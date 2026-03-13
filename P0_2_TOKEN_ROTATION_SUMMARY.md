# P0-2 Token轮换修复总结

**完成时间**: 2025-01-27  
**修改范围**: 最小化改动，仅添加鉴权 + 文档脱敏

---

## ✅ 已完成的修改

### 1. 代码修改（最小化）

#### 1.1 添加最小鉴权函数
- **位置**: `src/app/api/mcp/route.ts` (103-141行)
- **函数**: `requireMcpAuth(request: NextRequest)`
- **功能**:
  - 读取 `Authorization: Bearer <token>` header
  - 验证token是否匹配 `MCP_SHARED_SECRET`（新token）
  - 兼容窗口：如果设置了 `MCP_SHARED_SECRET_OLD`，旧token也可通过
  - 不打印Authorization header到日志（安全）
  - 返回401 Unauthorized如果验证失败

#### 1.2 GET方法添加鉴权
- **位置**: `src/app/api/mcp/route.ts` (530行)
- **修改**: 在GET方法入口添加 `requireMcpAuth` 调用
- **改动**: 仅2行代码

#### 1.3 POST方法添加鉴权
- **位置**: `src/app/api/mcp/route.ts` (872行)
- **修改**: 在POST方法入口添加 `requireMcpAuth` 调用
- **改动**: 仅2行代码

**总代码改动**: 约40行（函数定义）+ 4行（调用）= 44行，最小化改动 ✅

### 2. 文档脱敏（完成）

**已替换的文件**（6个）:
1. `CHATGPT_APP_STORE_SUBMISSION_CHECKLIST.md`
2. `CHATGPT_APPS_INTEGRATION_GUIDE.md`
3. `MCP_TEST_RESULTS.md`
4. `MCP_INTEGRATION_GUIDE.md`
5. `MCP_IMPLEMENTATION_PLAN.md`
6. `GPT_SUGGESTIONS_SUMMARY.md`

**替换内容**:
- 旧Token: `hera_mcp_secret_2025_min_32_characters_long_random_string`
- 新占位符: `YOUR_MCP_SHARED_SECRET`
- **替换次数**: 19处

**验证结果**:
```bash
grep -r "hera_mcp_secret_2025_min_32_characters_long_random_string" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude="*.env*"
# 结果: 0 (仅.env.local中还有，需要手动更新)
```

### 3. 验证脚本（创建）

**文件**: `scripts/verify_mcp.sh`

**测试内容**:
1. ✅ GET /api/mcp with NEW token → 200, tools=11
2. ✅ POST tools/list with NEW token → 200, tools=11
3. ✅ Smoke test: search_jobs with NEW token
4. ✅ Smoke test: build_search_links with NEW token
5. ✅ GET with OLD token (if compatibility enabled) → 200
6. ✅ GET without token → 401
7. ✅ POST without token → 401

---

## 📋 你需要做的（环境变量更新）

### Step 1: 生成新Token

生成至少32字符的随机字符串，例如：
```bash
# 方法1: 使用openssl
openssl rand -hex 32

# 方法2: 使用node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法3: 使用在线工具
# 访问: https://www.random.org/strings/
```

**建议格式**: `hera_mcp_secret_2025_[32+字符随机字符串]`

### Step 2: 更新Vercel环境变量

1. 登录 Vercel Dashboard
2. 进入项目 → Settings → Environment Variables
3. 添加/更新：
   - **Key**: `MCP_SHARED_SECRET`
   - **Value**: `[你的新token]`
   - **Environments**: Production, Preview, Development
4. （可选，仅3天兼容窗口）添加：
   - **Key**: `MCP_SHARED_SECRET_OLD`
   - **Value**: `hera_mcp_secret_2025_min_32_characters_long_random_string`（旧token）
   - **Environments**: Production, Preview, Development
5. **Redeploy** 项目

### Step 3: 更新本地环境变量（如果使用）

