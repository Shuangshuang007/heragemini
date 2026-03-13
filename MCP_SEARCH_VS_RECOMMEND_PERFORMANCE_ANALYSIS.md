# MCP search_jobs vs recommend_jobs 性能差异分析

## 📊 性能对比总结

| 工具 | 数据库查询 | GPT API 调用 | 返回数量 | 典型耗时 |
|------|-----------|-------------|---------|---------|
| `search_jobs` (FAST) | ✅ 1次（5条） | ❌ 无 | 5条 | **< 2秒** |
| `recommend_jobs` | ✅ 1次（40条） | ✅ **40次**（每个职位1次） | 5条 | **15-30秒+** |

---

## 🔍 详细分析

### 1. `search_jobs` (FAST mode) - 快速搜索

**执行流程：**
```
1. 接收参数：job_title, city
2. 调用 fastDbQuery() → queryJobsWithFilters()
   - 查询条件：title/city 匹配
   - pageSize: 5（固定）
   - 只查询5条结果
3. 映射结果格式
4. 返回（无外部API调用）
```

**代码位置：** `src/app/api/mcp/route.ts:2138-2293`

**关键特点：**
- ✅ **只做数据库查询**，不调用任何外部API
- ✅ **固定返回5条**，查询量小
- ✅ **有15秒超时保护**（`FAST_QUERY_TIMEOUT_MS`）
- ✅ **性能稳定**，通常在1-2秒内完成

**性能瓶颈：**
- MongoDB 查询性能（如果索引不完善可能慢）
- 网络延迟（数据库连接）

---

### 2. `recommend_jobs` - 个性化推荐

**执行流程：**
```
1. 接收参数：user_profile, job_title, city, limit=10
2. 构建用户档案（defaultProfile）
3. 三层去重逻辑：
   - Layer 1: exclude_ids 参数
   - Layer 2: AgentKit Memory（读取）
   - Layer 3: feedback_events（读取，500ms超时）
4. 调用 queryJobsWithFilters()
   - searchLimit = Math.max(limit * 3, 40) = 40条
   - 查询40条职位用于筛选
5. ⚠️ **关键瓶颈**：对每个职位调用 GPT API
   - Promise.all(transformedJobs.map(async (job) => {
       await fetch('/api/gpt-services/jobMatch', ...)
     }))
   - 40个职位 = 40次 GPT API 调用
6. 按 matchScore 排序，返回前5个
7. 更新 AgentKit Memory（写入）
8. 更新 feedback_events（写入）
```

**代码位置：** `src/app/api/mcp/route.ts:2746-3224`

**关键特点：**
- ✅ **个性化匹配**，基于用户档案评分
- ⚠️ **需要调用 GPT API 40次**（每个职位一次）
- ⚠️ **即使并行调用，累积延迟仍然很大**
- ⚠️ **无超时保护**（GPT API 调用可能很慢）

**性能瓶颈：**
1. **GPT API 调用次数过多**（40次）
   - 每个调用可能需要 500ms - 2秒
   - 即使并行，40个调用累积 = 5-20秒+
2. **数据库查询量更大**（40条 vs 5条）
3. **额外的内存读取**（AgentKit Memory + feedback_events）
4. **额外的内存写入**（AgentKit Memory + feedback_events）

---

## 🎯 根本原因

### `recommend_jobs` 慢的核心问题：

**问题1：GPT API 调用次数过多**
```typescript
// 代码位置：src/app/api/mcp/route.ts:2925-3048
const scoredJobs = await Promise.all(
  transformedJobs.map(async (job: any) => {
    // 对每个职位都调用一次 GPT API
    const matchResponse = await fetch('/api/gpt-services/jobMatch', ...);
    // ...
  })
);
```

- `transformedJobs.length = 40`
- 40次 GPT API 调用，即使并行执行，总时间 = max(单个调用时间) + 网络开销
- 如果每个调用平均1秒，总时间 ≈ 1-3秒（并行）
- 如果网络不稳定或GPT API慢，可能达到10-30秒+

**问题2：查询量更大**
- `search_jobs`: 查询5条
- `recommend_jobs`: 查询40条（用于评分筛选）

**问题3：额外的数据库操作**
- AgentKit Memory 读取
- feedback_events 读取（有500ms超时保护）
- AgentKit Memory 写入
- feedback_events 写入

---

## 💡 优化建议

### 方案1：减少 GPT API 调用次数（推荐）

**当前：** 查询40条 → 对40条都调用GPT → 排序 → 返回前5条

**优化：** 先做简单筛选 → 只对候选职位调用GPT

