# Kimi 2 Thinking 接入 career_transition_advice 实施计划

> **目标**：在 `career_transition_advice` 工具中接入 Kimi 2 Thinking，充分利用 MongoDB CareerSwitch 数据库数据  
> **原则**：不改动现有代码，通过新文件和 feature flag 实现

---

## 📋 当前状态分析

### 现有实现
- **位置**：`src/app/api/mcp/route.ts` (line 4230-4380)
- **当前方式**：调用外部 API (`http://149.28.175.142:3009/api/career/advice`)
- **数据源**：外部服务，可能使用 GPT 生成报告
- **返回格式**：Markdown 格式的职业转换建议报告

### 数据库资源
- **数据库名称**：`CareerSwitch`
- **需要探索的集合**：
  - 职业数据（job titles, career paths）
  - 技能数据（skills, skill gaps）
  - 转换路径数据（transition paths, similarity scores）
  - 市场数据（market demand, salary ranges）

---

## 🎯 实施目标

### 核心目标
1. **利用数据库数据**：从 CareerSwitch 数据库获取真实的职业转换数据
2. **Kimi 2 Thinking 增强**：使用 Kimi 的超长上下文和思维链推理能力
3. **零风险实施**：通过 feature flag 控制，可以随时回退

### 预期提升
- ✅ **数据驱动**：基于真实数据库数据，而非仅依赖模型知识
- ✅ **深度分析**：Kimi 2 Thinking 的多步骤推理能力
- ✅ **个性化**：结合用户画像和数据库中的历史转换案例
- ✅ **可扩展**：可以逐步添加更多数据维度

---

## 🏗️ 架构设计

### 文件结构（新增文件）

```
src/
├── utils/
│   ├── kimiClient.ts                    # 🆕 Kimi 客户端封装
│   └── modelRouter.ts                   # 🆕 模型路由器（可选）
│
├── services/
│   └── careerSwitch/
│       ├── careerSwitchDBService.ts      # 🆕 CareerSwitch 数据库服务
│       └── careerDataEnricher.ts        # 🆕 数据增强器（准备给 Kimi 的数据）
│
├── gpt-services/
│   └── careerTransition/
│       ├── kimiCareerTransition.ts      # 🆕 Kimi 实现（主要逻辑）
│       └── promptBuilder.ts             # 🆕 Prompt 构建器（利用数据库数据）
│
└── app/api/mcp/
    └── route.ts                         # 最小改动：添加 feature flag
```

---

## 📊 数据流程设计

### 流程 1: 数据准备阶段

```
用户请求
  ↓
1. 从 CareerSwitch 数据库查询相关数据
   - 当前职业的相关数据
   - 可能的转换目标职业
   - 技能差距数据
   - 历史转换案例（如果有）
   ↓
2. 数据增强和格式化
   - 提取关键信息
   - 构建结构化数据
   - 准备上下文数据
   ↓
3. 构建 Kimi Prompt
   - 包含数据库查询结果
   - 包含用户输入
   - 包含分析指令
```

### 流程 2: Kimi 分析阶段

```
Kimi 2 Thinking 分析
  ↓
1. 理解用户当前状态（从数据库数据中提取）
2. 分析可能的转换路径（基于数据库中的职业关系）
3. 评估技能差距（结合数据库技能数据）
4. 生成个性化建议（利用数据库中的市场数据）
  ↓
返回结构化结果
```

---

## 💻 代码实现

### 1. CareerSwitch 数据库服务

