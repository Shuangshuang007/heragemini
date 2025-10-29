# 🚀 Feedback Loop 快速启动指南

## 📋 前置条件

- [x] MongoDB 运行中
- [x] Node.js 已安装
- [x] 环境变量已配置

---

## ⚡ 3步启动

### **Step 1: 初始化数据库（1分钟）**

```bash
cd heraai_rebuild_public_v1
node scripts/init-feedback-db.js
```

**预期输出：**
```
🚀 Initializing Feedback Database...
✅ Connected to MongoDB
✅ feedback_events collection created
  ✅ Index: event_id (unique)
  ✅ Index: session_id + timestamp
  ... (8个索引)
✅ feedback_aggregates collection created
🎉 Feedback database initialization completed successfully!
```

---

### **Step 2: 启动开发服务器（1分钟）**

```bash
npm run dev
```

**验证：**
```bash
# 测试原端点（应该正常）
curl http://localhost:3002/api/mcp

# 测试新端点（应该正常）
curl http://localhost:3002/api/mcp-tracked
```

---

### **Step 3: 运行E2E测试（2分钟）**

```bash
export BASE_URL=http://localhost:3002
export AGENTKIT_TOKEN=your_token_here
./scripts/test-feedback-e2e.sh
```

**预期输出：**
```
🧪 HeraAI Feedback Loop E2E Test
================================
Test 1: 调用 /api/mcp-tracked ✅
Test 2: 检查 MongoDB ✅
Test 3: 模拟用户点击 ✅
Test 4: 验证 feedback 更新 ✅
Test 5: 查询会话历史 ✅
🎉 E2E Test Complete!
```

---

## 🔍 验证数据

### **查看 feedback_events**

```javascript
mongosh mongodb://localhost:27017/hera

> db.feedback_events.find().pretty()
> db.feedback_events.countDocuments()
```

**预期结果：**
```json
{
  "event_id": "xxx",
  "session_id": "e2e_test_001",
  "tool": "recommend_jobs",
  "input": {...},
  "output": {...},
  "feedback": {
    "clicked_jobs": ["test_job_123"],
    "clicked_at": ISODate(...)
  },
  "processed": false
}
```

---

## 🎚️ 功能开关

### **禁用 Feedback（回退）**

```bash
# .env.local
ENABLE_FEEDBACK=false
```

重启服务器后，/api/mcp-tracked 行为与 /api/mcp 完全相同。

### **启用 PII 保护**

```bash
# .env.local
FEEDBACK_PII_DISABLED=true
```

只存储 email_hash，不存储明文邮箱。

---

## 🐛 常见问题

### **Q1: feedback_events 没有数据？**

**检查：**
```bash
# 确认 ENABLE_FEEDBACK
echo $ENABLE_FEEDBACK  # 应该是 true

# 查看日志
# 应该看到：[Feedback] ✅ Start recorded
```

### **Q2: 追踪链接没有参数？**

**检查：**
```bash
# 响应头应该包含
X-Event-Id: xxx
X-Feedback-Enabled: true
```

### **Q3: MongoDB 连接失败？**

**检查：**
```bash
# 测试连接
mongosh $MONGODB_URI

# 检查环境变量
echo $MONGODB_URI
```

---

## 📊 监控指标

### **每日检查（开发环境）**

```javascript
// 今日事件总数
db.feedback_events.countDocuments({
  created_at: { $gte: new Date(Date.now() - 86400000) }
})

// 各工具调用分布
db.feedback_events.aggregate([
  { $group: { _id: '$tool', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// 有反馈的事件数
db.feedback_events.countDocuments({
  'feedback.clicked_jobs': { $exists: true, $ne: [] }
})
```

---

## 🚀 部署到 Vercel

### **环境变量设置**

Vercel Dashboard → Settings → Environment Variables：

```
ENABLE_FEEDBACK=true
FEEDBACK_PII_DISABLED=false
MONGODB_URI=mongodb+srv://...
MONGODB_DB=hera
AGENTKIT_TOKEN=your_token
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
```

### **部署流程**

```bash
# 1. 提交代码（需要用户同意）
# git add ...
# git commit -m "feat: Add Feedback Loop (Phase 2A)"
# git push heraai_one main

# 2. Vercel 自动部署

# 3. 运行数据库初始化
# 在 Vercel CLI 或本地连接生产数据库
node scripts/init-feedback-db.js

# 4. 测试生产环境
export BASE_URL=https://your-domain.vercel.app
./scripts/test-feedback-e2e.sh
```

---

## ✅ 完成标志

当以下全部通过，Phase 2A 即完成：

- [x] 7个文件全部创建
- [ ] 本地 E2E 测试通过
- [ ] MongoDB 有 feedback_events 数据
- [ ] /api/mcp 功能未受影响
- [ ] /api/mcp-tracked 正常工作
- [ ] 追踪链接格式正确
- [ ] 性能无明显下降（<+10ms）

---

**准备好了就开始测试！** 🚀


