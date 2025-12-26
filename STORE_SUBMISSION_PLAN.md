# App Store 首发方案执行计划（4工具版本）

**目标**: 首发只暴露 4 个工具，不影响现有 GPTs  
**最后更新**: 2025-01-XX  
**状态**: 待执行

---

## 📋 为什么需要隔离

### 问题背景
- 现有 GPTs 可能依赖 11 个工具
- App Store 审核需要最小化风险（只暴露稳定的 4 个工具）
- 不能影响现有线上服务

### 解决方案
**创建独立的"App Store 专用端点"，完全隔离现有端点**

- ✅ 现有端点保持不变（11 个工具）
- ✅ 新端点只暴露 4 个工具
- ✅ 两套端点互不影响

---

## 🎯 首发工具清单（顺序固定）

1. `career_transition_advice` - 职业转换建议
2. `search_jobs` - 职位搜索
3. `recommend_jobs` - 个性化职位推荐
4. `tailor_resume` - 简历定制

### 第二批再上（本次不暴露）
- `career_path_explorer` - 当前不稳定/参数映射不足
- `career_skill_gap_analysis` - 缺省输入会崩（已修复但需更多测试）
- `refine_recommendations` - location 类型不一致导致崩/边界复杂
- `job_alert` - 推送类审核敏感，后置
- `search_jobs_by_company` - 可合并到 search_jobs
- `build_search_links` - 辅助工具，非核心
- `get_user_applications` - 需要用户认证，后置

---

## 🏗️ 架构设计

### 现有端点（保持不变）
```
/api/mcp                    → 11 tools (GET tools + tools/list)
/api/gateway/mcp            → 11 tools (GPTs Actions)
/api/gateway/mcp/openapi.json → 11 tools schema
```

### 新增端点（App Store 专用）
```
/api/mcp-lite               → 4 tools (MCP Connector URL - App Store 提交用)
/api/gateway/mcp-v2         → 4 tools (GPTs Actions - 可选，不影响 App Store)
/api/gateway/mcp-v2/openapi.json → 4 tools schema (GPTs Actions - 可选)
```

**注意**:
- `/api/mcp-lite` 是 **App Store 提交的核心**（MCP Connector URL）
- Gateway v2 和 OpenAPI schema 只用于 GPTs Actions，不是 App Store 提交的关键项

---

## 📝 执行步骤

### Step 1: 创建 MCP Lite 专用路径（用于 App Store 提交）

**文件**: `src/app/api/mcp-lite/route.ts`（新建文件）

**实现方式**:
1. **复制现有 MCP 路由**:
   - 复制 `src/app/api/mcp/route.ts` → `src/app/api/mcp-lite/route.ts`

2. **定义常量**（文件顶部）:
   ```typescript
   const LITE_TOOLS = [
     'career_transition_advice',
     'search_jobs',
     'recommend_jobs',
     'tailor_resume'
   ] as const;
   ```

3. **GET 方法修改**:
   - ✅ **固定返回 4 个工具**（不检查 variant，因为这是专用路径）
   - ✅ **必须加** `Cache-Control: no-store` 响应头
   - ✅ 工具顺序严格按照：career_transition_advice, search_jobs, recommend_jobs, tailor_resume

4. **POST `tools/list` 方法修改**:
   - ✅ **固定返回 4 个工具定义**（不检查 variant）
   - ✅ 工具顺序严格按照：career_transition_advice, search_jobs, recommend_jobs, tailor_resume

5. **`tools/call` 方法修改**（必须做 allowlist）:
   - ✅ **固定检查 allowlist**（不检查 variant）
   - ✅ 如果工具名不在 4 个工具列表中，返回 400 错误
   - ✅ 错误信息明确说明可用工具列表

**优点**:
- ✅ 干净的 URL，符合 ChatGPT Connector 习惯
- ✅ 避免 UI/校验器对 query 参数的潜在限制
- ✅ 完全隔离，不影响现有 `/api/mcp`

