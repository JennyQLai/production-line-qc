/**
 * CameraPreview Component
 * 相机预览窗口（轮询模式）
 */

'use client'

import { useCameraPreview } from '../useCameraPreview'

interface CameraPreviewProps {
  cameraId: string | null
  intervalMs?: number
  enabled?: boolean
  className?: string
}

export function CameraPreview({
  cameraId,
  intervalMs = 1000,
  enabled = true,
  className = '',
}: CameraPreviewProps) {
  const { imageUrl, isLoading, error, onImageError, onImageLoad, lastUpdate } = useCameraPreview({
    cameraId,
    intervalMs,
    enabled,
  })

  if (!cameraId) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ minHeight: '300px' }}>
        <div className="text-center text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">请选择相机</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 rounded-lg border border-red-200 ${className}`} style={{ minHeight: '300px' }}>
        <div className="text-center text-red-600 p-4">
          <svg className="mx-auto h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium">{error.message}</p>
          {error.details && (
            <p className="text-xs mt-1 text-red-500">{error.details}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`} style={{ minHeight: '300px' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-10">
          <div className="text-white text-sm flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
            加载中...
          </div>
        </div>
      )}
      
      {imageUrl && (
        <>
          <img
            src={imageUrl}
            alt="Camera Preview"
            className="w-full h-auto object-contain"
            onError={onImageError}
            onLoad={onImageLoad}
            crossOrigin="anonymous"
          />
          
          {/* Status indicator */}
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
            <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
            实时预览
          </div>
          
          {/* Last update timestamp */}
          {lastUpdate > 0 && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              {new Date(lastUpdate).toLocaleTimeString('zh-CN')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
