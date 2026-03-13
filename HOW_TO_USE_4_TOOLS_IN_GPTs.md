# 如何在 GPTs 中使用 4 工具版本

## 🎯 目标

在 ChatGPT GPTs Actions 中使用新的 4 工具版本（`career_transition_advice`, `search_jobs`, `recommend_jobs`, `tailor_resume`）。

---

## 📋 当前状态

### ✅ 已完成
- `/api/mcp-lite` - MCP Server（4工具，JSON-RPC 2.0）
- 用于 App Store 提交

### ❌ 未完成
- `/api/gateway/mcp-v2` - Gateway v2（REST API 包装）
- `/api/gateway/mcp-v2/openapi.json` - OpenAPI Schema v2
- GPTs Actions 配置

---

## 🚀 实施步骤

### Step 1: 创建 Gateway v2

**文件**: `src/app/api/gateway/mcp-v2/route.ts`

**操作**：
1. 复制 `src/app/api/gateway/mcp/route.ts` 到新文件
2. 修改 `AVAILABLE_TOOLS` 数组：

```typescript
const AVAILABLE_TOOLS = [
  'career_transition_advice',
  'search_jobs',
  'recommend_jobs',
  'tailor_resume'
] as const;
```

3. 修改内部调用路径：

```typescript
// 原来：const mcpUrl = `${baseUrl}/api/mcp`;
// 改为：
const mcpUrl = `${baseUrl}/api/mcp-lite`;
```

---

### Step 2: 创建 OpenAPI Schema v2

**文件**: `src/app/api/gateway/mcp-v2/openapi.json`

**操作**：
1. 复制 `src/app/api/gateway/mcp/openapi.json` 到新文件
2. 修改 `tool.enum`，只保留 4 个工具：

```json
{
  "tool": {
    "enum": [
      "career_transition_advice",
      "search_jobs",
      "recommend_jobs",
      "tailor_resume"
    ]
  }
}
```

3. 更新描述：

```json
{
  "description": "Call any of the 4 available MCP tools by specifying the tool name and arguments. Available tools:\n- career_transition_advice: Get personalized career switch recommendations\n- search_jobs: Search for jobs by title and location\n- recommend_jobs: Get personalized job recommendations\n- tailor_resume: Optimize or tailor resume for a job"
}
```

4. 添加缺失的示例（`career_transition_advice` 和 `tailor_resume`）：

```json
{
  "examples": {
    "career_transition_advice": {
      "summary": "Career transition advice example",
      "value": {
        "tool": "career_transition_advice",
        "arguments": {
          "current_job": "Software Engineer",
          "experience_years": 5,
          "skills": ["JavaScript", "React", "Node.js", "TypeScript", "MongoDB"],
          "location": "Sydney"
        }
      }
    },
    "tailor_resume": {
      "summary": "Tailor resume example",
      "value": {
        "tool": "tailor_resume",
        "arguments": {
          "resume_content": "...",
          "user_profile": {
            "jobTitles": ["Software Engineer"],
            "skills": ["React", "TypeScript"],
            "employmentHistory": [{"title": "Software Engineer", "company": "ABC Corp"}]
          },
          "job_description": "...",
          "job_title": "Senior Software Engineer",
          "company": "XYZ Inc"
        }
      }
    }
  }
}
```

---

### Step 3: 创建 OpenAPI 路由（可选）

**文件**: `src/app/api/gateway/mcp-v2/openapi/route.ts`

**操作**：
1. 复制 `src/app/api/gateway/mcp/openapi/route.ts` 到新文件
2. 修改返回的 schema 路径：

```typescript
// 原来：return NextResponse.json(openApiSchema);
// 改为：确保返回的是 v2 的 schema
```

---

### Step 4: 在 GPTs 中配置

**操作**：
1. 打开 ChatGPT GPTs 编辑器
2. 添加新的 Action（或修改现有 Action）
3. 选择 "Import from URL"
4. 输入 OpenAPI Schema URL：
   ```
   https://www.heraai.net.au/api/gateway/mcp-v2/openapi.json
   ```
5. 设置 Authentication：
   - Type: Bearer Token
   - Token: `MCP_SHARED_SECRET` 的值（从环境变量获取）
6. 保存配置

---

## 🔍 验证步骤

### 1. 测试 Gateway v2 端点

```bash
curl -X POST https://www.heraai.net.au/api/gateway/mcp-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MCP_SHARED_SECRET>" \
  -d '{
    "tool": "search_jobs",
    "arguments": {
      "job_title": "Software Engineer",
      "city": "Sydney"
    }
  }'
```

**预期响应**：
```json
{
  "success": true,
  "tool": "search_jobs",
  "result": { ... },
  "meta": { ... }
}
```

### 2. 测试 OpenAPI Schema

```bash
curl https://www.heraai.net.au/api/gateway/mcp-v2/openapi.json
```

**预期响应**：返回 OpenAPI 3.1.0 schema，包含 4 个工具的定义。

### 3. 测试 GPTs Actions

在 ChatGPT GPTs 中测试调用：
- `career_transition_advice`
- `search_jobs`
- `recommend_jobs`
- `tailor_resume`

---

## 📊 对比：现有 GPTs vs 新版本

| 项目 | 现有 GPTs (11工具) | 新版本 (4工具) |
|------|-------------------|---------------|
| **Gateway** | `/api/gateway/mcp` | `/api/gateway/mcp-v2` |
| **OpenAPI Schema** | `/api/gateway/mcp/openapi.json` | `/api/gateway/mcp-v2/openapi.json` |
| **内部调用** | `/api/mcp` | `/api/mcp-lite` |
| **工具数量** | 11 个 | 4 个 |
| **用途** | 现有 GPTs | 新 GPTs（4工具版本） |

---

## ⚠️ 注意事项

1. **不影响现有 GPTs**：
   - 现有 GPTs 继续使用 `/api/gateway/mcp`（11工具）
   - 新 GPTs 使用 `/api/gateway/mcp-v2`（4工具）

2. **认证 Token**：
   - 两个版本使用相同的 `MCP_SHARED_SECRET`
   - 确保环境变量已正确配置

3. **部署顺序**：
   - 先部署代码（Gateway v2 + OpenAPI Schema v2）
   - 再在 GPTs 中配置新的 OpenAPI Schema URL

---

## ✅ 完成检查清单

- [ ] 创建 `src/app/api/gateway/mcp-v2/route.ts`
- [ ] 创建 `src/app/api/gateway/mcp-v2/openapi.json`
- [ ] 创建 `src/app/api/gateway/mcp-v2/openapi/route.ts`（可选）
- [ ] 测试 Gateway v2 端点
- [ ] 测试 OpenAPI Schema v2
- [ ] 在 GPTs 中配置新的 OpenAPI Schema URL
- [ ] 测试 GPTs Actions 调用
- [ ] 部署到生产环境

---

## 🎯 总结

**关键点**：
1. GPTs Actions **必须使用 OpenAPI Schema**（REST API），不能直接使用 MCP Server URL
2. 需要创建 Gateway v2 作为 REST API 包装层
3. Gateway v2 内部调用 `/api/mcp-lite`（MCP Server）
4. 两个版本可以共存，互不影响

**下一步**：按照上述步骤创建 Gateway v2 和 OpenAPI Schema v2。








