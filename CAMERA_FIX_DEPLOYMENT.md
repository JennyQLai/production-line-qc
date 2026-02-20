# 相机可用性检查修复 - 部署说明

## 问题描述
- UI 显示"当前产线没有可用相机"
- 控制台错误：`/api/camera-proxy?endpoint=status` 返回 400 Bad Request
- 边缘服务 `http://221.226.60.30:8000/api/camera/status` 返回 404 Not Found

## 根本原因
代码调用了不存在的 `status` 端点。边缘服务只提供以下端点：
- ✅ `/health`
- ✅ `/api/camera/devices`
- ✅ `/api/camera/snapshot`
- ✅ `/api/camera/latest`
- ❌ `/api/camera/status` (不存在)

## 修复方案
采用**首选方案**（最小化后端改动）：
1. 修改 `edgeInferenceService.checkNetworkCameraAvailable()` 使用 `devices` 端点
2. 通过 `devices.length > 0` 判断相机是否可用
3. 移除 `CameraCapture` 中废弃的 `checkNetworkCamera` 函数
4. 统一使用 `fetchNetworkCameras()` 获取相机列表

## 修改的文件
1. `src/lib/services/edgeInferenceService.ts`
   - `checkNetworkCameraAvailable()` 改用 `/api/camera-proxy?endpoint=devices`
   - 添加详细日志输出

2. `src/components/qc/CameraCapture.tsx`
   - 移除废弃的 `checkNetworkCamera()` 函数
   - 所有调用改为 `fetchNetworkCameras()`

## 部署步骤

### 在云服务器上执行：

```bash
# 1. 进入项目目录
cd ~/apps/production-line-qc

# 2. 拉取最新代码
git pull origin main

# 3. 清理构建缓存
rm -rf .next

# 4. 重新构建
npm run build

# 5. 重启服务
tmux attach -t qcapp
# 按 Ctrl+C 停止当前服务
npm start
# 按 Ctrl+B 然后 D 退出 tmux
```

## 验证步骤

### 1. 打开浏览器控制台
访问：http://69.230.223.12:3110/

### 2. 检查控制台日志
应该看到以下日志：
```
📹 Checking camera availability via proxy (devices endpoint): /api/camera-proxy?endpoint=devices
✅ Camera devices response: [{id: "DA8076792", name: "..."}]
📹 Camera availability: true (device_count: 1)
```

### 3. 检查 UI 状态
- 输入条码后进入拍照页面
- 选择"网络相机"模式
- 应该看到：
  - ✅ 当前产线信息显示
  - ✅ 相机选择下拉框显示 DA8076792
  - ✅ 相机预览画面（每秒刷新）
  - ✅ 左上角显示相机名称和绿色状态指示器

### 4. 检查网络请求
打开浏览器开发者工具 → Network 标签：
- ✅ `/api/camera-proxy?endpoint=devices` 返回 200
- ✅ `/api/camera-proxy?endpoint=latest&camera_id=DA8076792&t=...` 返回图片
- ❌ 不应该再看到 `/api/camera-proxy?endpoint=status` 请求

## 预期结果
- UI 正确显示"当前产线共 1 个可用相机"
- 相机预览正常工作
- 不再出现"当前产线没有可用相机"错误

## 回滚方案
如果出现问题，回滚到上一个版本：
```bash
cd ~/apps/production-line-qc
git reset --hard c7a37d0
rm -rf .next
npm run build
# 在 tmux 中重启服务
```

## 技术细节

### 修改前的逻辑
```typescript
// ❌ 调用不存在的端点
const url = '/api/camera-proxy?endpoint=status'
const response = await fetch(url)
const data = await response.json()
return data.camera_running === true
```

### 修改后的逻辑
```typescript
// ✅ 使用 devices 端点
const url = '/api/camera-proxy?endpoint=devices'
const response = await fetch(url)
const data = await response.json()

let devices = []
if (Array.isArray(data)) {
  devices = data
} else if (data.devices && Array.isArray(data.devices)) {
  devices = data.devices
}

const available = devices.length > 0
console.log(`📹 Camera availability: ${available} (device_count: ${devices.length})`)
return available
```

## 相关提交
- Commit: 37438be
- 分支: main
- 日期: 2026-02-19
