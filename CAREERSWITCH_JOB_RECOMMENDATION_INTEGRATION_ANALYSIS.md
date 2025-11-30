# AgentKit 与 MCP 工具集成方案分析

## 📊 当前状态总览

### 所有 MCP 工具列表（11个）

| 工具名称 | AgentKit 支持 | 直接 MCP 调用 | 用途分类 |
|---------|--------------|--------------|---------|
| `recommend_jobs` | ✅ **已支持** | ✅ 支持 | 🎯 个性化推荐 |
| `search_jobs` | ✅ **已支持** | ✅ 支持 | 🔍 简单搜索 |
| `refine_recommendations` | ❌ 不支持 | ✅ 支持 | 🔄 迭代优化 |
| `job_alert` | ❌ 不支持 | ✅ 支持 | 📣 定时提醒 |
| `search_jobs_by_company` | ❌ 不支持 | ✅ 支持 | 🏢 公司搜索 |
| `tailor_resume` | ❌ 不支持 | ✅ 支持 | 📝 简历定制 |
| `get_user_applications` | ❌ 不支持 | ✅ 支持 | 📋 申请历史 |
| `build_search_links` | ❌ 不支持 | ✅ 支持 | 🔗 URL 生成 |
| `career_transition_advice` | ❌ 不支持 | ✅ 支持 | 💼 职业转换 |
| `career_path_explorer` | ❌ 不支持 | ✅ 支持 | 🗺️ 路径探索 |
| `career_skill_gap_analysis` | ❌ 不支持 | ✅ 支持 | 📊 技能分析 |

---

## 🔍 详细分析：每个工具的 AgentKit 接入建议

### 1. ✅ 已支持的工具（无需改动）

#### `recommend_jobs` - 个性化职位推荐
- **当前状态**：✅ 已集成到 AgentKit Executor
- **接入方式**：通过 `agentkit/plan` → `agentkit/execute`
- **判断**：✅ **正确接入** - 这是初始任务规划的核心工具
- **建议**：保持现状

#### `search_jobs` - 简单职位搜索
- **当前状态**：✅ 已集成到 AgentKit Executor
- **接入方式**：通过 `agentkit/plan` → `agentkit/execute`
- **判断**：✅ **正确接入** - 适合规划流程中的简单搜索场景
- **建议**：保持现状

---

### 2. ❌ 不应该接入 AgentKit 的工具

#### `refine_recommendations` - 优化推荐
**不建议接入原因**：
- ⚠️ **依赖前一次调用结果**：需要 `meta.returned_job_ids` 进行去重
- ⚠️ **迭代反馈场景**：是对用户即时反馈的响应，不适合预规划
- ⚠️ **上下文依赖强**：依赖上一轮 `recommend_jobs` 的执行结果
- ✅ **当前方案更优**：直接调用 MCP `tools/call` 更灵活

**建议**：❌ **不接入**，保持直接调用方式

#### `job_alert` - 职位提醒
**不建议接入原因**：
- ⚠️ **定时/周期性任务**：通常由调度系统触发，不是规划流程的一部分
- ⚠️ **状态持续性**：需要跨调用维护状态（`alertContext.last_sent_at`）
- ⚠️ **独立场景**：用户主动请求"新职位"时直接调用即可
- ✅ **AgentKit Memory 已集成**：虽然不通过 Plan/Execute，但已使用 Memory 系统

**建议**：❌ **不接入**，但保持 AgentKit Memory 集成

#### `build_search_links` - 生成搜索链接
**不建议接入原因**：
- ⚠️ **辅助性工具**：纯功能工具，不需要智能规划
- ⚠️ **简单操作**：无复杂逻辑，不需要规划器参与
- ⚠️ **即时响应**：通常是用户明确要求"给我链接"时的直接响应

**建议**：❌ **不接入**

---

### 3. ✅ 应该接入 AgentKit 的工具（高优先级）

#### `search_jobs_by_company` - 按公司搜索
**真实场景分析**：
- ✅ **明确指令**：用户说"搜索 Google 的职位" → 意图明确，直接调用即可
- ❌ **不需要规划**：用户已经知道要搜索哪个公司，直接调用工具即可
- ❓ **是否需要规划**：如果用户说"我想在 Google 工作"，直接搜索 Google 职位就够了，不需要AgentKit规划