**实现方式**:
```typescript
// ✅ 固定返回 4 个工具（专用路径，不需要检查 variant）
// GET 方法
const toolsToReturn = LITE_TOOLS; // 固定 4 个工具

// POST tools/list
const toolsToReturn = LITE_TOOLS; // 固定 4 个工具定义

// ✅ tools/call 必须做 allowlist（保持一致）
if (!LITE_TOOLS.includes(name)) {
  return json200({ 
    jsonrpc: "2.0",
    id: body.id ?? null,
    error: { 
      code: -32601, 
      message: `Tool "${name}" is not available in lite mode. Available tools: ${LITE_TOOLS.join(', ')}` 
    }
  }, { status: 400 });
}

// ✅ GET 返回必须加 Cache-Control: no-store（防止缓存污染）
return json200(toolsToReturn, {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
});
```

**常量定义**:
```typescript
const LITE_TOOLS = [
  'career_transition_advice',
  'search_jobs',
  'recommend_jobs',
  'tailor_resume'
] as const;
```

---

### Step 2: 创建 Gateway v2（用于 GPTs Actions，可选）

**文件**: `src/app/api/gateway/mcp-v2/route.ts`

**实现方式**:
1. 复制 `src/app/api/gateway/mcp/route.ts`
2. 修改 `AVAILABLE_TOOLS` 数组，只保留 4 个工具
3. 内部调用时使用 `/api/mcp-lite` 路径

**注意**: Gateway v2 只用于 GPTs Actions，不是 App Store 提交的关键项。

**关键代码**:
```typescript
const AVAILABLE_TOOLS = [
  'career_transition_advice',
  'search_jobs',
  'recommend_jobs',
  'tailor_resume'
] as const;

// ✅ 调用 MCP Lite 专用路径（不是 variant=lite）
const mcpUrl = `${baseUrl}/api/mcp-lite`;
```

**注意**: Gateway v2 只用于 GPTs Actions，不是 App Store 提交的关键项。

---

### Step 3: 创建 OpenAPI Schema v2

**文件**: `src/app/api/gateway/mcp-v2/openapi.json`

**实现方式**:
1. 复制 `src/app/api/gateway/mcp/openapi.json`
2. 修改 `tool.enum`，只保留 4 个工具
3. 修改 `tool.description`，只描述 4 个工具
4. 修改 `examples`，**必须补齐** 4 个工具的示例：
   - `recommend_jobs` ✅（已有）
   - `search_jobs` ✅（已有）
   - `career_transition_advice` ⚠️（需要添加）
   - `tailor_resume` ⚠️（需要添加）

**注意**: 
- OpenAPI schema **只用于 GPTs Actions**，不是 App Store 提交的关键项
- 如果不需要 GPTs Actions，可以跳过 Step 2-4

---

### Step 4: 创建 OpenAPI 路由（如果需要）

**文件**: `src/app/api/gateway/mcp-v2/openapi/route.ts`

**实现方式**:
1. 复制 `src/app/api/gateway/mcp/openapi/route.ts`
2. 修改返回的 schema 路径

---

## ✅ 验收标准

### 1. 旧入口不变
- [ ] GET `/api/mcp` → 11 tools
- [ ] POST `/api/mcp` tools/list → 11 tools
- [ ] `/api/gateway/mcp` → 11 tools

### 2. Lite 入口正确
- [ ] GET `/api/mcp-lite` → 4 tools（顺序正确：career_transition_advice, search_jobs, recommend_jobs, tailor_resume）
- [ ] POST `/api/mcp-lite` tools/list → 4 tools（顺序正确）
- [ ] POST `/api/mcp-lite` tools/call（调用非 4 工具）→ 400 错误（allowlist 生效）
- [ ] `/api/gateway/mcp-v2` → 4 tools（GPTs Actions，可选）
- [ ] `/api/gateway/mcp-v2/openapi.json` → 4 tools schema（GPTs Actions，可选）

### 3. 4 工具稳定性测试
- [ ] `career_transition_advice`: 5 次不同输入，成功率 100%
- [ ] `search_jobs`: 5 次不同输入，成功率 100%
- [ ] `recommend_jobs`: 15 次测试（5 次基础 + 10 次连续），0 次 400/500/TypeError
- [ ] `tailor_resume`: 5 次不同输入，允许 FEEDBACK_WRITE_TIMEOUT，但主返回必须正常

