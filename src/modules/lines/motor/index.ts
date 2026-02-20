/**
 * Motor Line Module
 * 电机产线模块定义
 */

import { LineModule } from '../types'

export const motorLine: LineModule = {
  key: 'motor',
  label: '电机产线',
  description: '电机质检相机 - 用于电机产品的拍照质检',
  cameraIds: [], // 电机产线的相机ID列表（待配置）
  defaultCameraId: undefined,
}
