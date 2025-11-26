# Hera Jobs 数据迁移与重构执行手册

> 目标：将 Hera 前端全面迁移到 `hera.jobs` 数据源，并在 Hot Job、Mirror Jobs、Location Array、JobMatch 评分等环节完成重构。所有步骤需逐项验证，严禁跨步操作。

---

## 目录
1. 准备阶段
2. Step 1 – Schema & 类型同步
3. Step 2 – 数据访问统一
4. Step 3 – Mirror Jobs 重构
5. Step 4 – Hot Job 策略更新
6. Step 5 – JobMatch 调整
7. Step 6 – Location Expansion 更新
   - 7.1 Step 6.1 – Profile Location 下拉框更新
   - 7.2 Step 6.2 – Top 100 城市扩展区域扩容
8. Step 7 – 前端 & MCP 对齐
9. Step 8 – 测试与验收
10. Step 9 – 性能优化（后续改进）
11. Step 10 – UI 优化（上线前优化）
12. 附录：验证清单模板

---

## 1. 准备阶段
### 1.1 数据确认
- [ ] 从 `hera.jobs` 抽样 20 条文档，确认包含 `summary`, `highlights`, `mustHaveTags`, `locations (array)`, `hotjob`, `sourceType` 等字段。
- [ ] 确认 JobDirectPipeline 正在持续写入上述字段。

### 1.2 差异清单
- [ ] 列出需要修改的 TS/TSX 文件（含 MCP）。
- [ ] 记录对应测试用例/验证方法。

---

## 2. Step 1 – Schema & 类型同步
**目标**：Hera 前端类型系统与新字段对齐。

### 2.1 修改项
- `src/types/job.ts`：新增/更新字段（location string[]、skills tags、workRights、hotjob 等）。
- 各组件引用：`JobList`, `JobDetailPanel`, `JobAssistant`, `TailorResume` 等。
- `transformMongoDBJobToFrontendFormat`：直接映射 pipeline 字段，移除旧的正则解析。

### 2.2 验证
- [ ] `npm run lint -- src/types/job.ts src/components/JobDetail.tsx ...`
- [ ] 手动运行 `npm run dev`，加载 Jobs 页面，验证渲染无类型错误（使用 dummy 数据）。
- [ ] 检查 Git diff，确保仅修改 schema 相关文件。

---

## 3. Step 2 – 数据访问统一
**目标**：所有服务（含 MCP）使用 `hera.jobs`，且支持 location array。

### 3.1 修改项
- `src/services/jobDatabaseService.ts`、`src/lib/dbsearchqueryBuilder.ts`：DB/Collection 名称改为 `hera`/`jobs`，查询条件更新。
- `queryJobsFromDatabase` / `jobFetchService` / MCP `fastDbQuery` / `recommend_jobs` / `refine_recommendations` / `job_alert` 等函数内的 location 条件使用 `$or` + `$elemMatch`。

### 3.2 验证
- [ ] CLI 运行 `node scripts/test-mongodb-connection.js`（已存在）确认连接成功。
- [ ] 执行一次 `curl /api/mirror-jobs?jobTitle=...`，确认返回数据来自 `hera.jobs`。
- [ ] Git diff double-check：仅 DB 配置和查询语句变化。

---

## 4. Step 3 – Mirror Jobs 重构
**目标**：改为“按需补全”模式。

### 4.1 修改项
- `/api/mirror-jobs`：
  - GET 接收 `jobId`，若 summary 缺失则调用 GPT 并写回。
  - POST 仅保留后台批处理入口。
- 前端 Job detail & Tailor Resume：在渲染前调用 detail API。
- 去除列表阶段的 GPT 调用（jobFetchService、MCP 等处删除 POST 调用）。

### 4.2 验证
- [ ] 单测/脚本：调用 `/api/mirror-jobs?id=<existing>` 返回缓存数据；调用缺 summary 的 job，日志显示“Cache miss -> GPT -> Mongo update”。
- [ ] 前端点开 job detail，确保依赖 detail API；Reload 页面重开相同 job 只命中缓存。
- [ ] Git diff 确认：list flow 中不再出现 `/api/mirror-jobs` 调用。

---

## 5. Step 4 – Hot Job 策略更新（扩大范围）
**目标**：扩大 Hot Jobs 范围，从 Profile 页面下拉框数据源动态提取所有城市和职位，不写死任何城市名称。

### 5.1 需求说明

**4.1 需求**：
- Profile 页面 location 下拉框中的所有可选城市 × Profile 页面 Job Titles 下拉框中的所有可选职位 → 全部作为 Hot Jobs

**4.2 需求**：
- 保留扩展性，后续可补充其他 Job Titles（通过更新 Profile 数据源自动生效）

