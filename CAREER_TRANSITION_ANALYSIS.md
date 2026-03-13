# Career Transition Tool 后台实现分析

> **目标**：理解现有 career_transition_advice 的完整实现流程，为 Kimi 接入做准备  
> **原则**：只分析，不修改任何代码

---

## 📊 当前实现架构

### 1. 数据源分析

#### 方式 A: CSV 文件（当前主要使用 - 图数据）
- **位置**：`JobDirectSearchAPI/src/careerSwitch/data/graph_v1.0/`
- **文件**：
  - `nodes.csv` - 职业节点数据（51,283 个职位）
  - `edges.csv` - 职业转换关系数据（51,414 条边）
  - `stats.json` - 统计信息
- **加载方式**：启动时加载到内存（`GRAPH_CACHE`）
- **使用位置**：`career_api_server.js`
- **说明**：这是从大量原始数据中提取的图结构数据，用于快速查询

### 方式 B: MongoDB CareerSwitch 数据库（原始数据源 - 约 3M 条记录）
- **数据库名称**：`CareerSwitch`
- **数据规模**：约 300 万条记录（需要确认实际数量）
- **主要集合**：

#### 方式 B: MongoDB CareerSwitch 数据库（有数据但未充分利用）
- **数据库名称**：`CareerSwitch`
- **主要集合**：
  1. **`jobs`** - 职位原始数据
  2. **`job_tags`** - 职位标签（standardTitle, experienceLevel, primaryThemes, industry）
  3. **`job_skills`** - 职位-技能关联
  4. **`skills`** - 技能数据（canonical, df, idf）
  5. **`role_skill_matrix`** - 角色技能矩阵（role, level, country, marketDemand）
  6. **`career_paths`** - 职业路径（fromRole, toRole, transitionScore, feasibility）
  7. **`extraction_logs`** - 提取日志
  8. **`unknown_phrases`** - 未知短语

---

## 🔄 当前调用流程

### MCP Route → Career API Server

```
用户请求 (MCP)
  ↓
src/app/api/mcp/route.ts (line 4233)
  ↓
POST /api/career/advice
  ↓
career_api_server.js (line 207)
  ↓
1. 从 CSV 加载图数据（loadGraphData）
2. 查找当前职业节点（findNodesByTitle）
3. 获取转换关系（getTransitionsFrom）
4. 生成推荐（recommendations）
5. 如果 mode='report'，调用 GPT 生成报告（generateGPTReport）
  ↓
返回结果
```

### 关键代码位置

1. **MCP Route**：
   - `src/app/api/mcp/route.ts` (line 4233-4380)
   - 调用外部 API：`http://149.28.175.142:3009/api/career/advice`

2. **Career API Server**：
   - `JobDirectSearchAPI/career_api_server.js`
   - 主要逻辑在 `POST /api/career/advice` (line 207-438)

3. **数据加载**：
   - `loadGraphData()` (line 74-140) - 从 CSV 加载
   - `findNodesByTitle()` (line 142-157) - 查找节点
   - `getTransitionsFrom()` (line 159-175) - 获取转换

4. **GPT 报告生成**：
   - `generateGPTReport()` (line 555-645) - 使用 GPT-4.1-mini
   - `generateTemplateReport()` (line 657-807) - 模板报告（fallback）

---

## 📋 MongoDB CareerSwitch 数据库详细结构

### 集合 1: `jobs`
```typescript
{
  id: string,                    // 职位 ID
  title: string,                 // 职位标题
  company: string,               // 公司名称
  location: string,              // 地点
  description: string,           // 职位描述
  postedDateISO: Date,          // 发布日期
  skillExtractionStatus: string, // 技能提取状态
  hasDetailedSkills: boolean     // 是否有详细技能
}
```

### 集合 2: `job_tags`
```typescript
{
  jobId: string,                 // 职位 ID（唯一）
  standardTitle: string,         // 标准化职位标题 ⭐
  experienceLevel: string,       // 经验级别 ⭐
  primaryThemes: string[],       // 主要主题 ⭐
  industry: string,              // 行业 ⭐
  extractedAt: Date             // 提取时间
}
```

### 集合 3: `job_skills`
```typescript
{
  jobId: string,                 // 职位 ID
  skillId: string,               // 技能 ID
  confidenceValidated: number,   // 置信度
  extractionMethod: string,      // 提取方法
  createdAt: Date               // 创建时间
}
```

### 集合 4: `skills`
```typescript
{
  id: string,                    // 技能 ID（唯一）
  canonical: string,             // 标准化技能名称 ⭐
  df: number,                    // 文档频率
  idf: number,                   // 逆文档频率
  // ... 其他字段
}
```

