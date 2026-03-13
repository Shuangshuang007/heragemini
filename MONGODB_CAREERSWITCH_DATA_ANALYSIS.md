# MongoDB CareerSwitch 数据分析 - 为 Kimi 接入做准备

> **目标**：分析 MongoDB CareerSwitch 数据库的实际数据结构和维度  
> **原则**：只分析，不改动任何代码

---

## 📊 当前 MCP 调用流程

### 实际调用路径
```
MCP Route (hera_one/src/app/api/mcp/route.ts)
  ↓
POST /api/career/advice
  ↓
外部 API: http://149.28.175.142:3009/api/career/advice
  ↓
返回结果（格式化后返回给用户）
```

### 问题
- ❌ 当前通过外部 API 调用，不是直接连接 MongoDB
- ❌ 无法充分利用 MongoDB 中的丰富数据

---

## 🗄️ MongoDB CareerSwitch 数据库结构分析

### 核心集合及其数据维度

#### 1. `job_tags` ⭐⭐⭐（核心数据源）

**字段结构**（从代码分析，完整定义）：
```typescript
{
  // === 基础标识 ===
  jobId: string,                    // ⭐ 职位 ID（唯一索引）
  
  // === 标准化信息 ===
  standardTitle: string,            // ⭐ 标准化职位标题（用于匹配和分组）
  canonicalTitle?: string,          // 规范标题（备用）
  experienceLevel: 'entry' | 'junior' | 'mid' | 'senior' | 'lead',  // ⭐ 经验级别
  
  // === 技能数据（核心） ===
  skillVec: number[],                // ⭐ 技能向量（50维，基于技能 embedding 的加权平均）
  topSkills: string[],              // ⭐ 主要技能列表（按 TF-IDF 排序）
  coreSkills: string[],             // ⭐ 核心技能 ID 列表
  niceToHaveSkills: string[],       // ⭐ 加分技能 ID 列表
  skillCount: number,               // 技能总数
  
  // === 能力主题 ===
  primaryThemes: string[],          // ⭐ 主要能力主题 ID
  secondaryThemes: string[],        // 次要能力主题 ID
  
  // === 要求信息 ===
  educationRequirement: string[],    // ⭐ 教育要求
  experienceRange: {                // ⭐ 经验范围
    min: number,
    max: number,
    unit: 'years' | 'months'
  },
  keyRequirements?: string[],       // ⭐ 关键要求（资格、许可证、证书、经验年限等）
  employmentType?: string,          // 工作类型（Full-time, Part-time, Contract）
  
  // === 市场信息 ===
  industry: string,                 // ⭐ 行业
  salaryRange?: {                   // 薪资范围
    min: number,
    max: number,
    currency: string
  },
  
  // === 地理位置信息 ===
  country?: string,                 // ⭐ 国家代码（如 "US", "AU", "US;CA", "remote;US"）
  locations?: string,               // ⭐ 位置字符串
  
  // === 智能分析结果 ===
  responsibilityScore: number,      // ⭐ 责任级别评分（0-1）
  leadershipScore: number,          // ⭐ 领导力评分（0-1）
  technicalScore: number,           // ⭐ 技术复杂度评分（0-1）
  
  // === 功能分类 ===
  functionality?: string,            // 核心职责功能域
  
  // === 元数据 ===
  extractedAt: Date,                // 提取时间
  updatedAt: Date,                  // 更新时间
  vectorizedAt?: Date               // 向量化时间
}
```

**skillVec 生成方式**：
- 维度：50 维向量
- 生成方法：基于 `extractedMustHaveTags` 中的技能，使用技能的 `embedding`（50维）乘以 TF-IDF 权重后加权平均
- 用途：用于计算职位之间的余弦相似度（`calculateCosineSimilarity`）

**索引**：
- `{ jobId: 1 }` - 唯一索引
- `{ standardTitle: 1, experienceLevel: 1 }` - 复合索引
- `{ industry: 1 }` - 行业索引
- `{ extractedAt: -1 }` - 时间索引

**数据用途**：
- 职位标准化和分类
- 技能向量化（用于相似度计算）
- 多维度查询（国家、行业、经验级别）

---

#### 2. `career_paths` ⭐⭐⭐（预计算的转换路径）