**数据源说明**（不写死城市）：
- **城市数据源1**：`src/constants/cities.ts` 的 `cityOptionsMap`（Profile 页面 location Select 组件使用）
- **城市数据源2**：`src/constants/profileData.ts` 的 `CITIES`（Profile 页面使用的另一个数据源，格式如 `melbourne_vic`）
- **职位数据源**：`src/constants/profileData.ts` 的 `JOB_TITLES`（Profile 页面 Job Titles 下拉框使用）

### 5.2 修改项

#### 5.2.1 修改 `src/constants/hotJobs.ts`

**新增辅助函数**：
1. `getAllProfileCities()`：从 Profile 页面数据源提取所有可选城市
   - 从 `cityOptionsMap`（`src/constants/cities.ts`）提取
   - 从 `CITIES`（`src/constants/profileData.ts`）提取
   - 规范化处理：提取 value、label（英文）、去除州/省信息、处理下划线格式等

2. `getAllProfileJobTitles()`：从 Profile 页面数据源提取所有可选职位
   - 从 `JOB_TITLES`（`src/constants/profileData.ts`）提取
   - 规范化处理：提取 value、英文 label、中文 label、处理下划线格式等

3. `normalizeCityForMatch(city: string)`：规范化城市名称用于匹配
   - 处理各种格式：`Sydney`, `Sydney NSW`, `sydney_nsw`, `melbourne_vic`, `New York`, `New York, NY` 等

4. `normalizeJobTitleForMatch(jobTitle: string)`：规范化 Job Title 用于匹配
   - 处理各种格式：`Software Engineer`, `software_engineer`, `软件工程师` 等

**修改 `isHotJob()` 函数**：
- 添加 Profile 数据源匹配逻辑（优先判断）
- 保留原有逻辑（`sydney`/`melbourne` + `exactMatches` + `fuzzyMatchKeywords`）作为 fallback
- 使用缓存机制避免重复计算

**代码结构**：
```typescript
// ✅ 从指定文件导入数据源（不写死城市）
import { cityOptionsMap } from '@/constants/cities';
import { CITIES, JOB_TITLES } from '@/constants/profileData';

// 缓存 Profile 数据（避免重复计算）
let cachedProfileCities: string[] | null = null;
let cachedProfileJobTitles: string[] | null = null;

export function isHotJob(jobTitle: string, city: string): boolean {
  // 1. 首次调用时初始化缓存（从 Profile 数据源提取）
  // 2. 规范化输入的城市和 Job Title
  // 3. 检查城市是否在 Profile 城市列表中（宽松匹配）
  // 4. 检查 Job Title 是否在 Profile Job Titles 列表中（宽松匹配）
  // 5. 如果城市和 Job Title 都在 Profile 下拉框中，返回 true
  // 6. 否则，使用原有逻辑作为 fallback
}
```

#### 5.2.2 处理城市扩展逻辑（greaterAreaMap）

**问题**：
- 当前 `greaterAreaMap` 只定义了 4 个城市：Melbourne, Sydney, Perth, Brisbane
- 当 Hot Jobs 扩大到所有 Profile 城市后，大部分城市（如 New York, Beijing, Los Angeles）不在 `greaterAreaMap` 中
- 这会导致：
  1. `getHotJobsQuery` 中只使用 `[city]`（不扩展周边区域）
  2. `buildExtendedLocationQuery` 中使用原始逻辑（不扩展）
  3. `getLocationWeight` 返回 1.0（无权重调整）

**解决方案**：
- **方案 A（推荐）**：为没有 `greaterAreaMap` 定义的城市使用默认扩展逻辑
  - 在 `getHotJobsQuery` 中：如果城市不在 `greaterAreaMap` 中，使用 `[city]`（保持现有逻辑）
  - 在 `buildExtendedLocationQuery` 中：如果城市不在 `greaterAreaMap` 中，使用 `buildLocationQuery(city)`（保持现有逻辑）
  - 在 `getLocationWeight` 中：如果城市不在 `greaterAreaMap` 中，返回 1.0（保持现有逻辑）
  - **说明**：这是合理的默认行为，因为：
    - 没有扩展定义的城市，只搜索城市本身是安全的
    - 不会因为格式问题漏掉结果
    - 不会影响 Job Match 评分的准确性（权重 1.0 表示无调整）

- **方案 B（可选，长期优化）**：逐步为重要城市添加 `greaterAreaMap` 定义
  - 优先为美国前十大城市、中国一线城市等添加扩展定义
  - 这是一个长期工作，可以在 Step 8（性能优化）或后续迭代中完成
  - 涉及文件：`src/utils/greaterAreaMap.ts`

**实施建议**：
- Step 4 中采用**方案 A**（保持现有逻辑，不扩展未定义城市）
- 在文档中记录**方案 B**作为后续优化项
- 不影响现有功能，向后兼容

#### 5.2.3 保持现有逻辑不变

