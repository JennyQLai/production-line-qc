/**
 * Line Module Types
 * 产线模块类型定义
 */

export interface LineModule {
  key: string
  label: string
  description?: string
  cameraIds: string[]
  defaultCameraId?: string
}