---

## 📦 交付物清单

- [x] `STORE_SUBMISSION_PLAN.md` - 本文件
- [ ] `src/app/api/mcp-lite/route.ts` - **MCP Lite 专用路径（App Store 提交核心）**
- [ ] `src/app/api/gateway/mcp-v2/route.ts` - Gateway v2 实现（GPTs Actions，可选）
- [ ] `src/app/api/gateway/mcp-v2/openapi.json` - OpenAPI schema v2（GPTs Actions，可选）
- [ ] `src/app/api/gateway/mcp-v2/openapi/route.ts` - OpenAPI 路由（GPTs Actions，可选）
- [ ] `TEST_RESULTS_STORE_SUBMISSION.md` - 测试记录

---

## 🔧 技术细节

### ⚠️ 关键决策：使用专用路径而不是 query 参数

**原因**:
- ChatGPT Connector URL 习惯使用干净的 `/mcp` 风格 URL
- 避免 UI/校验器对 query 参数的潜在限制
- 更符合 App Store 提交的最佳实践

**实现方式**: 创建新路径 `/api/mcp-lite`

**优点**:
- ✅ 干净的 URL，符合 ChatGPT Connector 习惯
- ✅ 完全隔离，不影响现有 `/api/mcp`
- ✅ 避免缓存污染问题
- ✅ 审核时更清晰

**缺点**:
- 需要创建新文件（但代码可以复用）

### ⚠️ 必须遵守的 3 个要求

#### 1. tools/call allowlist（必须做）
**问题**: 如果清单是 4 个，但 call 还能调用 11 个，审核口径不一致  
**修正**: `/api/mcp-lite` 路径下，如果工具名不在 4 个工具列表中，返回 400 错误  
**影响**: 确保审核时只能调用 4 个工具

#### 2. GET 缓存污染风险（必须避免）
**问题**: 平台/CDN 可能缓存 GET 响应  
**修正**: GET 返回必须加 `Cache-Control: no-store`  
**影响**: 防止"今天好明天坏"的不确定性

#### 3. 工具顺序固定（必须遵守）
**问题**: 审核需要一致的顺序  
**修正**: 严格按照顺序返回：career_transition_advice, search_jobs, recommend_jobs, tailor_resume

### Gateway v2 实现

**方式**: 创建新目录 `/api/gateway/mcp-v2`

**优点**:
- 完全隔离
- 不影响现有 Gateway
- 易于维护

---

## ⚠️ 重要提醒

1. **不要删除现有代码**: 所有工具的后端实现保留，只是不在清单中暴露
2. **测试顺序**: 先测试现有端点不受影响，再测试新端点
3. **部署顺序**: 先部署到测试环境，验证后再部署生产
4. **文档更新**: 提交前更新相关文档，说明隔离原因

---

## 📊 提交时使用的端点

### ✅ App Store 提交（ChatGPT Apps / MCP Connector）

**提交的是 MCP Connector URL**:
```
https://www.heraai.net.au/api/mcp-lite
```

**提交时需要填写**:
- **Connector name**: `mcp-app-lite`（或你想要的展示名称）
- **Description**: 给审核/模型看的简介
- **Connector URL**: `https://www.heraai.net.au/api/mcp-lite`

平台会通过 MCP 的 `tools/list` 等机制自动发现工具。

**注意**: 
- ✅ 名字只是展示名，不影响技术调用（技术调用看 URL）
- ✅ 这是 App Store 提交的**核心**，必须准备好

### 📝 GPTs Actions（可选，不影响 App Store 提交）

如果同时要发布一个 GPT，可以使用 OpenAPI Schema:
```
https://www.heraai.net.au/api/gateway/mcp-v2/openapi.json
```

**注意**: 
- OpenAPI schema **只用于 GPTs Actions**，不是 App Store 提交的关键项
- Gateway v2 和 OpenAPI schema 是**可选的**，不影响 App Store 提交

---

**状态**: 待用户确认后执行