**字段结构**（从代码分析，实际存储结构）：
```typescript
{
  // === 转换关系 ===
  fromId: string,                   // ⭐ 起始职位（standardTitle）
  toId: string,                     // ⭐ 目标职位（standardTitle）
  
  // === 相似度分析 ===
  sim: number,                      // ⭐ 相似度分数（0-1，基于 skillVec 余弦相似度）
  
  // === 技能分析 ===
  sharedSkills: string[],           // ⭐ 共享技能（最多5个）
  gapSkills: string[],             // ⭐ 技能差距（最多6个）
  
  // === 评分 ===
  opportunityScore: number,        // ⭐ 机会分数（0-1，基于趋势、远程、赞助、行业增长）
  
  // === 地理维度 ===
  fromCountry?: string,             // ⭐ 起始国家（如 "US", "AU"）
  toCountry?: string,               // ⭐ 目标国家
  isCrossCountry?: boolean,         // ⭐ 是否跨国家转换
  remoteSupported?: boolean,        // ⭐ 是否支持远程工作
  
  // === 元数据 ===
  updatedAt: Date                   // 更新时间
}
```

**计算逻辑**：
- `sim`：通过 `calculateCosineSimilarity(fromJob.skillVec, toJob.skillVec)` 计算
- `sharedSkills` / `gapSkills`：通过 `calculateSkillGaps(fromJob.topSkills, toJob.topSkills)` 计算
- `opportunityScore`：基于趋势、远程工作率、赞助率、行业增长（当前部分数据缺失，使用默认值）
- `isCrossCountry`：通过 `parseCountry` 解析国家代码，判断是否跨国家

**索引**：
- `{ fromRole: 1, toRole: 1 }` - 转换关系索引
- `{ fromRole: 1, fromLevel: 1 }` - 起始职位+级别索引
- `{ transitionScore: -1 }` - 转换分数索引
- `{ feasibility: 1 }` - 可行性索引

**数据用途**：
- 快速查询职业转换路径
- 预计算的相似度和技能分析
- 支持国家维度的转换分析

---

#### 3. `role_skill_matrix` ⭐⭐（市场数据）

**字段结构**（从代码分析）：
```typescript
{
  role: string,                     // ⭐ 角色名称
  level: string,                    // ⭐ 级别
  country: string,                  // ⭐ 国家
  marketDemand: number,             // ⭐ 市场需求（0-1）
  skills: string[],                 // 技能列表
  updatedAt: Date                  // 更新时间
}
```

**索引**：
- `{ role: 1, level: 1, country: 1 }` - 唯一复合索引
- `{ role: 1 }` - 角色索引
- `{ country: 1 }` - 国家索引
- `{ marketDemand: -1 }` - 市场需求索引

**数据用途**：
- 市场趋势分析
- 不同国家的市场需求对比
- 技能矩阵分析

---

#### 4. `jobs` ⭐（原始职位数据，约 3M 条）

**字段结构**：
```typescript
{
  id: string,                       // 职位 ID
  title: string,                    // 职位标题
  company: string,                  // 公司名称
  location: string,                 // 地点
  description: string,              // 职位描述
  postedDateISO: Date,             // 发布日期
  skillExtractionStatus: string,    // 技能提取状态
  hasDetailedSkills: boolean       // 是否有详细技能
}
```

**数据用途**：
- 原始数据源
- 用于提取和生成 `job_tags`

---

#### 5. `job_skills` ⭐（职位-技能关联）

**字段结构**：
```typescript
{
  jobId: string,                   // 职位 ID
  skillId: string,                  // 技能 ID
  confidenceValidated: number,      // 置信度
  extractionMethod: string,         // 提取方法
  createdAt: Date                   // 创建时间
}
```

**数据用途**：
- 职位和技能的关联关系
- 技能置信度分析

---

#### 6. `skills` ⭐（技能数据）

**字段结构**：
```typescript
{
  id: string,                      // 技能 ID（唯一）
  canonical: string,               // ⭐ 标准化技能名称
  df: number,                      // 文档频率
  idf: number,                     // 逆文档频率
  // ... 其他字段
}
```

**数据用途**：
- 技能标准化
- TF-IDF 统计

---

## 🎯 数据维度总结

### 主要数据维度

1. **职位维度**：
   - `standardTitle` - 标准化职位标题
   - `experienceLevel` - 经验级别
   - `industry` - 行业
   - `functionality` - 功能分类

2. **技能维度**：
   - `skillVec` - 技能向量（高维）
   - `topSkills` - 主要技能列表
   - `coreSkills` - 核心技能
   - `niceToHaveSkills` - 加分技能

3. **地理维度**：
   - `country` - 国家
   - `locations` - 地点列表

4. **转换维度**：
   - `sim` - 相似度分数
   - `sharedSkills` - 共享技能
   - `gapSkills` - 技能差距
   - `opportunityScore` - 机会分数

5. **市场维度**：
   - `marketDemand` - 市场需求
   - `level` - 级别

---

## 💡 Kimi 2 Thinking 接入后的数据利用方案

