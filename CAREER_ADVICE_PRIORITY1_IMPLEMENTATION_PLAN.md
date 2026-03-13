# Career Advice 优先级1数据增强 - 最小实施方案

## 🎯 目标

**最小改动**：只增加优先级1的数据字段，最大化效果，最小化风险。

**优先级1数据包括：**
1. ✅ **评分数据**：`opportunityScore`, `score`, `feasibilityScore`
2. ✅ **市场数据**：`trend`, `remoteRate`, `sponsorshipRate`, `avgSalary`, `industryDistribution`
3. ✅ **地理位置**：`fromCountry`, `toCountry`, `isCrossCountry`, `remoteSupported`

---

## 📋 实施步骤

### 步骤 1: 定义期望的外部API返回格式

**当前格式：**
```typescript
{
  candidates: [{
    to: string,
    similarity: number,
    sharedTags: string[],
    skillsToLearn: string[],
    difficulty?: string,
    transitionTime?: string
  }],
  report: { ... }
}
```

**增强后格式（优先级1）：**
```typescript
{
  candidates: [{
    // 现有字段（保持不变）
    to: string,
    similarity: number,
    sharedTags: string[],
    skillsToLearn: string[],
    difficulty?: string,
    transitionTime?: string,
    
    // 🆕 优先级1：评分数据
    opportunityScore?: number,      // 0-1，机会评分
    score?: number,                  // 0-1，综合评分
    feasibilityScore?: number,       // 0-1，可行性评分
    
    // 🆕 优先级1：市场数据
    market?: {
      trend?: number,                // -1 到 1，市场趋势（正数表示增长）
      remoteRate?: number,           // 0-1，远程工作比例
      sponsorshipRate?: number,      // 0-1，签证支持比例
      avgSalary?: string,            // 平均薪资，如 "$120,000 AUD"
      industryDistribution?: {       // 行业分布
        [industry: string]: number   // 如 { "Technology": 0.6, "Finance": 0.3 }
      }
    },
    
    // 🆕 优先级1：地理位置
    fromCountry?: string,            // 源职位国家，如 "AU", "US"
    toCountry?: string,              // 目标职位国家
    isCrossCountry?: boolean,        // 是否跨国家转换
    remoteSupported?: boolean        // 是否支持远程工作
  }],
  report: { ... }
}
```

**注意：** 所有新字段都是**可选的**（`?`），确保向后兼容。

---

### 步骤 2: 修改 MCP 格式化逻辑

**文件：** `src/app/api/mcp/route.ts` (line ~4314-4330)

**修改位置：** `career_transition_advice` 工具的 candidates 格式化部分

**当前代码：**
```typescript
data.candidates.slice(0, 10).forEach((candidate: any, index: number) => {
  markdownReport += `**${index + 1}. ${candidate.to}**\n`;
  markdownReport += `Similarity: ${Math.round((candidate.similarity || 0) * 100)}%`;
  if (candidate.difficulty) markdownReport += ` | Difficulty: ${candidate.difficulty}`;
  if (candidate.transitionTime) markdownReport += ` | Timeline: ${candidate.transitionTime}`;
  markdownReport += `\n`;
  if (candidate.sharedTags && candidate.sharedTags.length > 0) {
    markdownReport += `**Shared Skills:** ${candidate.sharedTags.slice(0, 5).join(', ')}\n`;
  }
  if (candidate.skillsToLearn && candidate.skillsToLearn.length > 0) {
    markdownReport += `**Skills to Learn:** ${candidate.skillsToLearn.slice(0, 5).join(', ')}\n`;
  }
  markdownReport += `\n---\n\n`;
});
```

