# Career Advice API - 丢失数据字段分析

## 📋 概述

当前 MCP `career_transition_advice` 工具返回给 ChatGPT 的数据中，**大量有价值的字段被丢弃**。这些数据在 MongoDB 查询中已经获取，但在格式化返回时被过滤掉了。

## ⚠️ 重要说明：数据可用性检查

**本文档标注了每个字段在 MongoDB 中的实际数据状态：**
- ✅ **有数据** - 字段在数据库中实际存在且有值
- ⚠️ **部分数据** - 字段存在但可能为空或默认值
- ❌ **无数据** - 字段不存在或始终为空/默认值
- 🔄 **实时计算** - 字段不是存储的，需要实时从其他集合计算

---

## 🔍 数据流分析

### 1. 数据查询层（MongoDB）

#### 1.1 `_transitions.js` 查询的数据

**来源集合：** `career_paths` + `jobs`

**查询到的完整数据：**
```typescript
{
    // 从 career_paths 查询（✅ 这些字段在 MongoDB 中都有数据）
    fromId: string,                 // ✅ 有数据
    toId: string,                   // ✅ 有数据
    sim: number,                    // ✅ 有数据，返回给 MCP
    sharedSkills: string[],         // ✅ 有数据，⚠️ 只返回前5个（实际可能有10-20个）
    gapSkills: string[],            // ✅ 有数据，⚠️ 只返回前6个（实际可能有10-20个）
    opportunityScore: number,       // ✅ 有数据，❌ 丢失（未返回给 MCP）
    fromCountry?: string,           // ✅ 有数据，❌ 丢失（未返回给 MCP）
    toCountry?: string,             // ✅ 有数据，❌ 丢失（未返回给 MCP）
    isCrossCountry?: boolean,        // ✅ 有数据，❌ 丢失（未返回给 MCP）
    remoteSupported?: boolean,      // ✅ 有数据，❌ 丢失（未返回给 MCP）
    updatedAt: Date,                // ✅ 有数据，❌ 丢失（未返回给 MCP）
    
    // 从 jobs 查询补充（需要实时计算）
    score: number,                  // 🔄 实时计算，❌ 丢失（综合评分）
    feasibilityScore?: number       // 🔄 实时计算，❌ 丢失
}
```

#### 1.2 `_market.js` 查询的数据

**来源集合：** `jobs`

**查询到的完整数据：**
```typescript
{
    // 🔄 这些数据是实时从 jobs 集合计算的，不是存储的
    trend: number,                      // 🔄 实时计算，❌ 丢失（市场趋势：-1 到 1）
    remoteRate: number,                 // 🔄 实时计算，❌ 丢失（远程工作比例：0-1）
    sponsorshipRate: number,            // 🔄 实时计算，❌ 丢失（签证支持比例：0-1）
    avgSalary: string,                  // 🔄 实时计算，❌ 丢失（平均薪资，如 "$120,000 AUD"）
    industryDistribution: {             // 🔄 实时计算，❌ 丢失
        [industry: string]: number       // 行业分布比例
    },
    companySizeDistribution: {          // 🔄 实时计算，❌ 丢失
        [size: string]: number           // 公司规模分布比例
    },
    workModeDistribution: {             // 🔄 实时计算，❌ 丢失
        [mode: string]: number           // 工作模式分布（On-site/Hybrid/Remote）
    },
    notes: string[]                     // 🔄 实时生成，❌ 丢失（市场洞察文本）
}
```

#### 1.3 `_skill-gaps.js` 查询的数据

**来源集合：** `jobs`

**查询到的完整数据：**
```typescript
{
    // 从 jobs 集合查询 topSkills 后计算
    sharedSkills: string[],      // ✅ 有数据，⚠️ 只返回前10个，MCP只显示前5个
    gapSkills: string[],         // ✅ 有数据，⚠️ 只返回前10个，MCP只显示前5个
    learningHints: string[],     // 🔄 实时生成，❌ 丢失（学习建议，如 "技术技能: 学习 Python, SQL - 建议通过在线课程"）
    skillMatchRate: number,       // 🔄 实时计算，❌ 丢失（技能匹配度：0-1）
    totalShared: number,         // 🔄 实时计算，❌ 丢失（共享技能总数）
    totalGaps: number            // 🔄 实时计算，❌ 丢失（技能差距总数）
}
```

#### 1.4 `job_tags` 集合的可用数据（未使用）