- **不删除**原有 `HOT_JOBS_CONFIG` 配置
- **不删除**原有 `exactMatches` 和 `fuzzyMatchKeywords`
- **不删除**原有 `sydney`/`melbourne` 判断逻辑
- **不修改**`greaterAreaMap` 相关逻辑（保持现有行为）
- 新逻辑优先，原有逻辑作为 fallback（向后兼容）

### 5.3 验证方案

#### 5.3.1 数据源验证

- [ ] **验证城市数据源提取**：
  - [ ] 检查 `getAllProfileCities()` 是否正确从 `cityOptionsMap` 提取所有城市
  - [ ] 检查 `getAllProfileCities()` 是否正确从 `CITIES` 提取所有城市
  - [ ] 验证提取的城市数量（预期：`cityOptionsMap` 约 100+ 个城市，`CITIES` 约 50+ 个城市）
  - [ ] 验证城市名称规范化（如 `New York, NY` → `new york`，`melbourne_vic` → `melbourne`）

- [ ] **验证职位数据源提取**：
  - [ ] 检查 `getAllProfileJobTitles()` 是否正确从 `JOB_TITLES` 提取所有职位
  - [ ] 验证提取的职位数量（预期：约 50+ 个职位）
  - [ ] 验证职位名称规范化（如 `software_engineer` → `software engineer`）

#### 5.3.2 匹配逻辑验证

- [ ] **验证原有逻辑（向后兼容）**：
  - [ ] `isHotJob('Software Engineer', 'Sydney')` → `true`（原有逻辑）
  - [ ] `isHotJob('Software Engineer', 'Melbourne')` → `true`（原有逻辑）
  - [ ] `isHotJob('Data Scientist', 'Sydney')` → `true`（原有逻辑）

- [ ] **验证新逻辑（Profile 数据源）**：
  - [ ] `isHotJob('Software Engineer', 'New York')` → `true`（新增：Profile 城市）
  - [ ] `isHotJob('Accountant', 'Melbourne')` → `true`（新增：Profile 职位）
  - [ ] `isHotJob('Graphic Designer', 'Beijing')` → `true`（新增：Profile 城市 × Profile 职位）
  - [ ] `isHotJob('Software Engineer', 'Los Angeles')` → `true`（新增：Profile 城市）
  - [ ] `isHotJob('HR Manager', 'Sydney')` → `true`（新增：Profile 职位）

- [ ] **验证规范化匹配**：
  - [ ] `isHotJob('software engineer', 'sydney')` → `true`（小写）
  - [ ] `isHotJob('Software Engineer', 'Sydney, NSW')` → `true`（包含州）
  - [ ] `isHotJob('Software Engineer', 'sydney_nsw')` → `true`（下划线格式）
  - [ ] `isHotJob('software_engineer', 'Sydney')` → `true`（下划线职位格式）

- [ ] **验证非 Hot Job 场景**：
  - [ ] `isHotJob('Software Engineer', 'Unknown City')` → `false`（城市不在 Profile 列表中）
  - [ ] `isHotJob('Unknown Job', 'Sydney')` → `false`（职位不在 Profile 列表中）
  - [ ] `isHotJob('Unknown Job', 'Unknown City')` → `false`（都不在 Profile 列表中）

#### 5.3.3 实际场景验证

- [ ] **验证 JobFetchService 调用**：
  - [ ] 搜索 `Software Engineer` in `New York`，确认 `isHotJob` 返回 `true`
  - [ ] 检查日志：`[JobFetchService] Job: Software Engineer, City: New York, IsHotJob: true`
  - [ ] 确认数据源为 `hot_jobs_database`（从数据库获取）

- [ ] **验证多个城市组合**：
  - [ ] 测试美国城市：`New York`, `Los Angeles`, `Chicago`, `Houston`, `Phoenix` 等
  - [ ] 测试中国城市：`Beijing`, `Shanghai`, `Shenzhen`, `Guangzhou` 等
  - [ ] 测试澳洲城市：`Sydney`, `Melbourne`, `Brisbane`, `Perth` 等
  - [ ] 所有测试城市 × Profile 职位都应返回 `true`

- [ ] **验证多个职位组合**：
  - [ ] 测试 IT 职位：`Software Engineer`, `Data Scientist`, `Full Stack Developer` 等
  - [ ] 测试财务职位：`Accountant`, `Financial Analyst`, `CFO` 等
  - [ ] 测试市场职位：`Marketing Manager`, `Digital Marketing Specialist` 等
  - [ ] 所有测试职位 × Profile 城市都应返回 `true`

#### 5.3.4 城市扩展逻辑验证（greaterAreaMap）

- [ ] **验证有扩展定义的城市（Sydney, Melbourne）**：
  - [ ] 搜索 `Software Engineer` in `Sydney`，确认 `getHotJobsQuery` 使用扩展区域（core + fringe）
  - [ ] 检查日志：确认搜索范围包含周边区域（如 `North Sydney`, `Chatswood` 等）
  - [ ] 验证 `buildExtendedLocationQuery` 返回扩展查询（包含多个区域）
  - [ ] 验证 `getLocationWeight` 对 fringe 区域返回 0.85