**增强后代码：**
```typescript
data.candidates.slice(0, 10).forEach((candidate: any, index: number) => {
  markdownReport += `**${index + 1}. ${candidate.to}**\n`;
  
  // 基础评分信息
  markdownReport += `Similarity: ${Math.round((candidate.similarity || 0) * 100)}%`;
  
  // 🆕 优先级1：评分数据
  if (candidate.opportunityScore !== undefined) {
    markdownReport += ` | Opportunity Score: ${Math.round(candidate.opportunityScore * 100)}%`;
  }
  if (candidate.score !== undefined) {
    markdownReport += ` | Overall Score: ${Math.round(candidate.score * 100)}%`;
  }
  if (candidate.feasibilityScore !== undefined) {
    markdownReport += ` | Feasibility: ${Math.round(candidate.feasibilityScore * 100)}%`;
  }
  
  if (candidate.difficulty) markdownReport += ` | Difficulty: ${candidate.difficulty}`;
  if (candidate.transitionTime) markdownReport += ` | Timeline: ${candidate.transitionTime}`;
  markdownReport += `\n`;
  
  // 🆕 优先级1：地理位置信息
  if (candidate.fromCountry || candidate.toCountry) {
    const locationInfo = [];
    if (candidate.fromCountry) locationInfo.push(`From: ${candidate.fromCountry}`);
    if (candidate.toCountry) locationInfo.push(`To: ${candidate.toCountry}`);
    if (candidate.isCrossCountry) locationInfo.push(`(Cross-country)`);
    if (candidate.remoteSupported) locationInfo.push(`Remote supported`);
    markdownReport += `**Location:** ${locationInfo.join(' | ')}\n`;
  }
  
  // 🆕 优先级1：市场数据
  if (candidate.market) {
    const marketInfo = [];
    if (candidate.market.trend !== undefined) {
      const trendEmoji = candidate.market.trend > 0 ? '📈' : candidate.market.trend < 0 ? '📉' : '➡️';
      marketInfo.push(`${trendEmoji} Trend: ${(candidate.market.trend * 100).toFixed(0)}%`);
    }
    if (candidate.market.remoteRate !== undefined) {
      marketInfo.push(`Remote: ${Math.round(candidate.market.remoteRate * 100)}%`);
    }
    if (candidate.market.sponsorshipRate !== undefined) {
      marketInfo.push(`Sponsorship: ${Math.round(candidate.market.sponsorshipRate * 100)}%`);
    }
    if (candidate.market.avgSalary) {
      marketInfo.push(`Avg Salary: ${candidate.market.avgSalary}`);
    }
    if (marketInfo.length > 0) {
      markdownReport += `**Market Data:** ${marketInfo.join(' | ')}\n`;
    }
    
    // 行业分布（如果有）
    if (candidate.market.industryDistribution && Object.keys(candidate.market.industryDistribution).length > 0) {
      const topIndustries = Object.entries(candidate.market.industryDistribution)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([industry, pct]) => `${industry} ${Math.round((pct as number) * 100)}%`)
        .join(', ');
      markdownReport += `**Top Industries:** ${topIndustries}\n`;
    }
  }
  
  // 现有技能信息（保持不变）
  if (candidate.sharedTags && candidate.sharedTags.length > 0) {
    markdownReport += `**Shared Skills:** ${candidate.sharedTags.slice(0, 5).join(', ')}\n`;
  }
  if (candidate.skillsToLearn && candidate.skillsToLearn.length > 0) {
    markdownReport += `**Skills to Learn:** ${candidate.skillsToLearn.slice(0, 5).join(', ')}\n`;
  }
  
  markdownReport += `\n---\n\n`;
});
```

---

### 步骤 3: 同步修改 mcp-lite 版本

**文件：** `src/app/api/mcp-lite/route.ts` (line ~4126-4142)

**修改内容：** 与步骤2相同

---

## 🔍 向后兼容性保证

### 1. 所有新字段都是可选的
- 使用 `!== undefined` 检查，而不是 `if (field)`
- 如果字段不存在，不影响现有功能

### 2. 渐进式增强
- 如果外部API还没有返回新字段，MCP仍然正常工作
- 如果外部API返回了新字段，MCP会自动展示

### 3. 数据格式验证
- 使用安全的类型转换（`Math.round()`, `toFixed()`）
- 处理可能的 `null` 或 `undefined` 值

---

## 📝 外部API修改要求（需要通知后端团队）

### 需要修改的文件（假设在 JobDirectSearchAPI 项目中）

**文件：** `career_api_server.js` 或类似文件

**需要修改的地方：**

1. **在返回 candidates 时，添加优先级1字段：**

```javascript
// 假设当前代码类似这样：
const candidates = transitions.map(t => ({
  to: t.toId,
  similarity: t.sim,
  sharedTags: t.sharedSkills.slice(0, 5),
  skillsToLearn: t.gapSkills.slice(0, 6),
  // ... 其他字段
}));

// 修改为：
const candidates = transitions.map(t => ({
  to: t.toId,
  similarity: t.sim,
  sharedTags: t.sharedSkills.slice(0, 5),
  skillsToLearn: t.gapSkills.slice(0, 6),
  
  // 🆕 优先级1：评分数据（从 career_paths 集合）
  opportunityScore: t.opportunityScore,        // 已存在
  score: calculateScore(t),                    // 需要计算
  feasibilityScore: calculateFeasibility(t),  // 需要计算
  
  // 🆕 优先级1：地理位置（从 career_paths 集合）
  fromCountry: t.fromCountry,                 // 已存在
  toCountry: t.toCountry,                      // 已存在
  isCrossCountry: t.isCrossCountry,            // 已存在
  remoteSupported: t.remoteSupported,          // 已存在
  
  // 🆕 优先级1：市场数据（需要从 jobs 集合实时计算）
  market: await getMarketData(t.toId),         // 需要实现
}));
```

2. **实现 `getMarketData()` 函数：**

