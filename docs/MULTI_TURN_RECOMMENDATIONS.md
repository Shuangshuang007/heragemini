# 多轮职位推荐机制 (Multi-Turn Job Recommendations)

## 📋 概述

Hera AI 的 `recommend_jobs` 工具支持**智能去重的多轮推荐**，确保用户在连续多次请求中不会看到重复的职位。

---

## 🎯 核心功能

### **三层去重架构**

```
┌─────────────────────────────────────────────┐
│  Layer 1: exclude_ids (参数传递)            │
│  - ChatGPT/用户明确传递的排除 IDs           │
│  - 最高优先级，实时生效                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 2: AgentKit Memory (运行时缓存)       │
│  - 低延迟同步读取                            │
│  - 保留最近 50 个 job IDs                   │
│  - 自动去重，即使不传 exclude_ids            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 3: feedback_events (长期历史)        │
│  - 异步补充，用于跨 session 分析             │
│  - 超时保护 (500ms)                         │
└─────────────────────────────────────────────┘
```

---

## 🔧 工具契约

### **recommend_jobs 参数**

```typescript
{
  job_title: string;           // 职位标题（必填）
  city: string;                // 城市（必填）
  session_id?: string;         // Session ID（强烈推荐）
  user_email?: string;         // 用户邮箱（可选）
  exclude_ids?: string[];      // 要排除的职位 IDs（可选）
  limit?: number;              // 返回数量，默认 5
}
```

### **返回格式**

```typescript
{
  result: {
    content: [{ type: "text", text: "..." }],
    isError: false,
    mode: "recommend",
    total: 5,
    isFinal: false,              // ← 鼓励后续对话
    meta: {
      returned_job_ids: string[] // ← 本轮返回的 job IDs
    }
  }
}
```

---

## 📖 使用场景

### **场景 1: 基础推荐（不传 exclude_ids）**

**第一轮：**
```json
{
  "name": "recommend_jobs",
  "arguments": {
    "job_title": "Software Engineer",
    "city": "Sydney",
    "session_id": "sess_123"
  }
}
```

**返回：**
- 5 个职位
- `meta.returned_job_ids: ["job_1", "job_2", "job_3", "job_4", "job_5"]`

**第二轮（同一 session）：**
```json
{
  "name": "recommend_jobs",
  "arguments": {
    "job_title": "Software Engineer",
    "city": "Sydney",
    "session_id": "sess_123"
    // ✅ 不传 exclude_ids，系统自动从 Memory 读取
  }
}
```

**结果：** 返回全新的 5 个职位（不重复）

---

### **场景 2: 手动传递 exclude_ids（双保险）**

**第二轮：**
```json
{
  "name": "recommend_jobs",
  "arguments": {
    "job_title": "Software Engineer",
    "city": "Sydney",
    "session_id": "sess_123",
    "exclude_ids": ["job_1", "job_2", "job_3", "job_4", "job_5"]
    // ✅ 从上一轮的 meta.returned_job_ids 获取
  }
}
```

**优势：**
- 即使 Memory 失败，仍能去重
- 跨不同客户端/设备也能保持一致

---

### **场景 3: 连续多轮推荐**

```
第 1 轮: 返回 5 个职位 → Memory 记录 5 个 IDs
第 2 轮: 返回 5 个新职位 → Memory 记录 10 个 IDs
第 3 轮: 返回 5 个新职位 → Memory 记录 15 个 IDs
...
最多保留 50 个最近的 IDs
```

**验证通过：**
- R1 vs R2: 0 重复
- R1 vs R3: 0 重复
- R2 vs R3: 0 重复

---

## 🔐 环境配置

### **开关控制**

```bash
# .env.local

# 控制 AgentKit Memory（默认开启）
ENABLE_MEMORY=true  # 或不设置（默认 true）
# ENABLE_MEMORY=false  # 禁用 Memory（仍可用 exclude_ids）

# 控制 feedback_events（默认开启）
ENABLE_FEEDBACK=true
```