```typescript
// 伪代码
const candidates = transformedJobs
  .filter(job => {
    // 简单的关键词匹配、技能匹配
    return basicMatch(job, userProfile);
  })
  .slice(0, 15); // 只保留15个候选

// 只对15个候选调用GPT
const scoredJobs = await Promise.all(
  candidates.map(async (job) => {
    return await scoreWithGPT(job, userProfile);
  })
);
```

**预期效果：** 40次 → 15次 GPT调用，耗时减少 60%+

---

### 方案2：批量 GPT API 调用

**当前：** 每个职位单独调用一次GPT API

**优化：** 批量调用，一次处理多个职位

```typescript
// 伪代码
const batchSize = 10;
const batches = chunkArray(transformedJobs, batchSize);

const scoredJobs = [];
for (const batch of batches) {
  const batchResults = await fetch('/api/gpt-services/jobMatchBatch', {
    method: 'POST',
    body: JSON.stringify({
      jobs: batch,
      userProfile: defaultProfile
    })
  });
  scoredJobs.push(...batchResults);
}
```

**预期效果：** 40次 → 4次 GPT调用，耗时减少 90%+

**需要修改：** 需要创建新的 `/api/gpt-services/jobMatchBatch` 端点

---

### 方案3：缓存 GPT 评分结果

**优化：** 对相同职位+用户档案组合缓存评分结果

```typescript
// 伪代码
const cacheKey = `${job.id}_${hashUserProfile(userProfile)}`;
const cachedScore = await redis.get(cacheKey);

if (cachedScore) {
  return JSON.parse(cachedScore);
} else {
  const score = await scoreWithGPT(job, userProfile);
  await redis.set(cacheKey, JSON.stringify(score), 'EX', 3600); // 1小时过期
  return score;
}
```

**预期效果：** 重复查询时，GPT调用次数减少 50-80%

---

### 方案4：降低初始查询数量

**当前：** `searchLimit = Math.max(limit * 3, 40) = 40`

**优化：** 降低到20-25条

```typescript
const searchLimit = Math.max(limit * 2, 20); // 从40降到20
```

**预期效果：** GPT调用次数减少 50%，但可能影响推荐质量

---

### 方案5：添加超时保护

**当前：** GPT API 调用无超时保护

**优化：** 添加超时，超时后使用fallback评分

```typescript
const scoredJobs = await Promise.all(
  transformedJobs.map(async (job: any) => {
    try {
      const matchResponse = await Promise.race([
        fetch('/api/gpt-services/jobMatch', ...),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )
      ]);
      // ...
    } catch (error) {
      // 使用fallback评分
      return fallbackScore(job, userProfile);
    }
  })
);
```

**预期效果：** 防止单个慢请求拖累整体，但不会减少总耗时

---

## 📈 推荐优化方案组合

**优先级1（立即实施）：**
1. ✅ 方案1：减少GPT调用次数（40 → 15）
2. ✅ 方案5：添加超时保护（防止卡死）

**优先级2（中期优化）：**
3. ✅ 方案2：批量GPT调用（需要后端支持）
4. ✅ 方案3：缓存评分结果（需要Redis）

**优先级3（长期优化）：**
5. ✅ 方案4：降低查询数量（需要评估推荐质量影响）

---

## 🔧 实施建议

### 快速修复（1-2小时）

修改 `src/app/api/mcp/route.ts:2882-2901`：

```typescript
// 当前代码
const searchLimit = Math.max(limit * 3, 40);

// 优化后
const searchLimit = Math.max(limit * 2, 20); // 从40降到20

// 添加简单筛选
const candidates = transformedJobs
  .filter(job => {
    // 简单的关键词匹配
    if (searchCriteria.jobTitle) {
      const titleMatch = job.title?.toLowerCase().includes(
        searchCriteria.jobTitle.toLowerCase()
      );
      if (!titleMatch) return false;
    }
    return true;
  })
  .slice(0, 15); // 只保留15个候选

// 只对15个候选调用GPT
const scoredJobs = await Promise.all(
  candidates.map(async (job: any) => {
    // ... 现有GPT调用逻辑
  })
);
```

**预期效果：** 耗时从 15-30秒 降低到 5-10秒

---

## 📝 总结

| 问题 | 原因 | 影响 |
|------|------|------|
| `recommend_jobs` 慢 | GPT API 调用40次 | 耗时 15-30秒+ |
| `search_jobs` 快 | 只做数据库查询，无GPT调用 | 耗时 < 2秒 |

**核心差异：** `recommend_jobs` 需要对每个职位调用GPT API进行个性化评分，而 `search_jobs` 只做简单的数据库查询。

**优化方向：** 减少GPT API调用次数（从40次降到15次或更少），添加超时保护，考虑批量调用或缓存。








