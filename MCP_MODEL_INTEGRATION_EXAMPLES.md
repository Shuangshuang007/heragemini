# MCP 工具模型集成示例 - 不改动现有代码的实现方案

> **目标**：展示如何在不改动现有代码的情况下，接入 Kimi 2 Thinking 等新模型  
> **原则**：通过新文件和 feature flag 实现，完全不影响现有功能

---

## 🏗️ 架构设计：最小侵入式集成

### 设计原则

1. **新文件策略**：所有新模型代码放在新文件中
2. **Feature Flag**：通过环境变量控制使用哪个模型
3. **向后兼容**：默认使用现有 GPT 模型，新模型作为可选增强
4. **渐进式迁移**：可以逐个场景迁移，不影响其他场景

---

## 📁 文件结构（新增文件）

```
src/
├── utils/
│   ├── openaiClient.ts          # 现有文件（不改动）
│   ├── kimiClient.ts            # 🆕 Kimi 客户端
│   └── modelRouter.ts           # 🆕 模型路由器
│
├── gpt-services/
│   ├── careerTransition/
│   │   ├── kimiCareerTransition.ts  # 🆕 Kimi 实现
│   │   └── gptCareerTransition.ts   # 🆕 GPT 实现（从现有代码提取）
│   │
│   └── jobMatch/
│       ├── kimiMatchJob.ts      # 🆕 Kimi 实现
│       └── gptMatchJob.ts       # 现有文件（不改动）
│
└── app/api/mcp/
    └── route.ts                 # 现有文件（最小改动，添加 feature flag）
```

---

## 💻 代码示例

### 1. Kimi 客户端封装（新文件）

```typescript
// src/utils/kimiClient.ts

import OpenAI from 'openai';

/**
 * Kimi 2 Thinking 客户端
 * 使用 OpenAI SDK 兼容的 API 格式
 */
export function createKimiClient(apiKey?: string): OpenAI {
  const kimiApiKey = apiKey || process.env.KIMI_API_KEY;
  
  if (!kimiApiKey) {
    throw new Error('KIMI_API_KEY is not set');
  }
  
  return new OpenAI({
    apiKey: kimiApiKey,
    baseURL: 'https://api.moonshot.cn/v1', // Kimi API 地址（需要确认）
    defaultHeaders: {
      'Authorization': `Bearer ${kimiApiKey}`
    }
  });
}

/**
 * Kimi 2 Thinking 专用调用函数
 * 支持思维链推理和超长上下文
 */
export async function kimiChatCompletions(
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  options?: {
    enableThinking?: boolean;  // 是否启用思维链
    maxTokens?: number;         // 最大 tokens（Kimi 支持 200K+）
  }
): Promise<ReturnType<OpenAI['chat']['completions']['create']>> {
  const client = createKimiClient();
  
  // Kimi 2 Thinking 模型名称（需要确认）
  const model = options?.enableThinking 
    ? 'moonshot-v1-8k'  // 思维链模型（示例，需要确认实际名称）
    : 'moonshot-v1-8k'; // 标准模型
  
  const kimiParams = {
    ...params,
    model,
    max_tokens: options?.maxTokens || params.max_tokens || 8192,
  };
  
  try {
    const result = await client.chat.completions.create(kimiParams);
    console.log('[Kimi Client] Successfully called Kimi API');
    return result;
  } catch (error: any) {
    console.error('[Kimi Client] API call failed:', {
      message: error?.message,
      status: error?.status,
      error: error?.error
    });
    throw error;
  }
}
```

---

### 2. 模型路由器（新文件）