```javascript
async function getMarketData(toJobId) {
  const db = await getDb('CareerSwitch');
  
  // 查询目标职位的所有jobs
  const jobTag = await db.collection('job_tags').findOne({ 
    standardTitle: toJobId 
  });
  
  if (!jobTag) return null;
  
  // 查询匹配的jobs（通过standardTitle匹配）
  const jobs = await db.collection('jobs').aggregate([
    { $match: { 
      // 这里需要根据实际schema匹配
      // 可能需要通过job_tags关联
    }},
    { $sample: { size: 1000 } } // 采样足够的数据
  ]).toArray();
  
  if (jobs.length === 0) return null;
  
  // 计算市场数据
  const total = jobs.length;
  const remoteCount = jobs.filter(j => j.workMode === 'Remote' || j.workMode === 'Hybrid').length;
  const sponsorshipCount = jobs.filter(j => 
    j.workRights?.sponsorship === 'available' || 
    j.workRights?.sponsorship === 'required'
  ).length;
  
  // 计算趋势（基于发布时间，最近30天 vs 前30天）
  const now = new Date();
  const recent30Days = jobs.filter(j => {
    const posted = new Date(j.postedDateISO);
    return (now - posted) < 30 * 24 * 60 * 60 * 1000;
  }).length;
  const prev30Days = jobs.filter(j => {
    const posted = new Date(j.postedDateISO);
    const daysAgo = (now - posted) / (24 * 60 * 60 * 1000);
    return daysAgo >= 30 && daysAgo < 60;
  }).length;
  const trend = prev30Days > 0 ? (recent30Days - prev30Days) / prev30Days : 0;
  
  // 计算平均薪资
  const salaries = jobs
    .map(j => parseSalary(j.salary))
    .filter(s => s !== null);
  const avgSalary = salaries.length > 0 
    ? formatSalary(calculateAverage(salaries))
    : null;
  
  // 计算行业分布
  const industryCounts = {};
  jobs.forEach(j => {
    const industry = j.industry || 'Unknown';
    industryCounts[industry] = (industryCounts[industry] || 0) + 1;
  });
  const industryDistribution = {};
  Object.entries(industryCounts).forEach(([industry, count]) => {
    industryDistribution[industry] = count / total;
  });
  
  return {
    trend: Math.max(-1, Math.min(1, trend)), // 限制在 -1 到 1
    remoteRate: remoteCount / total,
    sponsorshipRate: sponsorshipCount / total,
    avgSalary: avgSalary,
    industryDistribution: industryDistribution
  };
}
```

---

## ✅ 实施检查清单

### MCP 端（前端）

- [ ] 修改 `src/app/api/mcp/route.ts` 的 `career_transition_advice` 处理逻辑
- [ ] 修改 `src/app/api/mcp-lite/route.ts` 的 `career_transition_advice` 处理逻辑
- [ ] 测试向后兼容性（外部API不返回新字段时）
- [ ] 测试新字段展示（外部API返回新字段时）
- [ ] 验证Markdown格式正确性

### 外部API端（后端）

- [ ] 修改 `career_api_server.js`（或类似文件）
- [ ] 在返回 candidates 时添加优先级1字段
- [ ] 实现 `getMarketData()` 函数
- [ ] 实现 `calculateScore()` 和 `calculateFeasibility()` 函数
- [ ] 测试数据查询性能（确保不影响响应时间）
- [ ] 测试数据准确性

### 测试

- [ ] 单元测试：测试格式化逻辑
- [ ] 集成测试：测试完整流程
- [ ] 性能测试：确保响应时间不受影响
- [ ] 兼容性测试：确保旧版本API仍然工作

---

## 📊 预期效果

### 增强前：
```
1. Data Scientist
Similarity: 85% | Difficulty: Moderate | Timeline: 3-6 months
Shared Skills: Python, SQL, Machine Learning, Statistics, Data Analysis
Skills to Learn: Deep Learning, TensorFlow, Cloud Computing, Big Data, NLP
```

### 增强后：
```
1. Data Scientist
Similarity: 85% | Opportunity Score: 78% | Overall Score: 82% | Feasibility: 80% | Difficulty: Moderate | Timeline: 3-6 months
Location: From: AU | To: US (Cross-country) | Remote supported
Market Data: 📈 Trend: +15% | Remote: 45% | Sponsorship: 30% | Avg Salary: $120,000 AUD
Top Industries: Technology 60%, Finance 30%, Healthcare 10%
Shared Skills: Python, SQL, Machine Learning, Statistics, Data Analysis
Skills to Learn: Deep Learning, TensorFlow, Cloud Computing, Big Data, NLP
```

---

## 🚀 实施顺序

1. **第一步**：先修改 MCP 端代码（前端）
   - 即使外部API还没返回新字段，代码也不会报错
   - 可以提前测试格式化逻辑

2. **第二步**：通知后端团队修改外部API
   - 提供详细的字段要求和数据结构
   - 提供 `getMarketData()` 实现参考

3. **第三步**：测试和验证
   - 测试完整流程
   - 验证数据准确性
   - 性能测试

---

## 📝 注意事项

1. **性能考虑**：
   - `getMarketData()` 可能需要查询大量jobs数据
   - 建议使用采样（sample）而不是全量查询
   - 考虑添加缓存机制

2. **数据准确性**：
   - 确保 `trend` 计算逻辑正确
   - 确保 `avgSalary` 解析和格式化正确
   - 确保 `industryDistribution` 计算正确

3. **错误处理**：
   - 如果市场数据查询失败，应该返回 `null` 而不是报错
   - 如果某些字段缺失，应该优雅降级

---

**文档创建时间：** 2025-01-XX  
**状态：** 待实施  
**优先级：** 🔥 高


