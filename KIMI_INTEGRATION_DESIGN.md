# Kimi 2 Thinking 接入设计方案

> **目标**：在 `career_transition_advice` MCP 工具中接入 Kimi 2 Thinking，充分利用 MongoDB CareerSwitch 数据库的丰富数据维度  
> **原则**：最小侵入，不改动现有代码，任何异常都 fallback 到原外部 API

---

## 📋 改动说明

### ✅ 需要改动的地方

1. **新增文件**：
   - `src/services/careerSwitch/kimiCareerAdvice.ts` - Kimi 职业建议服务（新建）
   - `src/lib/kimiClient.ts` - Kimi API 客户端封装（新建）

2. **修改文件**：
   - `src/app/api/mcp/route.ts` - 在 `career_transition_advice` 中添加 Feature Flag 分支（最小侵入）

3. **环境变量**：
   - `USE_KIMI_FOR_CAREER_ADVICE=true` - Feature Flag
   - `KIMI_API_KEY=xxx` - Kimi API Key
   - `MONGODB_URI=xxx` - MongoDB 连接（如果还没有）

### ❌ 不改动的地方

1. **现有外部 API 路径**：
   - `src/app/api/mcp/route.ts` 中的现有 `career_transition_advice` 逻辑完全不变
   - 外部 API `http://149.28.175.142:3009/api/career/advice` 调用逻辑不变

2. **其他 MCP 工具**：
   - `recommend_jobs`、`refine_recommendations` 等工具不受影响

3. **现有数据库连接**：
   - 如果已有 MongoDB 连接，复用现有连接

---

## 🎯 一、接入内容

### 1.1 接入的 Kimi 能力

#### **Kimi 2 Thinking 模型特性**
- **模型名称**：`moonshot-v1-32k`（MVP 阶段，保守选择）
- **核心能力**：
  1. **长上下文**：支持 32K tokens，可一次性处理多个转换路径数据
  2. **思维链推理**：多步骤深度分析能力
  3. **结构化输出**：支持 JSON/Markdown 格式输出，便于后续处理
  4. **中文优化**：对中文理解能力强，适合职业建议场景

#### **接入的具体功能**
在 `career_transition_advice` 工具中，Kimi 将负责：

1. **多维度数据分析**：
   - 基于 `sharedSkills` / `gapSkills` / `topSkills` / `primaryThemes` 进行技能分析
   - 利用 `skillVec` 计算的 `sim` 分数作为相似度参考（不要求模型解释向量维度）
   - 融合市场数据、地理因素、经验匹配等多维度信息

2. **个性化路径生成**：
   - 基于用户输入（`current_job`, `experience_years`, `skills`, `industry`, `location`）
   - 匹配 MongoDB 中的多维度数据
   - 生成个性化的职业转换建议

3. **深度推理分析**：
   - 分析技能之间的关联性和学习路径
   - 评估转换难度和时间线
   - 提供多路径对比和风险评估

---

## 📊 二、数据流程设计

### 2.1 当前流程（外部 API）

```
用户请求
  ↓
MCP Route (career_transition_advice)
  ↓
外部 API: http://149.28.175.142:3009/api/career/advice
  ↓
返回基础转换建议（fromId → toId, sim, sharedSkills, gapSkills）
```

### 2.2 Kimi 接入后的流程