**来源集合：** `job_tags`

**可查询但未使用的数据：**
```typescript
{
    standardTitle: string,           // ✅ 有数据，❌ 未使用（标准化职位名）
    experienceLevel: string,         // ✅ 有数据，❌ 未使用（junior/mid/senior）
    coreSkills: string[],            // ✅ 有数据，❌ 未使用（核心技能ID列表）
    niceToHaveSkills: string[],      // ✅ 有数据，❌ 未使用（加分技能ID列表）
    industry: string,                // ✅ 有数据，❌ 未使用（行业）
    country: string,                 // ✅ 有数据（部分），❌ 未使用（国家代码）
    locations: string,                // ✅ 有数据（部分），❌ 未使用（位置字符串）
    keyRequirements: string[],       // ⚠️ 部分有数据，❌ 未使用（关键要求）
    salaryRange: {                   // ⚠️ 部分有数据，❌ 未使用
        min: number,
        max: number,
        currency: string
    },
    
    // ❌ 这些字段在数据库中默认是空值或0，没有实际数据
    primaryThemes: string[],         // ❌ 默认 []，无数据（主要能力主题）
    secondaryThemes: string[],       // ❌ 默认 []，无数据（次要能力主题）
    educationRequirement: string[],   // ❌ 默认 []，无数据（教育要求）
    experienceRange: {               // ❌ 默认 { min: 0, max: 0 }，无数据
        min: number,
        max: number,
        unit: 'years' | 'months'
    },
    responsibilityScore: number,     // ❌ 默认 0，无数据（责任评分）
    leadershipScore: number,         // ❌ 默认 0，无数据（领导力评分）
    technicalScore: number           // ❌ 默认 0，无数据（技术评分）
}
```

---

## 📊 当前 MCP 返回的数据（格式化后）

### 实际返回给 ChatGPT 的字段：

```typescript
{
    // 从 data.candidates 数组
    to: string,                      // ✅ 目标职位
    similarity: number,              // ✅ 相似度（0-1）
    sharedTags: string[],            // ⚠️ 只显示前5个
    skillsToLearn: string[],        // ⚠️ 只显示前5个
    difficulty?: string,             // ✅ 难度（Easy/Moderate/Challenging）
    transitionTime?: string         // ✅ 时间线（3-6 months等）
}
```

### 从 data.report 返回的字段：

```typescript
{
    summary: string,                 // ✅ 摘要
    insights: string[],              // ✅ 洞察
    skillsAnalysis: {                // ✅ 技能分析
        transferable: string[],     // ⚠️ 只显示前5个
        toDevelop: string[]         // ⚠️ 只显示前5个
    },
    actionPlan: {                    // ✅ 行动建议
        immediate: string[],
        shortTerm: string[]
    }
}
```

---

## ❌ 完全丢失的数据字段

### 1. 评分相关（✅ 有数据，但未返回）
- `opportunityScore` - ✅ 有数据，机会评分（0-1）
- `score` - 🔄 实时计算，综合评分（综合 sim + trend + opportunity + feasibility）
- `feasibilityScore` - 🔄 实时计算，可行性评分
- `skillMatchRate` - 🔄 实时计算，技能匹配度（0-1）

### 2. 市场数据（🔄 实时计算，但未返回）
- `trend` - 🔄 实时计算，市场趋势（-1 到 1，正数表示增长）
- `remoteRate` - 🔄 实时计算，远程工作比例（0-1）
- `sponsorshipRate` - 🔄 实时计算，签证支持比例（0-1）
- `avgSalary` - 🔄 实时计算，平均薪资（如 "$120,000 AUD"）
- `industryDistribution` - 🔄 实时计算，行业分布（对象，如 `{ "Technology": 0.6, "Finance": 0.3 }`）
- `companySizeDistribution` - 🔄 实时计算，公司规模分布
- `workModeDistribution` - 🔄 实时计算，工作模式分布（On-site/Hybrid/Remote）
- `notes` - 🔄 实时生成，市场洞察文本数组

### 3. 地理位置相关（✅ 有数据，但未返回）
- `fromCountry` - ✅ 有数据，源职位国家
- `toCountry` - ✅ 有数据，目标职位国家
- `isCrossCountry` - ✅ 有数据，是否跨国家
- `remoteSupported` - ✅ 有数据，是否支持远程

