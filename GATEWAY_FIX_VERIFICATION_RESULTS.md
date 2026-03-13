# Gateway 401 Fix - 验证结果

**测试时间**: 2025-12-24  
**测试环境**: Production (https://www.heraai.net.au)

---

## ✅ 代码修复（已完成）

### 采用方案A（最稳）
Gateway现在**永远只使用自己的MCP_SHARED_SECRET**，忽略上游Authorization header。

**修改位置**: `src/app/api/gateway/mcp/route.ts` 第144-189行

**修改内容**:
- ✅ Gateway从环境变量读取 `MCP_SHARED_SECRET`
- ✅ **忽略上游Authorization header**（避免安全风险）
- ✅ 如果环境变量不存在，返回500错误
- ✅ 添加了token检查日志（不打印明文）

---

## 📋 验收测试结果

### Test 1: Gateway调用（无Authorization header）❌ FAIL
**测试**: Gateway调用 `recommend_jobs`，不带Authorization header（模拟ChatGPT）

**结果**: 
- ❌ **返回401**
- 错误: "MCP Server error"

**分析**: 
- Gateway代码修复已完成，但**还未部署到生产环境**
- 或者Gateway的环境变量 `MCP_SHARED_SECRET` 未设置

**需要**: 
1. 部署修复后的Gateway代码到生产环境
2. 在Vercel中为 `www.heraai.net.au` 设置 `MCP_SHARED_SECRET` 环境变量
3. Redeploy

---

### Test 2: 直接MCP调用（带token）✅ PASS
**测试**: 直接调用MCP endpoint，带Bearer token

**结果**: 
- ✅ **返回200**
- ✅ MCP返回了11个工具

**结论**: MCP endpoint本身工作正常，鉴权正常。

---

### Test 3: 直接MCP调用（无token）✅ PASS
**测试**: 直接调用MCP endpoint，不带token

**结果**: 
- ✅ **返回401**
- ✅ 错误消息表明需要认证

**结论**: MCP鉴权仍然生效，安全机制正常。

---

## 🎯 最终结论

### 代码修复状态
- ✅ **代码修复已完成**（采用方案A，最稳）
- ✅ Gateway现在永远只使用自己的token
- ✅ 代码已通过linter检查

### 部署状态
- ❌ **Gateway代码还未部署到生产环境**
- ❌ Gateway的环境变量可能未设置

### 下一步操作

1. **部署Gateway代码到生产环境**
   ```bash
   git add src/app/api/gateway/mcp/route.ts
   git commit -m "fix: Gateway always uses own MCP_SHARED_SECRET (ignore upstream Authorization)"
   git push
   ```

2. **在Vercel中设置环境变量**
   - 登录Vercel Dashboard
   - 找到 `www.heraai.net.au` 对应的Project
   - 在Environment Variables中添加：
     - `MCP_SHARED_SECRET` = `<your_token>`
     - （可选）`MCP_SHARED_SECRET_OLD` = `<old_token>` (3-day compatibility)

3. **Redeploy**
   - 在Vercel Dashboard中触发Redeploy
   - 或等待自动部署（如果已配置）

4. **复测**
   ```bash
   node scripts/verify_gateway_fix.js
   ```
   - Test 1应该返回200（Gateway调用成功）
   - Test 2应该返回200（MCP直接调用成功）
   - Test 3应该返回401（无token被拒绝）

---

## 📝 修复方案说明

### 为什么采用方案A（忽略上游Authorization）？

1. **安全性**: 避免任何人带不同Authorization header影响Gateway行为
2. **排障清晰**: 所有Gateway调用都使用同一个token，行为一致
3. **未来扩展**: 如果给Gateway加别的鉴权，不会出现绕过/混用风险

### 代码变更

**修改前**:
```typescript
// Forward Authorization header if present
...(request.headers.get('Authorization') && {
  'Authorization': request.headers.get('Authorization')!
}),
```

**修改后**:
```typescript
// Gateway always uses its own token (ignore upstream Authorization for security)
const authHeader = mcpToken ? `Bearer ${mcpToken}` : (mcpTokenOld ? `Bearer ${mcpTokenOld}` : null);

const mcpResponse = await fetch(mcpFetchUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Gateway always uses its own MCP_SHARED_SECRET (ignore upstream Authorization)
    ...(authHeader && {
      'Authorization': authHeader
    }),
```

---

**状态**: ✅ 代码修复完成，等待部署和复测









