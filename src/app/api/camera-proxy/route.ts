/**
 * Camera Proxy API
 * 相机代理 API - 用于转发网络相机请求，解决 CORS 问题
 * 
 * 2026-02-19: 重构为 snapshot 模式（轮询预览）
 * - devices: GET /api/camera/devices
 * - snapshot: POST /api/camera/snapshot?camera_id=XXX
 * - latest: GET /api/camera/latest?camera_id=XXX&t=timestamp
 */

import { NextRequest, NextResponse } from 'next/server'

// 配置运行时为 nodejs
export const runtime = 'nodejs'

const EDGE_API_BASE_URL = process.env.NEXT_PUBLIC_EDGE_API_BASE_URL || 'http://221.226.60.30:8000'

const SUPPORTED_ENDPOINTS = ['devices', 'snapshot', 'latest']

/**
 * GET handler - 处理 devices 和 latest 端点
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const cameraId = searchParams.get('camera_id')
  
  // 验证 endpoint
  if (!endpoint || !SUPPORTED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json(
      { 
        error: 'Unknown or missing endpoint',
        supported: SUPPORTED_ENDPOINTS,
        received: endpoint || 'null'
      },
      { status: 400 }
    )
  }
  
  // 处理 devices 端点
  if (endpoint === 'devices') {
    return handleDevices()
  }
  
  // 处理 latest 端点
  if (endpoint === 'latest') {
    if (!cameraId) {
      return NextResponse.json(
        { error: 'camera_id is required for latest endpoint' },
        { status: 400 }
      )
    }
    return handleLatest(cameraId, searchParams.get('t') || '')
  }
  
  return NextResponse.json(
    { error: 'Endpoint not implemented in GET handler' },
    { status: 400 }
  )
}

/**
 * POST handler - 处理 snapshot 端点
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const cameraId = searchParams.get('camera_id')
  
  // 验证 endpoint
  if (!endpoint || endpoint !== 'snapshot') {
    return NextResponse.json(
      { 
        error: 'Unknown or missing endpoint',
        supported: ['snapshot'],
        received: endpoint || 'null'
      },
      { status: 400 }
    )
  }
  
  // 验证 camera_id
  if (!cameraId) {
    return NextResponse.json(
      { error: 'camera_id is required for snapshot endpoint' },
      { status: 400 }
    )
  }
  
  return handleSnapshot(cameraId)
}

/**
 * OPTIONS handler - CORS 预检
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}

/**
 * 处理 devices 端点
 */
async function handleDevices() {
  try {
    const targetUrl = `${EDGE_API_BASE_URL}/api/camera/devices`
    console.log(`📊 Fetching devices from: ${targetUrl}`)
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QC-System-Camera-Proxy/2.0',
      },
    })

    console.log(`✅ Devices response: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { 
          error: 'Failed to fetch devices',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      )
    }

    const data = await response.text()
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('❌ Devices error:', error)
    return NextResponse.json(
      { 
        error: 'Devices request failed',
        details: error instanceof Error ? error.message : String(error),
        target_url: `${EDGE_API_BASE_URL}/api/camera/devices`
      },
      { status: 500 }
    )
  }
}

/**
 * 处理 snapshot 端点
 */
async function handleSnapshot(cameraId: string) {
  try {
    const targetUrl = `${EDGE_API_BASE_URL}/api/camera/snapshot?camera_id=${cameraId}`
    console.log(`📸 Triggering snapshot: ${targetUrl}`)
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QC-System-Camera-Proxy/2.0',
      },
    })

    console.log(`✅ Snapshot response: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { 
          error: 'Snapshot failed',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      )
    }

    const data = await response.text()
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('❌ Snapshot error:', error)
    return NextResponse.json(
      { 
        error: 'Snapshot request failed',
        details: error instanceof Error ? error.message : String(error),
        target_url: `${EDGE_API_BASE_URL}/api/camera/snapshot?camera_id=${cameraId}`
      },
      { status: 500 }
    )
  }
}

/**
 * 处理 latest 端点 - 直接透传图片
 */
async function handleLatest(cameraId: string, timestamp: string) {
  try {
    const targetUrl = `${EDGE_API_BASE_URL}/api/camera/latest?camera_id=${cameraId}&t=${timestamp}`
    console.log(`🖼️ Fetching latest image: ${targetUrl}`)
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'QC-System-Camera-Proxy/2.0',
      },
    })

    console.log(`✅ Latest image response: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      // 如果不是图片，返回 JSON 错误
      const errorText = await response.text()
      return NextResponse.json(
        { 
          error: 'Failed to fetch latest image',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      )
    }

    // 直接透传图片数据
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('❌ Latest image error:', error)
    return NextResponse.json(
      { 
        error: 'Latest image request failed',
        details: error instanceof Error ? error.message : String(error),
        target_url: `${EDGE_API_BASE_URL}/api/camera/latest?camera_id=${cameraId}`
      },
      { status: 500 }
    )
  }
}
