# ChatGPT 应用商店上线申请清单

**检查日期**: 2025-01-XX  
**当前状态**: 技术实现已完成，准备提交审核

---

## 📊 当前MCP工具状态

### ✅ 已实现的工具（共11个）

根据 `src/app/api/mcp/route.ts` 的 `tools/list` 方法，以下工具已完整实现：

1. ✅ **job_alert** - 职位提醒（定时推送新职位）
2. ✅ **recommend_jobs** - 个性化职位推荐（AI匹配）
3. ✅ **refine_recommendations** - 优化推荐结果（基于反馈）
4. ✅ **search_jobs_by_company** - 按公司搜索职位
5. ✅ **search_jobs** - 简单职位搜索
6. ✅ **build_search_links** - 生成搜索链接
7. ✅ **get_user_applications** - 获取申请历史
8. ✅ **tailor_resume** - 简历定制
9. ✅ **career_transition_advice** - 职业转换建议
10. ✅ **career_path_explorer** - 职业路径探索
11. ✅ **career_skill_gap_analysis** - 技能差距分析

### ⚠️ 发现的问题

**GET端点返回的工具数量不一致**：
- `GET /api/mcp` 只返回了 **9个工具**（缺少 `job_alert` 和 `refine_recommendations`）
- `POST /api/mcp` 的 `tools/list` 方法返回了 **11个工具**（完整）

**建议修复**：更新 `GET /api/mcp` 端点，使其返回完整的11个工具列表。

---

## ✅ 已完成项

### 1. 技术实现
- [x] MCP端点已部署：`https://heraai-rebuild-public-v1-kc4f.vercel.app/api/mcp`
- [x] 11个MCP工具已实现
- [x] Bearer Token认证已配置（`MCP_SHARED_SECRET`）
- [x] JSON-RPC 2.0协议支持
- [x] 错误处理和超时保护
- [x] 测试通过（见 `MCP_TEST_RESULTS.md`）

### 2. 合规文件
- [x] 隐私政策页面：`/privacy` ✅
  - URL: `https://heraai-rebuild-public-v1-kc4f.vercel.app/privacy`
  - 生效日期：2025年7月28日
- [x] 服务条款页面：`/terms` ✅
  - URL: `https://heraai-rebuild-public-v1-kc4f.vercel.app/terms`
  - 生效日期：2025年7月28日

### 3. 文档准备
- [x] 集成指南：`CHATGPT_APPS_INTEGRATION_GUIDE.md`
- [x] MCP工具完整说明：`MCP_TOOLS_COMPLETE_DESCRIPTION.md`
- [x] 测试结果：`MCP_TEST_RESULTS.md`

---

## ❌ 待完成项

### 1. 应用信息准备（必需）

#### 1.1 应用基本信息
- [ ] **应用名称**（建议）：
  ```
  HeraAI - Multi-Source Job Search
  ```
  或
  ```
  HeraAI (heraai.net.au)
  ```

- [ ] **简短描述**（建议）：
  ```
  Search AU/Global jobs using HeraAI's intelligent job aggregation system
  ```

- [ ] **详细描述**（建议，基于 `CHATGPT_APPS_INTEGRATION_GUIDE.md`）：
  ```
  Hera AI aggregates jobs from 4+ major job boards (LinkedIn, SEEK, Jora, Adzuna) with intelligent features:

  • Multi-source aggregation: Search across multiple platforms simultaneously
  • AI-powered expansion: Automatically expands search terms (e.g., "software engineer" → 11 related titles)
  • Smart deduplication: Removes duplicate jobs using company+title+location fingerprinting
  • Country optimization: Prioritizes SEEK for Australian jobs, LinkedIn for global searches
  • Match scoring: AI-driven fit analysis (experience, skills, industry, location)
  • Source transparency: Each job tagged with origin platform
  • Deep links: Direct access to native job board listings
  • Application tracking: Unified view of all applications across platforms

  Data Sources: Hera AI distinguishes between ATS sources (e.g., Lever) and job board platforms. For ATS sources, we store job metadata from official feeds. For job board platforms (LinkedIn, SEEK, Jora, Adzuna), we do NOT scrape or copy content—we only generate search links that direct users to the original platforms. All displayed job data comes from Hera AI's own aggregated database.

  Ideal for job seekers who want comprehensive coverage beyond single platforms.
  ```

- [ ] **分类**：
  ```
  Productivity > Career & Jobs
  ```