### 4. 学习建议（🔄 实时生成，但未返回）
- `learningHints` - 🔄 实时生成，学习建议数组（如 "技术技能: 学习 Python, SQL - 建议通过在线课程"）

### 5. 统计信息（🔄 实时计算，但未返回）
- `totalShared` - 🔄 实时计算，共享技能总数
- `totalGaps` - 🔄 实时计算，技能差距总数

### 6. job_tags 完整数据（部分有数据，部分为空）
- `standardTitle` - ✅ 有数据，标准化职位名
- `experienceLevel` - ✅ 有数据，经验等级
- `coreSkills` - ✅ 有数据，核心技能ID列表（不只是前5个）
- `niceToHaveSkills` - ✅ 有数据，加分技能ID列表
- `industry` - ✅ 有数据，行业
- `country` - ⚠️ 部分有数据，国家代码
- `locations` - ⚠️ 部分有数据，位置字符串
- `keyRequirements` - ⚠️ 部分有数据，关键要求
- `salaryRange` - ⚠️ 部分有数据，薪资范围
- `primaryThemes` - ❌ 默认 []，无数据（主要能力主题）
- `secondaryThemes` - ❌ 默认 []，无数据（次要能力主题）
- `educationRequirement` - ❌ 默认 []，无数据（教育要求）
- `experienceRange` - ❌ 默认 { min: 0, max: 0 }，无数据（经验范围）
- `responsibilityScore` - ❌ 默认 0，无数据（责任评分）
- `leadershipScore` - ❌ 默认 0，无数据（领导力评分）
- `technicalScore` - ❌ 默认 0，无数据（技术评分）

---

## 📈 数据丢失的影响

### 当前限制：
1. **无法做市场分析** - 没有 trend, remoteRate, sponsorshipRate（🔄 可实时计算）
2. **无法做薪资对比** - 没有 avgSalary（🔄 可实时计算）
3. **无法做行业分析** - 没有 industryDistribution（🔄 可实时计算）
4. **无法做地理位置分析** - 没有 country, isCrossCountry（✅ 有数据但未返回）
5. **无法提供学习建议** - 没有 learningHints（🔄 可实时生成）
6. **技能信息不完整** - 只显示前5个，实际可能有10-20个（✅ 有完整数据但被截断）
7. **无法做综合评分** - 没有 opportunityScore（✅ 有数据但未返回）, score（🔄 可实时计算）

### 如果返回这些数据，Kimi 可以：
1. ✅ **市场趋势分析** - 基于 trend 判断机会
2. ✅ **远程/签证机会评估** - 基于 remoteRate, sponsorshipRate
3. ✅ **薪资对比分析** - 基于 avgSalary
4. ✅ **行业分布分析** - 基于 industryDistribution
5. ✅ **地理位置建议** - 基于 country, isCrossCountry
6. ✅ **个性化学习路径** - 基于 learningHints
7. ✅ **完整技能分析** - 基于完整的 sharedSkills 和 gapSkills 列表
8. ✅ **综合评分解释** - 基于 opportunityScore, score 解释为什么推荐

---

## 🎯 建议的改进方案

### 方案 A：先丰富 MCP 返回数据（推荐）

**步骤：**
1. 修改外部 API 返回格式，包含所有可用字段
2. 修改 MCP 格式化逻辑，保留这些字段
3. 在 Markdown 中展示这些数据（或作为 JSON 数据块）

**优点：**
- 即使不接入 Kimi，也能提供更丰富的信息
- 为后续接入 Kimi 打好数据基础

### 方案 B：直接接入 Kimi（数据更丰富）

**步骤：**
1. 在 MCP 中直接查询 MongoDB（不走外部 API）
2. 获取所有可用数据（career_paths + job_tags + market 数据）
3. 传给 Kimi 做分析
4. 服务端模板渲染返回

**优点：**
- 数据最丰富
- Kimi 可以充分利用所有维度

---

## 📝 数据字段清单（完整版）

### 应该返回给 MCP 的完整数据结构：

