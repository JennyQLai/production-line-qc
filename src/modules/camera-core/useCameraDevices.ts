/**
 * useCameraDevices Hook
 * 获取和管理相机设备列表
 */

import { useState, useEffect, useCallback } from 'react'
import { listDevices } from './api'
import { CameraDevice, CameraError } from './types'

export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CameraError | null>(null)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const deviceList = await listDevices()
      setDevices(deviceList)
    } catch (err) {
      setError(err as CameraError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
  }
}