- [ ] **验证无扩展定义的城市（New York, Beijing）**：
  - [ ] 搜索 `Software Engineer` in `New York`，确认 `getHotJobsQuery` 只使用 `[city]`（不扩展）
  - [ ] 检查日志：确认搜索范围只包含城市本身（`New York`）
  - [ ] 验证 `buildExtendedLocationQuery` 使用原始逻辑（`buildLocationQuery(city)`）
  - [ ] 验证 `getLocationWeight` 返回 1.0（无权重调整）
  - [ ] **说明**：这是预期行为，因为没有扩展定义的城市只搜索城市本身是合理的

- [ ] **验证 Job Match 评分**：
  - [ ] 对于有扩展定义的城市（Sydney），fringe 区域的职位权重为 0.85
  - [ ] 对于无扩展定义的城市（New York），所有职位权重为 1.0
  - [ ] 验证 Job Match 评分计算正确（考虑 location weight）

- [ ] **验证向后兼容**：
  - [ ] 原有城市（Sydney, Melbourne）的扩展逻辑仍然正常工作
  - [ ] 新城市（New York, Beijing）使用默认逻辑（不扩展），不影响功能

#### 5.3.5 性能验证

- [ ] **验证缓存机制**：
  - [ ] 首次调用 `isHotJob()` 时，日志显示：`[HotJobs] Loaded X cities from Profile dropdown`
  - [ ] 首次调用 `isHotJob()` 时，日志显示：`[HotJobs] Loaded Y job titles from Profile dropdown`
  - [ ] 后续调用不再重复计算（检查日志无重复加载信息）

- [ ] **验证性能影响**：
  - [ ] 连续调用 100 次 `isHotJob()`，总耗时 < 100ms
  - [ ] 内存使用正常（缓存数据量合理）

#### 5.3.6 代码质量验证

- [ ] **Git diff 检查**：
  - [ ] 仅修改 `src/constants/hotJobs.ts`
  - [ ] 未写死任何城市名称（所有城市从数据源动态提取）
  - [ ] 未删除原有逻辑（向后兼容）

- [ ] **类型检查**：
  - [ ] `npm run lint` 通过
  - [ ] `npm run build` 通过
  - [ ] TypeScript 类型检查通过

#### 5.3.7 扩展性验证

- [ ] **验证数据源更新自动生效**：
  - [ ] 在 `cityOptionsMap` 中添加一个新城市（如 `Test City`）
  - [ ] 重启服务后，`isHotJob('Software Engineer', 'Test City')` → `true`
  - [ ] 在 `JOB_TITLES` 中添加一个新职位（如 `Test Engineer`）
  - [ ] 重启服务后，`isHotJob('Test Engineer', 'Sydney')` → `true`

### 5.4 验收标准

- [ ] **功能验收**：
  - [ ] 所有 Profile 页面城市 × Profile 页面职位组合都返回 `true`
  - [ ] 原有逻辑（`sydney`/`melbourne` + `exactMatches`）仍然正常工作
  - [ ] 规范化匹配正确处理各种格式

- [ ] **性能验收**：
  - [ ] 缓存机制正常工作，无重复计算
  - [ ] 单次 `isHotJob()` 调用耗时 < 1ms（缓存后）

- [ ] **代码质量验收**：
  - [ ] 未写死任何城市名称
  - [ ] 所有数据源明确标注（文件路径）
  - [ ] 向后兼容，不影响现有功能

### 5.5 预期效果

**扩大前**：
- Hot Jobs 范围：仅 `sydney`/`melbourne` + 86 个精确匹配职位 + 190 个模糊匹配关键词
- 覆盖城市：2 个（Sydney, Melbourne）
- 覆盖职位：约 200+ 个（通过模糊匹配）

**扩大后**：
- Hot Jobs 范围：Profile 页面所有城市 × Profile 页面所有职位
- 覆盖城市：100+ 个（从 `cityOptionsMap` 和 `CITIES` 提取）
- 覆盖职位：50+ 个（从 `JOB_TITLES` 提取）
- 总组合数：5000+ 个城市×职位组合

**优势**：
1. **自动同步**：当 Profile 数据源更新时，Hot Jobs 范围自动更新
2. **不写死**：所有城市和职位从数据源动态提取
3. **向后兼容**：保留原有逻辑，不影响现有功能
4. **扩展性强**：后续添加城市或职位，只需更新 Profile 数据源

**注意事项**：
- **城市扩展逻辑**：当前 `greaterAreaMap` 只定义了 4 个城市（Melbourne, Sydney, Perth, Brisbane）
- 对于没有扩展定义的城市（如 New York, Beijing），使用默认逻辑：
  - 搜索范围：只搜索城市本身（不扩展周边区域）
  - Job Match 权重：1.0（无权重调整）
