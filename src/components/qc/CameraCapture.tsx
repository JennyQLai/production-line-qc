'use client';

/**
 * CameraCapture 组件
 * 
 * 2026-02-04 修改: 添加网络相机模式支持
 * - 新增 'network' 模式，支持边缘机海康威视工业相机
 * - 通过 /api/camera-proxy 代理转发视频流
 * - 支持从 MJPEG 流中截图
 * 
 * 2026-02-19 修改: 添加产线选择功能
 * - 网络相机模式支持产线选择（控制器/电机）
 * - 根据产线过滤相机列表
 * - 使用模块化 LINE_MODULES 配置
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ProgressIndicator from '../ui/ProgressIndicator';
import { edgeInferenceService } from '@/lib/services/edgeInferenceService';
import { LINE_MODULES } from '@/modules/lines';
import { listDevices, getLatestUrl } from '@/modules/camera-core/api';
import type { CameraDevice as NetworkCameraDevice } from '@/modules/camera-core/types';

interface CameraCaptureProps {
  onPhotoCapture: (photoBlob: Blob) => void;
  onCancel: () => void;
  jobId: string;
  selectedLineKey: string; // 从首页传入的产线选择
  defaultCameraId?: string; // 用户的默认相机设置
  uploadProgress?: number;
  uploadStatus?: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

export default function CameraCapture({ onPhotoCapture, onCancel, jobId, selectedLineKey, defaultCameraId, uploadProgress = 0, uploadStatus = 'idle' }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [previewOptimized, setPreviewOptimized] = useState(false);
  // 2026-02-04: 默认模式 - 生产环境优先使用网络相机
  const [mode, setMode] = useState<'camera' | 'upload' | 'network'>(() => {
    // 如果不支持本地相机，默认使用网络相机
    if (typeof window !== 'undefined' && !navigator?.mediaDevices?.getUserMedia) {
      return 'network';
    }
    return 'camera';
  });
  
  // 2026-02-04: 网络相机相关状态
  const [networkCameraAvailable, setNetworkCameraAvailable] = useState(false);
  const [networkCameraLoading, setNetworkCameraLoading] = useState(false);
  const [networkCameraError, setNetworkCameraError] = useState<string | null>(null);
  const [networkCameraUrl, setNetworkCameraUrl] = useState<string | null>(null);
  
  // 2026-02-19: 产线选择状态 - 从 props 接收，不再内部管理
  // const [selectedLineKey, setSelectedLineKey] = useState<string>(LINE_MODULES[0]?.key || 'controller');
  
  // 2026-02-19: 网络相机列表和选择
  const [networkCameras, setNetworkCameras] = useState<NetworkCameraDevice[]>([]);
  const [selectedNetworkCameraId, setSelectedNetworkCameraId] = useState<string | null>(null);
  const [networkCamerasLoading, setNetworkCamerasLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 2026-02-04: 网络相机图像引用
  const networkImageRef = useRef<HTMLImageElement>(null);

  // Get available camera devices (only for local camera mode)
  const getCameraDevices = useCallback(async () => {
    // 防护：检查 navigator.mediaDevices 是否可用
    if (!navigator?.mediaDevices?.enumerateDevices) {
      console.warn('navigator.mediaDevices.enumerateDevices not available');
      setError('当前环境不支持摄像头设备枚举（可能是非安全上下文或服务端渲染）');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `相机 ${device.deviceId.slice(0, 8)}`
        }));
      
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('获取摄像头设备失败:', err);
      setError('无法获取摄像头设备列表');
    }
  }, [selectedDeviceId]);

  // 2026-02-04: 检查网络相机是否可用
  const checkNetworkCamera = useCallback(async () => {
    setNetworkCameraLoading(true);
    setNetworkCameraError(null);
    
    try {
      const available = await edgeInferenceService.checkNetworkCameraAvailable();
      setNetworkCameraAvailable(available);
      
      if (available) {
        const videoUrl = edgeInferenceService.getVideoFeedUrl();
        setNetworkCameraUrl(videoUrl);
        console.log('📹 网络相机可用:', videoUrl);
      } else {
        setNetworkCameraError('边缘机相机不可用');
      }
    } catch (err) {
      console.error('检查网络相机失败:', err);
      setNetworkCameraAvailable(false);
      setNetworkCameraError(err instanceof Error ? err.message : '检查网络相机失败');
    } finally {
      setNetworkCameraLoading(false);
    }
  }, []);

  // 2026-02-19: 获取网络相机列表
  const fetchNetworkCameras = useCallback(async () => {
    setNetworkCamerasLoading(true);
    setNetworkCameraError(null);
    
    try {
      const cameras = await listDevices();
      setNetworkCameras(cameras);
      console.log('📹 获取到网络相机列表:', cameras);
      
      // 根据当前产线自动选择第一个可用相机
      const currentLine = LINE_MODULES.find(l => l.key === selectedLineKey);
      if (currentLine && currentLine.cameraIds.length > 0) {
        const availableCameras = cameras.filter(c => currentLine.cameraIds.includes(c.id));
        if (availableCameras.length > 0) {
          // 优先使用用户的默认相机设置
          let cameraToSelect = currentLine.defaultCameraId || availableCameras[0].id;
          
          // 如果传入了 defaultCameraId 且在可用相机列表中，使用它
          if (defaultCameraId && availableCameras.some(c => c.id === defaultCameraId)) {
            cameraToSelect = defaultCameraId;
          }
          
          setSelectedNetworkCameraId(cameraToSelect);
          // 更新预览URL
          const previewUrl = getLatestUrl(cameraToSelect);
          setNetworkCameraUrl(previewUrl);
          setNetworkCameraAvailable(true);
        } else {
          setNetworkCameraError('当前产线没有可用相机');
          setNetworkCameraAvailable(false);
        }
      } else {
        setNetworkCameraError('当前产线未配置相机');
        setNetworkCameraAvailable(false);
      }
    } catch (err) {
      console.error('获取网络相机列表失败:', err);
      setNetworkCameraError(err instanceof Error ? err.message : '获取相机列表失败');
      setNetworkCameraAvailable(false);
    } finally {
      setNetworkCamerasLoading(false);
    }
  }, [selectedLineKey]);

  // Start camera stream with optimizations (only for local camera mode)
  const startCamera = useCallback(async (deviceId?: string) => {
    // 防护：检查 navigator.mediaDevices 是否可用
    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn('navigator.mediaDevices.getUserMedia not available');
      setError('当前环境不支持摄像头访问（可能是非安全上下文或服务端渲染）');
      return;
    }

    try {
      setError(null);
      setPermissionDenied(false);
      setPreviewOptimized(false);

      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          facingMode: deviceId ? undefined : 'environment', // Prefer back camera on mobile
          frameRate: { ideal: 30, min: 15 },
          aspectRatio: { ideal: 16/9 }
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Optimize video element for better performance
        videoRef.current.onloadedmetadata = () => {
          setPreviewOptimized(true);
          // Auto-adjust video element size for better performance on mobile
          if (videoRef.current) {
            const video = videoRef.current;
            const aspectRatio = video.videoWidth / video.videoHeight;
            
            // Optimize for mobile screens
            if (window.innerWidth < 640) {
              video.style.maxHeight = '240px';
            } else {
              video.style.maxHeight = '400px';
            }
          }
        };
      }
    } catch (err: any) {
      console.error('启动相机失败:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError('相机权限被拒绝，请在浏览器设置中允许相机访问');
      } else if (err.name === 'NotFoundError') {
        setError('未找到可用的摄像头设备');
      } else if (err.name === 'NotReadableError') {
        setError('摄像头正在被其他应用使用');
      } else {
        setError('启动相机失败，请检查设备连接');
      }
    }
  }, [stream]);

  // Initialize camera on mount
  // 2026-02-04: 修复 - 生产环境不使用本地相机，只使用网络相机和上传模式
  useEffect(() => {
    if (mode === 'camera') {
      // 生产环境不支持本地相机，显示提示并切换到网络模式
      if (typeof window !== 'undefined' && !navigator?.mediaDevices?.getUserMedia) {
        console.warn('Local camera not supported in this environment, switching to network camera');
        setMode('network');
        return;
      }
      
      // 只有在支持的环境下才调用本地相机
      getCameraDevices().then(() => {
        if (devices.length > 0) {
          startCamera(selectedDeviceId);
        }
      });
    } else if (mode === 'network') {
      // 网络相机模式：停止本地相机并检查网络相机
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      checkNetworkCamera();
    } else if (mode === 'upload') {
      // 上传模式：停止本地相机流
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);
  
  // 初始化时检查网络相机可用性，并设置默认模式
  useEffect(() => {
    // 2026-02-19: 网络相机模式下获取相机列表
    if (mode === 'network') {
      fetchNetworkCameras();
    }
    
    // 如果当前是 camera 模式但不支持本地相机，切换到 network 模式
    if (mode === 'camera' && typeof window !== 'undefined' && !navigator?.mediaDevices?.getUserMedia) {
      console.log('Switching to network camera mode (local camera not supported)');
      setMode('network');
    }
  }, [mode, fetchNetworkCameras]);

  // 2026-02-19: 网络相机预览轮询刷新
  useEffect(() => {
    if (mode === 'network' && selectedNetworkCameraId && networkCameraAvailable && !capturedPhoto) {
      const intervalId = setInterval(() => {
        // 更新图片URL的时间戳以触发重新加载
        const newUrl = getLatestUrl(selectedNetworkCameraId);
        setNetworkCameraUrl(newUrl);
      }, 1000); // 每秒刷新一次

      return () => clearInterval(intervalId);
    }
  }, [mode, selectedNetworkCameraId, networkCameraAvailable, capturedPhoto]);

  // Handle device change
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  // 2026-02-19: 处理产线切换 - 移除，产线在首页选择
  // const handleLineChange = (lineKey: string) => { ... }

  // 2026-02-19: 处理网络相机切换
  const handleNetworkCameraChange = (cameraId: string) => {
    setSelectedNetworkCameraId(cameraId);
    // 更新预览URL
    const previewUrl = getLatestUrl(cameraId);
    setNetworkCameraUrl(previewUrl);
    setNetworkCameraAvailable(true);
    setNetworkCameraError(null);
    console.log('📹 切换到相机:', cameraId, previewUrl);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('图片文件大小不能超过10MB');
      return;
    }

    // Create preview URL
    const photoUrl = URL.createObjectURL(file);
    setCapturedPhoto(photoUrl);
    setError(null);

    // Store the file for later use
    (window as any).uploadedFile = file;
  };

  // Capture photo from camera with enhanced feedback
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    setCaptureFlash(true);
    
    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration
    }
    
    // Flash effect
    setTimeout(() => setCaptureFlash(false), 200);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('无法获取画布上下文');
      setIsCapturing(false);
      return;
    }

    // Set canvas size to match video with optimization
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    // Optimize canvas size for better performance while maintaining quality
    const maxWidth = 1920;
    const maxHeight = 1080;
    
    let canvasWidth = videoWidth;
    let canvasHeight = videoHeight;
    
    if (videoWidth > maxWidth || videoHeight > maxHeight) {
      const aspectRatio = videoWidth / videoHeight;
      if (videoWidth > videoHeight) {
        canvasWidth = maxWidth;
        canvasHeight = maxWidth / aspectRatio;
      } else {
        canvasHeight = maxHeight;
        canvasWidth = maxHeight * aspectRatio;
      }
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Apply image enhancement filters
    context.filter = 'contrast(1.1) brightness(1.05) saturate(1.1)';
    
    // Draw video frame to canvas with smooth scaling
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, 0, 0, canvasWidth, canvasHeight);

    // Convert to blob with optimized quality
    canvas.toBlob((blob) => {
      if (blob) {
        const photoUrl = URL.createObjectURL(blob);
        setCapturedPhoto(photoUrl);
        
        // Add success feedback
        setTimeout(() => {
          setIsCapturing(false);
        }, 300);
      } else {
        setError('拍照失败，请重试');
        setIsCapturing(false);
      }
    }, 'image/jpeg', 0.85); // Slightly higher quality for better results
  };

  // 2026-02-04: 从网络相机截图
  const captureNetworkPhoto = async () => {
    if (!networkImageRef.current || !canvasRef.current) {
      setError('网络相机未就绪');
      return;
    }

    setIsCapturing(true);
    setCaptureFlash(true);

    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // Flash effect
    setTimeout(() => setCaptureFlash(false), 200);

    try {
      const img = networkImageRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        setError('无法获取画布上下文');
        setIsCapturing(false);
        return;
      }

      // 设置 canvas 尺寸
      canvas.width = img.naturalWidth || 1920;
      canvas.height = img.naturalHeight || 1080;

      // 绘制网络相机图像到 canvas
      context.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 转换为 blob
      canvas.toBlob((blob) => {
        if (blob) {
          const photoUrl = URL.createObjectURL(blob);
          setCapturedPhoto(photoUrl);
          setTimeout(() => {
            setIsCapturing(false);
          }, 300);
        } else {
          setError('截图失败，请重试');
          setIsCapturing(false);
        }
      }, 'image/jpeg', 0.85);
    } catch (err) {
      console.error('网络相机截图失败:', err);
      setError('截图失败，请重试');
      setIsCapturing(false);
    }
  };

  // Confirm photo and submit
  // 2026-02-04: 添加 'network' 模式支持
  const confirmPhoto = () => {
    if ((mode === 'camera' || mode === 'network') && canvasRef.current) {
      // Camera/Network mode: get blob from canvas
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          onPhotoCapture(blob);
        }
      }, 'image/jpeg', 0.8);
    } else if (mode === 'upload') {
      // Upload mode: get file from window storage
      const file = (window as any).uploadedFile;
      if (file) {
        onPhotoCapture(file);
      }
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedPhoto(null);
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    // Clear uploaded file
    if ((window as any).uploadedFile) {
      delete (window as any).uploadedFile;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Switch mode
  // 2026-02-04: 添加 'network' 模式支持，处理生产环境不支持本地相机的情况
  const switchMode = (newMode: 'camera' | 'upload' | 'network') => {
    // 如果尝试切换到 camera 模式但不支持，切换到 network 模式
    if (newMode === 'camera' && typeof window !== 'undefined' && !navigator?.mediaDevices?.getUserMedia) {
      console.warn('Local camera not supported, switching to network camera');
      newMode = 'network';
    }

    setMode(newMode);
    setCapturedPhoto(null);
    setError(null);
    
    // 切换模式时，先停止本地相机
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (newMode === 'upload') {
      // 上传模式不需要额外操作
    } else if (newMode === 'network') {
      // 网络相机模式 - 检查网络相机可用性
      checkNetworkCamera();
    } else if (newMode === 'camera') {
      // 本地相机模式 - 只在支持的环境下启动
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        getCameraDevices().then(() => {
          if (devices.length > 0) {
            startCamera(selectedDeviceId);
          }
        });
      }
    }
  };

  // Request permission
  const requestPermission = () => {
    startCamera(selectedDeviceId);
  };

  if (permissionDenied && mode === 'camera') {
    return (
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mb-4">
            <svg className="mx-auto h-10 sm:h-12 w-10 sm:w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">需要相机权限</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">请允许访问相机以进行拍照质检</p>
          <div className="space-y-3">
            <button
              onClick={requestPermission}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
            >
              重新请求权限
            </button>
            <button
              onClick={() => switchMode('upload')}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors touch-manipulation"
            >
              改用本地上传
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors touch-manipulation"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && mode === 'camera') {
    return (
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mb-4">
            <svg className="mx-auto h-10 sm:h-12 w-10 sm:w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">相机错误</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => startCamera(selectedDeviceId)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
            >
              重试
            </button>
            <button
              onClick={() => switchMode('upload')}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors touch-manipulation"
            >
              改用本地上传
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors touch-manipulation"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">拍摄产品照片</h2>
        <p className="text-sm sm:text-base text-gray-600">Job ID: {jobId}</p>
      </div>

      {/* Mode selector */}
      <div className="flex justify-center mb-4">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => switchMode('camera')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors touch-manipulation ${
              mode === 'camera'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">相机拍照</span>
            <span className="sm:hidden">拍照</span>
          </button>
          <button
            onClick={() => switchMode('upload')}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors touch-manipulation ${
              mode === 'upload'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="hidden sm:inline">本地上传</span>
            <span className="sm:hidden">上传</span>
          </button>
          {/* 2026-02-04: 添加网络相机模式按钮 */}
          <button
            onClick={() => switchMode('network')}
            disabled={networkCameraLoading}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors touch-manipulation ${
              mode === 'network'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            } ${networkCameraLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">网络相机</span>
            <span className="sm:hidden">网络</span>
            {/* 状态指示器 */}
            {networkCameraLoading && (
              <span className="ml-1 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            )}
            {!networkCameraLoading && networkCameraAvailable && (
              <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            )}
            {!networkCameraLoading && !networkCameraAvailable && (
              <span className="ml-1 inline-block w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {/* Camera device selector */}
      {mode === 'camera' && devices.length > 1 && !capturedPhoto && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择摄像头
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2026-02-19: 产线选择器 - 移除，在首页选择 */}
      {/* 网络相机模式下只显示相机选择器 */}
      {mode === 'network' && !capturedPhoto && (
        <>
          {/* 显示当前产线信息 */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  当前产线: {LINE_MODULES.find(l => l.key === selectedLineKey)?.label}
                </p>
                {LINE_MODULES.find(l => l.key === selectedLineKey)?.description && (
                  <p className="text-xs text-blue-700 mt-0.5">
                    {LINE_MODULES.find(l => l.key === selectedLineKey)?.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2026-02-19: 相机选择器（根据产线过滤） */}
          {(() => {
            const currentLine = LINE_MODULES.find(l => l.key === selectedLineKey);
            const filteredCameras = currentLine && currentLine.cameraIds.length > 0
              ? networkCameras.filter(c => currentLine.cameraIds.includes(c.id))
              : [];

            if (networkCamerasLoading) {
              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">加载相机列表...</p>
                </div>
              );
            }

            if (currentLine && currentLine.cameraIds.length === 0) {
              return (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">⚠️ 当前产线未配置相机</p>
                </div>
              );
            }

            if (filteredCameras.length === 0) {
              return (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">❌ 当前产线没有可用相机</p>
                </div>
              );
            }

            return (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择相机
                </label>
                <select
                  value={selectedNetworkCameraId || ''}
                  onChange={(e) => handleNetworkCameraChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {filteredCameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name || camera.id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  当前产线共 {filteredCameras.length} 个可用相机
                </p>
              </div>
            );
          })()}
        </>
      )}

      {/* File upload input */}
      {mode === 'upload' && !capturedPhoto && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择图片文件
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            支持 JPG、PNG 等图片格式，最大 10MB
          </p>
        </div>
      )}

      {/* Error display for upload mode */}
      {error && mode === 'upload' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Camera preview or uploaded photo */}
      <div className="relative mb-4 bg-black rounded-lg overflow-hidden">
        {capturedPhoto ? (
          <div className="relative">
            <img
              src={capturedPhoto}
              alt="拍摄的照片"
              className="w-full h-auto max-h-64 sm:max-h-96 object-contain animate-scale-in"
            />
            {/* Success overlay */}
            <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-2 animate-bounce">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : mode === 'camera' ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-auto max-h-64 sm:max-h-96 object-contain transition-all duration-500 ${
                previewOptimized ? 'opacity-100 scale-100' : 'opacity-70 scale-95'
              }`}
              style={{
                filter: previewOptimized ? 'none' : 'blur(1px)',
              }}
            />
            
            {/* Camera overlay guides */}
            {previewOptimized && !isCapturing && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Center focus guide */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white border-opacity-50 rounded-lg animate-pulse">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                </div>
                
                {/* Instructions */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                  将产品对准中心框内
                </div>
              </div>
            )}
            
            {/* Flash effect */}
            {captureFlash && (
              <div className="absolute inset-0 bg-white animate-ping opacity-80"></div>
            )}
            
            {/* Loading overlay with enhanced animation */}
            {isCapturing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-white text-base sm:text-lg flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  <span className="animate-pulse">拍照中...</span>
                </div>
              </div>
            )}
            
            {/* Camera not ready overlay */}
            {!previewOptimized && stream && (
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                <div className="text-white text-sm flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  相机准备中...
                </div>
              </div>
            )}
          </div>
        ) : mode === 'network' ? (
          /* 2026-02-04: 网络相机视频流显示 */
          <div className="relative">
            {networkCameraLoading ? (
              <div className="w-full h-48 sm:h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">连接网络相机中...</p>
                </div>
              </div>
            ) : networkCameraError ? (
              <div className="w-full h-48 sm:h-64 flex items-center justify-center bg-red-50 rounded-lg">
                <div className="text-center">
                  <svg className="mx-auto h-10 w-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-600 text-sm mb-2">{networkCameraError}</p>
                  <button
                    onClick={checkNetworkCamera}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    重新连接
                  </button>
                </div>
              </div>
            ) : networkCameraAvailable && networkCameraUrl && selectedNetworkCameraId ? (
              <>
                <img
                  ref={networkImageRef}
                  src={networkCameraUrl}
                  alt="网络相机画面"
                  className="w-full h-auto max-h-64 sm:max-h-96 object-contain bg-black rounded-lg"
                  crossOrigin="anonymous"
                  onError={() => {
                    setNetworkCameraError('图片加载失败');
                    setNetworkCameraAvailable(false);
                  }}
                />
                {/* 网络相机状态指示器 */}
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
                  {networkCameras.find(c => c.id === selectedNetworkCameraId)?.name || selectedNetworkCameraId}
                </div>
                {/* Flash effect */}
                {captureFlash && (
                  <div className="absolute inset-0 bg-white animate-ping opacity-80"></div>
                )}
                {/* Loading overlay */}
                {isCapturing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-base sm:text-lg flex items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      <span className="animate-pulse">截图中...</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-48 sm:h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-center text-gray-400">
                  <svg className="mx-auto h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">网络相机不可用</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-48 sm:h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="mx-auto h-8 sm:h-12 w-8 sm:w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm sm:text-base">请选择图片文件</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {uploadStatus !== 'idle' && (
        <div className="mb-4">
          <ProgressIndicator
            progress={uploadProgress}
            status={uploadStatus}
            animated={true}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {capturedPhoto ? (
          <>
            {/* 2026-02-04: 更新按钮文本支持网络模式 */}
            <button
              onClick={retakePhoto}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              className="flex-1 bg-gray-300 text-gray-700 py-4 sm:py-3 px-4 rounded-lg font-medium hover:bg-gray-400 transition-colors touch-manipulation text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              重新{mode === 'camera' ? '拍照' : mode === 'network' ? '截图' : '选择'}
            </button>
            <button
              onClick={confirmPhoto}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              className="flex-1 bg-green-600 text-white py-4 sm:py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors touch-manipulation text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
            >
              {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {uploadStatus === 'uploading' ? '上传中...' : '处理中...'}
                </div>
              ) : (
                '确认上传'
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onCancel}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              className="flex-1 bg-gray-300 text-gray-700 py-4 sm:py-3 px-4 rounded-lg font-medium hover:bg-gray-400 transition-colors touch-manipulation text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            {/* 2026-02-04: 添加网络模式截图按钮 */}
            {mode === 'camera' ? (
              <button
                onClick={capturePhoto}
                disabled={!stream || isCapturing || !previewOptimized || uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="flex-1 bg-blue-600 text-white py-4 sm:py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation text-base sm:text-sm relative overflow-hidden transform hover:scale-105 active:scale-95"
              >
                {isCapturing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span className="animate-pulse">拍照中...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    拍照
                    {/* Pulse effect for ready state */}
                    {previewOptimized && !isCapturing && (
                      <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity duration-200"></div>
                    )}
                  </>
                )}
              </button>
            ) : mode === 'network' ? (
              <button
                onClick={captureNetworkPhoto}
                disabled={!networkCameraAvailable || isCapturing || uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="flex-1 bg-blue-600 text-white py-4 sm:py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation text-base sm:text-sm relative overflow-hidden transform hover:scale-105 active:scale-95"
              >
                {isCapturing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span className="animate-pulse">截图中...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    截图
                    {networkCameraAvailable && !isCapturing && (
                      <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity duration-200"></div>
                    )}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="flex-1 bg-blue-600 text-white py-4 sm:py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors touch-manipulation text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                选择图片
              </button>
            )}
          </>
        )}
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}