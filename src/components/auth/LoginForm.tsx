'use client'

import { useState } from 'react'
import { useAuthActions } from '@/lib/auth/hooks'
import { initiateOIDCLogin } from '@/lib/auth/oidcService'

interface LoginFormProps {
  onSuccess?: () => void
  className?: string
}

export function LoginForm({ onSuccess, className = '' }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [message, setMessage] = useState<string | null>(null)

  const { signIn, signUp, signInWithMagicLink } = useAuthActions()

  // OIDC 登录函数
  const handleOIDCLogin = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // 直接调用自定义 OIDC 登录服务
      await initiateOIDCLogin()
      // 函数会重定向到 OIDC 提供商，不会返回到这里
    } catch (err) {
      console.error('OIDC login error:', err)
      setError('企业登录失败，请重试')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      let result
      
      if (mode === 'signin') {
        result = await signIn(email, password)
      } else if (mode === 'signup') {
        result = await signUp(email, password)
      } else {
        result = await signInWithMagicLink(email)
        if (!result.error) {
          setMessage('Check your email for the login link!')
        }
      }

      if (result.error) {
        setError(result.error.message)
      } else if (mode !== 'magic') {
        onSuccess?.()
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            邮箱地址
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="输入您的邮箱"
          />
        </div>

        {mode !== 'magic' && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入您的密码"
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        {message && (
          <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '处理中...' : 
           mode === 'signin' ? '登录' :
           mode === 'signup' ? '注册' : '发送登录链接'}
        </button>

        {/* OIDC 企业登录 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">或使用企业账户登录</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOIDCLogin}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          使用企业 OIDC 登录
        </button>

        <div className="flex justify-center space-x-4 text-sm">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`${mode === 'signin' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`${mode === 'signup' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            注册
          </button>
          <button
            type="button"
            onClick={() => setMode('magic')}
            className={`${mode === 'magic' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            魔法链接
          </button>
        </div>
      </form>
    </div>
  )
}