```
用户请求
  ↓
MCP Route (career_transition_advice)
  ↓
Feature Flag 检查：USE_KIMI_FOR_CAREER_ADVICE=true?
  ├─ NO → 走现有外部 API（保持不变，完全不变）
  └─ YES → Kimi 路径
      ↓
  1. 直接连接 MongoDB CareerSwitch
      ↓
  2. 多维度数据查询（严格限制数据量）：
     - job_tags: 查询当前职位信息（limit 1-3条，只取最匹配）
       - 字段：standardTitle, experienceLevel, industry, country, topSkills, 
              coreSkills, niceToHaveSkills, primaryThemes, secondaryThemes, 
              keyRequirements, educationRequirement, experienceRange,
              responsibilityScore, leadershipScore, technicalScore
     - career_paths: 查询转换路径（limit 30-50条）
       - 字段：fromId, toId, sim, sharedSkills, gapSkills, opportunityScore,
              fromCountry, toCountry, isCrossCountry, remoteSupported
     - role_skill_matrix: 查询市场数据（按 toId + country 取最相关1条）
       - 字段：role, level, country, marketDemand, skills
      ↓
  3. 数据聚合和格式化：
     - 将 MongoDB 查询结果组织成结构化数据
     - 包含所有相关维度（技能、市场、地理、经验、要求等）
      ↓
  4. 调用 Kimi API（超时预算：8秒）：
     - 输入：用户参数 + MongoDB 多维度数据（限制规模）
     - 提示词：设计专业的职业转换分析提示词（固定 schema，限制输出长度）
     - 输出：结构化的职业转换建议报告（Top 3-5 路径）
      ↓
  5. 格式化返回：
     - 将 Kimi 输出格式化为 Markdown
     - 保持与现有 API 返回格式一致
      ↓
  异常处理：
  - MongoDB 查询超过 2s → 降级到外部 API
  - Kimi 调用超过 8s → 降级到外部 API
  - Kimi 返回无法解析 → 降级到外部 API
  - 任何异常 → 直接 fallback 到原外部 API（保证可用性）
```

---

## 🎨 三、预期效果对比

### 3.1 当前效果（外部 API）

**输入示例**：
```json
{
  "current_job": "Software Engineer",
  "experience_years": 5,
  "skills": ["React", "Node.js"],
  "industry": "Technology",
  "location": "Australia"
}
```

**输出特点**：
- ✅ 基础转换建议（10个候选职位）
- ✅ 简单相似度分数
- ✅ 基础技能对比（sharedSkills, gapSkills）
- ❌ 未利用用户输入的经验、行业、地点
- ❌ 未利用市场数据、地理因素
- ❌ 未提供深度分析和个性化建议

**示例输出**：
```
1. Full Stack Developer
   Similarity: 85% | Difficulty: Medium
   Shared Skills: React, Node.js
   Skills to Learn: MongoDB, AWS
```

### 3.2 Kimi 接入后的预期效果

**输入示例**（相同）：
```json
{
  "current_job": "Software Engineer",
  "experience_years": 5,
  "skills": ["React", "Node.js"],
  "industry": "Technology",
  "location": "Australia"
}
```

**输出特点**：
- ✅ **多维度匹配**：基于经验、行业、地点精确匹配
- ✅ **深度分析**：基于 sharedSkills/gapSkills/topSkills 分析，解释为什么相似
- ✅ **市场洞察**：融合市场需求、竞争水平、远程支持（不包含薪资，避免幻觉）
- ✅ **个性化路径**：基于用户背景生成定制化建议
- ✅ **多路径对比**：同时分析多个转换路径，对比优劣
- ✅ **风险评估**：评估转换难度、时间线、地理因素