### 集合 5: `role_skill_matrix` ⭐⭐⭐
```typescript
{
  role: string,                  // 角色名称 ⭐
  level: string,                 // 级别 ⭐
  country: string,               // 国家 ⭐
  marketDemand: number,          // 市场需求 ⭐
  skills: string[],              // 技能列表
  updatedAt: Date               // 更新时间
}
```

### 集合 6: `career_paths` ⭐⭐⭐
```typescript
{
  fromRole: string,              // 起始角色 ⭐
  toRole: string,                // 目标角色 ⭐
  transitionScore: number,       // 转换分数 ⭐
  feasibility: string,           // 可行性 ⭐
  sharedSkills: string[],        // 共享技能
  skillsToLearn: string[],       // 需要学习的技能
  // ... 其他字段
}
```

---

## 🎯 关键发现

### 1. 数据源对比

| 数据源 | 当前使用 | 数据丰富度 | 更新频率 |
|--------|---------|-----------|---------|
| CSV (nodes.csv, edges.csv) | ✅ 主要使用 | 中等（51,283 职位） | 静态 |
| MongoDB CareerSwitch | ❌ 未使用 | 高（更详细的结构化数据） | 动态 |

### 2. MongoDB 数据的优势

1. **`job_tags`** - 提供标准化的职位标题和行业信息
2. **`role_skill_matrix`** - 提供角色级别的技能矩阵和市场数据
3. **`career_paths`** - 提供预计算的职业转换路径
4. **`job_skills` + `skills`** - 提供详细的技能关联数据

### 3. 当前实现的局限性

- ❌ 只使用 CSV 数据，没有利用 MongoDB 中的丰富数据
- ❌ GPT 报告生成时，只使用 CSV 中的基础数据
- ❌ 没有利用 `role_skill_matrix` 中的市场数据
- ❌ 没有利用 `career_paths` 中的预计算路径

---

## 💡 Kimi 接入方案设计思路

### 方案 1: 增强数据源（推荐）

**思路**：在调用 Kimi 之前，先从 MongoDB 查询相关数据，然后一起提供给 Kimi

**数据查询策略**：

1. **从 `job_tags` 查询**：
   ```javascript
   // 查找当前职业的标准标题和行业
   const jobTag = await db.collection('job_tags').findOne({
     standardTitle: { $regex: new RegExp(currentJob, 'i') }
   });
   ```

2. **从 `career_paths` 查询**：
   ```javascript
   // 查找预计算的职业转换路径
   const careerPaths = await db.collection('career_paths').find({
     fromRole: { $regex: new RegExp(currentJob, 'i') }
   }).sort({ transitionScore: -1 }).limit(20).toArray();
   ```

3. **从 `role_skill_matrix` 查询**：
   ```javascript
   // 查找市场数据
   const marketData = await db.collection('role_skill_matrix').find({
     role: { $regex: new RegExp(currentJob, 'i') },
     country: 'Australia'
   }).toArray();
   ```

4. **从 `job_skills` + `skills` 查询**：
   ```javascript
   // 查找技能数据
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

### 方案 2: 数据融合

**思路**：将 MongoDB 数据与 CSV 数据融合，提供给 Kimi

**流程**：
1. 从 CSV 获取基础转换关系（快速）
2. 从 MongoDB 获取详细数据（丰富）
3. 融合数据，构建完整的上下文
4. 提供给 Kimi 2 Thinking 进行深度分析

---

## 🔍 需要确认的信息

### 1. MongoDB 数据完整性
- [ ] `career_paths` 集合中是否有足够的数据？
- [ ] `role_skill_matrix` 集合中是否有市场数据？
- [ ] `job_tags` 集合的覆盖率如何？

### 2. 数据查询性能
- [ ] MongoDB 查询的响应时间？
- [ ] 是否需要添加索引优化？
- [ ] 是否需要缓存机制？

### 3. 数据一致性
- [ ] CSV 数据和 MongoDB 数据是否一致？
- [ ] 如果数据不一致，如何处理？

---

## 📝 下一步行动

1. **探索数据库**：运行 `scripts/explore-careerswitch-db.js` 查看实际数据
2. **确认数据质量**：检查关键集合的数据量和质量
3. **设计查询逻辑**：根据实际数据结构设计 MongoDB 查询
4. **实现 Kimi 集成**：利用 MongoDB 数据增强 Kimi 分析

---

**文档版本**：v1.0  
**创建时间**：2025-12-30  
**状态**：分析完成，待确认数据库结构

