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
    
    // 获取 OIDC discovery 配置
    const discovery = await getOIDCDiscovery()
    
    console.log('Token endpoint:', discovery.token_endpoint)
    
    // 使用 discovery 返回的 token_endpoint 交换授权码
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: OIDC_SERVER_CONFIG.clientId,
        client_secret: OIDC_SERVER_CONFIG.clientSecret,
        code_verifier: codeVerifier,
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.json(
        { error: 'Token exchange failed', details: errorText },
        { status: tokenResponse.status }
      )
    }
    
    const tokens = await tokenResponse.json()
    
    console.log('Userinfo endpoint:', discovery.userinfo_endpoint)
    
    // 使用 discovery 返回的 userinfo_endpoint 获取用户信息
    const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })
    
    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      console.error('Userinfo fetch failed:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch user info', details: errorText },
        { status: userInfoResponse.status }
      )
    }
    
    const userInfo = await userInfoResponse.json()
    
    console.log('OIDC login successful:', userInfo.email || userInfo.sub)
    
    // 返回 tokens 和 userInfo
    return NextResponse.json({
      tokens,
      userInfo,
    })
  } catch (error) {
    console.error('OIDC exchange error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
