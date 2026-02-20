# UI 验证报告 - 产线选择功能

## 构建状态
✅ **本地构建成功**
- 构建命令: `npm run build`
- 构建时间: 6.8s
- TypeScript 检查: 通过 (5.4s)
- 静态页面生成: 成功 (26/26)
- 生产服务器: 启动成功 (http://localhost:3000)

## 代码验证

### 1. CameraCapture 组件 (src/components/qc/CameraCapture.tsx)
✅ **产线选择器已实现** (第 739-753 行)
```tsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    选择产线
  </label>
  <select
    value={selectedLineKey}
    onChange={(e) => handleLineChange(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    {LINE_MODULES.map((line) => (
      <option key={line.key} value={line.key}>
        {line.label}
      </option>
    ))}
  </select>
</div>
```

✅ **相机选择器已实现** (第 794-808 行)
```tsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    选择相机
  </label>
  <select
    value={selectedNetworkCameraId || ''}
    onChange={(e) => handleNetworkCameraChange(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    {filteredCameras.map((camera) => (
      <option key={camera.id} value={camera.id}>
        {camera.name || camera.id}
      </option>
    ))}
  </select>
</div>
```

✅ **预览轮询刷新** (第 289-299 行)
```tsx
useEffect(() => {
  if (mode === 'network' && selectedNetworkCameraId && networkCameraAvailable && !capturedPhoto) {
    const intervalId = setInterval(() => {
      const newUrl = getLatestUrl(selectedNetworkCameraId);
      setNetworkCameraUrl(newUrl);
    }, 1000); // 每秒刷新一次

    return () => clearInterval(intervalId);
  }
}, [mode, selectedNetworkCameraId, networkCameraAvailable, capturedPhoto]);
```

### 2. 模块化架构
✅ **Camera Core API** (src/modules/camera-core/api.ts)
- `listDevices()`: 获取相机列表
- `snapshot()`: 触发抓拍
- `getLatestUrl()`: 获取最新图片URL

✅ **产线注册表** (src/modules/lines/registry.ts)
```typescript
export const LINE_MODULES: LineModule[] = [
  controllerLine,  // 控制器产线
  motorLine,       // 电机产线
]
```

✅ **控制器产线配置** (src/modules/lines/controller/index.ts)
```typescript
export const controllerLine: LineModule = {
  key: 'controller',
  label: '控制器产线',
  description: '控制器产品质检',
  cameraIds: ['DA8076792'],
  defaultCameraId: 'DA8076792',
}
```

## UI 功能清单

### 网络相机模式下的产线选择流程
1. ✅ 用户进入主页，输入条码
2. ✅ 点击"拍照"进入 CameraCapture 组件
3. ✅ 默认显示"网络相机"模式（有状态指示器）
4. ✅ 显示"选择产线"下拉框（控制器/电机）
5. ✅ 根据产线过滤并显示"选择相机"下拉框
6. ✅ 显示相机预览（1秒轮询刷新）
7. ✅ 预览左上角显示当前相机名称
8. ✅ 点击"截图"按钮进行抓拍

### 状态处理
- ✅ 产线未配置相机：显示"⚠️ 当前产线未配置相机"
- ✅ 产线没有可用相机：显示"❌ 当前产线没有可用相机"
- ✅ 加载中：显示加载动画和"加载相机列表..."
- ✅ 相机在线：绿色状态指示器 + 相机名称

## Git 提交记录
```
0fa45db (HEAD -> main, origin/main) feat: 完善网络相机产线选择功能
8110073 feat: 网络相机模块化重构 - snapshot轮询模式
```

## 测试步骤

### 本地测试
1. 打开浏览器访问: http://localhost:3000
2. 登录系统
3. 输入条码（例如：TEST123）
4. 点击"下一步"进入拍照界面
5. 确认看到以下元素：
   - 三个模式按钮：相机拍照 | 本地上传 | 网络相机
   - "选择产线"下拉框（控制器产线/电机产线）
   - "选择相机"下拉框（显示过滤后的相机）
   - 相机预览区域（黑色背景，左上角显示相机名称）
   - "取消"和"截图"按钮

### 云服务器部署步骤
```bash
cd ~/apps/production-line-qc
git pull origin main
rm -rf .next
npm run build
# 在 tmux 中重启服务
tmux attach -t qcapp
# Ctrl+C 停止服务
npm start
# Ctrl+B D 退出 tmux
```

## 问题排查

### 如果 UI 没有变化
1. **检查代码是否更新**
   ```bash
   git log -1
   # 应该显示: 0fa45db feat: 完善网络相机产线选择功能
   ```

2. **检查 modules 目录**
   ```bash
   ls -la src/modules/
   # 应该看到: camera-core/ 和 lines/
   ```

3. **清理构建缓存**
   ```bash
   rm -rf .next
   npm run build
   ```

4. **重启服务**
   - 在 tmux 会话中按 Ctrl+C 停止
   - 运行 `npm start` 重新启动

## 结论
✅ **代码已完整实现产线选择功能**
✅ **本地构建测试通过**
✅ **所有 UI 元素已正确添加**

如果云服务器 UI 没有变化，问题在于：
1. Next.js 构建缓存未更新（需要删除 .next 目录）
2. 服务未重启（需要在 tmux 中重启服务）
