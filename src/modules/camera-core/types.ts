/**
 * Camera Core Types
 * 通用相机模块的类型定义
 */

export interface CameraDevice {
  id: string
  name: string
  manufacturer?: string
  status?: 'online' | 'offline' | 'unknown'
  resolution?: string
}

export interface CameraError {
  code: 'NETWORK_ERROR' | 'NOT_FOUND' | 'SERVER_ERROR' | 'TIMEOUT' | 'UNKNOWN'
  message: string
  details?: string
  statusCode?: number
}

export interface SnapshotResult {
  success: boolean
  timestamp: number
  error?: CameraError
}

export interface CameraPreviewState {
  isLoading: boolean
  error: CameraError | null
  lastUpdate: number
  imageUrl: string | null
}
