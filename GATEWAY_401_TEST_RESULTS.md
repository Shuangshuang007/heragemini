# Gateway 401 鉴权失败 - 测试结果

**测试时间**: 2025-12-24

---

## ✅ Step 1: MCP Endpoint 测试结果

### 测试命令
```bash
curl -i \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  https://www.heraai.net.au/api/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### 测试结果
- ✅ **HTTP Status: 200**
- ✅ **MCP endpoint authentication works!**
- ✅ Token验证成功，返回了tools列表

### 结论
**MCP endpoint本身没有问题**，鉴权正常工作。

---

## 🔍 Step 2: Gateway代码分析

### 问题根因
Gateway代码 (`src/app/api/gateway/mcp/route.ts`) 第159-162行：
```typescript
// Forward Authorization header if present
...(request.headers.get('Authorization') && {
  'Authorization': request.headers.get('Authorization')!
}),
```

**问题**: Gateway只是转发上游请求的Authorization header，**没有自己添加token**

**结果**: 如果ChatGPT调用Gateway时没有带Authorization header，Gateway转发给MCP时就没有，导致401

---

## ✅ Step 3: Gateway修复

### 已完成的修复
1. ✅ Gateway从环境变量读取 `MCP_SHARED_SECRET`
2. ✅ 优先使用上游请求的Authorization header（如果存在）
3. ✅ 如果上游没有，则使用Gateway自己的token
4. ✅ 添加了token检查日志（不打印明文，只打印存在性、长度、前4位+后4位）

### 修复代码位置
`src/app/api/gateway/mcp/route.ts` 第144-189行

---

## 📋 最终结论

### 根因
**Gateway没有携带Authorization header** - Gateway只是转发上游的header，但ChatGPT调用Gateway时没有带Authorization header，导致Gateway转发给MCP时也没有。

### 修复方案
Gateway现在会：
1. 优先使用上游请求的Authorization header（如果存在）
2. 如果上游没有，则使用Gateway自己的 `MCP_SHARED_SECRET` 环境变量

### 最小改动
- ✅ 添加了token读取逻辑（从环境变量）
- ✅ 添加了token检查日志（不打印明文）
- ✅ 修改了Authorization header构建逻辑（优先上游，fallback到Gateway自己的token）

---

## ✅ Step 4: 复测建议

修复后请复测：
1. ✅ Gateway → MCP `tools/list` 成功（200）
2. ✅ Gateway调 `recommend_jobs` 成功（200）
3. ✅ 无token仍然401（鉴权生效）

---

**状态**: ✅ 已修复，等待部署后复测