**预期输出示例**（MVP 范围，禁止薪资等非库字段）：
```markdown
# 🎯 职业转换分析报告

## 📊 当前状态分析
- **职位**：Software Engineer (Mid-level)
- **经验匹配度**：✅ 5年经验符合目标职位要求（3-7年）
- **技能匹配度**：85% (React, Node.js 为核心技能)
- **行业匹配度**：✅ Technology 行业，市场需求高
- **地理匹配度**：✅ Australia 市场，远程工作支持率 40%

## 💼 推荐转换路径（Top 3-5）

### 1. Senior Full Stack Developer
**相似度**：88% | **可行性**：高 | **市场需求**：高（0.85）

**为什么推荐**：
- 技能相似度 88%，基于 sharedSkills 分析：React、Node.js 为核心匹配技能
- 你的 React、Node.js 经验可直接转移
- Australia 市场对 Senior 级别需求旺盛（marketDemand: 0.85）

**技能分析**：
- ✅ **可转移技能**：React, Node.js, JavaScript, Git（来自 sharedSkills）
- 📚 **需要学习**：MongoDB, AWS, 系统设计（来自 gapSkills）
- 🎯 **学习路径**（建议）：先掌握 MongoDB → 再学习 AWS → 最后系统设计

**市场洞察**：
- 市场需求：0.85（高需求，来自 role_skill_matrix）
- 竞争水平：中等（适合 5年经验，基于 experienceLevel 匹配）
- 远程支持：40% 职位支持远程（来自 remoteSupported）

**转换时间线**（预估）：
- 立即行动：更新简历，突出 React/Node.js 经验
- 1-3个月：学习 MongoDB，完成 1-2 个项目
- 3-6个月：学习 AWS，获得认证
- 6-12个月：准备面试

**风险评估**：
- ⚠️ 需要补充数据库和云服务经验（基于 gapSkills）
- ✅ 地理因素：Australia 市场友好，无需跨国家（isCrossCountry: false）
- ✅ 远程支持：可选择远程职位（remoteSupported: true）

**注意**：薪资区间数据不在数据库中，此处不提供具体薪资建议。

---

### 2. Tech Lead / Engineering Manager
**相似度**：72% | **可行性**：中 | **市场需求**：中（0.65）

**为什么推荐**：
- 技能相似度中等，但你的 5年经验符合 Tech Lead 的入门要求
- 需要补充领导力和管理技能
- Australia 市场对 Tech Lead 需求稳定

**技能分析**：
- ✅ **可转移技能**：技术栈经验（React, Node.js）
- 📚 **需要学习**：团队管理、项目管理、系统架构设计
- 🎯 **学习路径**：先承担小团队责任 → 学习管理技能 → 系统架构

**市场洞察**：
- 市场需求：0.65（中等需求，来自 role_skill_matrix）
- 竞争水平：高（需要管理经验，基于 experienceLevel 匹配）
- 远程支持：25% 职位支持远程（来自 remoteSupported）

**转换时间线**（预估）：
- 6-12个月：在当前职位承担更多领导责任
- 12-18个月：学习管理技能，可能考虑内部晋升
- 18-24个月：准备外部机会

**风险评估**：
- ⚠️ 需要补充管理经验，可能需要内部晋升路径
- ⚠️ 竞争激烈，需要证明领导能力
- ✅ 市场需求稳定（marketDemand: 0.65）

**注意**：薪资区间数据不在数据库中，此处不提供具体薪资建议。

---

### 3. Product Manager (Technical)
**相似度**：65% | **可行性**：中 | **市场需求**：高（0.80）

**为什么推荐**：
- 技能相似度较低，但你的技术背景是优势
- Technology 行业对 Technical PM 需求高
- Australia 市场对 Technical PM 需求旺盛

**技能分析**：
- ✅ **可转移技能**：技术理解、问题解决能力
- 📚 **需要学习**：产品思维、用户研究、数据分析、项目管理
- 🎯 **学习路径**：先学习产品思维 → 用户研究 → 数据分析

**市场洞察**：
- 市场需求：0.80（高需求，来自 role_skill_matrix）
- 竞争水平：中等（技术背景是优势，基于 experienceLevel 匹配）
- 远程支持：35% 职位支持远程（来自 remoteSupported）

**转换时间线**（预估）：
- 3-6个月：学习产品思维，完成在线课程
- 6-12个月：参与产品项目，积累经验
- 12-18个月：准备面试

**注意**：薪资区间数据不在数据库中，此处不提供具体薪资建议。

**风险评估**：
- ⚠️ 需要大幅补充产品和管理技能
- ✅ 技术背景是优势，容易理解技术产品
- ✅ 市场需求高，机会多

---

## 📈 四、数据利用对比

### 4.1 当前数据利用（外部 API）

| 数据维度 | 利用情况 | 说明 |
|---------|---------|------|
| `career_paths.sim` | ✅ 使用 | 基础相似度排序 |
| `career_paths.sharedSkills` | ✅ 使用 | 简单技能列表 |
| `career_paths.gapSkills` | ✅ 使用 | 简单技能列表 |
| `job_tags.skillVec` | ❌ 未使用 | 50维向量未利用 |
| `job_tags.country` | ❌ 未使用 | 地理维度未利用 |
| `job_tags.industry` | ❌ 未使用 | 行业维度未利用 |
| `job_tags.experienceLevel` | ❌ 未使用 | 经验维度未利用 |
| `job_tags.keyRequirements` | ❌ 未使用 | 要求维度未利用 |
| `role_skill_matrix.marketDemand` | ❌ 未使用 | 市场数据未利用 |
| `role_skill_matrix.level` | ❌ 未使用 | 级别匹配未利用 |
| `career_paths.isCrossCountry` | ❌ 未使用 | 跨国家分析未利用 |
| `career_paths.remoteSupported` | ❌ 未使用 | 远程工作分析未利用 |

**数据利用度**：约 20%

### 4.2 Kimi 接入后的数据利用

| 数据维度 | 利用情况 | Kimi 如何利用 |
|---------|---------|-------------|
| `career_paths.sim` | ✅ 使用 | 作为基础相似度参考 |
| `career_paths.sharedSkills` | ✅ 使用 | 分析可转移技能 |
| `career_paths.gapSkills` | ✅ 使用 | 生成学习路径 |
| `job_tags.skillVec` | ✅ **新增** | 用于 sim 计算与验证（不要求模型解释向量维度） |
| `job_tags.country` | ✅ **新增** | 匹配用户 location，分析地理因素 |
| `job_tags.industry` | ✅ **新增** | 匹配用户 industry，分析行业趋势 |
| `job_tags.experienceLevel` | ✅ **新增** | 匹配用户 experience_years |
| `job_tags.keyRequirements` | ✅ **新增** | 对比用户背景和要求 |
| `role_skill_matrix.marketDemand` | ✅ **新增** | 评估市场需求和机会 |
| `role_skill_matrix.level` | ✅ **新增** | 匹配用户经验级别 |
| `career_paths.isCrossCountry` | ✅ **新增** | 评估跨国家转换风险 |
| `career_paths.remoteSupported` | ✅ **新增** | 分析远程工作机会 |

**数据利用度**：约 90%+

---

## 🧪 五、测试方案

### 5.1 功能测试

#### **测试用例 1：基础转换建议**
**输入**：
```json
{
  "current_job": "Software Engineer",
  "experience_years": 3,
  "skills": ["JavaScript", "React"],
  "industry": "Technology",
  "location": "Australia"
}
```

**预期输出**：
- ✅ 返回 3-5 个推荐职位
- ✅ 每个职位包含相似度、可行性、市场需求
- ✅ 包含技能分析（可转移技能、需要学习）
- ✅ 包含市场洞察（薪资、竞争、远程支持）
- ✅ 包含转换时间线
- ✅ 包含风险评估

**验证点**：
- [ ] 输出格式正确（Markdown）
- [ ] 数据来源正确（MongoDB）
- [ ] Kimi API 调用成功
- [ ] 响应时间 < 10秒

---

#### **测试用例 2：经验匹配**
**输入**：
```json
{
  "current_job": "Junior Developer",
  "experience_years": 1,
  "skills": ["Python"],
  "industry": "Technology",
  "location": "Australia"
}
```

**预期输出**：
- ✅ 推荐职位匹配 Junior/Mid 级别
- ✅ 不推荐 Senior/Lead 级别（经验不足）
- ✅ 时间线考虑经验积累（12-24个月）

**验证点**：
- [ ] 经验级别匹配正确
- [ ] 不推荐超出经验范围的职位
- [ ] 时间线合理

---

#### **测试用例 3：地理因素**
**输入**：
```json
{
  "current_job": "Data Analyst",
  "experience_years": 4,
  "skills": ["Python", "SQL"],
  "industry": "Finance",
  "location": "Australia"
}
```

**预期输出**：
- ✅ 优先推荐 Australia 市场的职位
- ✅ 分析 Australia 市场的需求和竞争水平（不包含薪资）
- ✅ 如果推荐跨国家职位，明确说明风险和机会

**验证点**：
- [ ] 地理匹配正确
- [ ] 市场数据来自正确的 country
- [ ] 跨国家分析准确

---

#### **测试用例 4：行业匹配**
**输入**：
```json
{
  "current_job": "Marketing Manager",
  "experience_years": 6,
  "skills": ["Digital Marketing", "SEO"],
  "industry": "E-commerce",
  "location": "Australia"
}
```

**预期输出**：
- ✅ 优先推荐 E-commerce 相关职位
- ✅ 分析行业趋势和需求
- ✅ 考虑跨行业转换的机会和挑战

**验证点**：
- [ ] 行业匹配正确
- [ ] 行业趋势分析准确
- [ ] 跨行业建议合理

---

#### **测试用例 5：技能深度分析**
**输入**：
```json
{
  "current_job": "Frontend Developer",
  "experience_years": 5,
  "skills": ["React", "Vue", "TypeScript", "CSS"],
  "industry": "Technology",
  "location": "Australia"
}
```

**预期输出**：
- ✅ 基于 sharedSkills/gapSkills/topSkills 进行技能分析
- ✅ 解释为什么某些职位相似（基于技能列表，不要求解释向量维度）
- ✅ 提供技能学习路径和关联性

**验证点**：
- [ ] 技能分析深入（不只是列表）
- [ ] 学习路径合理
- [ ] 技能关联性准确

---

### 5.2 性能测试（硬约束）

#### **测试指标**
1. **响应时间（必须遵守）**：
   - MongoDB 查询时间：< 2秒（超过则降级）
   - Kimi API 调用时间：< 8秒（超过则降级）
   - 总响应时间：< 10秒

2. **数据量上限（必须遵守）**：
   - `job_tags`：limit 1-3 条（只取最匹配）
   - `career_paths`：limit 30-50 条（不是无限）
   - `role_skill_matrix`：按 toId + country 取最相关 1 条
   - Kimi 输出：Top 3-5 路径，固定 schema，限制字数/段落

3. **并发处理**：
   - 支持 10 个并发请求
   - 无内存泄漏
   - 无数据库连接泄漏

4. **错误处理和降级（明确触发条件）**：
   - MongoDB 查询超过 2s → 直接降级
   - Kimi 调用超过 8s → 直接降级
   - Kimi 返回无法解析 → 降级
   - MongoDB 连接失败 → 降级到外部 API
   - Kimi API 失败 → 降级到外部 API
   - 数据缺失 → 优雅处理，返回部分结果

---

### 5.3 对比测试（保守灰度）

#### **A/B 测试方案（渐进式灰度）**
1. **Feature Flag 控制（保守灰度）**：
   - Phase 1：0% 流量（仅内部测试）
   - Phase 2：10% 流量走 Kimi 路径（观察延迟与错误）
   - Phase 3：50% 流量走 Kimi 路径
   - Phase 4：100% 流量（如果稳定）

2. **对比指标**：
   - 响应时间对比
   - 输出质量对比（人工评估）
   - 用户满意度对比
   - 错误率对比

3. **评估标准**：
   - Kimi 输出是否更详细？
   - Kimi 输出是否更个性化？
   - Kimi 输出是否更准确？
   - 响应时间是否可控？
   - 错误率是否可接受？

---

### 5.4 数据准确性测试（字段一致性校验）

#### **测试用例**
1. **MongoDB 数据查询准确性**：
   - [ ] `job_tags` 查询结果正确（只查询必要字段）
   - [ ] `career_paths` 查询结果正确（只查询必要字段）
   - [ ] `role_skill_matrix` 查询结果正确（只查询必要字段）
   - [ ] 数据聚合逻辑正确

2. **Kimi 输出字段一致性校验**：
   - [ ] **对 MongoDB 原始字段**：数值/列表必须一致
     - `sim` 分数与 MongoDB 数据一致（不允许模型编造）
     - `sharedSkills` / `gapSkills` 列表与 MongoDB 数据一致（不允许模型编造）
     - `marketDemand` 与 MongoDB 数据一致（不允许模型编造）
     - `country` / `isCrossCountry` / `remoteSupported` 与 MongoDB 数据一致
   
   - [ ] **对推理性描述**：必须标注为推断/建议，不作为事实
     - 技能学习路径：标注为"建议"或"推断"
     - 转换时间线：标注为"预估"或"建议"
     - 薪资区间：**若无数据则不输出或标注缺失**（避免模型幻觉）
   
   - [ ] **禁止输出库里没有的数据**：
     - 薪资区间（库里没有）→ 不输出或标注缺失
     - 其他非库字段 → 必须标注为推断

3. **格式一致性**：
   - [ ] 输出格式与现有 API 兼容
   - [ ] Markdown 格式正确
   - [ ] 数据结构一致

---

### 5.5 边界情况测试

#### **测试用例**
1. **数据缺失**：
   - [ ] 用户输入不完整（缺少某些字段）
   - [ ] MongoDB 中找不到匹配的职位
   - [ ] `career_paths` 中没有转换路径

2. **异常输入**：
   - [ ] 无效的职位名称
   - [ ] 无效的经验年数（负数、过大）
   - [ ] 无效的地点

3. **API 失败**：
   - [ ] Kimi API 超时
   - [ ] Kimi API 返回错误
   - [ ] MongoDB 连接失败

---

## 🔧 六、技术实现要点

### 6.1 不改动现有代码的原则（最小侵入）

1. **Feature Flag 控制**：
   ```typescript
   const USE_KIMI = process.env.USE_KIMI_FOR_CAREER_ADVICE === 'true';
   if (USE_KIMI) {
     try {
       return await handleCareerAdviceWithKimi(args, traceId);
     } catch (error) {
       console.error('[Kimi] Fallback to external API:', error);
       // 直接 fallback，不抛出异常
     }
   }
   // 现有外部 API 路径（保持不变，完全不变）
   ```

2. **独立函数**：
   - ✅ 创建新的函数 `handleCareerAdviceWithKimi()`
   - ✅ 不修改现有的 `career_transition_advice` 处理逻辑
   - ✅ 现有外部 API 路径保持完全不变

3. **错误降级（明确触发条件）**：
   - ✅ MongoDB 查询超过 2s → 直接降级
   - ✅ Kimi 调用超过 8s（总 10s budget）→ 直接降级
   - ✅ Kimi 返回无法解析 JSON/Markdown schema → 降级
   - ✅ 任何异常都直接 fallback 到原外部 API（保证可用性）

---

### 6.2 MongoDB 查询优化（硬约束）

1. **索引利用**：
   - 使用 `job_tags.standardTitle` 索引
   - 使用 `career_paths.fromId` 索引
   - 使用 `role_skill_matrix.role` 索引

2. **查询优化（必须遵守）**：
   - ✅ **只查询必要字段（projection）**，避免全字段查询：
     ```typescript
     // job_tags projection（只取必要字段）
     {
       standardTitle: 1,
       experienceLevel: 1,
       industry: 1,
       country: 1,
       topSkills: 1,
       coreSkills: 1,
       niceToHaveSkills: 1,
       primaryThemes: 1,
       secondaryThemes: 1,
       keyRequirements: 1,
       educationRequirement: 1,
       experienceRange: 1,
       responsibilityScore: 1,
       leadershipScore: 1,
       technicalScore: 1
       // skillVec 可选（用于验证，不要求模型解释）
     }
     
     // career_paths projection
     {
       fromId: 1,
       toId: 1,
       sim: 1,
       sharedSkills: 1,
       gapSkills: 1,
       opportunityScore: 1,
       fromCountry: 1,
       toCountry: 1,
       isCrossCountry: 1,
       remoteSupported: 1
     }
     
     // role_skill_matrix projection
     {
       role: 1,
       level: 1,
       country: 1,
       marketDemand: 1,
       skills: 1
     }
     ```
   
   - ✅ **严格限制返回数量（limit）**：
     - `job_tags`：limit 1-3 条（只取最匹配，不要 broad regex 拉一堆）
     - `career_paths`：limit 30-50 条（不是无限）
     - `role_skill_matrix`：按 toId + country 取最相关 1 条（或少量）
   
   - ✅ **使用聚合管道优化复杂查询**

3. **连接池管理**：
   - 复用 MongoDB 连接
   - 避免频繁创建连接
   - 正确处理连接关闭

4. **超时控制**：
   - MongoDB 查询超时：2秒（超过则降级）
   - 总查询时间预算：< 2秒

---

### 6.3 Kimi API 调用（硬约束）

1. **API 配置**：
   ```typescript
   const KIMI_API_KEY = process.env.KIMI_API_KEY;
   const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
   const KIMI_MODEL = 'moonshot-v1-32k'; // MVP 阶段保守选择 32k
   ```

2. **提示词设计（固定 schema，限制输出长度）**：
   - ✅ 结构化提示词，包含所有数据维度
   - ✅ 明确输出格式要求（Markdown，固定 schema）
   - ✅ **限制输出长度**：Top 3-5 路径，每个路径限制字数/段落（避免模型写长文导致延迟）
   - ✅ 包含示例输出
   - ✅ **明确禁止**：薪资等库里没有的数据（避免模型幻觉）

3. **错误处理和超时控制**：
   - ✅ **超时处理**：8秒（总 10s budget，MongoDB 2s + Kimi 8s）
   - ✅ **重试机制**：只重试 1 次，或只对"可快速失败"的错误重试（避免 3 次 * 8s 导致延迟放大）
   - ✅ **降级策略**：
     - Kimi 调用超过 8s → 直接降级
     - Kimi 返回无法解析 JSON/Markdown schema → 降级
     - 任何异常 → 直接 fallback 到原外部 API

---

## 📋 七、实施步骤（MVP 优先）

### Phase 1: 准备阶段（1-2天）
1. ✅ 完成数据分析（已完成）
2. ⏳ 获取 Kimi API Key
3. ⏳ 配置环境变量
4. ⏳ 设计提示词模板（固定 schema，限制输出长度）

### Phase 2: 开发阶段（2-3天）- MVP 范围

#### **MVP 必做（严格范围）**：
1. ⏳ 实现 MongoDB 查询函数（只查必要字段，严格 limit）
   - `job_tags` + `career_paths` + `role_skill_matrix` 三集合
   - 使用 projection，避免全字段查询
   - 严格 limit（job_tags: 1-3, career_paths: 30-50, role_skill_matrix: 1）
   
2. ⏳ 实现 Kimi API 调用函数
   - 使用 `moonshot-v1-32k`（保守选择）
   - 固定 schema，限制输出长度（Top 3-5 路径）
   - 超时控制：8秒
   - 重试：只重试 1 次
   
3. ⏳ 实现数据聚合和格式化
   - 输出：Top 3-5 路径 + shared/gap + marketDemand + 风险（跨国/远程/级别）
   - **严格禁用**：薪资等库里没有的数据（避免幻觉）
   
4. ⏳ 实现 Feature Flag 控制
   - 独立函数 `handleCareerAdviceWithKimi()`
   - 现有外部 API 路径完全不变
   
5. ⏳ 实现错误处理和降级（明确触发条件）
   - MongoDB 查询超过 2s → 降级
   - Kimi 调用超过 8s → 降级
   - 任何异常 → 直接 fallback

#### **MVP 暂缓（后续扩展）**：
- ❌ `job_skills` + `skills` 的深度展开（除非确实需要）
- ❌ 128k 超长上下文（先 32k 保守）
- ❌ 薪资区间等非库字段（避免幻觉）

### Phase 3: 测试阶段（2-3天）
1. ⏳ 功能测试（5个测试用例）
2. ⏳ 性能测试（验证硬约束）
3. ⏳ 对比测试（A/B，保守灰度）
4. ⏳ 数据准确性测试（字段一致性校验）
5. ⏳ 边界情况测试

### Phase 4: 部署阶段（保守灰度）
1. ⏳ 0% 流量（仅内部测试）
2. ⏳ 10% 流量（观察延迟与错误）
3. ⏳ 50% 流量（如果稳定）
4. ⏳ 100% 流量（如果稳定）
5. ⏳ 监控和日志

---

## ✅ 八、成功标准

### 8.1 功能标准
- ✅ 所有功能测试用例通过
- ✅ 输出质量优于现有外部 API
- ✅ 数据利用度 > 90%

### 8.2 性能标准
- ✅ 响应时间 < 10秒
- ✅ 支持 10 个并发请求
- ✅ 错误率 < 1%

### 8.3 质量标准（字段一致性校验）
- ✅ 输出格式正确（Markdown）
- ✅ **字段一致性校验**：
  - 对 MongoDB 原始字段：数值/列表必须一致（sim、skills 列表不允许模型编造）
  - 对推理性描述：必须标注为推断/建议，不作为事实
  - 禁止输出库里没有的数据（薪资等），若无数据则不输出或标注缺失
- ✅ 用户体验提升（更详细、更个性化）

---

## 📝 九、风险与应对

### 9.1 技术风险
1. **Kimi API 不稳定**：
   - 应对：实现降级机制，失败时走外部 API

2. **MongoDB 查询慢**：
   - 应对：优化查询，使用索引，限制返回数量

3. **响应时间过长**：
   - 应对：优化提示词长度，使用更快的模型

### 9.2 数据风险
1. **数据缺失**：
   - 应对：优雅处理，返回部分结果

2. **数据不一致**：
   - 应对：数据验证，确保数据准确性

### 9.3 业务风险
1. **用户体验下降**：
   - 应对：A/B 测试，逐步灰度发布

2. **成本增加**：
   - 应对：监控 API 调用次数，优化提示词长度

---

## 🎯 十、总结

### 10.1 接入内容
- **Kimi 2 Thinking 模型**：用于多维度数据分析和个性化路径生成
- **MongoDB 直接查询**：充分利用 8 个核心集合的丰富数据
- **Feature Flag 控制**：不改动现有代码，安全接入

### 10.2 预期效果
- **数据利用度**：从 20% → 90%+
- **输出质量**：从基础建议 → 深度个性化分析
- **用户体验**：从通用建议 → 定制化路径规划

### 10.3 测试计划
- **功能测试**：5 个核心测试用例
- **性能测试**：响应时间、并发、错误处理
- **对比测试**：A/B 测试，评估改进效果
- **数据准确性测试**：确保数据一致性
- **边界情况测试**：异常处理和降级

---

## 📝 改动清单总结

### ✅ 需要改动

1. **新建文件**（2个）：
   - `src/lib/kimiClient.ts` - Kimi API 客户端
   - `src/services/careerSwitch/kimiCareerAdvice.ts` - Kimi 职业建议服务

2. **修改文件**（1个）：
   - `src/app/api/mcp/route.ts` - 添加 Feature Flag 分支（约 10 行代码）

3. **环境变量**（2个）：
   - `USE_KIMI_FOR_CAREER_ADVICE=false` - Feature Flag（初始关闭）
   - `KIMI_API_KEY=xxx` - Kimi API Key

### ❌ 不改动

1. **现有外部 API 路径**：`src/app/api/mcp/route.ts` 中的现有逻辑完全不变
2. **其他 MCP 工具**：不受影响
3. **现有数据库连接**：复用现有连接（如果有）

---

**下一步**：等待确认后开始实施 Phase 1（准备阶段）