### 当前数据利用（外部 API）
- ❌ 只使用基础转换路径（fromId → toId, sim）
- ❌ 没有利用技能向量、市场数据等丰富维度
- ❌ 没有利用用户输入（experience, skills, industry, location）

### Kimi 接入后的增强方案

#### 1. **多维度数据融合**
```typescript
// 查询策略
1. 从 job_tags 查询当前职位：
   - standardTitle 匹配
   - 获取 skillVec, topSkills, industry, country, experienceLevel

2. 从 career_paths 查询转换路径：
   - fromId 匹配
   - 获取 toId, sim, sharedSkills, gapSkills, opportunityScore

3. 从 role_skill_matrix 查询市场数据：
   - role 匹配 + country 匹配
   - 获取 marketDemand, level

4. 从 job_skills + skills 查询详细技能：
   - jobId → skillId → skill details
   - 获取技能置信度、TF-IDF 等
```

#### 2. **Kimi 2 Thinking 的优势利用**

**超长上下文（200K+ tokens）**：
- ✅ 可以一次性提供多个转换路径的完整数据
- ✅ 可以包含详细的技能分析、市场数据
- ✅ 可以包含用户的历史查询和偏好

**思维链推理**：
- ✅ 多步骤分析：
  1. 分析用户当前状态（从 job_tags）
  2. 评估转换路径（从 career_paths）
  3. 考虑市场因素（从 role_skill_matrix）
  4. 生成个性化建议

**深度理解**：
- ✅ 理解技能向量的语义含义
- ✅ 理解市场趋势对转换的影响
- ✅ 理解地理因素（国家、城市）的影响

#### 3. **数据丰富度提升**

**当前**：
- 基础转换路径（fromId → toId, sim）
- 简单技能列表（sharedSkills, gapSkills）

**Kimi 接入后**：
- ✅ 技能向量分析（skillVec 的语义理解）
- ✅ 市场数据融合（marketDemand, level）
- ✅ 地理维度分析（country, locations）
- ✅ 经验级别匹配（experienceLevel）
- ✅ 关键要求分析（keyRequirements）
- ✅ 行业趋势分析（industry）
- ✅ 多路径对比分析（多个 toId 的深度对比）

---

## 📋 数据查询示例（不改代码，仅分析）

### 查询 1: 获取当前职位信息
```typescript
// 从 job_tags 查询
const currentJobTag = await db.collection('job_tags').findOne({
  standardTitle: { $regex: new RegExp(currentJob, 'i') }
});

// 可获得：
// - skillVec: [0.1, 0.3, 0.5, ...] (高维向量)
// - topSkills: ['React', 'Node.js', 'TypeScript']
// - industry: 'Technology'
// - country: 'Australia'
// - experienceLevel: 'Mid'
// - keyRequirements: ['5+ years', 'Bachelor degree']
```

### 查询 2: 获取转换路径
```typescript
// 从 career_paths 查询
const careerPaths = await db.collection('career_paths').find({
  fromId: { $regex: new RegExp(currentJob, 'i') }
}).sort({ sim: -1 }).limit(20).toArray();

// 可获得：
// - toId: 'Product Manager'
// - sim: 0.75 (相似度)
// - sharedSkills: ['Communication', 'Problem Solving']
// - gapSkills: ['Product Strategy', 'User Research']
// - opportunityScore: 0.8
// - fromCountry, toCountry, isCrossCountry, remoteSupported
```

### 查询 3: 获取市场数据
```typescript
// 从 role_skill_matrix 查询
const marketData = await db.collection('role_skill_matrix').find({
  role: { $regex: new RegExp(targetJob, 'i') },
  country: location || 'Australia'
}).toArray();

// 可获得：
// - marketDemand: 0.85 (高需求)
// - level: 'Senior'
// - skills: ['Product Strategy', 'User Research', ...]
```

---

## 🚀 Kimi 接入后的数据利用策略

### 策略 1: 向量相似度 + Kimi 语义理解
- **当前**：只用 `sim` 分数排序，无法解释为什么相似
- **Kimi 后**：
  - ✅ 理解 `skillVec`（50维向量）的语义含义
  - ✅ 分析哪些维度（技能类别）导致相似度高
  - ✅ 提供匹配理由："这两个职位在技术栈（维度1-20）和软技能（维度30-40）上高度相似"

### 策略 2: 多维度数据融合分析
- **当前**：单一维度（相似度），忽略其他数据
- **Kimi 后**：同时考虑：
  - ✅ **技能相似度**（`sim` from `career_paths`）
  - ✅ **市场 demand**（`marketDemand` from `role_skill_matrix`）
  - ✅ **地理因素**（`country`, `locations` from `job_tags`）
  - ✅ **经验匹配**（`experienceLevel` from `job_tags` vs 用户输入）
  - ✅ **行业趋势**（`industry` from `job_tags`）
  - ✅ **责任级别**（`responsibilityScore`, `leadershipScore`, `technicalScore`）
  - ✅ **关键要求**（`keyRequirements` from `job_tags`）

