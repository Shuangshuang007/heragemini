# ChatGPT App Store 申请材料清单（4工具版本）

**提交版本**: Lite (4 tools)  
**MCP端点**: `/api/mcp-lite`  
**最后更新**: 2025-12-26

---

## 📋 必需材料清单

### ✅ 1. 技术实现（已完成）

- [x] **MCP Server 端点**
  - URL: `https://www.heraai.net.au/api/mcp-lite`
  - 协议: JSON-RPC 2.0
  - 认证: Bearer Token (`MCP_SHARED_SECRET`)

- [x] **4个工具实现**
  - `career_transition_advice` - 职业转换建议
  - `search_jobs` - 职位搜索
  - `recommend_jobs` - 个性化职位推荐
  - `tailor_resume` - 简历定制

- [x] **工具发现机制**
  - GET `/api/mcp-lite` 返回工具列表（带 `Cache-Control: no-store`）
  - POST `/api/mcp-lite` 支持 `tools/list` 和 `tools/call`

- [x] **测试报告**
  - `TEST_RESULTS_STORE_SUBMISSION_LITE_V2.md` - 完整测试结果

---

### ⚠️ 2. 应用信息（需要准备）

#### 2.1 应用基本信息

- [ ] **应用名称**（必需）
  ```
  建议选项：
  1. HeraAI - Career Assistant
  2. HeraAI Job Search
  3. HeraAI Career Tools
  ```
  **注意**: 名称需要简洁、清晰，符合 ChatGPT App Store 规范

- [ ] **简短描述**（必需，50-100字符）
  ```
  建议：
  "AI-powered career assistant for job search, resume optimization, and career transition advice"
  ```
  或
  ```
  "Search jobs, get personalized recommendations, optimize your resume, and get career advice"
  ```

- [ ] **详细描述**（必需，200-500字符）
  ```
  HeraAI provides intelligent career assistance through 4 powerful tools:

  1. Career Transition Advice - Get personalized recommendations for career switches based on your current role, experience, and skills. Receive actionable insights on target roles, skill gaps, and transition strategies.

  2. Job Search - Search for jobs across multiple platforms (LinkedIn, SEEK, Jora, Adzuna) with intelligent deduplication and source transparency. Filter by job title, location, and company.

  3. Personalized Job Recommendations - Get AI-powered job recommendations matched to your profile. Receive match scores, skill analysis, and direct links to apply.

  4. Resume Tailoring - Optimize your resume for specific job applications. Get personalized suggestions based on job descriptions and your profile.

  Data Sources: HeraAI aggregates jobs from multiple sources. For job board platforms (LinkedIn, SEEK, Jora, Adzuna), we generate search links that direct users to the original platforms. All displayed job data comes from HeraAI's aggregated database.

  Ideal for job seekers who want comprehensive coverage and personalized career guidance.
  ```

- [ ] **分类**（必需）
  ```
  Productivity > Career & Jobs
  ```
  或
  ```
  Business > Career Development
  ```

#### 2.2 应用图标/Logo（必需）

- [ ] **应用图标**
  - **尺寸**: 512x512px（最小），1024x1024px（推荐）
  - **格式**: PNG（透明背景）或 SVG
  - **要求**:
    - 清晰、专业的设计
    - 符合 ChatGPT App Store 视觉规范
    - 在小尺寸下仍然清晰可辨
  - **当前状态**: ⚠️ 需要准备
  - **建议**: 基于现有 HeraAI 品牌设计

#### 2.3 网站和链接（部分完成）

- [x] **网站URL**
  ```
  https://www.heraai.net.au
  ```

- [x] **隐私政策URL**
  ```
  https://www.heraai.net.au/privacy
  ```
  **注意**: 已更新，包含数据保留、删除、第三方数据源说明

- [x] **服务条款URL**
  ```
  https://www.heraai.net.au/terms
  ```

---

### ⚠️ 3. 开发者信息（需要确认）