- **后续优化**：可以在 Step 8 或后续迭代中，逐步为重要城市添加 `greaterAreaMap` 定义

---

## 6. Step 5 – JobMatch 调整
**目标**：GPT 使用结构化标签；为 hybrid 评分预留能力。

### 6.1 修改项
- `/api/gpt-services/jobMatch`：请求体改为包含 `mustHaveTags`、`niceToHaveTags`、`keyRequirements`、`workRights`、`highlights`；描述作为 fallback。
- `matchJobWithGPT.ts`：更新 prompt；返回结构保持兼容。
- 可选：新增 `calculateDeterministicScore` 模块（暂不接入 UI）。

### 6.2 验证
- [ ] 构造请求：仅包含标签字段，确认 GPT 成功返回评分。
- [ ] 检查日志，确认描述缺失时也能运行。
- [ ] 若添加 deterministic：对比 `mode=gpt_only` 与 `mode=hybrid` 差异。

---

## 7. Step 6 – Location Expansion 更新
**目标**：基于实际职位数据，更新 Profile 页面 location 下拉框，并扩展 Top 100 城市的周边区域定义。

### 7.1 Step 6.1 – Profile Location 下拉框更新
**目标**：将职位数 > 200 的城市更新到 Profile 页面的 location 下拉框。

#### 7.1.1 数据源
- **输入**：`LocationExpansion/location-stats/location-stats.json`（职位数 > 200 的城市）
- **输出**：更新 `src/constants/cities.ts` 的 `cityOptionsMap`

#### 7.1.2 处理逻辑
1. **数据清洗**：
   - 过滤职位数 > 200 的城市
   - 排除 Remote 相关（36 条）
   - 排除 Multiple Locations（11 条）
   - 排除纯国家名（13 条）
   - 有效城市数：约 1,471 条

2. **城市标准化**：
   - 提取城市名：去除州/省/国家后缀（如 "Sydney, NSW, Australia" → "Sydney"）
   - 统一格式：标准化城市名称
   - 去重：同一城市的不同格式合并

3. **国家映射**：
   - 根据城市后缀或关键词映射到对应国家
   - 支持的国家：Australia, United States, United Kingdom, Canada, China, India, Singapore, Hong Kong, Taiwan, France, Germany, Japan, South Korea, Netherlands, Italy, Spain, Brazil, Mexico, Philippines, Thailand, Malaysia, Indonesia, Vietnam, New Zealand, Israel, Ukraine, Poland, Sweden, Norway, Denmark, Belgium, Switzerland, Argentina, Chile, Colombia, Peru, South Africa, Egypt, UAE, Saudi Arabia, Turkey, Russia 等

4. **Remote 处理**：
   - 在每个国家的城市列表最前面添加 "Remote" 选项
   - 格式：`{ label: { en: "Remote", zh: "远程" }, value: "Remote" }`

5. **更新 cities.ts**：
   - 为每个国家添加新城市（保持现有城市不变）
   - 添加 Remote 选项
   - 保持现有结构不变

#### 7.1.3 修改项
- `src/constants/cities.ts`：更新 `cityOptionsMap`，添加新城市和 Remote 选项
- 创建数据清洗脚本：`LocationExpansion/updateProfileCities.js`

#### 7.1.4 验证
- [ ] 数据清洗脚本正确过滤和标准化城市
- [ ] 每个国家的新增城市数量合理
- [ ] Remote 选项正确添加到所有国家
- [ ] Profile 页面 location 下拉框正常显示
- [ ] 新增城市可以正常选择
- [ ] 现有城市不受影响

---

### 7.2 Step 6.2 – Top 100 城市扩展区域扩容
**目标**：针对 Top 100 城市（按职位数），进一步扩容城市周围的扩展区域（core 和 fringe）。

#### 7.2.1 数据源
- **输入**：`LocationExpansion/location-stats/location-stats.json`（Top 100 城市）
- **现有扩展**：`LocationExpansion/cityExpansions.json`（已生成 99 个城市）
- **输出**：更新 `LocationExpansion/cityExpansions.json` 和 `greaterAreaMapExtended.ts`

#### 7.2.2 处理逻辑
1. **识别缺失城市**：
   - 从 Top 100 城市中提取城市名（标准化）
   - 对比现有 `cityExpansions.json`，找出缺失的城市
   - 预计缺失：约 50-70 个城市

2. **生成扩展区域**：
   - 使用 `LocationExpansion/generateCityExpansions.ts` 脚本
   - 调用 GPT 为缺失城市生成 core 和 fringe 区域
   - 批量处理：每批 4 个城市，减少 API 调用

3. **数据合并**：
   - 将新生成的扩展区域合并到现有 `cityExpansions.json`
   - 更新 `greaterAreaMapExtended.ts` TypeScript 文件

4. **集成到前端**：
   - 将 `greaterAreaMapExtended.ts` 合并到 `src/utils/greaterAreaMap.ts`
   - 确保 Hot Jobs 查询使用扩展区域

