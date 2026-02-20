/**
 * Line Registry
 * 产线模块注册表 - 集中管理所有产线模块
 */

import { LineModule } from './types'
import { controllerLine } from './controller'
import { motorLine } from './motor'

/**
 * 所有已注册的产线模块
 * 新增产线时，只需在此数组中添加新的 LineModule
 */
export const LINE_MODULES: LineModule[] = [
  controllerLine,
  motorLine,
]

/**
 * 根据 key 获取产线模块
 */
export function getLineModule(key: string): LineModule | undefined {
  return LINE_MODULES.find(line => line.key === key)
}

/**
 * 获取所有产线的 keys
 */
export function getLineKeys(): string[] {
  return LINE_MODULES.map(line => line.key)
}