- [ ] **开发者名称**（必需）
  ```
  建议选项：
  1. HeraAI Team
  2. HeraAI
  3. [您的公司名称]
  ```

- [ ] **开发者联系邮箱**（必需）
  ```
  建议：
  support@heraai.net.au
  或
  [您的实际联系邮箱]
  ```
  **注意**: 这个邮箱会用于审核沟通，必须能及时回复

- [ ] **开发者网站**（可选但推荐）
  ```
  https://www.heraai.net.au
  ```

---

### ✅ 4. 技术配置（已完成）

- [x] **MCP Server URL**
  ```
  https://www.heraai.net.au/api/mcp-lite
  ```

- [x] **认证方式**
  ```
  Bearer Token
  ```

- [x] **Token值**
  ```
  MCP_SHARED_SECRET (从环境变量获取)
  ```

- [x] **协议类型**
  ```
  MCP (Model Context Protocol) - JSON-RPC 2.0
  ```

---

### ⚠️ 5. 文档和说明（部分完成）

#### 5.1 工具文档

- [x] **工具审核包**
  - `MCP_TOOLS_REVIEW_PACKET.md` - 11工具版本（需要更新为4工具版本）
  - **需要**: 创建 `MCP_TOOLS_REVIEW_PACKET_LITE.md`（4工具版本）

- [x] **测试报告**
  - `TEST_RESULTS_STORE_SUBMISSION_LITE_V2.md` - 完整测试结果

- [ ] **使用说明**（可选但推荐）
  ```
  简短的使用指南，说明：
  - 如何调用每个工具
  - 参数说明
  - 示例用法
  ```

#### 5.2 合规文档

- [x] **隐私政策**
  - 已更新，包含：
    - 数据保留期限
    - 数据删除方法
    - 第三方数据源说明（ATS vs 招聘平台）
    - 信息安全措施

- [x] **服务条款**
  - 已发布

- [ ] **第三方数据源声明**（可选但推荐）
  ```
  明确说明：
  - 数据来源（LinkedIn, SEEK, Jora, Adzuna）
  - 数据使用方式（URL聚合 vs 数据抓取）
  - 合规性声明
  ```

---

### ⚠️ 6. 演示和测试（需要准备）

- [ ] **测试账号**（必需）
  - 准备一个测试用的 ChatGPT 账户
  - 用于审核人员测试应用功能

- [ ] **演示视频**（可选但强烈推荐）
  - 录制 2-3 分钟的功能演示视频
  - 展示 4 个工具的使用场景
  - 上传到 YouTube 或 Vimeo，提供链接

- [ ] **功能演示脚本**（可选）
  ```
  准备一个简短的演示脚本，说明：
  1. 如何调用 career_transition_advice
  2. 如何调用 search_jobs
  3. 如何调用 recommend_jobs
  4. 如何调用 tailor_resume
  ```

---

## 📝 提交步骤

### Step 1: 准备应用信息（1-2小时）

1. **确定应用名称**
   - 选择简洁、清晰的应用名称
   - 确保符合 ChatGPT App Store 规范

2. **编写描述**
   - 简短描述（50-100字符）
   - 详细描述（200-500字符）
   - 突出 4 个工具的核心功能

3. **准备应用图标**
   - 设计或委托设计 512x512px（或更大）的应用图标
   - 确保符合视觉规范

### Step 2: 确认开发者信息（30分钟）

1. **确认开发者名称**
   - 选择开发者名称（个人或公司）
   - 确保与品牌一致

2. **确认联系邮箱**
   - 使用能及时回复的邮箱
   - 建议使用 support@heraai.net.au

### Step 3: 更新文档（1-2小时）

1. **创建 4 工具版本的审核包**
   - 基于 `MCP_TOOLS_REVIEW_PACKET.md`
   - 只包含 4 个工具的描述
   - 保存为 `MCP_TOOLS_REVIEW_PACKET_LITE.md`