```typescript
// src/utils/modelRouter.ts

import { chatCompletionsWithFallback } from './openaiClient';
import { kimiChatCompletions } from './kimiClient';
import type OpenAI from 'openai';

/**
 * 模型选择策略
 */
export type ModelStrategy = 
  | 'openai-only'      // 仅使用 OpenAI（默认）
  | 'kimi-only'        // 仅使用 Kimi
  | 'kimi-primary'     // 优先 Kimi，失败回退 OpenAI
  | 'openai-primary'   // 优先 OpenAI，失败回退 Kimi
  | 'auto';            // 根据场景自动选择

/**
 * 场景类型
 */
export type ScenarioType = 
  | 'career_transition'    // 职业转换（深度思考）
  | 'refine_recommendations' // 推荐优化（理解反馈）
  | 'job_matching'         // 职位匹配（快速分析）
  | 'job_analysis'         // 职位分析（中等复杂度）
  | 'search_planning';     // 搜索规划（策略思考）

/**
 * 根据场景自动选择最佳模型
 */
export function getModelForScenario(scenario: ScenarioType): ModelStrategy {
  // 从环境变量读取配置，如果没有则使用默认策略
  const envStrategy = process.env.MODEL_STRATEGY as ModelStrategy | undefined;
  if (envStrategy) {
    return envStrategy;
  }
  
  // 默认策略：根据场景选择
  switch (scenario) {
    case 'career_transition':
    case 'refine_recommendations':
      return 'kimi-primary'; // 深度思考场景优先使用 Kimi
    case 'job_matching':
    case 'search_planning':
      return 'openai-primary'; // 快速场景优先使用 OpenAI
    default:
      return 'openai-only'; // 默认使用 OpenAI
  }
}

/**
 * 统一的模型调用接口
 * 根据策略自动选择模型和 fallback
 */
export async function callModelWithStrategy(
  params: Parameters<typeof chatCompletionsWithFallback>[1],
  scenario: ScenarioType,
  strategy?: ModelStrategy
): Promise<ReturnType<typeof chatCompletionsWithFallback>> {
  const selectedStrategy = strategy || getModelForScenario(scenario);
  
  console.log(`[ModelRouter] Scenario: ${scenario}, Strategy: ${selectedStrategy}`);
  
  switch (selectedStrategy) {
    case 'kimi-only':
      return await kimiChatCompletions(params, { enableThinking: true });
    
    case 'kimi-primary':
      try {
        return await kimiChatCompletions(params, { enableThinking: true });
      } catch (error) {
        console.warn('[ModelRouter] Kimi failed, falling back to OpenAI');
        return await chatCompletionsWithFallback(
          // 需要创建 OpenAI client
          // 这里简化，实际需要传入 client
          params as any,
          'gemini-2.0-flash-exp'
        );
      }
    
    case 'openai-primary':
      try {
        return await chatCompletionsWithFallback(
          // 需要传入 OpenAI client
          params as any,
          'gemini-2.0-flash-exp'
        );
      } catch (error) {
        console.warn('[ModelRouter] OpenAI failed, falling back to Kimi');
        return await kimiChatCompletions(params, { enableThinking: false });
      }
    
    case 'openai-only':
    default:
      return await chatCompletionsWithFallback(
        params as any,
        'gemini-2.0-flash-exp'
      );
  }
}
```

---

### 3. Kimi 职业转换实现（新文件）

```typescript
// src/gpt-services/careerTransition/kimiCareerTransition.ts

import { kimiChatCompletions } from '../../../utils/kimiClient';

interface CareerTransitionRequest {
  current_job: string;
  experience_years: number;
  skills?: string[];
  industry?: string;
  location?: string;
  target_careers?: string[]; // 可选：用户指定的目标职业
}

interface CareerTransitionResult {
  recommended_careers: Array<{
    career_name: string;
    similarity_score: number;
    transition_difficulty: 'easy' | 'medium' | 'hard';
    skill_gaps: string[];
    skill_overlaps: string[];
    transition_path: string[];
    estimated_time: string;
    market_demand: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;
  analysis: {
    current_skill_profile: string;
    career_cluster: string;
    growth_potential: string;
  };
}

/**
 * 使用 Kimi 2 Thinking 进行职业转换分析
 * 
 * 优势：
 * - 超长上下文：可以一次性分析多个职业路径
 * - 思维链推理：多步骤分析（当前技能 → 目标技能 → 过渡路径）
 * - 深度理解：理解职业之间的关联性和过渡难度
 */
export async function careerTransitionWithKimi(
  request: CareerTransitionRequest
): Promise<CareerTransitionResult> {
  const prompt = buildCareerTransitionPrompt(request);
  
  const completion = await kimiChatCompletions(
    {
      model: 'moonshot-v1-8k', // Kimi 2 Thinking 模型（需要确认）
      messages: [
        {
          role: 'system',
          content: `You are an expert career advisor specializing in career transitions in the Australian job market.

Your task is to analyze career transition opportunities and provide detailed, actionable recommendations.

