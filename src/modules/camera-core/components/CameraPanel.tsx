/**
 * CameraPanel Component
 * 通用相机面板 - 集成选择器、预览和抓拍功能
 */

'use client'

import { useState, useEffect } from 'react'
import { useCameraDevices } from '../useCameraDevices'
import { CameraSelector } from './CameraSelector'
import { CameraPreview } from './CameraPreview'
import { SnapshotButton } from './SnapshotButton'
import { StatusBanner } from './StatusBanner'
import { CameraDevice } from '../types'

interface CameraPanelProps {
  title?: string
  description?: string
  allowedCameraIds?: string[]
  defaultCameraId?: string
  intervalMs?: number
  onSnapshotSuccess?: (cameraId: string) => void
  className?: string
}

export function CameraPanel({
  title = '相机控制',
  description,
  allowedCameraIds,
  defaultCameraId,
  intervalMs = 1000,
  onSnapshotSuccess,
  className = '',
}: CameraPanelProps) {
  const { devices, loading, error: devicesError, refetch } = useCameraDevices()
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string, details?: string } | null>(null)

  // Filter devices based on allowed IDs
  const filteredDevices = allowedCameraIds && allowedCameraIds.length > 0
    ? devices.filter(d => allowedCameraIds.includes(d.id))
    : devices

  // Auto-select default camera or first available
  useEffect(() => {
    if (filteredDevices.length === 0) return

    if (defaultCameraId && filteredDevices.some(d => d.id === defaultCameraId)) {
      setSelectedCameraId(defaultCameraId)
    } else if (!selectedCameraId) {
      setSelectedCameraId(filteredDevices[0].id)
    }
  }, [filteredDevices, defaultCameraId, selectedCameraId])

  const handleSnapshotSuccess = () => {
    setStatusMessage({
      type: 'success',
      message: '抓拍成功',
      details: `相机 ${selectedCameraId} 已完成抓拍`,
    })
    
    onSnapshotSuccess?.(selectedCameraId!)
    
    // Auto-dismiss success message
    setTimeout(() => setStatusMessage(null), 3000)
  }

  const handleSnapshotError = (errorMsg: string) => {
    setStatusMessage({
      type: 'error',
      message: '抓拍失败',
      details: errorMsg,
    })
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
      </div>

      {/* Devices Error */}
      {devicesError && (
        <StatusBanner
          type="error"
          message="无法加载相机列表"
          details={devicesError.message}
          onClose={() => refetch()}
          className="mb-4"
        />
      )}

      {/* No devices available */}
      {!loading && filteredDevices.length === 0 && !devicesError && (
        <StatusBanner
          type="warning"
          message="暂无可用相机"
          details={allowedCameraIds ? "当前产线未配置相机或相机离线" : "请检查相机连接状态"}
          className="mb-4"
        />
      )}

      {/* Status Message */}
      {statusMessage && (
        <StatusBanner
          type={statusMessage.type}
          message={statusMessage.message}
          details={statusMessage.details}
          onClose={() => setStatusMessage(null)}
          className="mb-4"
        />
      )}

      {/* Camera Selector */}
      <CameraSelector
        devices={filteredDevices}
        selectedId={selectedCameraId}
        onSelect={setSelectedCameraId}
        loading={loading}
        className="mb-6"
      />

      {/* Camera Preview */}
      <CameraPreview
        cameraId={selectedCameraId}
        intervalMs={intervalMs}
        enabled={!!selectedCameraId}
        className="mb-6"
      />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {selectedCameraId ? (
            <span>当前相机: <span className="font-mono font-medium">{selectedCameraId}</span></span>
          ) : (
            <span>未选择相机</span>
          )}
        </div>
        
        <SnapshotButton
          cameraId={selectedCameraId}
          onSuccess={handleSnapshotSuccess}
          onError={handleSnapshotError}
        />
      </div>
    </div>
  )
}
