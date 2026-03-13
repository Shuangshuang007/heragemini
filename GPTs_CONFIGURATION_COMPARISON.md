# GPTs 配置对比：现有 GPTs vs 新 4 工具版本

## 📋 核心差异总结

| 项目 | 现有 GPTs (11工具) | 新版本 (4工具) |
|------|-------------------|---------------|
| **集成方式** | GPTs Actions (OpenAPI) | App Store (MCP Server) |
| **协议** | REST API | JSON-RPC 2.0 |
| **端点** | `/api/gateway/mcp` | `/api/mcp-lite` |
| **Schema** | `/api/gateway/mcp/openapi.json` | 无（直接 MCP Server URL） |
| **工具数量** | 11 个 | 4 个 |
| **认证方式** | Bearer Token (通过 Gateway) | Bearer Token (直接 MCP) |

---

## 🔍 详细对比

### 1. 现有 GPTs Actions 配置（11工具）

**架构流程**：
```
ChatGPT GPTs Actions
  ↓ (REST API, OpenAPI Schema)
/api/gateway/mcp (Gateway)
  ↓ (内部 HTTP 调用, JSON-RPC 2.0)
/api/mcp (MCP Server)
  ↓
业务逻辑
```

**配置步骤**：
1. 在 ChatGPT GPTs 编辑器中添加 Action
2. 选择 "Import from URL"
3. 输入 OpenAPI Schema URL: `https://www.heraai.net.au/api/gateway/mcp/openapi.json`
4. 设置 Authentication: Bearer Token
5. Token: `MCP_SHARED_SECRET` 的值

**请求格式**：
```json
POST /api/gateway/mcp
Content-Type: application/json
Authorization: Bearer <token>

{
  "tool": "search_jobs",
  "arguments": {
    "job_title": "Software Engineer",
    "city": "Sydney"
  }
}
```

**响应格式**：
```json
{
  "success": true,
  "tool": "search_jobs",
  "result": { ... },
  "meta": {
    "elapsed": "1.2s",
    "mcpRequestId": "..."
  }
}
```

**特点**：
- ✅ 使用 REST API，符合 GPTs Actions 标准
- ✅ Gateway 层处理字段映射（`query` → `job_title`, `location` → `city`）
- ✅ Gateway 层处理错误转换（JSON-RPC → HTTP）
- ✅ 支持 11 个工具

---

### 2. 新版本 MCP Server（4工具，App Store 提交）

**架构流程**：
```
ChatGPT App Store (MCP Server)
  ↓ (直接 JSON-RPC 2.0)
/api/mcp-lite (MCP Server)
  ↓
业务逻辑
```

**配置步骤**：
1. 在 ChatGPT App Store 提交时
2. 选择 "MCP Server" 类型
3. 输入 MCP Server URL: `https://www.heraai.net.au/api/mcp-lite`
4. 设置 Authentication: Bearer Token
5. Token: `MCP_SHARED_SECRET` 的值

**请求格式**：
```json
POST /api/mcp-lite
Content-Type: application/json
Authorization: Bearer <token>

{
  "jsonrpc": "2.0",
  "id": "request-123",
  "method": "tools/call",
  "params": {
    "name": "search_jobs",
    "arguments": {
      "job_title": "Software Engineer",
      "city": "Sydney"
    }
  }
}
```

**响应格式**：
```json
{
  "jsonrpc": "2.0",
  "id": "request-123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 1707 jobs..."
      }
    ]
  }
}
```

**特点**：
- ✅ 直接使用 MCP Server，无需 Gateway 层
- ✅ 符合 MCP (Model Context Protocol) 标准
- ✅ 只支持 4 个工具（App Store 审核要求）
- ✅ GET 请求返回工具列表（带 `Cache-Control: no-store`）

---

## 🚀 如何在 GPTs 中使用新的 4 工具版本？

### 方案 A：创建 Gateway v2（推荐，用于 GPTs Actions）

**目标**：让 GPTs Actions 也能使用 4 工具版本

**步骤**：

1. **创建 Gateway v2** (`/api/gateway/mcp-v2`)
   - 复制 `/api/gateway/mcp/route.ts`
   - 修改 `AVAILABLE_TOOLS` 数组，只保留 4 个工具
   - 修改内部调用路径为 `/api/mcp-lite`

2. **创建 OpenAPI Schema v2** (`/api/gateway/mcp-v2/openapi.json`)
   - 复制 `/api/gateway/mcp/openapi.json`
   - 修改 `tool.enum`，只保留 4 个工具
   - 更新描述和示例