```typescript
{
    // 基础信息
    to: string,
    similarity: number,
    
    // 技能信息（完整）
    sharedSkills: string[],          // 所有共享技能（不只是前5个）
    gapSkills: string[],            // 所有技能差距（不只是前5个）
    totalShared: number,             // 共享技能总数
    totalGaps: number,              // 技能差距总数
    
    // 评分信息
    opportunityScore: number,        // 机会评分
    score: number,                   // 综合评分
    feasibilityScore: number,        // 可行性评分
    skillMatchRate: number,          // 技能匹配度
    
    // 市场数据
    market: {
        trend: number,               // 市场趋势
        remoteRate: number,          // 远程工作比例
        sponsorshipRate: number,     // 签证支持比例
        avgSalary: string,          // 平均薪资
        industryDistribution: object, // 行业分布
        companySizeDistribution: object, // 公司规模分布
        workModeDistribution: object,    // 工作模式分布
        notes: string[]             // 市场洞察
    },
    
    // 地理位置
    fromCountry: string,
    toCountry: string,
    isCrossCountry: boolean,
    remoteSupported: boolean,
    
    // 学习建议
    learningHints: string[],         // 学习建议
    
    // 难度和时间
    difficulty: string,
    transitionTime: string,
    
    // job_tags 补充信息（可选）
    targetJobInfo: {
        standardTitle: string,
        experienceLevel: string,
        topSkills: string[],        // 完整技能列表
        primaryThemes: string[],
        industry: string,
        country: string,
        responsibilityScore: number,
        leadershipScore: number,
        technicalScore: number
    }
}
```

---

## 🔄 下一步行动

1. **先丰富 MCP 返回数据** - 把所有可用字段都返回
2. **然后接入 Kimi** - 基于丰富的数据做深度分析

---

## 📊 数据可用性总结

### ✅ **有实际数值，可以返回给 MCP**

#### 1. career_paths 集合（✅ 有数据）
```typescript
{
    fromId: string,              // ✅ 有实际值
    toId: string,                // ✅ 有实际值
    sim: number,                 // ✅ 有实际值（0-1）
    sharedSkills: string[],      // ✅ 有实际值（数组，可能有10-20个技能）
    gapSkills: string[],         // ✅ 有实际值（数组，可能有10-20个技能）
    opportunityScore: number,    // ✅ 有实际值（0-1）
    fromCountry?: string,        // ✅ 有实际值（如 "AU", "US"）
    toCountry?: string,          // ✅ 有实际值（如 "AU", "US"）
    isCrossCountry?: boolean,    // ✅ 有实际值（true/false）
    remoteSupported?: boolean,    // ✅ 有实际值（true/false）
    updatedAt: Date              // ✅ 有实际值
}
```

#### 2. job_tags 集合（✅ 有数据）
```typescript
{
    standardTitle: string,        // ✅ 有实际值
    experienceLevel: string,     // ✅ 有实际值（"junior"/"mid"/"senior"）
    coreSkills: string[],         // ✅ 有实际值（核心技能ID数组）
    niceToHaveSkills: string[],   // ✅ 有实际值（加分技能ID数组）
    industry: string,             // ✅ 有实际值（如 "Technology", "Finance"）
    country?: string,            // ⚠️ 部分有数据（如 "AU", "US"）
    locations?: string,          // ⚠️ 部分有数据
    keyRequirements?: string[]   // ⚠️ 部分有数据
}
```

#### 3. 需要实时计算的数据（🔄 可计算，有实际值）
```typescript
{
    // 从 jobs 集合实时聚合计算
    trend: number,                      // 🔄 可计算（-1 到 1）
    remoteRate: number,                 // 🔄 可计算（0-1）
    sponsorshipRate: number,            // 🔄 可计算（0-1）
    avgSalary: string,                  // 🔄 可计算（如 "$120,000 AUD"）
    industryDistribution: object,       // 🔄 可计算（行业分布比例）
    companySizeDistribution: object,     // 🔄 可计算（公司规模分布）
    workModeDistribution: object,       // 🔄 可计算（工作模式分布）
    
    // 实时计算的评分
    score: number,                      // 🔄 可计算（综合评分 0-1）
    feasibilityScore: number,           // 🔄 可计算（可行性评分 0-1）
    skillMatchRate: number,             // 🔄 可计算（技能匹配度 0-1）
    
    // 实时生成的学习建议
    learningHints: string[],            // 🔄 可生成（基于 gapSkills）
    
    // 实时计算的统计
    totalShared: number,                // 🔄 可计算（共享技能总数）
    totalGaps: number                   // 🔄 可计算（技能差距总数）
}
```

---

### ❌ **默认值或空值，暂时不返回（无意义）**

