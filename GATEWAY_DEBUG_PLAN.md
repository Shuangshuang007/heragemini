# Gateway GPTs Actions 参数传递排查计划

**问题**: GPTs在对话中说"系统没有收到搜索参数"，但Gateway日志显示调用成功。

**目标**: 定位GPTs Actions → Gateway → MCP的参数传递和响应解析问题。

---

## ✅ Step 1: 添加Debug日志（已完成）

### 修改文件
- `src/app/api/gateway/mcp/route.ts`

### 添加的日志

#### 1. Request Debug Log (第123-142行)
```typescript
console.log('[Gateway] Tool call request (DEBUG):', {
  tool,
  argsKeys: argsKeys,                    // 所有arguments的keys
  hasJobTitle,                           // job_title是否存在
  hasQuery,                              // query是否存在（可能的GPTs字段名）
  hasCity,                               // city是否存在
  hasLocation,                           // location是否存在（可能的GPTs字段名）
  jobTitle: jobTitleValue || 'NOT_PRESENT',
  query: queryValue || 'NOT_PRESENT',
  city: cityValue || 'NOT_PRESENT',
  location: locationValue || 'NOT_PRESENT'
});
```

#### 2. Response Debug Log (第267-280行)
```typescript
console.log('[Gateway] Tool call completed (DEBUG):', {
  tool,
  success: true,
  resultType,                            // array/object/string
  resultKeys,                            // result对象的keys（前10个）
  hasJobs,                               // 是否包含jobs/content/data字段
  resultTopLevel                         // 顶层字段名
});
```

---

## ✅ Step 2: 创建curl测试脚本（已完成）

### 文件
- `scripts/test_gateway_search_jobs.sh`

### 测试场景
1. **Test 1**: `job_title` + `city` (正确字段名)
2. **Test 2**: `query` + `city` (可能的GPTs字段名不匹配)
3. **Test 3**: `job_title` + `location` (可能的GPTs字段名不匹配)

### 使用方法
```bash
./scripts/test_gateway_search_jobs.sh
```

---

## 📋 Step 3: 检查OpenAPI Schema字段名

### OpenAPI Schema位置
- `src/app/api/gateway/mcp/openapi.json`

### search_jobs字段定义（第71-79行）
```json
{
  "tool": "search_jobs",
  "arguments": {
    "job_title": "software engineer",  // ✅ 字段名：job_title
    "city": "Sydney"                      // ✅ 字段名：city
  }
}
```

### MCP工具期望的字段（从MCP_TOOLS_REVIEW_PACKET.md）
- **Required**: `job_title` OR `city` (至少一个)
- **字段名**: `job_title`, `city` (不是`query`或`location`)

### 结论
- ✅ OpenAPI schema使用`job_title`和`city`
- ✅ MCP工具期望`job_title`和`city`
- ⚠️ **如果GPTs Actions发送`query`或`location`，会导致字段名不匹配**

---

## 📋 Step 4: 检查Gateway Response结构

### OpenAPI Response Schema（第95-133行）
```json
{
  "success": boolean,
  "tool": string,
  "result": object,        // additionalProperties: true
  "meta": {
    "elapsed": string,
    "mcpRequestId": string
  }
}
```

### MCP实际返回结构（从route.ts第2272-2286行）
```json
{
  "jsonrpc": "2.0",
  "id": "...",
  "result": {
    "content": [
      { "type": "text", "text": "..." }
    ],
    "isError": false,
    "mode": "search",
    "query_used": { "job_title": "...", "city": "..." },
    "total": 5,
    "isFinal": true
  }
}
```

### Gateway提取逻辑（第244-265行）
Gateway会尝试从MCP的`result.content`中提取数据：
- 如果`content[0].data.content`存在 → 使用它
- 如果`content[0].data`存在 → 使用它
- 如果`content[0].text`存在 → 使用`{ text: ..., ...mcpResult }`
- 否则 → 使用整个`content`数组

