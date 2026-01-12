'use client';

import { useState, useCallback } from 'react';
import { AuthGuard } from "@/components/auth";
import { ProfileDisplay } from "@/components/profile";
import { MockApiToggle } from "@/components/admin/MockApiConfig";
import TestPanel from "@/components/admin/TestPanel";
import BarcodeInput from '@/components/qc/BarcodeInput';
import CameraCapture from '@/components/qc/CameraCapture';
import ResultPanel from '@/components/qc/ResultPanel';
import { jobService, photoService, edgeApiService } from '@/lib/services';
import type { Database } from '@/lib/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];
type QCStep = 'barcode' | 'camera' | 'result';

export default function Home() {
  const isDemoMode = process.env.NEXT_PUBLIC_SUPABASE_URL === 'your_supabase_project_url' || 
                    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://demo.supabase.co';

  const [currentStep, setCurrentStep] = useState<QCStep>('barcode');
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [testBarcode, setTestBarcode] = useState<string>(''); // 新增：测试条形码状态

  // Handle barcode submission
  const handleBarcodeSubmit = useCallback(async (barcode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create new job
      const job = await jobService.createJob({ barcode });
      setCurrentJob(job);
      setCurrentStep('camera');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建任务失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle photo capture
  const handlePhotoCapture = useCallback(async (photoBlob: Blob) => {
    if (!currentJob) return;

    setIsLoading(true);
    setError(null);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Update job status to uploading
      await jobService.updateJob({
        id: currentJob.id,
        status: 'uploading'
      });

      // Upload photo with progress tracking
      const uploadResult = await photoService.uploadPhoto(
        {
          jobId: currentJob.id,
          photoBlob
        },
        (progressData) => {
          setUploadProgress(progressData.progress);
          console.log('Upload progress:', progressData);
        }
      );

      setUploadStatus('processing');
      setUploadProgress(100);

      // Call edge API for analysis
      await edgeApiService.processQualityCheck(
        currentJob.id,
        currentJob.barcode,
        uploadResult.publicUrl
      );

      // Start polling for results
      setIsPolling(true);
      const pollingResult = await jobService.pollJobStatus(
        currentJob.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
        }
      );

      setCurrentJob(pollingResult.job);
      setUploadStatus('completed');
      setCurrentStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
      setUploadStatus('error');
    } finally {
      setIsLoading(false);
      setIsPolling(false);
    }
  }, [currentJob]);

  // Handle camera cancel
  const handleCameraCancel = useCallback(() => {
    setCurrentStep('barcode');
    setCurrentJob(null);
  }, []);

  // Handle start next job
  const handleStartNext = useCallback(() => {
    setCurrentStep('barcode');
    setCurrentJob(null);
    setError(null);
    setUploadProgress(0);
    setUploadStatus('idle');
    setTestBarcode(''); // 清除测试条形码
  }, []);

  // Handle test barcode selection
  const handleTestBarcodeSelect = useCallback((barcode: string) => {
    setTestBarcode(barcode);
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-4 sm:py-8 px-4">
          {/* Demo Mode Banner */}
          {isDemoMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-800 font-medium text-sm sm:text-base">当前运行在演示模式</span>
                <a
                  href="/demo-info"
                  className="ml-auto text-blue-600 hover:text-blue-800 text-xs sm:text-sm underline"
                >
                  了解更多
                </a>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  产线拍照质检系统
                </h1>
                <ProfileDisplay />
              </div>
              <a
                href="/history"
                className="bg-green-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center touch-manipulation"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                历史记录
              </a>
            </div>
          </div>

          {/* Step indicator */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-center space-x-2 sm:space-x-4">
              <div className={`w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                currentStep === 'barcode' ? 'bg-blue-600 text-white' : 
                ['camera', 'result'].includes(currentStep) ? 'bg-green-600 text-white' : 
                'bg-gray-300 text-gray-600'
              }`}>
                1
              </div>
              <span className={`text-xs sm:text-sm ${currentStep === 'barcode' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                扫码
              </span>
              
              <div className={`w-8 sm:w-12 h-1 ${['camera', 'result'].includes(currentStep) ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              
              <div className={`w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                currentStep === 'camera' ? 'bg-blue-600 text-white' : 
                currentStep === 'result' ? 'bg-green-600 text-white' : 
                'bg-gray-300 text-gray-600'
              }`}>
                2
              </div>
              <span className={`text-xs sm:text-sm ${currentStep === 'camera' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                拍照
              </span>
              
              <div className={`w-8 sm:w-12 h-1 ${currentStep === 'result' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              
              <div className={`w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                currentStep === 'result' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                3
              </div>
              <span className={`text-xs sm:text-sm ${currentStep === 'result' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                结果
              </span>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 font-medium text-sm sm:text-base break-words">{error}</span>
              </div>
            </div>
          )}

          {/* Main QC Content */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            {currentStep === 'barcode' && (
              <BarcodeInput
                onBarcodeSubmit={handleBarcodeSubmit}
                isLoading={isLoading}
                autoFocus={true}
                initialBarcode={testBarcode}
              />
            )}

            {currentStep === 'camera' && currentJob && (
              <CameraCapture
                onPhotoCapture={handlePhotoCapture}
                onCancel={handleCameraCancel}
                jobId={currentJob.id}
                uploadProgress={uploadProgress}
                uploadStatus={uploadStatus}
              />
            )}

            {currentStep === 'result' && currentJob && (
              <ResultPanel
                job={currentJob}
                onStartNext={handleStartNext}
                isPolling={isPolling}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Mock API Configuration (only in demo mode) */}
      <MockApiToggle />
      
      {/* Test Panel (only in demo mode) */}
      {isDemoMode && (
        <TestPanel onSelectBarcode={handleTestBarcodeSelect} />
      )}
    </AuthGuard>
  );
}
