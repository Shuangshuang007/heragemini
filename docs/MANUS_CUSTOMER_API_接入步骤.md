# Manus Customer API 接入步骤（Hera → Manus）

本文档按**严格先后顺序**写出：从备份、检查、部署到在 Manus 里完成配置与验证的每一步，以及现有仓库（hera_one 下）需要关注或改动的点。不跳步、不省略细节（含备份、部署、端口等）。

---

## 一、目标与前提

- **目标**：把 Hera 作为 Manus 的 Custom MCP Server 接入，在 Manus 里 **Settings → Integrations → Custom MCP Servers** 中**自己**添加、看到并可使用。
- **前提**：
  - 已有公网可访问的 Hera 域名（如 `https://heraai.net.au` 或 `https://heraai.one`）。
  - Manus 侧使用 **HTTPS + Bearer 认证** 调用我们的 `/api/mcp`，本地端口/部署只影响我们自己的环境，**不影响 Manus 接入**（Manus 只认公网 URL）。

---

## 二、接入步骤（严格顺序）

### 阶段一：备份与准备（先做，再动任何代码）

| 步骤 | 动作 | 说明 |
|------|------|------|
| 1.1 | 备份 MCP 路由与相关配置 | 复制 `src/app/api/mcp/route.ts` 到项目内备份目录，例如 `scripts/backup-before-manus/route.ts`，或打 git tag（如 `pre-manus-customer-api`）。 |
| 1.2 | 备份环境变量说明 | 若有 `.env.example` 或内部文档记录 `MCP_SHARED_SECRET`、`MONGODB_URI`、`MONGODB_DB` 等，确保有一份当前生产/测试用的说明，便于部署与 Manus 填认证时对照。 |
| 1.3 | 确认备份可还原 | 确保能从备份或 tag 还原 `route.ts`，再进入阶段二。 |

---

### 阶段二：代码与配置检查（hera_one 下）

| 步骤 | 检查项 | 当前状态 / 是否需要改 |
|------|--------|------------------------|
| 2.1 | **POST /api/mcp** 支持 `initialize` | 已支持。`body.method === "initialize"` 时返回 `protocolVersion`、`serverInfo`、`capabilities`。 |
| 2.2 | **POST /api/mcp** 支持 `tools/list` | 已支持。返回工具列表（含 `recommend_jobs`、`create_application_intent`、`prepare_application_context` 等），Manus 靠此拉取工具列表。 |
| 2.3 | **POST /api/mcp** 支持 `tools/call` | 已支持。含 `create_application_intent`、`prepare_application_context` 等 Manus 所需工具。 |
| 2.4 | **GET /api/mcp** | 已有（健康检查）。MCP 规范要求 endpoint 支持 GET；若不提供 SSE，可返回 200 或 405。当前为 200 + 简单 tools 列表，可保留。 |
| 2.5 | **认证** | 使用 `requireMcpAuth(request)`，校验 `Authorization: Bearer <token>`。Manus 里填的 Authentication 须与 `MCP_SHARED_SECRET`（或你们单独给 Manus 的 token）一致。 |
| 2.6 | **apply_applications 集合** | `create_application_intent` 会写 MongoDB `apply_applications`。确认生产环境 `MONGODB_URI`、`MONGODB_DB` 正确，且该库下可创建该集合。 |
| 2.7 | **Profile DB** | `prepare_application_context` 会查用户 profile（如 `getUserProfile`）。确认 profile 服务/DB 在生产可用。 |

**可选改动（仅在确有需求时做）：**

- 若 Manus 官方客户端要求 **MCP 协议版本** 或 **initialize 返回结构** 与当前不一致，再按 Manus 文档调整 `initialize` 的 `result` 结构。
- 若希望 Manus 请求带 **Header 区分来源**，已支持 `X-Caller: manus` 在 `recommend_jobs` 中识别；其他 tool 可按需扩展。

---

### 阶段三：部署与公网可达

| 步骤 | 动作 | 说明 |
|------|------|------|
| 3.1 | 确认生产部署方式 | 例如 Vercel：连 GitHub 自动部署；或自有服务器。确认 `next build` 与 `next start`（或 Vercel 的 start）正常。 |
| 3.2 | 确认生产域名与 /api/mcp | 生产 base URL 例如 `https://heraai.net.au`，则 Manus 要填的 **Server URL** 为 `https://heraai.net.au/api/mcp`（不要漏 `/api/mcp`）。 |
| 3.3 | 确认 HTTPS | Manus 只应填 HTTPS，不要用内网或 localhost。 |
| 3.4 | 本地端口与“释放端口” | 本地 `npm run dev` 使用端口 3002（见 `package.json` 的 `next dev -p 3002`）。**接入 Manus 不需要“释放”本地端口**：Manus 只调公网 URL。若本地 3002 被占用，仅影响本地开发；可关掉占用进程或改端口。部署到 Vercel 后由 Vercel 提供端口与域名，与本地 3002 无关。 |
| 3.5 | 环境变量（生产） | 生产环境中设置：`MCP_SHARED_SECRET`（与给 Manus 的 Bearer 一致）、`MONGODB_URI`、`MONGODB_DB`、以及 profile 相关配置。 |
| 3.6 | 验证公网可调 | 本地用 curl 测：`curl -X POST https://heraai.net.au/api/mcp -H "Content-Type: application/json" -H "Authorization: Bearer <你们的token>" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`，应返回 200 及工具列表 JSON。 |