### 潜在问题
1. **字段名不匹配**: GPTs发送`query`/`location`，但MCP期望`job_title`/`city`
2. **Response结构**: Gateway返回的`result`结构可能与GPTs期望的不一致
3. **Content-Type**: 需要确认是`application/json`

---

## 🔍 排查步骤

### 1. 部署代码并检查日志
```bash
# 部署到生产环境
git add src/app/api/gateway/mcp/route.ts
git commit -m "debug: Add detailed logging for GPTs Actions parameter passing"
git push origin main
```

### 2. 等待GPTs调用或运行测试脚本
```bash
# 运行curl测试
./scripts/test_gateway_search_jobs.sh
```

### 3. 检查Vercel日志
查找以下日志：
- `[Gateway] Tool call request (DEBUG)` - 查看GPTs实际发送的字段名
- `[Gateway] Tool call completed (DEBUG)` - 查看返回结构

### 4. 分析根因

#### 场景A: 字段名不匹配
**症状**: 
- Debug log显示`hasQuery: true`但`hasJobTitle: false`
- 或`hasLocation: true`但`hasCity: false`

**根因**: GPTs Actions发送的字段名与MCP期望的不一致

**修复**: 在Gateway中添加字段名映射
```typescript
// Map GPTs field names to MCP field names
if (toolArguments.query && !toolArguments.job_title) {
  toolArguments.job_title = toolArguments.query;
  delete toolArguments.query;
}
if (toolArguments.location && !toolArguments.city) {
  toolArguments.city = toolArguments.location;
  delete toolArguments.location;
}
```

#### 场景B: Response结构不匹配
**症状**:
- Debug log显示`hasJobs: false`
- 或`resultType`不是GPTs期望的类型

**根因**: Gateway返回的`result`结构与GPTs期望的不一致

**修复**: 调整Gateway的response提取逻辑，确保返回结构符合OpenAPI schema

#### 场景C: 参数确实缺失
**症状**:
- Debug log显示`argsKeys: []`或关键字段都是`NOT_PRESENT`

**根因**: GPTs Actions没有正确发送参数

**修复**: 检查GPTs Actions的OpenAPI配置，确保required字段正确设置

---

## 📊 期望的输出

### 1. GPTs实际请求的字段名
从`[Gateway] Tool call request (DEBUG)`日志中获取：
- `argsKeys`: 实际发送的所有字段
- `hasJobTitle`/`hasQuery`: 确认字段名是`job_title`还是`query`
- `hasCity`/`hasLocation`: 确认字段名是`city`还是`location`

### 2. Gateway收到的arguments
从同一日志中获取：
- `jobTitle`: 实际值（如果存在）
- `city`: 实际值（如果存在）

### 3. Gateway返回的顶层结构
从`[Gateway] Tool call completed (DEBUG)`日志中获取：
- `resultType`: array/object/string
- `resultKeys`: 顶层字段列表
- `hasJobs`: 是否包含jobs数据

### 4. 根因判断
根据以上信息判断：
- **字段名不一致**: `hasQuery=true`但`hasJobTitle=false` → 需要字段映射
- **Gateway映射错误**: 字段存在但MCP没收到 → 检查Gateway→MCP传递逻辑
- **Response结构不一致**: `hasJobs=false`或结构不匹配 → 调整response提取逻辑

---

## ⚠️ 重要要求

- ✅ **先定位根因，不要重构MCP**
- ✅ **不要改工具逻辑，不要改其它端点**
- ✅ **修复后只做"最小改动"**: 对齐字段名映射或调整response结构

---

## 🎯 下一步

1. **部署代码**到生产环境
2. **运行测试脚本**或等待GPTs调用
3. **检查日志**获取debug信息
4. **根据日志分析根因**
5. **实施最小修复**

---

**状态**: Step 1 & 2 已完成，等待部署和日志分析。