#### 7.2.3 修改项
- `LocationExpansion/generateCityExpansions.ts`：添加 Top 100 城市生成逻辑
- `LocationExpansion/cityExpansions.json`：更新扩展数据
- `LocationExpansion/greaterAreaMapExtended.ts`：更新 TypeScript 文件
- `src/utils/greaterAreaMap.ts`：合并扩展区域定义

#### 7.2.4 验证
- [ ] Top 100 城市中缺失扩展的城市已全部生成
- [ ] 生成的扩展区域格式正确（core 和 fringe 数组）
- [ ] 扩展区域数据已合并到 `cityExpansions.json`
- [ ] `greaterAreaMapExtended.ts` 已更新
- [ ] `src/utils/greaterAreaMap.ts` 正确合并扩展定义
- [ ] Hot Jobs 查询使用扩展区域（验证日志）
- [ ] Job Match 评分考虑扩展区域权重（fringe 区域权重 0.85）

---

### 7.3 验收标准
- [ ] **Step 6.1 验收**：
  - [ ] Profile 页面 location 下拉框包含所有职位数 > 200 的城市
  - [ ] Remote 选项正确显示在所有国家
  - [ ] 新增城市可以正常选择和使用
  - [ ] 现有功能不受影响

- [ ] **Step 6.2 验收**：
  - [ ] Top 100 城市全部有扩展区域定义
  - [ ] 扩展区域数据格式正确
  - [ ] Hot Jobs 查询正确使用扩展区域
  - [ ] Job Match 评分考虑扩展区域权重

- [ ] **整体验收**：
  - [ ] 数据清洗脚本运行成功
  - [ ] 所有文件更新正确
  - [ ] 前端功能正常
  - [ ] 性能无影响

---

## 8. Step 7 – 前端 & MCP 对齐
**目标**：UI/MCP 使用新字段，保持用户体验。

### 7.1 修改项
- Jobs page 相关组件读取新字段；detail 异步加载 summary；Tailor Resume 依赖 detail API。
- MCP `recommend_jobs` / `search_jobs` / `refine_recommendations`：响应中包含 `highlights`, `skillsMustHave`, `hotjob` 等。
- AgentKit executor 同步字段；确保 Memory 仍记录 `job.id`。

### 7.2 验证
- [ ] UI 回归：搜索、分页、detail、Tailor Resume；确认 tags/highlights 正常展示。
- [ ] MCP CLI：调用 `recommend_jobs` 多轮无重复，返回字段完整。
- [ ] Git diff double-check：只影响必要组件。

---

## 8. Step 7 – 前端 & MCP 对齐
**目标**：UI/MCP 使用新字段，保持用户体验。

### 8.1 修改项
- Jobs page 相关组件读取新字段；detail 异步加载 summary；Tailor Resume 依赖 detail API。
- MCP `recommend_jobs` / `search_jobs` / `refine_recommendations`：响应中包含 `highlights`, `skillsMustHave`, `hotjob` 等。
- AgentKit executor 同步字段；确保 Memory 仍记录 `job.id`。

### 8.2 验证
- [ ] UI 回归：搜索、分页、detail、Tailor Resume；确认 tags/highlights 正常展示。
- [ ] MCP CLI：调用 `recommend_jobs` 多轮无重复，返回字段完整。
- [ ] Git diff double-check：只影响必要组件。

---

## 9. Step 8 – 测试与验收
### 8.1 自动化/脚本
- [ ] `npm run lint && npm run test` 全通过。
- [ ] 运行 `scripts/test-mongodb-connection.js`，`test-minimal-3002.js`，`test_agentkit_*`。

### 8.2 手动检查
- [ ] Jobs 页面（PC+移动）
- [ ] MCP (ChatGPT Actions) 全流程
- [ ] Tailor Resume 生成
- [ ] Mirror Jobs detail API 缓存命中率

### 8.3 验收会议
- 展示变更、验证日志和监控方案。

---

## 10. Step 9 – 性能优化（后续改进）

**目标**：优化 JobMatch API 调用性能，减少日志噪音，提升用户体验。

### 9.1 问题分析

**当前状态**：
- JobMatch API 在列表视图为每个职位单独调用 GPT（150+ 个职位 = 150+ 次 API 调用）
- 每次调用耗时 1.5-3 秒，总耗时可达 5-10 分钟
- 日志输出过多，影响可读性和调试效率
- 用户体验：等待时间过长

**性能瓶颈**：
1. **串行调用**：每个职位顺序调用 GPT，未使用批处理或并发
2. **重复计算**：相同职位可能被多次评分
3. **日志冗余**：每个调用都输出详细日志

### 9.2 优化方案

#### 9.2.1 批处理优化
- **方案**：将多个职位的匹配请求合并为单次 GPT 调用
- **实现**：
  - 修改 `/api/gpt-services/jobMatch` 支持批量请求（`jobs: Job[]`）
  - GPT prompt 优化：一次处理 10-20 个职位
  - 返回批量结果数组