---

### 阶段四：在 Manus 里添加 Custom MCP Server（我们自己在 Manus 里操作）

| 步骤 | 动作 | 说明 |
|------|------|------|
| 4.1 | 登录 Manus | 使用你们的 Manus 账号登录。 |
| 4.2 | 打开 Custom MCP 设置 | 进入 **Settings → Integrations → Custom MCP Servers**，点击 **Add Server**。 |
| 4.3 | 填 Server URL | 填写 **Server URL**：`https://heraai.net.au/api/mcp`（或你们实际生产域名 + `/api/mcp`）。 |
| 4.4 | 填 Authentication | 选择/填写 **Bearer token**（或 API key，视 Manus 界面选项）：值与生产环境 `MCP_SHARED_SECRET` 一致（或你们单独为 Manus 生成的 token）。 |
| 4.5 | 填 Server name | **Server name** 填便于识别的名称，如 `Hera Jobs` 或 `Hera MCP`。 |
| 4.6 | 保存并 Test Connection | 保存后，Manus 会进行 **Test Connection**：向你们的 `/api/mcp` 发请求（一般为 `initialize` + `tools/list`），并拉取可用工具列表。若成功，该 Custom MCP Server 会出现在列表中，**你们在 Manus 里能看到**。 |
| 4.7 | 确认列表中可见 | 在 **Custom MCP Servers** 或 **Integrations** 列表中确认出现刚添加的 Hera 服务器，状态为已连接/可用。 |

---

### 阶段五：验证与后续

| 步骤 | 动作 | 说明 |
|------|------|------|
| 5.1 | 在 Manus 中发起任务 | 在 Manus 里用自然语言发起与“推荐职位”“申请上下文”相关的任务，确认会调用到 Hera 的工具（如 recommend_jobs、prepare_application_context）。 |
| 5.2 | 检查 Hera 日志 | 在生产环境查看 MCP 路由日志，确认收到来自 Manus 的 `initialize`、`tools/list`、`tools/call` 请求。 |
| 5.3 | 调用顺序（给 Manus 侧参考） | 推荐 → 选 job → create_application_intent → prepare_application_context(application_id) → Manus 执行 browser/task。可在内部或给 Manus 的文档中写明该顺序。 |

---

## 三、现有文件与可能需要改动的地方（仅 hera_one 下）

| 文件/位置 | 用途 | 是否需要为接入 Manus 改动 |
|-----------|------|----------------------------|
| `src/app/api/mcp/route.ts` | MCP 入口：GET/POST、initialize、tools/list、tools/call、认证 | **当前已满足**。仅当 Manus 要求特定 MCP 版本或 initialize 格式时再改。 |
| `src/lib/db/mongoClient.ts` | MongoDB 连接；`apply_applications` 用同一 DB | 无需改；确认生产 env 的 `MONGODB_DB` 与 `getDb()` 使用一致。 |
| `src/services/profileDatabaseService.ts` | 用户 profile；prepare_application_context 会用到 | 无需改；确认生产可访问 profile DB。 |
| 环境变量（.env / Vercel 等） | `MCP_SHARED_SECRET`、`MONGODB_URI`、`MONGODB_DB`、profile 相关 | **必须**在生产配置正确；无需改代码。 |
| `docs/MANUS_CUSTOMER_API_INTEGRATION.md` | 给 Manus 或内部的接口说明 | 可选：把「我们自己在 Manus 里配置」的步骤与 Server URL、认证方式写进去，方便交接。 |

**结论：** 在现有实现下，**不需要为“接入 Manus Customer API”改任何代码**，只需：备份 → 确认部署与 env → 在 Manus 里按步骤四填写 URL、认证、名称并测试。

---

## 四、清单小结（按顺序执行）

1. **备份**：`route.ts` 及 env 说明；确认可还原。  
2. **检查**：POST 支持 initialize / tools/list / tools/call，GET 存在，认证与 DB 配置正确。  
3. **部署**：生产 build + 部署，公网 HTTPS，确认 `/api/mcp` 可访问且返回正常。  
4. **Manus 配置**：Settings → Integrations → Custom MCP Servers → Add Server → 填 URL、Bearer、名称 → Test Connection → 确认列表中出现且可用。  
5. **验证**：Manus 内跑任务 + 看 Hera 日志，必要时补充内部/对接文档（含调用顺序）。

---

## 五、端口与部署的进一步说明

- **本地**：`npm run dev` 使用 3002；仅用于开发。若 3002 被占用，可结束占用进程或修改 `package.json` 中 `dev` 的 `-p` 参数。  
- **生产（如 Vercel）**：端口由平台管理，对外只有域名（如 `https://heraai.net.au`）。Manus 只填该域名 + `/api/mcp`，**不需要也不应**填本地端口。  
- **“释放端口”**：仅当你要在本地跑完整服务或本地测试 Manus 直连时才需要；正式接入 Manus 使用生产 URL 即可，无需为接入而改或释放在本机端口。