3. **在 GPTs 中配置**：
   - OpenAPI Schema URL: `https://www.heraai.net.au/api/gateway/mcp-v2/openapi.json`
   - Authentication: Bearer Token
   - Token: `MCP_SHARED_SECRET`

**优点**：
- ✅ 保持与现有 GPTs 相同的使用方式
- ✅ 可以同时使用 11 工具版本和 4 工具版本
- ✅ 不影响现有 GPTs

---

### 方案 B：直接使用 MCP Server（仅限 App Store）

**目标**：App Store 提交使用

**步骤**：
1. 在 App Store 提交时选择 "MCP Server"
2. MCP Server URL: `https://www.heraai.net.au/api/mcp-lite`
3. Authentication: Bearer Token
4. Token: `MCP_SHARED_SECRET`

**注意**：
- ⚠️ GPTs Actions **不支持** MCP Server URL（只支持 OpenAPI）
- ⚠️ 这个方案**只用于 App Store 提交**，不能用于 GPTs Actions

---

## 📊 请求/响应格式对比

### Gateway (REST API) vs MCP Server (JSON-RPC 2.0)

| 项目 | Gateway (`/api/gateway/mcp`) | MCP Server (`/api/mcp-lite`) |
|------|------------------------------|------------------------------|
| **协议** | REST API | JSON-RPC 2.0 |
| **请求格式** | `{ tool, arguments }` | `{ jsonrpc, id, method, params }` |
| **响应格式** | `{ success, tool, result, meta }` | `{ jsonrpc, id, result }` |
| **错误格式** | HTTP 状态码 + `{ error }` | `{ jsonrpc, id, error }` |
| **工具列表** | 通过 OpenAPI Schema | GET `/api/mcp-lite` 返回 `{ tools: [...] }` |

---

## 🔧 代码实现差异

### Gateway (`/api/gateway/mcp/route.ts`)

```typescript
// Gateway 接收 REST API 请求
export async function POST(request: NextRequest) {
  const { tool, arguments: args } = await request.json();
  
  // 转换为 JSON-RPC 2.0 格式
  const mcpRequest = {
    jsonrpc: '2.0',
    id: `gateway-${Date.now()}`,
    method: 'tools/call',
    params: { name: tool, arguments: args }
  };
  
  // 调用 MCP Server
  const mcpResponse = await fetch(`${baseUrl}/api/mcp`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(mcpRequest)
  });
  
  // 转换响应为 REST 格式
  const mcpResult = await mcpResponse.json();
  return NextResponse.json({
    success: !mcpResult.error,
    tool,
    result: mcpResult.result || mcpResult.error
  });
}
```

### MCP Server (`/api/mcp-lite/route.ts`)

```typescript
// MCP Server 直接接收 JSON-RPC 2.0 请求
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  if (body.method === "tools/call") {
    const { name, arguments: args } = body.params || {};
    
    // 检查工具是否在允许列表中
    if (!LITE_TOOLS.includes(name)) {
      return json200({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: `Tool "${name}" not available` }
      });
    }
    
    // 直接调用工具逻辑
    const result = await callTool(name, args);
    
    return json200({
      jsonrpc: "2.0",
      id: body.id,
      result: { content: [{ type: "text", text: result }] }
    });
  }
}
```

---

## ✅ 总结

### 现有 GPTs（11工具）
- **端点**: `/api/gateway/mcp`
- **Schema**: `/api/gateway/mcp/openapi.json`
- **协议**: REST API
- **用途**: GPTs Actions

### 新版本（4工具，App Store）
- **端点**: `/api/mcp-lite`
- **Schema**: 无（直接 MCP Server URL）
- **协议**: JSON-RPC 2.0
- **用途**: App Store 提交

### 新版本（4工具，GPTs Actions，可选）
- **端点**: `/api/gateway/mcp-v2`（需要创建）
- **Schema**: `/api/gateway/mcp-v2/openapi.json`（需要创建）
- **协议**: REST API
- **用途**: GPTs Actions（如果需要在 GPTs 中使用 4 工具版本）

---

## 🎯 下一步行动

1. **如果只需要 App Store 提交**：
   - ✅ `/api/mcp-lite` 已就绪
   - ✅ 直接使用 MCP Server URL 提交

2. **如果还需要在 GPTs 中使用 4 工具版本**：
   - ⏳ 创建 `/api/gateway/mcp-v2`（Gateway v2）
   - ⏳ 创建 `/api/gateway/mcp-v2/openapi.json`（OpenAPI Schema v2）
   - ⏳ 在 GPTs 中配置新的 OpenAPI Schema URL