#### job_tags 集合中的空字段（❌ 默认值，无实际数据）
```typescript
{
    // 这些字段在数据库中默认是空值，没有实际意义
    primaryThemes: string[],         // ❌ 默认 []，无数据
    secondaryThemes: string[],       // ❌ 默认 []，无数据
    educationRequirement: string[],   // ❌ 默认 []，无数据
    experienceRange: {               // ❌ 默认 { min: 0, max: 0, unit: 'years' }，无数据
        min: number,
        max: number,
        unit: 'years' | 'months'
    },
    responsibilityScore: number,    // ❌ 默认 0，无数据
    leadershipScore: number,         // ❌ 默认 0，无数据
    technicalScore: number            // ❌ 默认 0，无数据
}
```

**说明：** 这些字段在数据库创建时被设置为默认值（空数组或0），但从未被实际填充过数据，因此返回它们没有意义。

---

## 🎯 建议返回的数据字段清单

### 应该返回给 MCP 的字段（有实际数值）

#### 基础信息
- ✅ `to` - 目标职位（from `career_paths.toId`）
- ✅ `similarity` - 相似度（from `career_paths.sim`）
- ✅ `opportunityScore` - 机会评分（from `career_paths.opportunityScore`）
- ✅ `score` - 综合评分（实时计算）

#### 技能信息（完整列表，不只是前5个）
- ✅ `sharedSkills` - 所有共享技能（from `career_paths.sharedSkills`，完整数组）
- ✅ `gapSkills` - 所有技能差距（from `career_paths.gapSkills`，完整数组）
- ✅ `totalShared` - 共享技能总数（实时计算）
- ✅ `totalGaps` - 技能差距总数（实时计算）
- ✅ `skillMatchRate` - 技能匹配度（实时计算）

#### 地理位置信息
- ✅ `fromCountry` - 源职位国家（from `career_paths.fromCountry`）
- ✅ `toCountry` - 目标职位国家（from `career_paths.toCountry`）
- ✅ `isCrossCountry` - 是否跨国家（from `career_paths.isCrossCountry`）
- ✅ `remoteSupported` - 是否支持远程（from `career_paths.remoteSupported`）

#### 市场数据（实时计算）
- ✅ `market.trend` - 市场趋势（实时计算）
- ✅ `market.remoteRate` - 远程工作比例（实时计算）
- ✅ `market.sponsorshipRate` - 签证支持比例（实时计算）
- ✅ `market.avgSalary` - 平均薪资（实时计算）
- ✅ `market.industryDistribution` - 行业分布（实时计算）
- ✅ `market.companySizeDistribution` - 公司规模分布（实时计算）
- ✅ `market.workModeDistribution` - 工作模式分布（实时计算）
- ✅ `market.notes` - 市场洞察文本（实时生成）

#### 学习建议（实时生成）
- ✅ `learningHints` - 学习建议数组（实时生成）

#### 目标职位补充信息（from job_tags）
- ✅ `targetJobInfo.standardTitle` - 标准化职位名
- ✅ `targetJobInfo.experienceLevel` - 经验等级
- ✅ `targetJobInfo.coreSkills` - 核心技能列表
- ✅ `targetJobInfo.niceToHaveSkills` - 加分技能列表
- ✅ `targetJobInfo.industry` - 行业
- ⚠️ `targetJobInfo.country` - 国家代码（部分有数据）
- ⚠️ `targetJobInfo.locations` - 位置字符串（部分有数据）
- ⚠️ `targetJobInfo.keyRequirements` - 关键要求（部分有数据）

#### 难度和时间（当前已有）
- ✅ `difficulty` - 难度（Easy/Moderate/Challenging）
- ✅ `transitionTime` - 时间线（3-6 months等）

---

### 暂时不返回的字段（默认值/空值）

- ❌ `primaryThemes` - 默认 []，无数据
- ❌ `secondaryThemes` - 默认 []，无数据
- ❌ `educationRequirement` - 默认 []，无数据
- ❌ `experienceRange` - 默认 { min: 0, max: 0 }，无数据
- ❌ `responsibilityScore` - 默认 0，无数据
- ❌ `leadershipScore` - 默认 0，无数据
- ❌ `technicalScore` - 默认 0，无数据

**注意：** 如果未来这些字段被填充了实际数据，可以再考虑返回。

---

**文档创建时间：** 2025-01-XX  
**状态：** 待实施  
**最后更新：** 数据可用性检查完成

