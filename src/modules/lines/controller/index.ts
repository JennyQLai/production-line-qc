/**
 * Controller Line Module
 * 控制器产线模块定义
 */

import { LineModule } from '../types'

export const controllerLine: LineModule = {
  key: 'controller',
  label: '控制器产线',
  description: '控制器质检相机 - 用于控制器产品的拍照质检',
  cameraIds: ['DA8076792'], // 控制器产线的相机ID列表
  defaultCameraId: 'DA8076792',
}
