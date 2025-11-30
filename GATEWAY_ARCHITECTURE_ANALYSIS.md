# Gateway 架构方案分析

## 📋 背景

目标：将现有的 11 个 MCP tools 暴露给 ChatGPT GPTs Actions 使用。

当前状态：
- ✅ MCP Server 已实现：`/api/mcp` (JSON-RPC 2.0 协议)
- ✅ 11 个工具完整实现
- ❌ ChatGPT GPTs Actions 需要 OpenAPI schema 格式的 REST API

---

## 🎯 GPT 建议的方案

### 方案概述
创建一个独立的 Gateway 服务，将 MCP tools 包装成 REST API：

```
ChatGPT GPTs Actions
  ↓ (HTTP REST API)
Gateway Service (/api/gateway)
  ↓ (内部调用)
MCP Server (/api/mcp)
  ↓
实际业务逻辑
```

### 架构流程
1. Gateway 暴露 11 个 REST endpoints（每个工具一个）
2. Gateway 内部调用 MCP Server（通过 JSON-RPC）
3. Gateway 返回标准 REST 响应
4. 生成 OpenAPI schema 供 GPT Actions 使用

---

## 🔍 我的分析和建议

### ✅ 方案优点

1. **符合 GPT Actions 要求**
   - GPT Actions 确实需要 OpenAPI schema 格式
   - REST API 是标准格式，兼容性好

2. **架构清晰**
   - Gateway 作为适配层，职责明确
   - MCP Server 业务逻辑不需要改动

3. **易于维护**
   - Gateway 层代码简单（只是转发）
   - 业务逻辑集中在 MCP Server

4. **可扩展性**
   - 未来可以添加缓存、限流、日志等中间件
   - 可以支持多个下游服务

---

### ❌ 方案缺点

1. **额外的网络跳转**
   - Gateway → MCP Server 是内部 HTTP 调用
   - 增加了延迟和复杂度
   - 如果 Gateway 和 MCP Server 在同一服务，可以直接内部调用

2. **代码重复**
   - 需要维护 11 个 REST endpoints
   - 虽然只是转发，但仍然需要写代码

3. **错误处理复杂**
   - Gateway 需要处理 MCP 的错误格式
   - 需要将 JSON-RPC 错误转换为 HTTP 错误

---

## 💡 我的优化建议

### 🎯 方案 1：内置 Gateway（推荐）

**思路**：直接在 Next.js 项目中添加 Gateway 层，避免独立服务。

**架构**：
```
ChatGPT GPTs Actions
  ↓
/api/gateway/recommend-jobs (REST API)
  ↓ (内部函数调用，无 HTTP)
MCP Server 业务逻辑 (直接调用)
```

**优点**：
- ✅ 零额外网络开销（内部函数调用）
- ✅ 代码复用（直接调用 MCP 工具函数）
- ✅ 部署简单（无需独立服务）
- ✅ 易于调试（在同一进程）

**实现方式**：
1. 创建 `/api/gateway/[tool-name]/route.ts` 动态路由
2. 或者创建 `/api/gateway/route.ts` 统一处理所有工具
3. 内部直接调用 MCP 工具函数（提取公共逻辑）

**代码示例**：
```typescript
// /api/gateway/recommend-jobs/route.ts
import { recommendJobsHandler } from '@/app/api/mcp/handlers';

export async function POST(request: Request) {
  const body = await request.json();
  // 直接调用 MCP 工具逻辑（不通过 HTTP）
  return await recommendJobsHandler(body);
}
```

---

### 🎯 方案 2：混合模式（最灵活）

**思路**：Gateway 同时支持 REST API 和内部函数调用。

**架构**：
```
Gateway 层
  ├─ REST API 入口 (给 ChatGPT)
  └─ 内部函数调用 (给其他 Next.js API routes)
     ↓
工具函数层 (可复用)
     ↓
MCP Server (保持现有 JSON-RPC 接口)
```

**优点**：
- ✅ 保持 MCP Server 不变（向后兼容）
- ✅ Gateway 可以复用工具函数
- ✅ 两种接口都能用

---

### 🎯 方案 3：最小改动（如果不想写 Gateway）

**思路**：直接在现有 MCP Server 上添加 OpenAPI schema 端点。

**实现**：
1. 保持 `/api/mcp` 不变
2. 添加 `/api/gateway/openapi.json` 返回 OpenAPI schema
3. 在 GPT Actions 中配置：
   - Schema: 使用 `/api/gateway/openapi.json`
   - Server: 使用 `/api/gateway`
   - 但实际调用还是通过 MCP 协议