```typescript
// src/services/careerSwitch/careerSwitchDBService.ts

import { getDb } from '@/lib/db/mongoClient';

interface CareerData {
  currentJob: string;
  targetJobs: Array<{
    jobTitle: string;
    similarity: number;
    sharedSkills: string[];
    skillsToLearn: string[];
    transitionDifficulty: 'easy' | 'medium' | 'hard';
    marketDemand?: 'high' | 'medium' | 'low';
    avgSalary?: number;
  }>;
  skillGaps: Array<{
    skill: string;
    importance: 'high' | 'medium' | 'low';
    learningResources?: string[];
  }>;
  marketInsights?: {
    demandTrend: 'increasing' | 'stable' | 'decreasing';
    growthRate?: number;
  };
}

/**
 * 从 CareerSwitch 数据库获取职业转换数据
 */
export async function getCareerTransitionData(
  currentJob: string,
  experienceYears: number,
  skills?: string[],
  industry?: string,
  location?: string
): Promise<CareerData | null> {
  const db = await getDb('CareerSwitch');
  
  try {
    // 1. 查询当前职业的相关数据
    const currentJobData = await db.collection('jobs').findOne({
      title: { $regex: new RegExp(currentJob, 'i') }
    });
    
    // 2. 查询可能的转换目标（基于相似度或技能匹配）
    const targetJobs = await db.collection('career_transitions').find({
      from: { $regex: new RegExp(currentJob, 'i') }
    }).limit(20).toArray();
    
    // 3. 查询技能差距数据
    const skillGaps = await db.collection('skill_gaps').find({
      fromJob: { $regex: new RegExp(currentJob, 'i') }
    }).toArray();
    
    // 4. 查询市场数据（如果有）
    const marketData = await db.collection('market_insights').findOne({
      jobTitle: { $regex: new RegExp(currentJob, 'i') },
      location: location || { $exists: false }
    });
    
    // 5. 构建返回数据
    return {
      currentJob,
      targetJobs: targetJobs.map(t => ({
        jobTitle: t.to,
        similarity: t.similarity || 0,
        sharedSkills: t.sharedSkills || [],
        skillsToLearn: t.skillsToLearn || [],
        transitionDifficulty: t.difficulty || 'medium',
        marketDemand: t.marketDemand,
        avgSalary: t.avgSalary
      })),
      skillGaps: skillGaps.map(s => ({
        skill: s.skill,
        importance: s.importance || 'medium',
        learningResources: s.learningResources || []
      })),
      marketInsights: marketData ? {
        demandTrend: marketData.demandTrend,
        growthRate: marketData.growthRate
      } : undefined
    };
    
  } catch (error) {
    console.error('[CareerSwitchDB] Error querying database:', error);
    return null;
  }
}

/**
 * 查询职业相似度数据
 */
export async function getJobSimilarity(
  fromJob: string,
  toJob: string
): Promise<number | null> {
  const db = await getDb('CareerSwitch');
  
  try {
    const result = await db.collection('career_transitions').findOne({
      from: { $regex: new RegExp(fromJob, 'i') },
      to: { $regex: new RegExp(toJob, 'i') }
    });
    
    return result?.similarity || null;
  } catch (error) {
    console.error('[CareerSwitchDB] Error querying similarity:', error);
    return null;
  }
}
```

---

### 2. Kimi 客户端封装

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
  
  // Kimi 2 Thinking 模型名称（需要确认实际名称）
  const model = options?.enableThinking 
    ? 'moonshot-v1-8k'  // 思维链模型（示例）
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

### 3. Prompt 构建器（利用数据库数据）

```typescript
// src/gpt-services/careerTransition/promptBuilder.ts

import { CareerData } from '@/services/careerSwitch/careerSwitchDBService';

/**
 * 构建包含数据库数据的 Kimi Prompt
 */
export function buildCareerTransitionPrompt(
  userInput: {
    current_job: string;
    experience_years: number;
    skills?: string[];
    industry?: string;
    location?: string;
  },
  dbData: CareerData | null
): string {
  let prompt = `You are an expert career advisor specializing in career transitions in the Australian job market.

Analyze career transition opportunities for the following profile:

**Current Position:** ${userInput.current_job}
**Experience:** ${userInput.experience_years} years
${userInput.skills ? `**Skills:** ${userInput.skills.join(', ')}` : ''}
${userInput.industry ? `**Industry:** ${userInput.industry}` : ''}
${userInput.location ? `**Location:** ${userInput.location}` : ''}