#### 1.2 应用Logo/图标（必需）
- [ ] **应用图标**（需要准备）
  - 尺寸要求：通常需要 512x512px 或更高分辨率
  - 格式：PNG（透明背景）或 SVG
  - 当前状态：未找到专用应用图标
  - 建议：基于现有Logo创建应用商店专用图标

- [ ] **品牌Logo检查**
  - 当前有：`public/Lululemon.png`（非应用Logo）
  - 需要：HeraAI品牌Logo（512x512px或更高）

#### 1.3 网站和链接
- [x] **网站URL**：
  ```
  https://heraai-rebuild-public-v1-kc4f.vercel.app
  ```
  或
  ```
  https://www.heraai.net.au
  ```

- [x] **隐私政策URL**：
  ```
  https://heraai-rebuild-public-v1-kc4f.vercel.app/privacy
  ```

- [x] **服务条款URL**：
  ```
  https://heraai-rebuild-public-v1-kc4f.vercel.app/terms
  ```

### 2. 开发者信息（必需）

- [ ] **开发者名称**：
  ```
  HeraAI Team
  ```
  或
  ```
  [您的公司名称]
  ```

- [ ] **开发者联系邮箱**：
  ```
  support@heraai.com
  ```
  或
  ```
  [您的实际联系邮箱]
  ```

- [ ] **开发者网站**（可选）：
  ```
  https://www.heraai.net.au
  ```

### 3. 技术配置检查

#### 3.1 MCP端点配置
- [x] **端点URL**：
  ```
  https://heraai-rebuild-public-v1-kc4f.vercel.app/api/mcp
  ```

- [x] **认证方式**：Bearer Token
- [x] **Token值**：`YOUR_MCP_SHARED_SECRET`
- [ ] **协议验证**：确认ChatGPT Apps支持MCP协议（可能需要OpenAPI格式）

#### 3.2 工具发现机制
- [x] **GET方法**：返回工具清单（当前返回9个，需修复为11个）
- [x] **POST方法**：调用工具（`tools/call`）
- [ ] **工具数量一致性**：修复GET端点，返回完整的11个工具

### 4. 功能测试（必需）

#### 4.1 基础功能测试
- [ ] **工具清单获取**：
  ```bash
  curl -H "Authorization: Bearer YOUR_MCP_SHARED_SECRET" \
    https://heraai-rebuild-public-v1-kc4f.vercel.app/api/mcp
  ```
  - 预期：返回11个工具（当前返回9个，需修复）

- [ ] **工具调用测试**：
  - [ ] `search_jobs` - 职位搜索
  - [ ] `recommend_jobs` - 个性化推荐
  - [ ] `build_search_links` - 生成链接
  - [ ] `get_user_applications` - 获取申请历史
  - [ ] `tailor_resume` - 简历定制
  - [ ] `career_transition_advice` - 职业转换建议
  - [ ] 其他工具...

#### 4.2 ChatGPT集成测试
- [ ] 在ChatGPT中创建测试App
- [ ] 测试工具自动发现
- [ ] 测试工具调用
- [ ] 测试错误处理
- [ ] 测试响应格式

### 5. 合规性检查

#### 5.1 隐私和数据安全
- [x] 隐私政策已发布
- [ ] **数据收集声明**：确认隐私政策包含：
  - [ ] 收集的数据类型（用户邮箱、简历、申请历史等）
  - [ ] 数据使用目的
  - [ ] 数据存储位置
  - [ ] 数据共享政策
  - [ ] 用户权利（删除、导出等）

- [ ] **GDPR合规**（如适用）：
  - [ ] Cookie政策
  - [ ] 数据主体权利
  - [ ] 数据处理法律依据

#### 5.2 服务条款
- [x] 服务条款已发布
- [ ] **内容检查**：确认包含：
  - [ ] 服务描述
  - [ ] 用户责任
  - [ ] 知识产权声明
  - [ ] 免责声明
  - [ ] 争议解决机制

#### 5.3 内容政策
- [ ] **内容适合性**：确认应用内容适合所有受众
- [ ] **第三方集成**：确认遵守LinkedIn、SEEK等平台的API使用政策
- [ ] **数据来源**：确认职位数据的使用符合各平台服务条款

### 6. 性能和质量

#### 6.1 性能指标
- [x] 响应时间：< 15秒（已测试）
- [ ] **负载测试**：确认能处理并发请求
- [ ] **错误率**：监控并保持在可接受范围

#### 6.2 用户体验
- [ ] **错误消息**：清晰、友好的错误提示
- [ ] **响应格式**：确保ChatGPT能正确渲染结果
- [ ] **文档质量**：工具描述清晰、准确

