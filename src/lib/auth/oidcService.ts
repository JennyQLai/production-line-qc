/**
 * 自定义 OIDC 登录服务
 * 直接与企业 OIDC 服务器通信，不依赖 Supabase third-party auth
 */

// OIDC 配置
const OIDC_CONFIG = {
  issuer: 'https://221.226.60.30:5001/webman/sso',
  clientId: 'fd1297925826a23aed846c170a33fcbc',
  clientSecret: 'REGRxUmocD8eIeGnULJtysKWPi3WW8LT',
  scopes: 'openid profile email',
  // 根据环境自动选择回调 URL
  get redirectUri() {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/auth/callback`
  }
}

/**
 * 生成随机字符串用于 state 和 nonce
 */
function generateRandomString(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length]
  }
  
  return result
}

/**
 * 生成 PKCE code verifier 和 challenge
 */
async function generatePKCE() {
  const verifier = generateRandomString(128)
  
  // 生成 code_challenge (SHA-256 hash of verifier, base64url encoded)
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  
  // Base64url encode
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  return { verifier, challenge }
}

/**
 * 启动 OIDC 登录流程
 * 重定向到 OIDC 提供商的授权页面
 */
export async function initiateOIDCLogin() {
  try {
    // 生成 state 和 nonce 用于安全验证
    const state = generateRandomString()
    const nonce = generateRandomString()
    
    // 生成 PKCE
    const { verifier, challenge } = await generatePKCE()
    
    // 保存到 sessionStorage，回调时验证
    sessionStorage.setItem('oidc_state', state)
    sessionStorage.setItem('oidc_nonce', nonce)
    sessionStorage.setItem('oidc_code_verifier', verifier)
    
    // 构建授权 URL
    const authUrl = new URL(`${OIDC_CONFIG.issuer}/authorize`)
    authUrl.searchParams.set('client_id', OIDC_CONFIG.clientId)
    authUrl.searchParams.set('redirect_uri', OIDC_CONFIG.redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', OIDC_CONFIG.scopes)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('nonce', nonce)
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    
    // 重定向到 OIDC 提供商
    window.location.href = authUrl.toString()
  } catch (error) {
    console.error('Failed to initiate OIDC login:', error)
    throw new Error('无法启动企业登录，请重试')
  }
}

/**
 * 处理 OIDC 回调
 * 交换授权码获取 token
 */
export async function handleOIDCCallback(code: string, state: string) {
  try {
    // 验证 state
    const savedState = sessionStorage.getItem('oidc_state')
    if (!savedState || savedState !== state) {
      throw new Error('Invalid state parameter')
    }
    
    // 获取 code verifier
    const codeVerifier = sessionStorage.getItem('oidc_code_verifier')
    if (!codeVerifier) {
      throw new Error('Missing code verifier')
    }
    
    // 交换授权码获取 token
    const tokenResponse = await fetch(`${OIDC_CONFIG.issuer}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: OIDC_CONFIG.redirectUri,
        client_id: OIDC_CONFIG.clientId,
        client_secret: OIDC_CONFIG.clientSecret,
        code_verifier: codeVerifier,
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('Token exchange failed:', errorData)
      throw new Error('Failed to exchange authorization code')
    }
    
    const tokens = await tokenResponse.json()
    
    // 获取用户信息
    const userInfoResponse = await fetch(`${OIDC_CONFIG.issuer}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })
    
    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info')
    }
    
    const userInfo = await userInfoResponse.json()
    
    // 清理 session storage
    sessionStorage.removeItem('oidc_state')
    sessionStorage.removeItem('oidc_nonce')
    sessionStorage.removeItem('oidc_code_verifier')
    
    return {
      tokens,
      userInfo,
    }
  } catch (error) {
    console.error('OIDC callback error:', error)
    throw error
  }
}

/**
 * 使用 OIDC token 登录到 Supabase
 */
export async function signInWithOIDCToken(idToken: string, userInfo: any) {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  
  try {
    // 使用 OIDC 用户信息创建或更新 Supabase 用户
    // 这里我们使用 email/password 方式，但使用 OIDC 的用户信息
    
    // 首先尝试用 email 登录（如果用户已存在）
    const { data: existingUser, error: signInError } = await supabase.auth.signInWithPassword({
      email: userInfo.email,
      password: idToken.substring(0, 72), // 使用 token 的一部分作为密码
    })
    
    if (!signInError && existingUser) {
      return { user: existingUser.user, session: existingUser.session }
    }
    
    // 如果用户不存在，创建新用户
    const { data: newUser, error: signUpError } = await supabase.auth.signUp({
      email: userInfo.email,
      password: idToken.substring(0, 72),
      options: {
        data: {
          name: userInfo.name || userInfo.preferred_username,
          oidc_sub: userInfo.sub,
          oidc_provider: 'enterprise',
        },
      },
    })
    
    if (signUpError) {
      throw signUpError
    }
    
    return { user: newUser.user, session: newUser.session }
  } catch (error) {
    console.error('Failed to sign in with OIDC token:', error)
    throw error
  }
}
