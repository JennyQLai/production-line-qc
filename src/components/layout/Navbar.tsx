'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { User, ChevronDown, LogOut } from 'lucide-react'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (!user || !profile) return null

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">产线质检系统</h1>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900">{user.email}</div>
              <div className="text-xs text-gray-500">工号: {profile.id.slice(-8)}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-900">{user.email}</div>
                <div className="text-xs text-gray-500">工号: {profile.id.slice(-8)}</div>
                <div className="text-xs text-gray-500">角色: {profile.role === 'worker' ? '操作员' : profile.role === 'admin' ? '管理员' : '主管'}</div>
                {profile.station && (
                  <div className="text-xs text-gray-500">工位: {profile.station}</div>
                )}
              </div>
              
              <button
                onClick={() => {
                  setIsDropdownOpen(false)
                  console.log('Navigate to profile')
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <User className="w-4 h-4" />
                <span>个人资料</span>
              </button>
              
              <button
                onClick={() => {
                  setIsDropdownOpen(false)
                  signOut()
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </nav>
  )
}