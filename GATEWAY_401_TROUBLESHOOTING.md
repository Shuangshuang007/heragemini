# Gateway 401 鉴权失败排查步骤

**问题**: Gateway调用MCP Server时返回401 "Unauthorized - Missing or invalid Bearer token"

**时间**: 2025-12-24

---

## 🔍 排查步骤（按顺序执行）

### Step 1: 确认 MCP endpoint 本身是否 OK（直接 curl）

**目的**: 确认 `www.heraai.net.au/api/mcp` 的鉴权是否正常工作

**测试命令**:
```bash
curl -i \
  -H "Authorization: Bearer <NEW_TOKEN>" \
  -H "Content-Type: application/json" \
  https://www.heraai.net.au/api/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**预期结果**:
- ✅ **返回200**: MCP鉴权没问题，问题在Gateway"没带/没转发header"
- ❌ **返回401**: 说明 `www.heraai.net.au` 这套部署的env变量（`MCP_SHARED_SECRET`/`MCP_SHARED_SECRET_OLD`）没更新或未redeploy

**注意**: 
- 之前验证通过的是 `heraai-rebuild-public-v1-kc4f.vercel.app`
- 这次是 `www.heraai.net.au`，很可能是不同Vercel Project或不同环境变量

---

### Step 2: 确认 Gateway 调 MCP 时是否真正携带 Authorization header

**检查位置**: `src/app/api/gateway/mcp/route.ts` 第155-175行

**当前代码逻辑**:
```typescript
headers: {
  'Content-Type': 'application/json',
  // Forward Authorization header if present
  ...(request.headers.get('Authorization') && {
    'Authorization': request.headers.get('Authorization')!
  }),
}
```

**问题分析**:
- Gateway只是**转发**上游请求的Authorization header
- 如果ChatGPT调用Gateway时**没有带**Authorization header，Gateway转发给MCP时就没有
- Gateway应该**自己从环境变量读取token**并添加到请求中

**需要检查**:
1. Gateway代码是否设置了 `Authorization: Bearer <token>`
2. Token从哪个env读取（变量名是什么）：
   - `MCP_SHARED_SECRET` / `MCP_TOKEN` / `HERA_MCP_TOKEN` 等
3. 打印"是否存在"而非打印明文token：
   - 只打印：是否存在、长度、前4位+后4位（避免泄露）
   - 示例：`MCP token present: true, len=64, head=abcd, tail=wxyz`

---

### Step 3: 确认 www.heraai.net.au 对应部署的环境变量是否已生效

**需要确认**:
1. `www.heraai.net.au` 绑定的Vercel Project/环境
2. `MCP_SHARED_SECRET` 是否为新token
3. （若启用兼容）`MCP_SHARED_SECRET_OLD` 是否存在且正确
4. env改完后是否**Redeploy**（确保运行中的版本读到新env）

**检查方法**:
- Vercel Dashboard → Project Settings → Environment Variables
- 确认 `www.heraai.net.au` 对应的Project
- 检查 `MCP_SHARED_SECRET` 的值
- 确认最近是否有Redeploy

---

### Step 4: 复测（修复后再跑）

**修复后请复测**:
1. ✅ Gateway → MCP `tools/list` 成功（200）
2. ✅ Gateway调 `recommend_jobs` 成功（200）
3. ✅ 无token仍然401（鉴权生效）

**简短结论**:
- 根因是什么（header没转发 / env变量不一致 / 部署没更新）
- 做了哪些最小改动

---

## 🎯 根因分析（基于代码检查）

### 发现的问题

**Gateway代码问题** (`src/app/api/gateway/mcp/route.ts` 第159-162行):
```typescript
// Forward Authorization header if present
...(request.headers.get('Authorization') && {
  'Authorization': request.headers.get('Authorization')!
}),
```

**问题**: Gateway只是转发上游的Authorization header，**没有自己添加token**

**解决方案**: Gateway应该自己从环境变量读取 `MCP_SHARED_SECRET` 并添加到请求中

---

## 🔧 最小修复方案

### 修复 Gateway 代码

**修改位置**: `src/app/api/gateway/mcp/route.ts` 第155-175行

**修改前**:
```typescript
const mcpResponse = await fetch(mcpFetchUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Forward Authorization header if present
    ...(request.headers.get('Authorization') && {
      'Authorization': request.headers.get('Authorization')!
    }),
```

**修改后**:
```typescript
// Get MCP token from environment (Gateway's own token)
const mcpToken = process.env.MCP_SHARED_SECRET;
const mcpTokenOld = process.env.MCP_SHARED_SECRET_OLD;

// Log token presence (without exposing full value)
const tokenPresent = !!(mcpToken || mcpTokenOld);
const tokenLen = mcpToken ? mcpToken.length : (mcpTokenOld ? mcpTokenOld.length : 0);
const tokenHead = mcpToken ? mcpToken.substring(0, 4) : (mcpTokenOld ? mcpTokenOld.substring(0, 4) : 'none');
const tokenTail = mcpToken ? mcpToken.substring(mcpToken.length - 4) : (mcpTokenOld ? mcpTokenOld.substring(mcpTokenOld.length - 4) : 'none');

console.log('[Gateway] MCP token check:', {
  present: tokenPresent,
  len: tokenLen,
  head: tokenHead,
  tail: tokenTail
});

// Check if upstream request has Authorization header
const upstreamAuth = request.headers.get('Authorization');
console.log('[Gateway] Upstream Authorization header:', {
  present: !!upstreamAuth,
  startsWithBearer: upstreamAuth ? upstreamAuth.startsWith('Bearer ') : false
});

// Build Authorization header: prefer upstream, fallback to Gateway's own token
const authHeader = upstreamAuth || (mcpToken ? `Bearer ${mcpToken}` : null);

const mcpResponse = await fetch(mcpFetchUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Use upstream Authorization if present, otherwise use Gateway's own token
    ...(authHeader && {
      'Authorization': authHeader
    }),
```

**修改说明**:
1. Gateway从环境变量读取 `MCP_SHARED_SECRET`
2. 优先使用上游请求的Authorization header（如果存在）
3. 如果上游没有，则使用Gateway自己的token
4. 添加日志记录token存在性（不打印明文）

---

## ⚠️ 特别注意

1. ✅ **不要把token明文写进日志、文档、commit**
2. ✅ **不要大改架构，先定位根因，再做最小修补**
3. ✅ **很可能是两个域名对应不同部署/不同env导致**：请优先确认这一点

---

## 📋 检查清单

- [ ] Step 1: 测试 `www.heraai.net.au/api/mcp` 直接curl（确认MCP endpoint是否OK）
- [ ] Step 2: 检查Gateway代码是否携带Authorization header
- [ ] Step 3: 确认 `www.heraai.net.au` 的环境变量是否已设置并redeploy
- [ ] Step 4: 修复Gateway代码（添加token读取逻辑）
- [ ] Step 5: 复测Gateway → MCP调用

---

**状态**: 🔄 排查中









