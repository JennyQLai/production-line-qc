/**
 * useCameraPreview Hook
 * 轮询相机最新图片进行预览
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getLatestUrl } from './api'
import { CameraPreviewState } from './types'

interface UseCameraPreviewOptions {
  cameraId: string | null
  intervalMs?: number
  enabled?: boolean
}

export function useCameraPreview({ 
  cameraId, 
  intervalMs = 1000,
  enabled = true 
}: UseCameraPreviewOptions) {
  const [state, setState] = useState<CameraPreviewState>({
    isLoading: true,
    error: null,
    lastUpdate: 0,
    imageUrl: null,
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const updatePreview = useCallback(() => {
    if (!cameraId || !enabled) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        imageUrl: null,
      }))
      return
    }

    const url = getLatestUrl(cameraId)
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      imageUrl: url,
      lastUpdate: Date.now(),
      error: null,
    }))
  }, [cameraId, enabled])

  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return
    
    setState(prev => ({
      ...prev,
      error: {
        code: 'NOT_FOUND',
        message: 'Failed to load camera image',
      },
    }))
  }, [])

  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return
    
    setState(prev => ({
      ...prev,
      error: null,
      isLoading: false,
    }))
  }, [])

  // Start/stop polling
  useEffect(() => {
    if (!cameraId || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial update
    updatePreview()

    // Start polling
    intervalRef.current = setInterval(updatePreview, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [cameraId, intervalMs, enabled, updatePreview])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    ...state,
    onImageError: handleImageError,
    onImageLoad: handleImageLoad,
    refresh: updatePreview,
  }
}