Guidelines:
- Consider real-world career progression paths and industry transitions
- Analyze skill gaps and overlaps between current and target roles
- Provide specific transition steps with estimated timeframes
- Consider market demand and growth potential
- Use your thinking process to reason through multiple career paths before making recommendations

Always return valid JSON format.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    },
    {
      enableThinking: true, // 启用思维链推理
      maxTokens: 4000
    }
  );
  
  // Type guard
  if (!('choices' in completion)) {
    throw new Error('Unexpected response type');
  }
  
  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from Kimi');
  }
  
  // 解析 JSON 响应
  try {
    return JSON.parse(response) as CareerTransitionResult;
  } catch (error) {
    // 如果解析失败，尝试提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CareerTransitionResult;
    }
    throw new Error('Failed to parse Kimi response');
  }
}

/**
 * 构建职业转换分析的 prompt
 */
function buildCareerTransitionPrompt(request: CareerTransitionRequest): string {
  return `Analyze career transition opportunities for the following profile:

Current Position: ${request.current_job}
Experience: ${request.experience_years} years
Skills: ${request.skills?.join(', ') || 'Not specified'}
Industry: ${request.industry || 'Not specified'}
Location: ${request.location || 'Not specified'}
${request.target_careers ? `Target Careers: ${request.target_careers.join(', ')}` : ''}

Please provide:
1. Recommended career transitions (5-10 options)
2. For each career:
   - Similarity score (0-100)
   - Transition difficulty (easy/medium/hard)
   - Skill gaps (what needs to be learned)
   - Skill overlaps (what transfers well)
   - Transition path (step-by-step)
   - Estimated time to transition
   - Market demand assessment
   - Detailed reasoning

3. Overall analysis:
   - Current skill profile summary
   - Career cluster identification
   - Growth potential assessment

Return the result as JSON with the following structure:
{
  "recommended_careers": [...],
  "analysis": {...}
}`;
}
```

---

### 4. MCP Route 集成（最小改动）

```typescript
// src/app/api/mcp/route.ts
// 只在 career_transition_advice 工具中添加 feature flag 控制

// ... 现有代码保持不变 ...

else if (name === "career_transition_advice") {
  const { 
    current_job, 
    experience_years, 
    skills = [], 
    industry, 
    location 
  } = args;
  
  // ✅ Feature Flag: 控制使用哪个模型实现
  const useKimi = process.env.USE_KIMI_FOR_CAREER_TRANSITION === 'true';
  
  try {
    let result;
    
    if (useKimi) {
      // 🆕 使用 Kimi 2 Thinking（新实现）
      const { careerTransitionWithKimi } = await import(
        '../../../gpt-services/careerTransition/kimiCareerTransition'
      );
      
      result = await careerTransitionWithKimi({
        current_job,
        experience_years,
        skills,
        industry,
        location
      });
      
      console.log('[MCP] career_transition_advice - Used Kimi 2 Thinking');
    } else {
      // ✅ 使用现有 GPT 实现（不改动）
      // ... 现有代码 ...
      result = await existingCareerTransitionLogic(args);
      
      console.log('[MCP] career_transition_advice - Used GPT');
    }
    
    // 格式化返回结果（统一格式）
    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        content: [{
          type: "text",
          text: formatCareerTransitionResult(result)
        }],
        isError: false
      }
    }, { "X-MCP-Trace-Id": traceId });
    
  } catch (error: any) {
    console.error('[MCP] career_transition_advice error:', { traceId, error });
    
    // ✅ Fallback: 如果 Kimi 失败，回退到 GPT
    if (useKimi) {
      console.warn('[MCP] Kimi failed, falling back to GPT');
      try {
        const { careerTransitionWithGPT } = await import(
          '../../../gpt-services/careerTransition/gptCareerTransition'
        );
        const fallbackResult = await careerTransitionWithGPT(args);
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "text",
              text: formatCareerTransitionResult(fallbackResult)
            }],
            isError: false
          }
        }, { "X-MCP-Trace-Id": traceId });
      } catch (fallbackError) {
        // 如果 GPT 也失败，返回错误
      }
    }
    
    // 返回错误响应
    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: {
        code: -32603,
        message: error.message || 'Internal error'
      }
    }, { "X-MCP-Trace-Id": traceId });
  }
}
```

---

## 🔧 环境变量配置

```bash
# .env.local（新增配置）

# Kimi API 配置
KIMI_API_KEY=your_kimi_api_key_here

