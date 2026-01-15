import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { handleOIDCCallback, signInWithOIDCToken } from '@/lib/auth/oidcService'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    // 检查是否是 OIDC 回调（有 state 参数）
    if (state) {
      try {
        // 处理 OIDC 回调
        const { tokens, userInfo } = await handleOIDCCallback(code, state)
        
        // 使用 OIDC token 登录到 Supabase
        await signInWithOIDCToken(tokens.id_token, userInfo)
        
        // 重定向到首页
        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'
        
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`)
        } else {
          return NextResponse.redirect(`${origin}${next}`)
        }
      } catch (error) {
        console.error('OIDC callback error:', error)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=oidc_callback_failed`)
      }
    } else {
      // 标准 Supabase 回调（email/password 登录）
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error) {
        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'
        
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`)
        } else {
          return NextResponse.redirect(`${origin}${next}`)
        }
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}