2. **准备使用说明**（可选）
   - 简短的使用指南
   - 示例用法

### Step 4: 准备演示材料（1-2小时）

1. **录制演示视频**（可选但推荐）
   - 展示 4 个工具的使用
   - 2-3 分钟长度
   - 清晰、专业

2. **准备测试账号**
   - 确保测试账号可以正常使用
   - 准备测试数据（简历、职位搜索等）

### Step 5: 提交审核（30分钟）

1. **登录 OpenAI 开发者平台**
   - 访问：https://platform.openai.com/apps
   - 登录账户

2. **创建新应用**
   - 点击 "Create App" 或 "Submit to Store"
   - 选择 "MCP Server" 类型

3. **填写应用信息**
   - 应用名称
   - 简短描述
   - 详细描述
   - 分类
   - 上传应用图标

4. **配置技术设置**
   - MCP Server URL: `https://www.heraai.net.au/api/mcp-lite`
   - 认证方式: Bearer Token
   - Token: `MCP_SHARED_SECRET`
   - 协议: MCP (JSON-RPC 2.0)

5. **添加链接**
   - 网站URL: `https://www.heraai.net.au`
   - 隐私政策URL: `https://www.heraai.net.au/privacy`
   - 服务条款URL: `https://www.heraai.net.au/terms`

6. **上传文档**（可选）
   - 工具审核包（PDF或Markdown）
   - 使用说明
   - 演示视频链接

7. **提交审核**
   - 检查所有信息
   - 点击 "Submit for Review"

---

## ✅ 完成检查清单

### 技术实现
- [x] MCP Server 端点 (`/api/mcp-lite`)
- [x] 4个工具实现
- [x] 工具发现机制（GET/POST）
- [x] 认证机制（Bearer Token）
- [x] 测试报告

### 应用信息
- [ ] 应用名称
- [ ] 简短描述
- [ ] 详细描述
- [ ] 分类
- [ ] 应用图标（512x512px或更大）

### 开发者信息
- [ ] 开发者名称
- [ ] 开发者联系邮箱
- [ ] 开发者网站（可选）

### 文档
- [x] 隐私政策（已更新）
- [x] 服务条款
- [ ] 4工具版本的审核包（需要创建）
- [ ] 使用说明（可选）

### 演示材料
- [ ] 测试账号
- [ ] 演示视频（可选但推荐）
- [ ] 功能演示脚本（可选）

---

## 🎯 优先级排序

### P0 - 必需（提交前必须完成）
1. ✅ 技术实现（已完成）
2. ⚠️ 应用名称和描述
3. ⚠️ 应用图标（512x512px）
4. ⚠️ 开发者名称和联系邮箱
5. ⚠️ 测试账号

### P1 - 重要（强烈推荐）
1. ⚠️ 4工具版本的审核包文档
2. ⚠️ 演示视频
3. ⚠️ 使用说明

### P2 - 可选（提升审核通过率）
1. 功能演示脚本
2. 第三方数据源声明
3. 开发者网站

---

## 📚 参考文档

- [提交计划](./STORE_SUBMISSION_PLAN.md)
- [测试结果](./TEST_RESULTS_STORE_SUBMISSION_LITE_V2.md)
- [工具审核包（11工具版本）](./MCP_TOOLS_REVIEW_PACKET.md)
- [隐私政策](https://www.heraai.net.au/privacy)
- [服务条款](https://www.heraai.net.au/terms)

---

## ⚠️ 重要提醒

1. **应用图标是必需的**：没有应用图标无法提交审核
2. **联系邮箱必须能及时回复**：审核人员可能会通过邮箱联系
3. **测试账号必须可用**：审核人员需要测试应用功能
4. **演示视频可以显著提升审核通过率**：强烈推荐准备
5. **审核时间可能需要几天到几周**：请耐心等待

---

**最后更新**: 2025-12-26  
**状态**: 技术实现已完成，等待准备应用信息和演示材料








