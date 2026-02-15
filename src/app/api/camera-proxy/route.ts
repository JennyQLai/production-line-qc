/**
 * Camera Proxy API
 * 相机代理 API - 用于转发网络相机请求，解决 CORS 问题
 * 
 * 2026-02-04: 新增网络相机代理支持
 * 2026-02-04: 修复 MJPEG 流透传问题 - 直接透传 upstream.body
 */

import { NextRequest, NextResponse } from 'next/server'

// 配置运行时为 nodejs，确保流式传输支持
export const runtime = 'nodejs'

const EDGE_API_BASE_URL = process.env.NEXT_PUBLIC_EDGE_API_BASE_URL || 'http://221.226.60.30:8000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'status'
  
  // Handle video feed with direct stream passthrough
  if (endpoint === 'video_feed') {
    return handleVideoFeed()
  }
  
  // Handle status endpoint - use /health on edge machine
  if (endpoint === 'status') {
    return handleHealthStatus()
  }
  
  // Handle devices endpoint with proper /api/camera prefix
  if (endpoint === 'devices') {
    return handleApiEndpoint(endpoint)
  }
  
  try {
    console.log(`🔄 Proxying camera request to: ${EDGE_API_BASE_URL}/${endpoint}`)
    
    const response = await fetch(`${EDGE_API_BASE_URL}/${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QC-System-Camera-Proxy/1.0',
      },
    })

    console.log(`✅ Camera proxy response: ${response.status} ${response.statusText}`)
    
    // 对于 JSON 响应
    const data = await response.text()
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.error('❌ Camera proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Camera proxy request failed', 
        details: error instanceof Error ? error.message : String(error),
        endpoint: endpoint,
        target_url: `${EDGE_API_BASE_URL}/${endpoint}`
      },
      { status: 500 }
    )
  }
}

/**
 * Handle health status endpoint
 * 边缘机的状态接口是 /health，不是 /api/status
 */
async function handleHealthStatus() {
  try {
    console.log(`📊 Checking edge machine health status: ${EDGE_API_BASE_URL}/health`)
    
    const response = await fetch(`${EDGE_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QC-System-Camera-Proxy/1.0',
      },
    })

    console.log(`✅ Health status response: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch health status`, status: response.status },
        { status: response.status }
      )
    }

    const data = await response.text()
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.error(`❌ Health status check failed:`, error)
    return NextResponse.json(
      { 
        error: `Health status check failed`, 
        details: error instanceof Error ? error.message : String(error),
        target_url: `${EDGE_API_BASE_URL}/health`
      },
      { status: 500 }
    )
  }
}

/**
 * Handle API endpoints (devices) with proper /api prefix
 * 处理需要 /api 前缀的端点，避免 404 错误
 */
async function handleApiEndpoint(endpoint: string) {
  try {
    // devices 端点需要 /api/camera/ 前缀
    const apiPath = '/api/camera/devices'
    
    console.log(`📊 Proxying API request to: ${EDGE_API_BASE_URL}${apiPath}`)
    
    const response = await fetch(`${EDGE_API_BASE_URL}${apiPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QC-System-Camera-Proxy/1.0',
      },
    })

    console.log(`✅ API proxy response: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch ${endpoint}`, status: response.status },
        { status: response.status }
      )
    }

    const data = await response.text()
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.log(`❌ API ${endpoint} proxy error:`, error)
    return NextResponse.json(
      { 
        error: `API ${endpoint} proxy failed`, 
        details: error instanceof Error ? error.message : String(error),
        target_url: `${EDGE_API_BASE_URL}/api/camera/devices`
      },
      { status: 500 }
    )
  }
}

/**
 * Handle video feed with direct stream passthrough
 * 直接透传上游视频流，避免缓冲问题
 */
async function handleVideoFeed() {
  try {
    console.log('🎥 Proxying video feed...')
    
    const upstream = await fetch(`${EDGE_API_BASE_URL}/api/camera/video_feed`, {
      method: 'GET',
      headers: {
        'User-Agent': 'QC-System-Camera-Proxy/1.0',
      },
    })

    console.log(`✅ Proxy response: ${upstream.status} ${upstream.statusText}`)

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Failed to connect to camera', status: upstream.status },
        { status: upstream.status }
      )
    }

    if (!upstream.body) {
      return NextResponse.json(
        { error: 'No video stream available' },
        { status: 500 }
      )
    }

    // 透传上游的 Content-Type（包含 boundary）
    const contentType = upstream.headers.get('content-type') ?? 'multipart/x-mixed-replace'

    // 直接透传 upstream.body，不使用 TransformStream
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.error('❌ Video feed proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Video feed proxy failed', 
        details: error instanceof Error ? error.message : String(error),
        target_url: `${EDGE_API_BASE_URL}/api/camera/video_feed`
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || 'capture'
  
  try {
    console.log(`🔄 Proxying camera POST request to: ${EDGE_API_BASE_URL}/${endpoint}`)
    
    // 获取请求体
    const body = await request.text()
    
    const response = await fetch(`${EDGE_API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'User-Agent': 'QC-System-Camera-Proxy/1.0',
      },
      body: body || undefined,
    })

    const responseText = await response.text()
    
    console.log(`✅ Camera proxy POST response: ${response.status} ${response.statusText}`)
    
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.error('❌ Camera proxy POST error:', error)
    return NextResponse.json(
      { 
        error: 'Camera proxy POST request failed', 
        details: error instanceof Error ? error.message : String(error),
        endpoint: endpoint,
        target_url: `${EDGE_API_BASE_URL}/${endpoint}`
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}