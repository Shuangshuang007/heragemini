# AgentKit MVP - 隔离沙箱实现

> **⚠️ 重要：这是一个隔离的MVP实现，不得被主程序import或引用**

## 📁 目录结构

```
src/experimental/agentkit_mvp/
├── types.ts          # 类型定义 (Intent, Plan, AgentStep, ExecutionRecord)
├── registry.ts       # 工具注册表 (Mock实现)
├── planner.ts        # 规划器 (纯规则生成)
├── executor.ts       # 执行器 (Dry-run模式)
├── memory.ts         # 内存管理 (In-memory实现)
└── README.md         # 本文档

devdata/agentkit/
├── sample-intent.json    # 示例意图
└── sample-plan.json      # 示例计划

scripts/agentkit/
├── demo_plan.ts      # 规划演示脚本
└── demo_execute.ts   # 执行演示脚本
```

## 🎯 MVP功能说明

### 1. 类型系统 (`types.ts`)
- `Intent`: 用户意图 (find_jobs, improve_profile, apply_job)
- `AgentStep`: 执行步骤 (工具调用)
- `Plan`: 完整执行计划
- `ExecutionRecord`: 执行记录和结果

### 2. 工具注册表 (`registry.ts`)
**Mock工具实现**：
- `parseResume`: 简历解析 (mock)
- `updateProfile`: 档案更新 (mock)  
- `searchJobs`: 工作搜索 (mock)
- `rankRecommend`: 推荐排序 (mock)

### 3. 规划器 (`planner.ts`)
**纯规则规划**：
- 基于 `intent.primary` 生成步骤序列
- 根据 `intent.readiness` 决定前置步骤
- 不依赖外部API或业务服务

### 4. 执行器 (`executor.ts`)
**Dry-run执行**：
- 调用registry中的mock工具
- 记录执行时间和结果
- 支持错误处理和状态跟踪

### 5. 内存管理 (`memory.ts`)
**In-memory存储**：
- 会话级别的内存管理
- 重启后数据丢失 (MVP限制)
- 提供基础的load/save接口

## 🔗 人工集成步骤

### 阶段1: 代码审查
1. **审查类型定义** - 确认 `types.ts` 符合业务需求
2. **验证工具接口** - 检查 `registry.ts` 中的工具签名
3. **测试规划逻辑** - 运行 `demo_plan.ts` 验证规划规则
4. **验证执行流程** - 运行 `demo_execute.ts` 查看执行效果

### 阶段2: 生产集成
1. **替换Mock实现**:
   ```typescript
   // 在 registry.ts 中替换 mock 调用
   export const ToolRegistry = {
     parseResume: async (args) => {
       // 调用实际的简历解析服务
       return await parseResumeService(args);
     },
     // ... 其他工具
   };
   ```

2. **连接数据库**:
   ```typescript
   // 在 memory.ts 中替换 in-memory 实现
   export async function saveMemory(sessionId: string, patch: SessionMemory) {
     await db.collection('agentkit_memory').updateOne(
       { sessionId },
       { $set: { ...patch, updatedAt: new Date() } },
       { upsert: true }
     );
   }
   ```

3. **集成到MCP路由**:
   ```typescript
   // 在 src/app/api/mcp/route.ts 中添加
   if (body.method === "agentkit/plan") {
     const { userId, intent } = body.params;
     const plan = await plan(userId, intent);
     return json200({ result: { plan } });
   }
   
   if (body.method === "agentkit/execute") {
     const { plan, options } = body.params;
     const results = await execute(plan, options);
     return json200({ result: { results } });
   }
   ```

### 阶段3: 配置和环境
1. **环境变量**:
   ```bash
   # 添加 AgentKit 相关配置
   AGENTKIT_MODE=production
   AGENTKIT_DB_COLLECTION=agentkit_plans
   ```

2. **数据库集合**:
   ```javascript
   // 创建必要的MongoDB集合和索引
   db.agentkit_plans.createIndex({ userId: 1, createdAt: -1 });
   db.agentkit_memory.createIndex({ sessionId: 1 });
   ```

## 🚨 风险评估

### 高风险点
1. **工具接口变更** - 确保registry中的工具签名与实际业务API匹配
2. **规划逻辑限制** - 当前是纯规则，可能需要引入GPT增强
3. **内存数据丢失** - 需要替换为持久化存储
4. **错误处理** - 需要增强生产级别的错误恢复机制

### 中等风险
1. **性能考虑** - 大量并发执行时的资源管理
2. **日志记录** - 生产环境需要结构化日志
3. **监控指标** - 执行成功率、延迟统计

### 低风险
1. **类型安全** - TypeScript类型定义相对稳定
2. **隔离性** - 当前完全隔离，不影响现有功能

## 🧪 测试验证

### 运行演示脚本
```bash
# 在项目根目录执行
cd heraai_rebuild_public_v1

# 测试规划功能
npx ts-node scripts/agentkit/demo_plan.ts

# 测试执行功能  
npx ts-node scripts/agentkit/demo_execute.ts
```

### 预期输出
- 规划演示应显示不同场景的步骤序列
- 执行演示应显示mock工具的成功调用
- 所有操作应为dry-run模式，不修改真实数据

## 📋 后续开发建议

1. **增强规划器** - 集成GPT进行智能规划
2. **完善工具链** - 添加更多业务工具
3. **优化执行器** - 支持并行执行和重试机制
4. **强化监控** - 添加完整的执行跟踪和性能指标
5. **安全加固** - 添加权限验证和输入校验

---

**注意**: 这个MVP实现故意保持了隔离性，确保不会影响现有的主程序。在生产集成前，建议进行充分的代码审查和测试。
