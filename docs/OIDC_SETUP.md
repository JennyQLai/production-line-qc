# OIDC 企业登录配置指南

## 概述

本系统支持通过 OIDC (OpenID Connect) 协议与企业身份认证系统集成。

**你的 OIDC 服务器**: `https://221.226.60.30:5001/webman/sso/.well-known/openid-configuration`

## 登录界面位置

企业 OIDC 登录按钮位于：
- **URL**: `/auth/login`
- **组件**: `src/components/auth/LoginForm.tsx`
- **按钮**: "使用企业 OIDC 登录"

## Supabase OIDC 配置

### 1. 在 Supabase 控制台配置

1. 进入 Supabase 项目 → **Authentication** → **Providers**
2. 找到 **OpenID Connect** 并启用
3. 配置以下参数：

```
Provider Name: oidc
Client ID: [需要从你的 OIDC 管理员获取]
Client Secret: [需要从你的 OIDC 管理员获取]
Issuer URL: https://221.226.60.30:5001/webman/sso
```

**注意**: Issuer URL 不包含 `.well-known/openid-configuration` 部分，Supabase 会自动添加。

### 2. 重定向 URL 配置

在你的 OIDC 提供商 (https://221.226.60.30:5001) 中配置重定向 URL：

```
开发环境: http://localhost:3000/auth/callback
生产环境: https://your-domain.com/auth/callback
```

**重要**: 需要联系你的 OIDC 管理员添加这些重定向 URL 到白名单。

### 3. 环境变量配置

更新 `.env.local` 文件：

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OIDC Configuration (可选，如果需要自定义)
OIDC_CLIENT_ID=your_oidc_client_id
OIDC_CLIENT_SECRET=your_oidc_client_secret
OIDC_ISSUER_URL=https://your-oidc-provider.com
```

## OIDC 提供商示例配置

### 你的 OIDC 服务器配置

基于你提供的服务器地址，配置如下：

```
OIDC 服务器: https://221.226.60.30:5001/webman/sso
Discovery URL: https://221.226.60.30:5001/webman/sso/.well-known/openid-configuration
```

**需要从 OIDC 管理员获取的信息**:
1. Client ID (应用程序 ID)
2. Client Secret (应用程序密钥)
3. 支持的 Scopes (通常是 `openid profile email`)
4. 确认重定向 URL 已添加到白名单

**SSL 证书注意事项**:
- 如果是自签名证书，可能需要在 Supabase 配置中处理
- 生产环境建议使用有效的 SSL 证书

## 登录流程

1. 用户访问 `/auth/login`
2. 点击 "使用企业 OIDC 登录"
3. 重定向到企业 OIDC 提供商
4. 用户在企业系统中认证
5. 重定向回 `http://localhost:3000/auth/callback?code=xxx`
6. 系统自动处理授权码交换
7. 用户登录成功，重定向到首页

## 用户信息映射

OIDC 返回的用户信息会自动映射到 Supabase 用户：

```json
{
  "id": "oidc-user-id",
  "email": "user@company.com",
  "user_metadata": {
    "name": "张三",
    "department": "质检部",
    "role": "inspector"
  }
}
```

## 故障排除

### 常见问题

1. **重定向 URL 不匹配**
   - 确保 OIDC 提供商中配置的重定向 URL 与代码中一致

2. **Client ID/Secret 错误**
   - 检查 Supabase 中的 OIDC 配置

3. **Issuer URL 错误**
   - 确保 `.well-known/openid_configuration` 端点可访问

4. **Scopes 不足**
   - 确保请求了 `openid profile email` scopes

### 调试步骤

1. 检查浏览器网络面板
2. 查看 Supabase 认证日志
3. 验证 OIDC 提供商配置
4. 测试 `.well-known/openid_configuration` 端点

## 安全注意事项

1. **HTTPS 必须**：生产环境必须使用 HTTPS
2. **Client Secret 保护**：不要在前端代码中暴露 Client Secret
3. **重定向 URL 验证**：严格验证重定向 URL
4. **Token 过期处理**：实现 Token 刷新机制

## 测试

访问 `http://localhost:3000/auth/login` 测试 OIDC 登录功能。