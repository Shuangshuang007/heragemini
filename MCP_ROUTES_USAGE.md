# MCP / ChatGPT 接入路由 — 实际使用说明

## 结论速览

| 路径 | 用途 | 是否在用 | 说明 |
|------|------|----------|------|
| **`/api/mcp`** | 完整 MCP（11 工具） | ✅ **在用** | 主 MCP Server，被 Gateway 内部调用 |
| **`/api/mcp-lite`** | 精简 MCP（4 工具） | ✅ **在用** | App Store 提交用，ChatGPT MCP Connector URL |
| **`/api/gateway/mcp`** | GPTs Actions 网关 | ✅ **在用** | REST 包装，内部调 **`/api/mcp`** |
| **`/api/gateway/mcp/openapi.json`** | OpenAPI 定义 | ✅ **在用** | 11 工具 schema，给 GPTs 用 |
| **`/api/mcp-test`** | 测试端点 | ⚠️ **仅测试** | 无业务引用，仅用于 Connector 验证 |
| **`/api/mcp-v2`** | AgentKit V2 实验 | ❌ **未接入业务** | 独立实验路由，与主 MCP 无关 |

---

## 1. 真实在用的代码

### 1.1 `src/app/api/mcp/route.ts` — 完整 MCP（11 工具）

- **作用**：主 MCP Server，实现 11 个工具（如 `search_jobs`、`recommend_jobs`、`tailor_resume`、`career_transition_advice` 等）。
- **被谁用**：
  - **Gateway**：`src/app/api/gateway/mcp/route.ts` 第 165 行写死调用 `${baseUrl}/api/mcp`。
  - 文档、脚本、career 相关逻辑都引用这个文件。
- **结论**：核心实现，必须保留。

### 1.2 `src/app/api/mcp-lite/route.ts` — 精简 MCP（4 工具，App Store）

- **作用**：仅暴露 4 个工具：`career_transition_advice`、`search_jobs`、`recommend_jobs`、`tailor_resume`，供 App Store / ChatGPT MCP Connector 使用。
- **被谁用**：
  - 文档与脚本（如 `test_mcp_lite_production.js`、`test_store_submission_lite.js`）都指向 `/api/mcp-lite`。
  - 不经过 Gateway，ChatGPT 直接连这个 URL。
- **结论**：App Store 提交用，必须保留。

### 1.3 `src/app/api/gateway/mcp/route.ts` + `openapi.json`

- **作用**：GPTs Actions 的 REST 网关，把 REST 请求转成 JSON-RPC 调 **`/api/mcp`**（不是 mcp-lite）。
- **openapi.json**：描述 11 个工具的 schema，GPTs 配置里填的 OpenAPI Schema URL 指向它。
- **结论**：GPTs Actions 在用，必须保留。

---

## 2. 未接入主流程 / 可清理的代码

### 2.1 `src/app/api/mcp-v2/route.ts` — AgentKit V2 实验

- **实际内容**：实现的是 **AgentKit V2** 的独立协议：
  - `agentkit-v2/plan`、`agentkit-v2/execute`
  - 依赖 `experimental/agentkit_mvp/planner`、`executor`
- **与主 MCP 的关系**：无。不是「MCP 的 v2」，也不是「4 工具的 Gateway」。
- **是否被引用**：在 `src` 下没有业务或前端代码引用 `/api/mcp-v2`，只有文档里提到的「gateway/mcp-v2」是另一个设想（未实现的 Gateway v2 路径）。
- **建议**：
  - 若不再做 AgentKit V2 实验：可删除整个 `src/app/api/mcp-v2/`。
  - 若保留实验：可改名为 `api/agentkit-v2` 或加注释标明「仅实验用」，避免和 MCP 混淆。

### 2.2 `src/app/api/mcp-test/route.ts` — 测试端点

- **作用**：极简 GET/POST，返回静态工具列表和假数据，用于 ChatGPT Connector 验证。
- **是否被引用**：仅在自身注释和测试脚本里出现，没有业务代码依赖。
- **建议**：
  - 若还需要做 Connector 验证：保留。
  - 若不需要：可删除，或保留在 `scripts/` 里用本地脚本代替。

---

## 3. 调用关系图

```
ChatGPT / 外部
    │
    ├─ MCP Connector (App Store) ──────────► /api/mcp-lite   (4 工具)
    │
    └─ GPTs Actions (OpenAPI) ─────────────► /api/gateway/mcp
                                                │
                                                └─ 内部 POST ──► /api/mcp   (11 工具)
```

- **mcp-lite** 与 **mcp** 是两条线：一个直接 4 工具，一个 11 工具并被 Gateway 包装。
- **gateway/mcp** 只认 **/api/mcp**，不认 mcp-lite。

---

## 4. 文件清单（按是否必留）

| 文件 | 必留？ |
|------|--------|
| `src/app/api/mcp/route.ts` | ✅ 是 |
| `src/app/api/mcp/helpers.ts` | ✅ 是（被 mcp、mcp-lite 共用） |
| `src/app/api/mcp-lite/route.ts` | ✅ 是 |
| `src/app/api/gateway/mcp/route.ts` | ✅ 是 |
| `src/app/api/gateway/mcp/openapi.json` | ✅ 是 |
| `src/app/api/gateway/mcp/openapi/route.ts` | ✅ 是（若 OpenAPI 通过该 route 提供） |
| `src/app/api/mcp-test/route.ts` | ⚠️ 仅测试需要可留 |
| `src/app/api/mcp-v2/route.ts` | ❌ 未接入业务，可删或改为实验用路由 |

如果你愿意，我可以下一步帮你：  
- 删掉 `mcp-v2` 或改成 `agentkit-v2` 并加注释；  
- 或删掉 `mcp-test` 并整理相关脚本引用。