**建议**：❌ **不接入** - 保持直接调用方式
- 用户意图明确时，直接调用更简单高效
- AgentKit 的价值在于意图不明确时的规划，而不是明确指令的执行

---

#### `tailor_resume` - 简历定制
**真实场景分析**：
- ✅ **明确指令**：用户说"帮我定制这个职位的简历" → 意图明确，直接调用即可
- ❌ **不需要规划**：用户已经知道要做什么，不需要AgentKit规划
- ❌ **复合场景很少**："找到工作并定制简历"这种场景在实际使用中很少见
- ❌ **复杂度高**：需要实现步骤间结果传递机制，改动大

**建议**：❌ **不接入** - 保持直接调用方式
- 用户意图明确时，直接调用 MCP `tools/call` 更简单高效
- 如果真的需要"找到+定制"流程，可以在应用层实现，不需要AgentKit规划

---

#### `career_transition_advice` - 职业转换建议
**真实场景分析**：
- ✅ **明确咨询**：用户问"我能转行做什么？" → 意图明确，直接调用工具回答即可
- ❌ **不需要规划**：这是一个直接的问题，不需要多步骤规划
- ⚠️ **外部依赖风险**：依赖外部 API（CAREER_SWITCH_API_URL），服务稳定性不可控
- ❌ **风险高收益低**：接入AgentKit带来的收益很小，但引入外部依赖风险

**建议**：❌ **不接入** - 保持直接调用方式
- 用户意图明确，直接调用工具即可
- 外部 API 风险不应该影响 AgentKit 的稳定性

---

#### `career_path_explorer` - 职业路径探索
**真实场景分析**：
- ✅ **明确查询**：用户说"探索从 X 职位的职业路径" → 意图明确，直接调用即可
- ❌ **不需要规划**：这是一个直接的查询工具
- ⚠️ **外部依赖风险**：依赖外部 API，服务稳定性不可控

**建议**：❌ **不接入** - 保持直接调用方式

---

#### `career_skill_gap_analysis` - 技能差距分析
**真实场景分析**：
- ✅ **明确查询**：用户问"从 X 到 Y 的技能差距是什么？" → 意图明确，直接调用即可
- ❌ **不需要规划**：这是一个直接的分析工具
- ⚠️ **外部依赖风险**：依赖外部 API，服务稳定性不可控

**建议**：❌ **不接入** - 保持直接调用方式

---

### 4. ⚠️ 可选接入的工具（低优先级）

#### `get_user_applications` - 获取申请历史
**可选接入理由**：
- ⚠️ **数据查询工具**：主要是数据获取，不是规划任务
- ⚠️ **上下文使用**：通常作为上下文信息，而非规划步骤
- ✅ **特殊场景**：如果用户说"基于我的申请历史推荐新职位"，可以规划

**建议**：⚠️ **可选接入** - 优先级低，可以作为上下文获取工具

---

## 📋 接入优先级总结（重新评估）

### ✅ 真实评估结论

**核心洞察**：
- AgentKit 的价值在于**意图不明确时的智能规划**
- 如果用户意图明确（如"定制简历"、"转行建议"），直接调用工具即可
- **最小改动原则**：只接入真正需要规划能力的工具

### 推荐接入：**无**

**原因**：
1. 所有工具的用户意图都很明确，不需要AgentKit规划
2. 当前的 `recommend_jobs` 和 `search_jobs` 已经覆盖了核心规划场景
3. 其他工具都是明确的单步操作，直接调用更简单高效

### 不接入 ❌（保持现状）
- `tailor_resume` - 意图明确，直接调用
- `search_jobs_by_company` - 意图明确，直接调用
- `career_transition_advice` - 意图明确 + 外部 API 风险
- `career_path_explorer` - 意图明确 + 外部 API 风险
- `career_skill_gap_analysis` - 意图明确 + 外部 API 风险
- `refine_recommendations` - 迭代反馈场景，不适合规划
- `job_alert` - 定时任务，不适合规划
- `build_search_links` - 辅助工具，不需要规划
- `get_user_applications` - 数据查询工具，不需要规划

