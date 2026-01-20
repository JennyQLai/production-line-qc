import { NextRequest, NextResponse } from 'next/server'

/**
 * OIDC Token Exchange API
 * 服务端处理 token 交换，保护 client_secret
 */

// 服务端 OIDC 配置（从环境变量读取）
const OIDC_SERVER_CONFIG = {
  issuer: process.env.ENTERPRISE_OIDC_ISSUER || 'https://panovation.i234.me:5001/webman/sso',
  clientId: process.env.ENTERPRISE_OIDC_CLIENT_ID || 'fd1297925826a23aed846c170a33fcbc',
  clientSecret: process.env.ENTERPRISE_OIDC_CLIENT_SECRET || 'REGRxUmocD8eIeGnULJtysKWPi3WW8LT',
}

/**
 * 获取 OIDC Discovery 配置
 */
async function getOIDCDiscovery() {
  try {
    const response = await fetch(`${OIDC_SERVER_CONFIG.issuer}/.well-known/openid-configuration`, {
      cache: 'no-store'
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch OIDC discovery')
    }
    
    return await response.json()
  } catch (error) {
    console.error('OIDC discovery error:', error)
    throw new Error('Failed to get OIDC configuration')
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const { code, redirectUri, codeVerifier } = await request.json()
    
    if (!code || !redirectUri || !codeVerifier) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    console.log('🔍 OIDC Exchange Debug:')
    console.log('  - Code:', code.substring(0, 20) + '...')
    console.log('  - Redirect URI:', redirectUri)
    console.log('  - Code Verifier:', codeVerifier.substring(0, 20) + '...')
    
    // 获取 OIDC discovery 配置
    const discovery = await getOIDCDiscovery()
    
    console.log('📍 Token endpoint:', discovery.token_endpoint)
    
    // 使用 Basic Auth (client_secret_basic) 而不是 POST body
    const basic = Buffer.from(`${OIDC_SERVER_CONFIG.clientId}:${OIDC_SERVER_CONFIG.clientSecret}`).toString('base64')
    
    console.log('🔐 Using Basic Auth with client_id:', OIDC_SERVER_CONFIG.clientId)
    
    // 使用 discovery 返回的 token_endpoint 交换授权码
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        // 不再在 body 中传递 client_id 和 client_secret，使用 Basic Auth
      }),
    })
    
    // 🔍 详细日志 - IdP 原始响应
    const tokenText = await tokenResponse.text()
    console.log('📊 IdP token status:', tokenResponse.status)
    console.log('📊 IdP token headers:', Object.fromEntries(tokenResponse.headers.entries()))
    console.log('📊 IdP token raw body:', tokenText)
    
    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed with status:', tokenResponse.status)
      return NextResponse.json(
        { 
          error: 'Token exchange failed', 
          details: tokenText,
          status: tokenResponse.status,
          endpoint: discovery.token_endpoint
        },
        { status: tokenResponse.status }
      )
    }
    
    // 解析 tokens
    let tokens
    try {
      tokens = JSON.parse(tokenText)
      console.log('✅ Token exchange successful, got access_token:', tokens.access_token ? 'present' : 'missing')
    } catch (parseError) {
      console.error('❌ Failed to parse token response as JSON:', parseError)
      return NextResponse.json(
        { 
          error: 'Invalid token response format', 
          details: tokenText,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        },
        { status: 500 }
      )
    }
    
    console.log('📍 Userinfo endpoint:', discovery.userinfo_endpoint)
    
    // 使用 discovery 返回的 userinfo_endpoint 获取用户信息
    const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })
    
    // 🔍 详细日志 - UserInfo 响应
    const userInfoText = await userInfoResponse.text()
    console.log('📊 UserInfo status:', userInfoResponse.status)
    console.log('📊 UserInfo raw body:', userInfoText)
    
    if (!userInfoResponse.ok) {
      console.error('❌ UserInfo fetch failed with status:', userInfoResponse.status)
      return NextResponse.json(
        { 
          error: 'Failed to fetch user info', 
          details: userInfoText,
          status: userInfoResponse.status,
          endpoint: discovery.userinfo_endpoint
        },
        { status: userInfoResponse.status }
      )
    }
    
    // 解析 userInfo
    let userInfo
    try {
      userInfo = JSON.parse(userInfoText)
      console.log('✅ UserInfo fetch successful, user:', userInfo.email || userInfo.sub || 'unknown')
    } catch (parseError) {
      console.error('❌ Failed to parse userinfo response as JSON:', parseError)
      return NextResponse.json(
        { 
          error: 'Invalid userinfo response format', 
          details: userInfoText,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        },
        { status: 500 }
      )
    }
    
    console.log('🎉 OIDC login successful for user:', userInfo.email || userInfo.sub)
    
    // 返回 tokens 和 userInfo
    return NextResponse.json({
      tokens,
      userInfo,
    })
  } catch (error) {
    console.error('💥 OIDC exchange error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