---

## 🧪 测试验证

### **本地测试命令**

```bash
# 生成随机 Session
SESSION=sess_$RANDOM

# 第一次推荐
curl -X POST http://localhost:3002/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":"1",
    "method":"tools/call",
    "params":{
      "name":"recommend_jobs",
      "arguments":{
        "job_title":"Software Engineer",
        "city":"Sydney",
        "session_id":"'$SESSION'"
      }
    }
  }' | jq '.result.meta.returned_job_ids'

# 等待 Memory 写入
sleep 5

# 第二次推荐（不传 exclude_ids）
curl -X POST http://localhost:3002/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":"2",
    "method":"tools/call",
    "params":{
      "name":"recommend_jobs",
      "arguments":{
        "job_title":"Software Engineer",
        "city":"Sydney",
        "session_id":"'$SESSION'"
      }
    }
  }' | jq '.result.meta.returned_job_ids'

# 验证无重复
```

---

## 📊 日志监控

### **关键日志**

```bash
# 去重统计
[MCP] Layer 1 (exclude_ids parameter): 5 jobs
[MCP] Layer 2 (AgentKit Memory): added 5 jobs from memory
[MCP] Layer 3 (feedback_events): added 0 jobs from 0 events
[MCP] recommend_jobs - EXCLUDE_SET size: 10

# Memory 更新
[MCP] AgentKit Memory updated: 5 new jobs added, total 10 in memory
```

---

## ⚙️ 技术细节

### **Memory 数据结构**

```typescript
// agentkit_memory 集合
{
  sessionId: "sess_123",
  context: {
    jobContext: {
      shown_job_ids: string[],     // 最近 50 个 IDs
      last_search: {
        job_title: string,
        city: string,
        timestamp: Date
      }
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### **异步写入机制**

- ✅ Memory 读取：**同步**（查询前）
- ✅ Memory 写入：**异步**（返回后，不阻塞）
- ✅ 错误处理：失败只 warn，不影响主流程

---

## 🎯 最佳实践

### **ChatGPT 集成建议**

1. **始终传递 `session_id`**
   - 用于跨轮次记忆
   - 可以是 ChatGPT 的 conversation_id

2. **可选传递 `exclude_ids`（双保险）**
   - 从上一轮的 `meta.returned_job_ids` 提取
   - 即使 Memory 失败也能去重

3. **利用 `isFinal: false`**
   - 鼓励用户继续对话
   - 询问"要看更多吗？"

4. **展示职位编号**
   - 方便用户反馈："我喜欢 #2 和 #5"
   - 用于 `refine_recommendations` 工具

---

## 🔗 相关工具

- **`refine_recommendations`**: 基于用户反馈（liked/disliked）优化推荐
- **`search_jobs`**: 更灵活的职位搜索（支持更多过滤条件）
- **`tailor_resume`**: 根据职位定制简历

---

## 📝 变更历史

- **PR-1 (2025-01)**: 集成 AgentKit Memory，实现三层去重
- **Phase 2 (2024-12)**: 添加 `refine_recommendations` 和反馈机制
- **Phase 1 (2024-11)**: 基础 `recommend_jobs` 实现

---

## 🆘 故障排查

### **问题：仍然看到重复职位**

**检查：**
1. 是否传递了 `session_id`？
2. `ENABLE_MEMORY` 是否开启？
3. 查看日志中的 "EXCLUDE_SET size"

**解决：**
- 确保同一 session 使用相同的 `session_id`
- 手动传递 `exclude_ids` 作为兜底

### **问题：Memory 读写失败**

**日志：**
```
[MCP] AgentKit Memory read failed (non-blocking): ...
```

**影响：**
- 不影响主流程
- 仍可用 `exclude_ids` 去重

**解决：**
- 检查 MongoDB 连接
- 检查 `agentkit_memory` 集合权限

---

*文档最后更新：2025-01-29*