### 7. 提交准备

#### 7.1 开发者账户
- [ ] **OpenAI开发者账户**：
  - [ ] 注册/登录：https://platform.openai.com
  - [ ] 验证邮箱
  - [ ] 完成身份验证（如需要）

#### 7.2 应用提交
- [ ] **访问应用商店**：
  - [ ] 登录：https://platform.openai.com/apps
  - [ ] 创建新应用

- [ ] **填写应用信息**：
  - [ ] 应用名称
  - [ ] 简短描述
  - [ ] 详细描述
  - [ ] 分类
  - [ ] Logo/图标
  - [ ] 网站URL
  - [ ] 隐私政策URL
  - [ ] 服务条款URL

- [ ] **配置技术设置**：
  - [ ] MCP端点URL
  - [ ] 认证方式（Bearer Token）
  - [ ] Token值
  - [ ] 协议类型（MCP/OpenAPI）

- [ ] **工具配置**：
  - [ ] 自动发现工具（通过GET端点）
  - [ ] 或手动配置11个工具

#### 7.3 审核准备
- [ ] **测试账号**：准备测试用的ChatGPT账户
- [ ] **演示视频**（可选）：录制功能演示视频
- [ ] **使用说明**：准备简短的使用指南

---

## 🔧 需要立即修复的问题

### 优先级1：关键问题

1. **修复GET端点工具数量不一致**
   - 文件：`src/app/api/mcp/route.ts`
   - 位置：`GET` 方法（约530-576行）
   - 问题：只返回9个工具，缺少 `job_alert` 和 `refine_recommendations`
   - 修复：更新GET方法，返回完整的11个工具列表

2. **准备应用Logo**
   - 需要：512x512px PNG或SVG格式的应用图标
   - 建议：基于现有品牌设计，符合ChatGPT应用商店规范

### 优先级2：重要问题

3. **验证MCP协议支持**
   - 确认ChatGPT应用商店是否支持MCP协议
   - 如果不支持，可能需要转换为OpenAPI格式
   - 参考：`GATEWAY_ARCHITECTURE_ANALYSIS.md` 中提到的Gateway方案

4. **完善隐私政策**
   - 确认包含所有必需的数据收集和使用声明
   - 确保符合GDPR（如适用）

---

## 📝 提交步骤（按顺序）

### Step 1: 修复技术问题（1-2小时）
1. 修复GET端点，返回完整的11个工具
2. 测试所有工具调用
3. 验证端点稳定性

### Step 2: 准备应用信息（1-2小时）
1. 准备应用Logo（512x512px）
2. 完善应用描述
3. 确认所有URL可访问

### Step 3: 合规性检查（1小时）
1. 检查隐私政策完整性
2. 检查服务条款完整性
3. 确认第三方API使用合规

### Step 4: 功能测试（1-2小时）
1. 在ChatGPT中创建测试App
2. 测试所有11个工具
3. 验证错误处理
4. 确认响应格式正确

### Step 5: 提交审核（30分钟）
1. 登录OpenAI开发者平台
2. 创建新应用
3. 填写所有必需信息
4. 配置MCP端点
5. 提交审核

### Step 6: 跟踪审核（持续）
1. 监控审核状态
2. 响应审核反馈
3. 修复发现的问题

---

## 📚 参考文档

- [ChatGPT Apps集成指南](./CHATGPT_APPS_INTEGRATION_GUIDE.md)
- [MCP工具完整说明](./MCP_TOOLS_COMPLETE_DESCRIPTION.md)
- [MCP测试结果](./MCP_TEST_RESULTS.md)
- [Gateway架构分析](./GATEWAY_ARCHITECTURE_ANALYSIS.md)

---

## ⚠️ 重要提醒

1. **MCP协议支持**：需要确认ChatGPT应用商店是否支持MCP协议。如果不支持，可能需要：
   - 使用Gateway层转换为OpenAPI格式（参考 `GATEWAY_ARCHITECTURE_ANALYSIS.md`）
   - 或等待OpenAI官方支持MCP

2. **工具数量**：用户提到应该有9个MCP工具，但实际实现了11个。建议：
   - 确认是否需要所有11个工具
   - 或选择9个核心工具提交

3. **测试环境**：建议先在测试环境完成所有测试，再提交生产环境

4. **审核时间**：预计审核时间可能需要几天到几周，请耐心等待

---

**最后更新**: 2025-01-XX  
**状态**: 待修复GET端点并准备应用Logo后即可提交