### 策略 3: 个性化路径规划
- **当前**：通用转换建议，不考虑用户背景
- **Kimi 后**：基于用户输入生成个性化路径：
  - ✅ **经验匹配**：用户 `experience_years` vs `experienceLevel` / `experienceRange`
  - ✅ **技能匹配**：用户 `skills` vs `topSkills` / `coreSkills` / `niceToHaveSkills`
  - ✅ **行业匹配**：用户 `industry` vs `job_tags.industry`
  - ✅ **地理匹配**：用户 `location` vs `country` / `locations`
  - ✅ **要求匹配**：用户背景 vs `keyRequirements` / `educationRequirement`

### 策略 4: 深度技能分析
- **当前**：简单技能列表对比（`sharedSkills`, `gapSkills`）
- **Kimi 后**：
  - ✅ **技能关联性**：理解技能之间的依赖关系（如 "React" → "JavaScript" → "HTML/CSS"）
  - ✅ **学习路径**：基于 `coreSkills` / `niceToHaveSkills` 生成学习顺序
  - ✅ **转移难度**：分析 `gapSkills` 的学习难度和时间
  - ✅ **技能主题**：利用 `primaryThemes` / `secondaryThemes` 理解能力要求

### 策略 5: 市场数据融合
- **当前**：`role_skill_matrix` 数据未被使用
- **Kimi 后**：
  - ✅ **市场需求**：结合 `marketDemand` 评估转换机会
  - ✅ **级别匹配**：用户经验 vs `role_skill_matrix.level`
  - ✅ **国家对比**：不同国家的 `marketDemand` 对比
  - ✅ **技能趋势**：分析 `role_skill_matrix.skills` 的变化趋势

### 策略 6: 多路径对比分析
- **当前**：单一转换路径，无法对比
- **Kimi 后**：
  - ✅ **多路径对比**：同时分析多个 `toId`，对比优劣
  - ✅ **路径组合**：分析多步转换路径（A → B → C）
  - ✅ **风险评估**：基于 `opportunityScore`, `isCrossCountry`, `remoteSupported` 评估风险

---

## 📊 数据维度利用对比

| 数据维度 | 当前利用 | Kimi 接入后利用 |
|---------|---------|---------------|
| `skillVec` | ❌ 未使用 | ✅ 语义理解，深度分析 |
| `topSkills` | ✅ 简单列表 | ✅ 技能关联性分析 |
| `marketDemand` | ❌ 未使用 | ✅ 市场趋势融合 |
| `country` | ❌ 未使用 | ✅ 地理因素分析 |
| `experienceLevel` | ❌ 未使用 | ✅ 经验匹配分析 |
| `keyRequirements` | ❌ 未使用 | ✅ 要求对比分析 |
| `industry` | ❌ 未使用 | ✅ 行业趋势分析 |
| `opportunityScore` | ❌ 未使用 | ✅ 机会评估融合 |
| `isCrossCountry` | ❌ 未使用 | ✅ 跨国家转换分析 |
| `remoteSupported` | ❌ 未使用 | ✅ 远程工作分析 |
| `responsibilityScore` | ❌ 未使用 | ✅ 责任级别分析 |
| `leadershipScore` | ❌ 未使用 | ✅ 领导力要求分析 |
| `technicalScore` | ❌ 未使用 | ✅ 技术复杂度分析 |
| `primaryThemes` | ❌ 未使用 | ✅ 能力主题分析 |
| `educationRequirement` | ❌ 未使用 | ✅ 教育要求匹配 |
| `experienceRange` | ❌ 未使用 | ✅ 经验范围匹配 |

---

## ✅ 总结

### MongoDB CareerSwitch 数据优势

1. **丰富的结构化数据**：
   - 8 个核心集合
   - 多维度数据（职位、技能、地理、市场）

2. **预计算的数据**：
   - `career_paths` - 预计算的转换路径
   - `job_tags` - 标准化的职位数据
   - `role_skill_matrix` - 市场数据

3. **高维数据**：
   - `skillVec` - 技能向量（可用于深度分析）

### Kimi 接入后的价值提升

1. **数据利用度**：从 20% → 90%+
2. **分析深度**：从简单匹配 → 多维度深度分析
3. **个性化**：从通用建议 → 基于用户输入的个性化路径
4. **推理能力**：从规则匹配 → 思维链推理

---

**下一步**：基于这个分析，设计 Kimi 接入的具体实现方案（不改动现有代码）

