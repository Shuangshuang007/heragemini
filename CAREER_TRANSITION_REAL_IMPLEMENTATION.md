# Career Transition 实际实现分析（基于 MongoDB）

> **重要**：基于 `JobDirectSearchAPI/src/careerSwitch` 下的实际代码分析  
> **数据源**：MongoDB CareerSwitch 数据库（约 3M 条记录）

---

## 📊 实际数据源：MongoDB CareerSwitch

### 主要集合（从代码分析）

1. **`jobs`** - 原始职位数据（约 3M 条）
   - 包含：title, company, location, description, skills 等
   - 来源：LinkedIn, SEEK 等平台

2. **`job_tags`** ⭐⭐⭐ - 职位标签（核心数据）
   - `standardTitle`: 标准化职位标题
   - `experienceLevel`: 经验级别
   - `primaryThemes`: 主要主题
   - `industry`: 行业
   - `country`: 国家
   - `skillVec`: 技能向量（用于相似度计算）
   - `topSkills`: 主要技能列表
   - `keyRequirements`: 关键要求

3. **`job_skills`** - 职位-技能关联
   - `jobId`: 职位 ID
   - `skillId`: 技能 ID
   - `confidenceValidated`: 置信度

4. **`skills`** - 技能数据
   - `canonical`: 标准化技能名称
   - `df`, `idf`: TF-IDF 统计

5. **`career_paths`** ⭐⭐⭐ - 职业转换路径（预计算）
   - `fromRole`: 起始角色
   - `toRole`: 目标角色
   - `transitionScore`: 转换分数（相似度）
   - `feasibility`: 可行性
   - `sharedSkills`: 共享技能
   - `gapSkills`: 技能差距
   - `fromCountry`, `toCountry`: 国家维度

6. **`role_skill_matrix`** ⭐⭐⭐ - 角色技能矩阵
   - `role`: 角色名称
   - `level`: 级别
   - `country`: 国家
   - `marketDemand`: 市场需求
   - `skills`: 技能列表

---

## 🔄 实际调用流程（需要确认）

### 当前 MCP Route 调用
```
MCP Route → http://149.28.175.142:3009/api/career/advice
  ↓
career_api_server.js (使用 CSV) ❓
```

### 应该使用的流程（基于 MongoDB）
```
MCP Route → MongoDB CareerSwitch 数据库
  ↓
1. 查询 job_tags 获取当前职位信息
2. 查询 career_paths 获取转换路径
3. 查询 role_skill_matrix 获取市场数据
4. 使用 Kimi 2 Thinking 进行深度分析
```

---

## 💡 Kimi 接入方案（基于 MongoDB）

### 数据查询策略

1. **从 `job_tags` 查询当前职位**：
   ```typescript
   const currentJobTag = await db.collection('job_tags').findOne({
     standardTitle: { $regex: new RegExp(currentJob, 'i') }
   });
   ```

2. **从 `career_paths` 查询转换路径**：
   ```typescript
   const careerPaths = await db.collection('career_paths').find({
     fromRole: { $regex: new RegExp(currentJob, 'i') }
   }).sort({ transitionScore: -1 }).limit(20).toArray();
   ```

3. **从 `role_skill_matrix` 查询市场数据**：
   ```typescript
   const marketData = await db.collection('role_skill_matrix').find({
     role: { $regex: new RegExp(currentJob, 'i') },
     country: 'Australia'
   }).toArray();
   ```

4. **从 `job_skills` + `skills` 查询详细技能**：
   ```typescript
   const jobSkills = await db.collection('job_skills').aggregate([
     { $match: { jobId: jobId } },
     { $lookup: {
         from: 'skills',
         localField: 'skillId',
         foreignField: 'id',
         as: 'skillDetails'
       }
     }
   ]).toArray();
   ```

---

## ❓ 需要确认的问题

1. **实际运行的 API 服务器是哪个？**
   - `career_api_server.js`（CSV）？
   - 还是其他使用 MongoDB 的服务器？

2. **MongoDB 数据量确认**：
   - `jobs` 集合：约 3M 条？
   - `job_tags` 集合：多少条？
   - `career_paths` 集合：多少条？

3. **数据完整性**：
   - `career_paths` 是否已经预计算好？
   - `role_skill_matrix` 是否有市场数据？

---

**下一步**：请确认实际使用的 API 服务器和数据量，然后我可以设计准确的 Kimi 接入方案。