### 💡 建议
**保持现状，不接入新工具** - AgentKit 当前的能力已经足够，增加更多工具不会带来明显收益，反而增加复杂度和风险。

---

## 🎯 接入方案建议（重新评估）

### 💡 真实评估结果：**建议不接入新工具**

**理由**：

1. **用户意图都很明确**
   - "定制简历" → 直接调用 `tailor_resume`
   - "转行建议" → 直接调用 `career_transition_advice`
   - "搜索公司职位" → 直接调用 `search_jobs_by_company`
   - 这些都不需要 AgentKit 规划，直接调用即可

2. **AgentKit 的真正价值场景**
   - 当前已经支持的 `recommend_jobs` 和 `search_jobs` 已经覆盖了需要规划的核心场景
   - 其他工具都是明确的单步操作，不需要规划能力

3. **最小改动原则**
   - 不需要实现步骤间结果传递机制（复杂度高）
   - 不需要接入外部 API 工具（风险高）
   - 不需要改动现有架构

### 📊 建议行动

**保持现状，专注优化现有功能**：
- ✅ 优化 `recommend_jobs` 和 `search_jobs` 的规划能力
- ✅ 完善 AgentKit Memory 的使用场景
- ✅ 改进意图识别准确性
- ❌ **不接入新工具** - 收益小，风险大，复杂度高

---

## 🔧 技术实现要点

### 1. MCPToolExecutor 扩展

```typescript
// 需要添加的方法
async executeSearchJobsByCompany(args: any): Promise<any>
async executeCareerTransitionAdvice(args: any): Promise<any>
async executeTailorResume(args: any): Promise<any>
async executeCareerSkillGapAnalysis(args: any): Promise<any>
async executeCareerPathExplorer(args: any): Promise<any>
```

### 2. AgentKitExecutor 扩展

```typescript
private async executeTool(toolName: string, context: ToolExecutionContext): Promise<...> {
  switch (toolName) {
    case 'recommend_jobs':
    case 'search_jobs':
    case 'search_jobs_by_company':      // 新增
    case 'career_transition_advice':    // 新增
    case 'tailor_resume':               // 新增
    case 'career_skill_gap_analysis':   // 新增
    case 'career_path_explorer':        // 新增
    // ...
  }
}
```

### 3. AgentKitPlanner 意图识别扩展

```typescript
private async generateSteps(intent: AgentKitIntent, userContext?: any): Promise<AgentStep[]> {
  switch (intent.action) {
    case 'company_search':
      // 识别"jobs at Google" → search_jobs_by_company
      
    case 'find_and_tailor':
      // 识别"找到工作并定制简历" → recommend_jobs + tailor_resume
      
    case 'career_transition':
      // 识别"我能转行做什么" → career_transition_advice + recommend_jobs
      
    // ...
  }
}
```

### 4. 步骤间结果传递机制（关键）

```typescript
// 支持动态参数解析
const resolveDynamicArgs = (args: any, previousSteps: AgentStep[]): any => {
  // 支持 {{step1.result.jobs[0].id}} 这样的引用
  // 支持 {{memory.userProfile}} 这样的内存引用
};
```

---

## 📊 接入评估矩阵

| 工具 | 接入难度 | 业务价值 | 规划适用性 | 推荐接入 |
|------|---------|---------|-----------|---------|
| `search_jobs_by_company` | ⭐⭐ 低 | ⭐⭐⭐⭐ 高 | ⭐⭐⭐⭐ 高 | ✅ 推荐 |
| `tailor_resume` | ⭐⭐⭐⭐ 高* | ⭐⭐⭐⭐⭐ 极高 | ⭐⭐⭐⭐⭐ 极高 | ✅ 推荐* |
| `career_transition_advice` | ⭐⭐⭐ 中 | ⭐⭐⭐⭐ 高 | ⭐⭐⭐⭐ 高 | ✅ 推荐 |
| `career_skill_gap_analysis` | ⭐⭐⭐ 中 | ⭐⭐⭐⭐ 高 | ⭐⭐⭐⭐ 高 | ✅ 推荐 |
| `career_path_explorer` | ⭐⭐⭐ 中 | ⭐⭐⭐ 中 | ⭐⭐⭐ 中 | ⚠️ 可选 |
| `get_user_applications` | ⭐⭐ 低 | ⭐⭐ 低 | ⭐⭐ 低 | ⚠️ 可选 |
| `refine_recommendations` | ⭐⭐ 低 | ⭐⭐⭐ 中 | ⭐ 低 | ❌ 不推荐 |
| `job_alert` | ⭐⭐ 低 | ⭐⭐⭐ 中 | ⭐ 低 | ❌ 不推荐 |
| `build_search_links` | ⭐ 极低 | ⭐ 低 | ⭐ 低 | ❌ 不推荐 |