更新 `.env.local`:
```bash
MCP_SHARED_SECRET=[你的新token]
MCP_SHARED_SECRET_OLD=hera_mcp_secret_2025_min_32_characters_long_random_string  # 仅3天兼容窗口
```

### Step 4: 更新所有调用方

1. **ChatGPT Apps / App Directory**:
   - 如果已经配置过，更新Bearer Token为新token
   - 配置位置：App Settings → Authentication → Bearer Token

2. **GPTs配置**（如果有）:
   - 更新GPTs Actions配置中的Authorization header

3. **本地脚本**:
   - 更新所有使用旧token的脚本

### Step 5: 3天后删除兼容窗口

**3天后必须执行**:
1. 在Vercel删除 `MCP_SHARED_SECRET_OLD` 环境变量
2. 在本地 `.env.local` 删除 `MCP_SHARED_SECRET_OLD`
3. Redeploy项目
4. 系统将只接受新token

---

## 🧪 验证步骤

### 1. 运行验证脚本

```bash
cd /Users/shuangshuangwu/Desktop/hera_one

# 设置环境变量（测试用）
export MCP_SHARED_SECRET="你的新token"
export MCP_SHARED_SECRET_OLD="hera_mcp_secret_2025_min_32_characters_long_random_string"  # 可选
export NEXT_PUBLIC_BASE_URL="http://localhost:3002"  # 或你的生产URL

# 运行验证脚本
./scripts/verify_mcp.sh
```

### 2. 预期结果

```
✅ PASS: GET returns 11 tools
✅ PASS: POST tools/list returns 11 tools
✅ PASS: search_jobs tool call
✅ PASS: build_search_links tool call
✅ PASS: GET with old token (should work during compatibility window)
✅ PASS: GET without token returns 401
✅ PASS: POST without token returns 401

✅ All tests passed!
```

### 3. 监控Vercel日志

部署后，观察Vercel Logs：
- 如果看到401错误，说明还有调用方在使用旧token
- 记录401的来源IP/User-Agent，更新对应的配置

---

## 📝 修改文件清单

### 代码文件
- `src/app/api/mcp/route.ts` - 添加鉴权函数和调用

### 文档文件（已脱敏）
- `CHATGPT_APP_STORE_SUBMISSION_CHECKLIST.md`
- `CHATGPT_APPS_INTEGRATION_GUIDE.md`
- `MCP_TEST_RESULTS.md`
- `MCP_INTEGRATION_GUIDE.md`
- `MCP_IMPLEMENTATION_PLAN.md`
- `GPT_SUGGESTIONS_SUMMARY.md`

### 新增文件
- `scripts/verify_mcp.sh` - 验证脚本

### 备份文件（桌面）
- `route.ts.backup_20251224_before_p0_2_token_fix` - 修改前
- `route.ts.backup_20251224_after_p0_2_token_fix` - 修改后

---

## ⚠️ 重要提醒

1. **不要提交.env.local到Git**: 确保 `.env.local` 在 `.gitignore` 中
2. **3天兼容窗口**: 必须在3天后删除 `MCP_SHARED_SECRET_OLD`，否则安全风险
3. **监控401错误**: 部署后观察日志，确保所有调用方都已更新
4. **测试生产环境**: 在更新Vercel环境变量后，用验证脚本测试生产环境

---

## ✅ 验收标准

- [x] 代码添加了最小鉴权（GET和POST入口）
- [x] 支持新token验证
- [x] 支持旧token兼容窗口（3天）
- [x] 文档脱敏完成（旧token 0命中，排除.env）
- [x] 验证脚本已创建
- [ ] 新token生成并更新到Vercel（需要你操作）
- [ ] 验证脚本运行通过（需要你操作）
- [ ] 所有调用方更新为新token（需要你操作）
- [ ] 3天后删除兼容窗口（需要你操作）

---

**下一步**: 生成新token并更新Vercel环境变量，然后运行验证脚本。









