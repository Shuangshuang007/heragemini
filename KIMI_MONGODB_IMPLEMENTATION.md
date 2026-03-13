# Kimi 接入方案 - 基于 MongoDB CareerSwitch

> **数据源**：MongoDB CareerSwitch 数据库（约 3M 条记录）  
> **核心集合**：`job_tags`, `career_paths`, `role_skill_matrix`

---

## 📊 MongoDB 数据结构

### 1. `job_tags` - 职位标签（核心）
```typescript
{
  jobId: string,
  standardTitle: string,        // 标准化职位标题
  skillVec: number[],            // 技能向量
  topSkills: string[],           // 主要技能
  country: string,               // 国家
  industry: string,              // 行业
  experienceLevel: string,       // 经验级别
  keyRequirements: string[]     // 关键要求
}
```

### 2. `career_paths` - 职业转换路径（预计算）
```typescript
{
  fromId: string,                // 起始职位
  toId: string,                  // 目标职位
  sim: number,                   // 相似度分数
  sharedSkills: string[],        // 共享技能
  gapSkills: string[],           // 技能差距
  opportunityScore: number,      // 机会分数
  fromCountry?: string,
  toCountry?: string,
  isCrossCountry?: boolean,
  remoteSupported?: boolean
}
```

### 3. `role_skill_matrix` - 角色技能矩阵
```typescript
{
  role: string,                  // 角色名称
  level: string,                 // 级别
  country: string,               // 国家
  marketDemand: number,          // 市场需求
  skills: string[]               // 技能列表
}
```

---

## 🎯 Kimi 接入实现方案

### 数据查询逻辑

1. **从 `job_tags` 查询当前职位**
2. **从 `career_paths` 查询转换路径**
3. **从 `role_skill_matrix` 查询市场数据**
4. **融合数据，提供给 Kimi 2 Thinking 分析**

---

## 💻 代码实现（新文件）

### 1. MongoDB 数据查询服务

```typescript
// src/services/careerSwitch/careerSwitchDBService.ts

import { getDb } from '@/lib/db/mongoClient';

export async function getCareerTransitionDataFromMongoDB(
  currentJob: string,
  experienceYears: number,
  skills?: string[],
  industry?: string,
  location?: string
) {
  const db = await getDb('CareerSwitch');
  
  // 1. 查询当前职位的 job_tags
  const currentJobTag = await db.collection('job_tags').findOne({
    standardTitle: { $regex: new RegExp(currentJob, 'i') }
  });
  
  if (!currentJobTag) {
    return null;
  }
  
  // 2. 查询 career_paths 获取转换路径
  const careerPaths = await db.collection('career_paths').find({
    fromId: { $regex: new RegExp(currentJob, 'i') }
  }).sort({ sim: -1 }).limit(20).toArray();
  
  // 3. 查询 role_skill_matrix 获取市场数据
  const marketData = await db.collection('role_skill_matrix').find({
    role: { $regex: new RegExp(currentJob, 'i') },
    country: location || 'Australia'
  }).toArray();
  
  return {
    currentJobTag,
    careerPaths,
    marketData
  };
}
```

---

## 🚀 下一步

1. 创建 Kimi 客户端
2. 创建 MongoDB 查询服务
3. 创建 Kimi 分析服务
4. 在 MCP route 中集成（feature flag）

**不再提 CSV，完全基于 MongoDB！**