*`tailor_resume` 需要先实现步骤间结果传递机制

---

## 🎯 最终建议（务实版）

### 核心判断标准

**接入 AgentKit 的前提**：
1. ✅ **需要意图判断** - 用户可能说多种话，但指向同一个工具
2. ✅ **需要参数提取** - AgentKit 可以从用户消息中提取参数
3. ✅ **改动成本低** - 不需要引入外部依赖或复杂机制

**不接入的理由**：
1. ❌ **外部 API 风险** - 依赖不稳定外部服务的工具
2. ❌ **意图过于明确** - 用户已经明确说要做什么，不需要规划
3. ❌ **需要复杂机制** - 需要步骤间结果传递等复杂功能

---

### 推荐接入：仅 1 个工具

#### ✅ `search_jobs_by_company` - **推荐接入**

**理由**：
- ✅ **需要意图判断**：用户可能说"我想在 Google 工作"或"搜索 Google 职位"或"jobs at Google"
- ✅ **参数提取价值**：AgentKit 可以从模糊表达中提取 company、city、job_title
- ✅ **改动成本低**：只需要在 MCPToolExecutor 中实现一个方法，复用现有逻辑
- ✅ **规划价值**：可以与其他工具组合规划（虽然当前不需要）

**实现成本**：⭐ 极低（约 1-2 小时）
- 在 `MCPToolExecutor` 中添加 `executeSearchJobsByCompany()`（复用现有 MCP 逻辑）
- 在 `AgentKitExecutor.executeTool()` 中添加一个 case
- 在 `AgentKitPlanner` 中识别 company_search 意图

---

### ❌ 明确不接入的工具（8个）

1. **`career_transition_advice`** - 外部 API 风险高
2. **`career_path_explorer`** - 外部 API 风险高
3. **`career_skill_gap_analysis`** - 外部 API 风险高
4. **`tailor_resume`** - 意图明确，不需要规划（用户已经知道要定制哪个职位）
5. **`refine_recommendations`** - 迭代反馈场景，不适合规划
6. **`job_alert`** - 定时任务，不适合规划
7. **`build_search_links`** - 辅助工具，不需要规划
8. **`get_user_applications`** - 数据查询工具，不需要规划

---

### 📊 最终方案

| 工具 | 接入决定 | 理由 |
|------|---------|------|
| `recommend_jobs` | ✅ 已接入 | 核心规划工具 |
| `search_jobs` | ✅ 已接入 | 核心规划工具 |
| `search_jobs_by_company` | ✅ **建议接入** | 需要意图判断，改动成本低 |
| 其他 8 个工具 | ❌ 不接入 | 外部风险高 或 意图明确 或 不适合规划 |

---

### 🚀 实施建议

**最小改动方案**：只接入 `search_jobs_by_company`

**实施步骤**（预计 1-2 小时）：
1. 在 `MCPToolExecutor` 中添加方法（复用现有 MCP route 逻辑）
2. 在 `AgentKitExecutor.executeTool()` 中添加 case 分支
3. 在 `AgentKitPlanner.generateSteps()` 中识别 company_search 意图

**预期收益**：
- ✅ AgentKit 可以处理"我想在 X 公司工作"这类表达
- ✅ 从模糊表达中提取参数（company, city, job_title）
- ✅ 与现有 `recommend_jobs` 和 `search_jobs` 形成完整的搜索能力

**风险**：几乎为零（复用现有代码逻辑）

---

### 💡 总结

**务实结论**：只接入 1 个工具（`search_jobs_by_company`），其他工具保持现状。

**原因**：
- 这个工具真正需要 AgentKit 的意图判断能力
- 改动成本极低，几乎零风险
- 其他工具要么风险高（外部 API），要么意图太明确不需要规划