- **预期效果**：150 个职位从 150 次调用降至 8-15 次，总耗时从 5-10 分钟降至 1-2 分钟

#### 9.2.2 并发控制
- **方案**：使用 Promise.all 并发调用，但限制并发数
- **实现**：
  - 使用 `p-limit` 或自定义并发池（如 5-10 个并发）
  - 避免 OpenAI API 速率限制
- **预期效果**：在批处理基础上，进一步缩短等待时间

#### 9.2.3 缓存机制
- **方案**：相同职位（jobId + userProfile hash）缓存匹配结果
- **实现**：
  - Redis 或 MongoDB 缓存层
  - 缓存 key: `jobMatch:${jobId}:${userProfileHash}`
  - TTL: 24 小时（用户 profile 变化时失效）
- **预期效果**：重复访问相同职位时，直接返回缓存结果（< 100ms）

#### 9.2.4 日志优化
- **方案**：减少日志输出，使用结构化日志
- **实现**：
  - 批量调用时只记录批次信息，不记录每个职位
  - 使用日志级别控制（开发环境详细，生产环境精简）
  - 汇总统计：`[JobMatch] Batch completed: 20 jobs in 3.2s, avg 160ms/job`
- **预期效果**：日志文件大小减少 80-90%，可读性提升

#### 9.2.5 前端优化
- **方案**：渐进式加载，先显示职位列表，后台异步加载匹配分数
- **实现**：
  - 初始加载：只显示职位基本信息（无 matchScore）
  - 后台任务：分批加载 matchScore（每批 10-20 个）
  - UI 更新：分数加载完成后实时更新卡片
- **预期效果**：用户可立即看到职位列表，无需等待所有分数计算完成

### 9.3 实施优先级

**P0（高优先级）**：
1. 批处理优化（9.2.1）- 最大性能提升
2. 日志优化（9.2.4）- 立即改善可读性

**P1（中优先级）**：
3. 并发控制（9.2.2）- 进一步提速
4. 前端渐进式加载（9.2.5）- 改善用户体验

**P2（低优先级）**：
5. 缓存机制（9.2.3）- 长期优化，需要基础设施支持

### 9.4 验证指标

- [ ] **性能指标**：
  - 150 个职位的匹配时间从 5-10 分钟降至 < 2 分钟
  - 单次批处理调用（20 个职位）耗时 < 5 秒
  - 缓存命中率 > 60%（重复访问场景）

- [ ] **日志指标**：
  - 日志文件大小减少 > 80%
  - 日志行数减少 > 70%
  - 关键信息（错误、警告）仍完整记录

- [ ] **用户体验指标**：
  - 职位列表初始加载时间 < 3 秒
  - 分数加载进度可见（进度条或百分比）
  - 用户可立即开始浏览职位，无需等待

### 9.5 技术债务

- [ ] 评估是否需要引入 Redis 作为缓存层
- [ ] 考虑使用消息队列（如 Bull/BullMQ）处理大批量匹配任务
- [ ] 监控 OpenAI API 使用量和成本，优化调用频率

---

## 11. Step 10 – UI 优化（上线前优化）

**目标**：优化 UI 显示，提升用户体验，确保信息展示清晰、紧凑、易读。

### 10.0 Location 输入搜索功能（可选优化）

**需求**：考虑是否在 Profile 页面的 Location（城市）选择中添加输入搜索功能。

**当前状态**：
- 使用下拉选择（Select 组件）
- 用户需要滚动查找城市

**可选方案**：
- 参考 `JobTitleSelector` 的实现方式
- 使用 `@headlessui/react` 的 `Combobox` 组件
- 支持输入搜索和下拉选择两种方式
- 输入城市名（如 "new york"）自动过滤匹配结果

**实施复杂度**：
- 需要创建新的 `CitySelector` 组件
- 需要修改 `profile/page.tsx`
- 需要处理国家过滤逻辑
- 相对复杂，建议在基础功能稳定后再考虑

**决策**：
- [ ] 是否添加 Location 输入搜索功能（待决定）

---

### 10.1 标签（Tags）过长处理

**问题**：标签文本过长时，影响 UI 布局和可读性。

**解决方案**：
- 对 `JobList` / `JobDetailPanel` 中的所有标签（`skills`、`highlights`、`niceToHave`、`mustHave`、`keyRequirements` 等）添加文本截断
- 使用 `text-ellipsis` CSS 类实现单行显示，超出长度自动隐藏
- 添加 Tooltip：鼠标 Hover 时显示完整内容