# Feature Flags（控制使用哪个模型）
USE_KIMI_FOR_CAREER_TRANSITION=false  # 默认 false，使用 GPT
USE_KIMI_FOR_REFINE_RECOMMENDATIONS=false
USE_KIMI_FOR_JOB_MATCHING=false

# 模型策略（可选，如果不设置则使用默认策略）
MODEL_STRATEGY=auto  # auto | openai-only | kimi-only | kimi-primary | openai-primary
```

---

## 📊 A/B 测试方案

### 方案 1: 用户级别 A/B 测试

```typescript
// src/utils/abTestRouter.ts（新文件）

/**
 * 根据用户 ID 或 session ID 决定使用哪个模型
 * 50% 用户使用 Kimi，50% 用户使用 GPT
 */
export function shouldUseKimi(userId: string, scenario: string): boolean {
  // 简单的哈希函数，确保同一用户总是分配到同一组
  const hash = simpleHash(userId + scenario);
  return hash % 2 === 0; // 50% 概率
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
```

### 方案 2: 百分比灰度发布

```typescript
// 逐步增加使用 Kimi 的用户比例
export function shouldUseKimi(userId: string): boolean {
  const percentage = Number(process.env.KIMI_ROLLOUT_PERCENTAGE || '0');
  const hash = simpleHash(userId);
  return (hash % 100) < percentage;
}
```

---

## 📈 监控和日志

```typescript
// src/utils/modelMonitor.ts（新文件）

interface ModelCallMetrics {
  model: string;
  scenario: string;
  success: boolean;
  responseTime: number;
  tokensUsed?: number;
  error?: string;
}

/**
 * 记录模型调用指标
 */
export function logModelCall(metrics: ModelCallMetrics) {
  console.log('[ModelMonitor]', {
    timestamp: new Date().toISOString(),
    ...metrics
  });
  
  // 可以发送到监控系统（如 Datadog, New Relic）
  // sendToMonitoring(metrics);
}

/**
 * 在 MCP route 中使用
 */
async function callModelWithMonitoring(
  modelFn: () => Promise<any>,
  modelName: string,
  scenario: string
) {
  const startTime = Date.now();
  try {
    const result = await modelFn();
    const responseTime = Date.now() - startTime;
    
    logModelCall({
      model: modelName,
      scenario,
      success: true,
      responseTime
    });
    
    return result;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    logModelCall({
      model: modelName,
      scenario,
      success: false,
      responseTime,
      error: error.message
    });
    
    throw error;
  }
}
```

---

## ✅ 实施检查清单

### 阶段 1: 准备（不改动现有代码）
- [ ] 获取 Kimi API 密钥
- [ ] 测试 Kimi API 连接和响应格式
- [ ] 确认 Kimi 模型名称和参数
- [ ] 设计 feature flag 策略

### 阶段 2: 开发（新增文件）
- [ ] 创建 `src/utils/kimiClient.ts`
- [ ] 创建 `src/utils/modelRouter.ts`
- [ ] 创建 `src/gpt-services/careerTransition/kimiCareerTransition.ts`
- [ ] 在 MCP route 中添加 feature flag 控制（最小改动）

### 阶段 3: 测试
- [ ] 单元测试：Kimi 客户端
- [ ] 集成测试：MCP 工具调用
- [ ] A/B 测试：对比 Kimi vs GPT 效果
- [ ] 性能测试：响应时间、成本

### 阶段 4: 部署
- [ ] 设置环境变量（feature flag = false）
- [ ] 部署到 staging 环境
- [ ] 灰度发布（10% 用户）
- [ ] 监控指标，逐步扩大范围

---

## 🎯 总结

### 核心优势

1. **零风险**：不改动现有代码，新模型作为可选增强
2. **渐进式**：可以逐个场景迁移，不影响其他功能
3. **可回退**：如果新模型效果不好，可以立即关闭 feature flag
4. **可测试**：支持 A/B 测试，对比不同模型效果

### 下一步行动

1. **验证 Kimi API**：确认 API 地址、模型名称、定价
2. **实现第一个场景**：选择 `career_transition_advice` 作为试点
3. **A/B 测试**：对比 Kimi vs GPT 的效果
4. **逐步扩展**：如果效果好，扩展到其他场景

---

**文档版本**：v1.0  
**创建时间**：2025-01  
**状态**：示例代码，未实施