`;

  // 如果数据库有数据，添加到 prompt
  if (dbData) {
    prompt += `\n## Database Insights (Real Career Transition Data)\n\n`;
    
    if (dbData.targetJobs && dbData.targetJobs.length > 0) {
      prompt += `### Potential Career Transitions (from database):\n`;
      dbData.targetJobs.slice(0, 10).forEach((job, idx) => {
        prompt += `${idx + 1}. **${job.jobTitle}**\n`;
        prompt += `   - Similarity: ${Math.round(job.similarity * 100)}%\n`;
        prompt += `   - Shared Skills: ${job.sharedSkills.slice(0, 5).join(', ')}\n`;
        prompt += `   - Skills to Learn: ${job.skillsToLearn.slice(0, 5).join(', ')}\n`;
        prompt += `   - Difficulty: ${job.transitionDifficulty}\n`;
        if (job.marketDemand) {
          prompt += `   - Market Demand: ${job.marketDemand}\n`;
        }
        prompt += `\n`;
      });
    }
    
    if (dbData.skillGaps && dbData.skillGaps.length > 0) {
      prompt += `### Key Skill Gaps Identified:\n`;
      dbData.skillGaps.forEach(gap => {
        prompt += `- **${gap.skill}** (${gap.importance} priority)\n`;
        if (gap.learningResources && gap.learningResources.length > 0) {
          prompt += `  Resources: ${gap.learningResources.slice(0, 3).join(', ')}\n`;
        }
      });
      prompt += `\n`;
    }
    
    if (dbData.marketInsights) {
      prompt += `### Market Insights:\n`;
      prompt += `- Demand Trend: ${dbData.marketInsights.demandTrend}\n`;
      if (dbData.marketInsights.growthRate) {
        prompt += `- Growth Rate: ${dbData.marketInsights.growthRate}%\n`;
      }
      prompt += `\n`;
    }
  }
  
  prompt += `## Your Task

Using the database insights above and your expertise, provide a comprehensive career transition analysis:

1. **Recommended Career Transitions** (5-10 options):
   - For each career, provide:
     * Similarity score (0-100) and reasoning
     * Transition difficulty (easy/medium/hard) with explanation
     * Skill gaps (what needs to be learned)
     * Skill overlaps (what transfers well)
     * Step-by-step transition path
     * Estimated time to transition
     * Market demand assessment
     * Detailed reasoning for why this transition makes sense

2. **Overall Analysis**:
   - Current skill profile summary
   - Career cluster identification
   - Growth potential assessment
   - Risk factors and considerations

3. **Action Plan**:
   - Immediate steps (Week 1-4)
   - Short-term goals (Month 1-3)
   - Long-term strategy (3-6 months)

**Important:** 
- Use the database insights as a foundation, but enhance with your analysis
- Consider real-world career progression paths
- Provide specific, actionable advice
- Consider the Australian job market context

Return the result as JSON with the following structure:
{
  "recommended_careers": [
    {
      "career_name": "...",
      "similarity_score": 85,
      "transition_difficulty": "medium",
      "skill_gaps": ["..."],
      "skill_overlaps": ["..."],
      "transition_path": ["..."],
      "estimated_time": "3-6 months",
      "market_demand": "high",
      "reasoning": "..."
    }
  ],
  "analysis": {
    "current_skill_profile": "...",
    "career_cluster": "...",
    "growth_potential": "..."
  },
  "action_plan": {
    "immediate": ["..."],
    "short_term": ["..."],
    "long_term": ["..."]
  }
}`;

  return prompt;
}
```

---

### 4. Kimi 职业转换实现（主逻辑）

```typescript
// src/gpt-services/careerTransition/kimiCareerTransition.ts

import { kimiChatCompletions } from '@/utils/kimiClient';
import { getCareerTransitionData } from '@/services/careerSwitch/careerSwitchDBService';
import { buildCareerTransitionPrompt } from './promptBuilder';

interface CareerTransitionRequest {
  current_job: string;
  experience_years: number;
  skills?: string[];
  industry?: string;
  location?: string;
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
  action_plan: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };
}

/**
 * 使用 Kimi 2 Thinking 进行职业转换分析
 * 充分利用 CareerSwitch 数据库数据
 */