**实现细节**：
- 使用 Tailwind CSS：`truncate` 类（等同于 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`）
- Tooltip 组件：使用现有的 Tooltip 组件或创建新的 `TruncatedTextWithTooltip` 组件
- 示例：`"Project management methodologies including agile and waterfall"` → `"Project management methodologies…"`（Hover 显示完整文本）

**涉及文件**：
- `src/components/JobSummaryCard.tsx`
- `src/components/JobDetailPanel.tsx`
- `src/components/JobList.tsx`

### 10.2 Salary 文本优化

**问题**：Salary 文本过长，在 JobList 中占用过多空间。

**解决方案**：
- **JobList 中**：显示短版本（如 `$78k–$98k`）
- **Detail Panel 中**：仍显示完整 Salary 文本（包含 benefits、bonus 等详细信息）

**实现细节**：
- 创建 `formatSalaryShort()` 函数：提取并格式化薪资范围
- 在 `JobSummaryCard.tsx` 中使用短版本
- 在 `JobDetailPanel.tsx` 中使用完整版本

**涉及文件**：
- `src/utils/employmentUtils.ts`（添加 `formatSalaryShort` 函数）
- `src/components/JobSummaryCard.tsx`
- `src/components/JobDetailPanel.tsx`

### 10.3 WorkMode 统一紧凑展示

**问题**：WorkMode 显示格式不统一，存在冗长说明。

**解决方案**：
- 统一显示格式为紧凑版本：
  - `Hybrid`
  - `2 days onsite`
  - `Remote`
  - `Onsite`
- 删除不必要的冗长说明（如 "Hybrid work arrangement with 2 days in office" → "2 days onsite"）

**实现细节**：
- 更新 `parseWorkMode()` 函数，返回紧凑格式
- 统一所有显示 WorkMode 的组件使用相同格式

**涉及文件**：
- `src/utils/employmentUtils.ts`（更新 `parseWorkMode` 函数）
- `src/components/JobSummaryCard.tsx`
- `src/components/JobDetailPanel.tsx`

### 10.4 非 Hot Job 的 LinkedIn 模式优化

**问题**：目前非 Hot Jobs 的 LinkedIn 数据获取模式需要改进。

**背景**：
- Step 4 已完成：所有 Profile 下拉菜单中的城市（如 New York、London、Beijing 等）现在都被识别为 Hot Jobs，从 MongoDB 获取数据
- 非 Hot Jobs（不在 Profile 城市列表中的城市）仍然从外部平台（LinkedIn 等）获取数据
- 当前非 Hot Jobs 的 LinkedIn 模式可能需要优化

**需要修改的内容**：
- [ ] 检查 `src/services/jobFetchService.ts` 中的 `fetchJobsForNonHotJob` 函数
- [ ] 检查 `/api/job-fetch-router` 的 LinkedIn 数据获取逻辑
- [ ] 优化非 Hot Jobs 的数据获取流程和性能
- [ ] 确保非 Hot Jobs 的数据质量和格式与 Hot Jobs 保持一致

**涉及文件**：
- `src/services/jobFetchService.ts`
- `src/app/api/job-fetch-router/index.ts`
- 相关的 LinkedIn 数据获取服务

**注意**：此优化应在 Step 4 验证通过后进行，确保 Hot Jobs 逻辑稳定后再优化非 Hot Jobs 流程。

### 10.5 实施优先级

**P0（上线前必须完成）**：
1. 标签截断 + Tooltip（10.1）
2. Salary 短版本显示（10.2）
3. WorkMode 统一格式（10.3）

**P1（重要优化）**：
4. 非 Hot Job 的 LinkedIn 模式优化（10.4）

**实施时机**：在 Step 7（测试与验收）完成后，上线前统一优化。

### 10.6 验证清单

- [ ] **标签截断**：
  - [ ] 所有标签在超出长度时自动截断
  - [ ] Tooltip 正确显示完整内容
  - [ ] 移动端体验良好（Tooltip 或点击展开）

- [ ] **Salary 优化**：
  - [ ] JobList 中显示短版本（如 `$78k–$98k`）
  - [ ] Detail Panel 中显示完整版本
  - [ ] 无效 Salary 正确过滤

- [ ] **WorkMode 统一**：
  - [ ] 所有 WorkMode 显示为紧凑格式
  - [ ] 冗长说明已删除
  - [ ] 格式统一（Hybrid / Remote / Onsite / X days onsite）

- [ ] **非 Hot Job LinkedIn 模式**：
  - [ ] 非 Hot Jobs 的数据获取流程正常
  - [ ] LinkedIn 数据质量和格式与 Hot Jobs 保持一致
  - [ ] 性能优化完成

- [ ] **UI 回归测试**：
  - [ ] JobList 显示正常
  - [ ] JobDetailPanel 显示正常
  - [ ] 移动端响应式布局正常
  - [ ] Tooltip 交互正常

---

## 12. 附录：验证清单模板
```
步骤：Step X 标题
- [ ] 验证 1 ...
- [ ] 验证 2 ...
Git diff 范围：...
日志/截图：链接/路径
```

请在每个阶段结束前填写并归档此清单。若任何一步未通过验证，禁止进入下一阶段。