**问题**：GPT Actions 可能不支持 JSON-RPC，需要验证。

---

## 📊 方案对比

| 方案 | 复杂度 | 性能 | 可维护性 | 推荐度 |
|------|--------|------|----------|--------|
| **独立 Gateway 服务** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **内置 Gateway** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **混合模式** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **最小改动** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 🚀 推荐实施方案

### 阶段 1：内置 Gateway（MVP）

**目标**：快速验证 GPT Actions 集成

**实施步骤**：

1. **提取工具函数**（重构现有代码）
   - 从 `/api/mcp/route.ts` 中提取工具处理函数
   - 创建 `/api/mcp/handlers/` 目录
   - 每个工具一个 handler 文件

2. **创建 Gateway 路由**
   - `/api/gateway/recommend-jobs/route.ts`
   - `/api/gateway/search-jobs/route.ts`
   - ... (其他 9 个工具)

3. **生成 OpenAPI Schema**
   - 使用代码生成工具（如 `swagger-jsdoc`）
   - 或手动编写 `/api/gateway/openapi.json`

4. **测试验证**
   - 本地测试 Gateway endpoints
   - 在 GPT Builder 中配置并测试

**时间估算**：
- 提取工具函数：2-3 小时
- 创建 Gateway 路由：1-2 小时
- 生成 OpenAPI Schema：1 小时
- 测试调试：1 小时
- **总计：5-7 小时**

---

### 阶段 2：优化和增强

**优化方向**：
1. 统一 Gateway 路由（动态路由，减少代码重复）
2. 添加请求验证和错误处理
3. 添加日志和监控
4. 添加限流和缓存

---

## 🔧 技术实现细节

### 1. 工具函数提取

```typescript
// /api/mcp/handlers/recommendJobs.ts
export async function recommendJobsHandler(args: any) {
  // 从现有 /api/mcp/route.ts 中提取的逻辑
  // ...
  return result;
}
```

### 2. Gateway 路由实现

```typescript
// /api/gateway/recommend-jobs/route.ts
import { recommendJobsHandler } from '@/app/api/mcp/handlers/recommendJobs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await recommendJobsHandler(body);
    
    // 转换为 REST 响应格式
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

### 3. OpenAPI Schema 生成

```typescript
// /api/gateway/openapi.json
{
  "openapi": "3.0.0",
  "info": {
    "title": "HeraAI Gateway API",
    "version": "1.0.0"
  },
  "paths": {
    "/recommend-jobs": {
      "post": {
        "summary": "Get personalized job recommendations",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                // 从 MCP tool schema 转换
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  // 响应 schema
                }
              }
            }
          }
        }
      }
    }
    // ... 其他 10 个工具
  }
}
```

---

## ⚠️ 注意事项

### 1. 参数格式转换

MCP 使用 JSON-RPC 格式：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "recommend_jobs",
    "arguments": { ... }
  }
}
```

REST API 格式：
```json
{
  "job_title": "...",
  "city": "..."
}
```

Gateway 需要做参数映射。

---

### 2. 错误处理

MCP 错误格式：
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error"
  }
}
```

REST API 错误格式：
```json
{
  "success": false,
  "error": "Internal error"
}
```

---

### 3. 认证

如果需要认证，Gateway 层需要处理：
- Bearer token 验证
- API key 验证
- Session 管理

---

## 📝 最终建议

### ✅ 推荐方案：内置 Gateway（方案 1）

**理由**：
1. ✅ **最小改动**：不需要独立服务，直接在当前项目添加
2. ✅ **最佳性能**：内部函数调用，零网络开销
3. ✅ **易于维护**：代码集中，便于调试
4. ✅ **快速实施**：5-7 小时即可完成

**实施优先级**：
1. **高优先级工具**（先实现）：
   - `recommend_jobs`
   - `search_jobs`
   - `search_jobs_by_company`
   
2. **中优先级工具**：
   - `refine_recommendations`
   - `tailor_resume`
   - `build_search_links`
   
3. **低优先级工具**（可以后续添加）：
   - Career switch 相关工具（风险高）
   - `job_alert`（使用频率低）
   - `get_user_applications`（功能简单）

---

## 🎯 下一步行动

1. **确认方案**：选择内置 Gateway 还是独立服务
2. **提取工具函数**：重构现有 MCP 代码
3. **创建 Gateway 路由**：实现 REST API endpoints
4. **生成 OpenAPI Schema**：供 GPT Actions 使用
5. **测试验证**：在 GPT Builder 中测试

---

**文档版本**: 1.0  
**创建时间**: 2025-01  
**作者**: Cursor AI Assistant