export async function careerTransitionWithKimi(
  request: CareerTransitionRequest
): Promise<CareerTransitionResult> {
  console.log('[KimiCareerTransition] Starting analysis for:', request.current_job);
  
  // Step 1: 从数据库获取数据
  const dbData = await getCareerTransitionData(
    request.current_job,
    request.experience_years,
    request.skills,
    request.industry,
    request.location
  );
  
  if (dbData) {
    console.log('[KimiCareerTransition] Database data retrieved:', {
      targetJobsCount: dbData.targetJobs.length,
      skillGapsCount: dbData.skillGaps.length
    });
  } else {
    console.warn('[KimiCareerTransition] No database data found, using Kimi only');
  }
  
  // Step 2: 构建包含数据库数据的 prompt
  const prompt = buildCareerTransitionPrompt(request, dbData);
  
  // Step 3: 调用 Kimi 2 Thinking
  const completion = await kimiChatCompletions(
    {
      model: 'moonshot-v1-8k', // Kimi 2 Thinking 模型（需要确认）
      messages: [
        {
          role: 'system',
          content: `You are an expert career advisor specializing in career transitions in the Australian job market.

Your task is to analyze career transition opportunities and provide detailed, actionable recommendations.

Guidelines:
- Use the provided database insights as a foundation
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
  
  // Step 4: 解析响应
  if (!('choices' in completion)) {
    throw new Error('Unexpected response type');
  }
  
  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from Kimi');
  }
  
  // 解析 JSON 响应
  try {
    const result = JSON.parse(response) as CareerTransitionResult;
    console.log('[KimiCareerTransition] Analysis completed:', {
      careersCount: result.recommended_careers.length
    });
    return result;
  } catch (error) {
    // 如果解析失败，尝试提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CareerTransitionResult;
    }
    throw new Error('Failed to parse Kimi response');
  }
}
```

---

### 5. MCP Route 集成（最小改动）

```typescript
// src/app/api/mcp/route.ts
// 只在 career_transition_advice 工具中添加 feature flag 控制

// ... 现有代码保持不变 ...

else if (name === "career_transition_advice") {
  const traceId = crypto.randomUUID();
  const { current_job, experience_years, skills, industry, location } = args;

  console.log('[MCP] career_transition_advice - Input:', { 
    current_job, 
    experience_years, 
    skills, 
    industry, 
    location 
  });

  // ✅ Feature Flag: 控制使用哪个模型实现
  const useKimi = process.env.USE_KIMI_FOR_CAREER_TRANSITION === 'true';

  try {
    let result;
    let markdownReport: string;

    if (useKimi) {
      // 🆕 使用 Kimi 2 Thinking（新实现）
      const { careerTransitionWithKimi } = await import(
        '../../../gpt-services/careerTransition/kimiCareerTransition'
      );
      
      const kimiResult = await careerTransitionWithKimi({
        current_job,
        experience_years,
        skills,
        industry,
        location
      });
      
      // 格式化 Kimi 结果为 Markdown
      markdownReport = formatKimiResultAsMarkdown(kimiResult);
      
      console.log('[MCP] career_transition_advice - Used Kimi 2 Thinking');
    } else {
      // ✅ 使用现有实现（不改动）
      const mcpCareerUrl = process.env.MCP_CAREER_URL || process.env.CAREER_SWITCH_API_URL || 'http://149.28.175.142:3009';
      const isVercelProxy = mcpCareerUrl.includes('/api/career-advice');
      const targetUrl = isVercelProxy ? mcpCareerUrl : `${mcpCareerUrl}/api/career/advice`;

      const requestBody = {
        mode: "report",
        currentJob: current_job ?? null,
        experience: experience_years ?? null,
        skills: skills ?? null,
        industry: industry ?? null,
        location: location ?? null,
      };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': traceId
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      // 使用现有的格式化逻辑
      markdownReport = formatExistingResultAsMarkdown(data);
      
      console.log('[MCP] career_transition_advice - Used existing API');
    }
    
    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        content: [{
          type: "text",
          text: markdownReport
        }],
        isError: false
      }
    }, { "X-MCP-Trace-Id": traceId });
    
  } catch (error: any) {
    console.error('[MCP] career_transition_advice error:', { traceId, error });
    
    // ✅ Fallback: 如果 Kimi 失败，回退到现有实现
    if (useKimi) {
      console.warn('[MCP] Kimi failed, falling back to existing API');
      try {
        // 调用现有 API 作为 fallback
        const mcpCareerUrl = process.env.MCP_CAREER_URL || process.env.CAREER_SWITCH_API_URL || 'http://149.28.175.142:3009';
        const isVercelProxy = mcpCareerUrl.includes('/api/career-advice');
        const targetUrl = isVercelProxy ? mcpCareerUrl : `${mcpCareerUrl}/api/career/advice`;

        const requestBody = {
          mode: "report",
          currentJob: current_job ?? null,
          experience: experience_years ?? null,
          skills: skills ?? null,
          industry: industry ?? null,
          location: location ?? null,
        };

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': traceId
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        const data = JSON.parse(responseText);
        const markdownReport = formatExistingResultAsMarkdown(data);
        
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "text",
              text: markdownReport
            }],
            isError: false
          }
        }, { "X-MCP-Trace-Id": traceId });
      } catch (fallbackError) {
        // 如果 fallback 也失败，返回错误
      }
    }
    
    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        content: [{
          type: "text",
          text: `Failed to get career transition advice: ${error.message}`
        }],
        isError: false
      }
    }, { "X-MCP-Trace-Id": traceId });
  }
}

/**
 * 格式化 Kimi 结果为 Markdown
 */
function formatKimiResultAsMarkdown(result: any): string {
  let markdown = `# 🎯 Career Transition Recommendations\n\n`;
  markdown += `*Generated using Kimi 2 Thinking with database insights*\n\n`;
  
  // Analysis section
  if (result.analysis) {
    markdown += `## 📊 Career Analysis\n\n`;
    if (result.analysis.current_skill_profile) {
      markdown += `**Current Skill Profile:** ${result.analysis.current_skill_profile}\n\n`;
    }
    if (result.analysis.career_cluster) {
      markdown += `**Career Cluster:** ${result.analysis.career_cluster}\n\n`;
    }
    if (result.analysis.growth_potential) {
      markdown += `**Growth Potential:** ${result.analysis.growth_potential}\n\n`;
    }
  }
  
  // Recommended careers
  if (result.recommended_careers && result.recommended_careers.length > 0) {
    markdown += `## 💼 Recommended Career Transitions\n\n`;
    result.recommended_careers.forEach((career: any, index: number) => {
      markdown += `### ${index + 1}. ${career.career_name}\n\n`;
      markdown += `**Similarity:** ${career.similarity_score}% | `;
      markdown += `**Difficulty:** ${career.transition_difficulty} | `;
      markdown += `**Market Demand:** ${career.market_demand} | `;
      markdown += `**Timeline:** ${career.estimated_time}\n\n`;
      
      if (career.skill_overlaps && career.skill_overlaps.length > 0) {
        markdown += `**Shared Skills:** ${career.skill_overlaps.slice(0, 5).join(', ')}\n\n`;
      }
      
      if (career.skill_gaps && career.skill_gaps.length > 0) {
        markdown += `**Skills to Learn:** ${career.skill_gaps.slice(0, 5).join(', ')}\n\n`;
      }
      
      if (career.transition_path && career.transition_path.length > 0) {
        markdown += `**Transition Path:**\n`;
        career.transition_path.forEach((step: string, idx: number) => {
          markdown += `${idx + 1}. ${step}\n`;
        });
        markdown += `\n`;
      }
      
      if (career.reasoning) {
        markdown += `**Reasoning:** ${career.reasoning}\n\n`;
      }
      
      markdown += `---\n\n`;
    });
  }
  
  // Action plan
  if (result.action_plan) {
    markdown += `## 📋 Action Plan\n\n`;
    
    if (result.action_plan.immediate && result.action_plan.immediate.length > 0) {
      markdown += `### Immediate Steps (Week 1-4)\n`;
      result.action_plan.immediate.forEach((step: string) => {
        markdown += `• ${step}\n`;
      });
      markdown += `\n`;
    }
    
    if (result.action_plan.short_term && result.action_plan.short_term.length > 0) {
      markdown += `### Short-term Goals (Month 1-3)\n`;
      result.action_plan.short_term.forEach((step: string) => {
        markdown += `• ${step}\n`;
      });
      markdown += `\n`;
    }
    
    if (result.action_plan.long_term && result.action_plan.long_term.length > 0) {
      markdown += `### Long-term Strategy (3-6 months)\n`;
      result.action_plan.long_term.forEach((step: string) => {
        markdown += `• ${step}\n`;
      });
      markdown += `\n`;
    }
  }
  
  return markdown;
}
```

---

## 🔧 环境变量配置

```bash
# .env.local（新增配置）

# Kimi API 配置
KIMI_API_KEY=your_kimi_api_key_here

# Feature Flag（控制使用哪个模型）
USE_KIMI_FOR_CAREER_TRANSITION=false  # 默认 false，使用现有 API

# MongoDB 配置（如果 CareerSwitch 在不同数据库）
MONGODB_URI=mongodb://your_mongodb_uri
MONGODB_DB=CareerSwitch  # CareerSwitch 数据库名称
```

---

## 📊 数据库集合结构（需要确认）

### 假设的集合结构

1. **`jobs`** - 职业基本信息
   ```json
   {
     "_id": ObjectId,
     "title": "Software Engineer",
     "industry": "Technology",
     "skills": ["JavaScript", "React", "Node.js"],
     "avgSalary": 120000,
     "marketDemand": "high"
   }
   ```

2. **`career_transitions`** - 职业转换关系
   ```json
   {
     "_id": ObjectId,
     "from": "Software Engineer",
     "to": "Product Manager",
     "similarity": 0.75,
     "sharedSkills": ["Problem Solving", "Communication"],
     "skillsToLearn": ["Product Strategy", "User Research"],
     "difficulty": "medium",
     "transitionTime": "6-12 months"
   }
   ```

3. **`skill_gaps`** - 技能差距数据
   ```json
   {
     "_id": ObjectId,
     "fromJob": "Software Engineer",
     "toJob": "Product Manager",
     "skill": "Product Strategy",
     "importance": "high",
     "learningResources": ["Course A", "Book B"]
   }
   ```

4. **`market_insights`** - 市场数据
   ```json
   {
     "_id": ObjectId,
     "jobTitle": "Product Manager",
     "location": "Sydney",
     "demandTrend": "increasing",
     "growthRate": 15,
     "avgSalary": 140000
   }
   ```

---

## ✅ 实施检查清单

### 阶段 1: 准备（1-2 天）
- [ ] 获取 Kimi API 密钥
- [ ] 确认 Kimi API 地址和模型名称
- [ ] 探索 CareerSwitch 数据库结构（运行 `scripts/explore-careerswitch-db.js`）
- [ ] 确认数据库集合名称和字段结构
- [ ] 设计数据库查询逻辑

### 阶段 2: 开发（2-3 天）
- [ ] 创建 `src/utils/kimiClient.ts`
- [ ] 创建 `src/services/careerSwitch/careerSwitchDBService.ts`
- [ ] 创建 `src/gpt-services/careerTransition/promptBuilder.ts`
- [ ] 创建 `src/gpt-services/careerTransition/kimiCareerTransition.ts`
- [ ] 在 MCP route 中添加 feature flag 控制（最小改动）

### 阶段 3: 测试（1-2 天）
- [ ] 单元测试：Kimi 客户端
- [ ] 单元测试：数据库服务
- [ ] 集成测试：完整的 career_transition_advice 流程
- [ ] A/B 测试：对比 Kimi vs 现有 API 效果

### 阶段 4: 部署（1 天）
- [ ] 设置环境变量（feature flag = false）
- [ ] 部署到 staging 环境
- [ ] 灰度发布（10% 用户）
- [ ] 监控指标，逐步扩大范围

---

## 🎯 下一步行动

1. **探索数据库**：运行 `scripts/explore-careerswitch-db.js` 确认数据结构
2. **获取 Kimi API**：确认 API 密钥、地址、模型名称
3. **实施开发**：按照检查清单逐步实施
4. **测试验证**：A/B 测试对比效果

---

**文档版本**：v1.0  
**创建时间**：2025-12-30  
**状态**：实施计划，待执行



