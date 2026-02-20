/**
 * Cameras Management Page
 * 相机管理页面 - 支持多产线切换
 */

'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { CameraPanel } from '@/modules/camera-core'
import { LINE_MODULES } from '@/modules/lines'

export default function CamerasPage() {
  const [activeLineKey, setActiveLineKey] = useState(LINE_MODULES[0]?.key || 'controller')
  
  const activeLine = LINE_MODULES.find(l => l.key === activeLineKey)
  
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">相机管理</h1>
            <p className="text-gray-600">管理和监控各产线的网络相机</p>
          </div>

          {/* Line Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="产线切换">
                {LINE_MODULES.map(line => (
                  <button
                    key={line.key}
                    onClick={() => setActiveLineKey(line.key)}
                    className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                      transition-colors duration-200
                      ${
                        activeLineKey === line.key
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                    aria-current={activeLineKey === line.key ? 'page' : undefined}
                  >
                    {line.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Camera Panel */}
          {activeLine && (
            <CameraPanel
              title={activeLine.label}
              description={activeLine.description}
              allowedCameraIds={activeLine.cameraIds}
              defaultCameraId={activeLine.defaultCameraId}
              intervalMs={1000}
              onSnapshotSuccess={(cameraId) => {
                console.log(`✅ Snapshot success for camera: ${cameraId}`)
              }}
            />
          )}

          {!activeLine && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-500 text-center">未找到产线配置</p>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  )
}
