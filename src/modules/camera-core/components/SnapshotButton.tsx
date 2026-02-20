/**
 * SnapshotButton Component
 * 抓拍按钮
 */

'use client'

import { useState } from 'react'
import { snapshot } from '../api'

interface SnapshotButtonProps {
  cameraId: string | null
  onSuccess?: () => void
  onError?: (error: string) => void
  disabled?: boolean
  className?: string
}

export function SnapshotButton({
  cameraId,
  onSuccess,
  onError,
  disabled = false,
  className = '',
}: SnapshotButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleSnapshot = async () => {
    if (!cameraId || loading) return

    setLoading(true)
    
    try {
      const result = await snapshot(cameraId)
      
      if (result.success) {
        onSuccess?.()
      } else {
        onError?.(result.error?.message || '抓拍失败')
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '抓拍失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSnapshot}
      disabled={!cameraId || disabled || loading}
      className={`flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          抓拍中...
        </>
      ) : (
        <>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          抓拍
        </>
      )}
    </button>
  )
}
