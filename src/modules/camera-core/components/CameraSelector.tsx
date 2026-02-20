/**
 * CameraSelector Component
 * 相机选择器
 */

'use client'

import { CameraDevice } from '../types'

interface CameraSelectorProps {
  devices: CameraDevice[]
  selectedId: string | null
  onSelect: (deviceId: string) => void
  loading?: boolean
  disabled?: boolean
  className?: string
}

export function CameraSelector({
  devices,
  selectedId,
  onSelect,
  loading = false,
  disabled = false,
  className = '',
}: CameraSelectorProps) {
  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">加载相机列表...</span>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        暂无可用相机
      </div>
    )
  }

  return (
    <div className={className}>
      <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
        选择相机
      </label>
      <select
        id="camera-select"
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">请选择相机</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name} {device.id && `(${device.id})`}
          </option>
        ))}
      </select>
    </div>
  )
}
