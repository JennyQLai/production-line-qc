/**
 * Camera Core API
 * 通用相机API调用封装
 */

import { CameraDevice, CameraError, SnapshotResult } from './types'

const CAMERA_PROXY_BASE = '/api/camera-proxy'

/**
 * 获取相机设备列表
 */
export async function listDevices(): Promise<CameraDevice[]> {
  try {
    const response = await fetch(`${CAMERA_PROXY_BASE}?endpoint=devices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw createError(response.status, 'Failed to fetch camera devices')
    }

    const data = await response.json()
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data
    } else if (data.devices && Array.isArray(data.devices)) {
      return data.devices
    }
    
    return []
  } catch (error) {
    console.error('❌ List devices error:', error)
    throw normalizeError(error)
  }
}

/**
 * 触发相机抓拍
 */
export async function snapshot(cameraId: string): Promise<SnapshotResult> {
  try {
    const response = await fetch(`${CAMERA_PROXY_BASE}?endpoint=snapshot&camera_id=${cameraId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw createError(response.status, 'Snapshot failed', errorData.detail || errorData.error)
    }

    return {
      success: true,
      timestamp: Date.now(),
    }
  } catch (error) {
    console.error('❌ Snapshot error:', error)
    return {
      success: false,
      timestamp: Date.now(),
      error: normalizeError(error),
    }
  }
}

/**
 * 获取最新图片的URL（用于轮询预览）
 */
export function getLatestUrl(cameraId: string): string {
  const timestamp = Date.now()
  return `${CAMERA_PROXY_BASE}?endpoint=latest&camera_id=${cameraId}&t=${timestamp}`
}

/**
 * 创建标准化错误对象
 */
function createError(statusCode: number, message: string, details?: string): CameraError {
  let code: CameraError['code'] = 'UNKNOWN'
  
  if (statusCode === 404) {
    code = 'NOT_FOUND'
  } else if (statusCode >= 500) {
    code = 'SERVER_ERROR'
  } else if (statusCode === 408 || statusCode === 504) {
    code = 'TIMEOUT'
  }

  return {
    code,
    message,
    details,
    statusCode,
  }
}

/**
 * 标准化错误对象
 */
function normalizeError(error: unknown): CameraError {
  if (error && typeof error === 'object' && 'code' in error) {
    return error as CameraError
  }

  if (error instanceof Error) {
    return {
      code: error.name === 'TypeError' ? 'NETWORK_ERROR' : 'UNKNOWN',
      message: error.message,
    }
  }

  return {
    code: 'UNKNOWN',
    message: String(error),
  }
}
