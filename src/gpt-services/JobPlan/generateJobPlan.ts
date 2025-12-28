import OpenAI from 'openai';

// 用户Profile接口
export interface UserProfile {
  resume?: string;
  targetTitle: string;
  city: string;
  skills?: string[];
  experience?: string;
  education?: string;
  careerPriorities?: string[];
  seniority?: string;
  openForRelocation?: boolean;
}

// GPT推荐结果接口
export interface JobPlanResult {
  primaryTitles: string[];
  secondaryTitles: string[];
  summarySentences: string[];
  reasoning: string;
  searchStrategy: {
    platforms: string[];
    keywords: string[];
    priorityOrder: string[];
    searchDescription: string;
  };
  confidence: number;
}

// Job Plan GPT API Key 优先级说明：
// 1. 优先读取 JOB_PLAN_OPENAI_API_KEY
// 2. 若未设置，则回退到 OPENAI_API_KEY
const jobPlanApiKey = process.env.JOB_PLAN_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

import { createOpenAIClient, chatCompletionsWithFallback } from '../../utils/openaiClient';

const openai = createOpenAIClient({
  apiKey: jobPlanApiKey,
  baseURL: 'https://api.openai.com/v1',
});

/**
 * 生成职位搜索计划
 * @param profile 用户Profile信息
 * @returns 职位推荐和搜索策略
 */
export async function generateJobPlanFromGPT(profile: UserProfile): Promise<JobPlanResult> {
  try {
    // 构建GPT Prompt
    const prompt = buildJobPlanPrompt(profile);
    
    console.log('[JobPlan] Sending request to GPT with profile:', {
      targetTitle: profile.targetTitle,
      city: profile.city,
      skillsCount: profile.skills?.length || 0
    });

    const completion = await chatCompletionsWithFallback(
      openai,
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert job search consultant specializing in the Australian job market.

Your task is to analyze user profiles and recommend relevant job titles for search.

🔒 Guidelines:
- Focus on Australian job market terminology and platform conventions
- Strongly prioritise **semantic similarity of job function**, not just job title keywords
- Consider **real-world career progression paths**, especially within finance, tech, consulting, etc.
- Use **domain knowledge** to recommend natural transitions and adjacent roles
- **Avoid recommending roles with overlapping titles but divergent industries**

⚠️ Common traps to avoid:
- A Software Engineer in IT should not be matched to a Civil Engineer or Mechanical Engineer
- An IT Project Manager is very different from a Construction or Healthcare Project Manager
- An Investment Banker should not be matched to a Commercial Banker or Retail Branch Manager
- A Product Manager in e-commerce is different from a Product Manager in manufacturing

✅ Instead, prioritise:
- Functionally adjacent roles (e.g. Software Engineer → Full Stack Developer → Backend Engineer)
- Realistic industry transitions (e.g. Investment Banker → M&A Analyst → Private Equity Analyst)
- Skill-aligned roles based on tech stack, tools, and methodologies`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.7,
      },
      'gemini-2.0-flash-exp'
    );

    // Type guard: ensure completion is ChatCompletion, not Stream
    if (!('choices' in completion)) {
      throw new Error('Unexpected response type: expected ChatCompletion');
    }

    let response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from GPT');
    }

    // 清理响应：移除 markdown 代码块标记
    response = response.replace(/^```json\s*|```$/g, '').trim();
    
    // 尝试提取 JSON 部分（如果响应包含其他文本）
    let jsonText = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const result = JSON.parse(jsonText) as JobPlanResult;
    
    console.log('[JobPlan] GPT response received:', {
      primaryTitles: result.primaryTitles?.length || 0,
      secondaryTitles: result.secondaryTitles?.length || 0,
      confidence: result.confidence
    });

    // 验证和清理结果
    return validateAndCleanResult(result);
    
  } catch (error) {
    console.error('[JobPlan] Error generating job plan:', error);
    
    // 返回fallback结果
    return getFallbackJobPlan(profile);
  }
}

/**
 * 构建GPT Prompt
 */
function buildJobPlanPrompt(profile: UserProfile): string {
  const skillsText = profile.skills?.length ? profile.skills.join(', ') : 'Not specified';
  const experienceText = profile.experience || 'Not specified';
  const educationText = profile.education || 'Not specified';
  const prioritiesText = profile.careerPriorities?.length ? profile.careerPriorities.join(', ') : 'Not specified';
  const seniorityText = profile.seniority || 'Not specified';
  const relocationText = profile.openForRelocation ? 'Yes' : 'No';

  return `Analyze this user profile and recommend job titles for search:

User Profile:
- Target Job Title: ${profile.targetTitle}
- City: ${profile.city}
- Skills: ${skillsText}
- Experience Level: ${experienceText}
- Education: ${educationText}
- Career Priorities: ${prioritiesText}
- Seniority: ${seniorityText}
- Open for Relocation: ${relocationText}

Please provide a JSON response with the following structure:
{
  "primaryTitles": ["3-4 most relevant job titles"],
  "secondaryTitles": ["5-8 alternative job titles"],
  "summarySentences": [
    "Brief explanation of the recommendation strategy",
    "Why these roles are suitable",
    "Search approach and platforms to use"
  ],
  "reasoning": "Detailed explanation of why these job titles were chosen",
  "searchStrategy": {
    "platforms": ["CorporateDirect", "SEEK", "LinkedIn", "Adzuna", "Jora"],
    "keywords": ["key search terms"],
    "priorityOrder": ["order of search priority"],
    "searchDescription": "Among your primary targets, I will prioritise jobs directly posted on corporate career portals — i.e., Corporate Direct Jobs. I will also search all relevant jobs across major platforms including SEEK, LinkedIn, Adzuna, and Jora."
  },
  "confidence": 85
}

Focus on:
1. Australian job market terminology
2. Skill transferability
3. Market demand in ${profile.city}
4. Career progression opportunities
5. Role variations and alternative titles`;
}

/**
 * 验证和清理GPT结果
 */
function validateAndCleanResult(result: any): JobPlanResult {
  // 确保必要字段存在
  const cleaned: JobPlanResult = {
    primaryTitles: Array.isArray(result.primaryTitles) ? result.primaryTitles : [],
    secondaryTitles: Array.isArray(result.secondaryTitles) ? result.secondaryTitles : [],
    summarySentences: Array.isArray(result.summarySentences) ? result.summarySentences : [],
    reasoning: result.reasoning || 'Analysis completed',
    searchStrategy: {
      platforms: Array.isArray(result.searchStrategy?.platforms) ? result.searchStrategy.platforms : ['CorporateDirect', 'SEEK', 'LinkedIn', 'Adzuna', 'Jora'],
      keywords: Array.isArray(result.searchStrategy?.keywords) ? result.searchStrategy.keywords : [],
      priorityOrder: Array.isArray(result.searchStrategy?.priorityOrder) ? result.searchStrategy.priorityOrder : [],
      searchDescription: result.searchStrategy?.searchDescription || "Among your primary targets, I will prioritise jobs directly posted on corporate career portals — i.e., Corporate Direct Jobs. I will also search all relevant jobs across major platforms including SEEK, LinkedIn, Adzuna, and Jora."
    },
    confidence: typeof result.confidence === 'number' ? result.confidence : 75
  };

  // 确保至少有一个主要职位
  if (cleaned.primaryTitles.length === 0) {
    cleaned.primaryTitles = [result.targetTitle || 'Software Engineer'];
  }

  // 确保有摘要
  if (cleaned.summarySentences.length === 0) {
    cleaned.summarySentences = [
      `Based on your profile, we recommend searching for ${cleaned.primaryTitles.join(', ')} roles.`,
      'These positions align with your skills and experience level.',
      'We will search across multiple platforms to find the best opportunities.'
    ];
  }

  return cleaned;
}

/**
 * Fallback职位计划（当GPT不可用时）
 */
function getFallbackJobPlan(profile: UserProfile): JobPlanResult {
  console.log('[JobPlan] Using fallback job plan');
  
  const baseTitle = profile.targetTitle || 'Software Engineer';
  const city = profile.city || 'Sydney';
  
  // 根据目标职位生成fallback推荐
  const fallbackTitles = generateFallbackTitles(baseTitle);
  
  return {
    primaryTitles: [baseTitle, ...fallbackTitles.primary],
    secondaryTitles: fallbackTitles.secondary,
    summarySentences: [
      `Based on your target role "${baseTitle}", we've expanded the search to include related positions.`,
      'This approach helps capture variations in job titles across different companies.',
      `We'll search for these roles in ${city} across multiple platforms.`
    ],
    reasoning: `Fallback recommendation based on target title "${baseTitle}" and location "${city}".`,
    searchStrategy: {
      platforms: ['CorporateDirect', 'SEEK', 'LinkedIn', 'Adzuna', 'Jora'],
      keywords: [baseTitle, ...fallbackTitles.primary],
      priorityOrder: [baseTitle, ...fallbackTitles.primary, ...fallbackTitles.secondary],
      searchDescription: "Among your primary targets, I will prioritise jobs directly posted on corporate career portals — i.e., Corporate Direct Jobs. I will also search all relevant jobs across major platforms including SEEK, LinkedIn, Adzuna, and Jora."
    },
    confidence: 60
  };
}

/**
 * 生成fallback职位标题
 */
function generateFallbackTitles(baseTitle: string): { primary: string[], secondary: string[] } {
  const titleVariations: Record<string, { primary: string[], secondary: string[] }> = {
    'Software Engineer': {
      primary: ['Full Stack Developer', 'Backend Developer', 'Software Developer'],
      secondary: ['Web Developer', 'Application Developer', 'Systems Developer']
    },
    'Data Scientist': {
      primary: ['Data Analyst', 'Machine Learning Engineer', 'Data Engineer'],
      secondary: ['Business Intelligence Analyst', 'Analytics Engineer', 'Research Scientist']
    },
    'Business Analyst': {
      primary: ['Product Analyst', 'Data Analyst', 'Systems Analyst'],
      secondary: ['Process Analyst', 'Requirements Analyst', 'Business Intelligence Analyst']
    },
    'Project Manager': {
      primary: ['Program Manager', 'Product Manager', 'Delivery Manager'],
      secondary: ['Scrum Master', 'Agile Coach', 'Technical Project Manager']
    },
    'Marketing Manager': {
      primary: ['Digital Marketing Manager', 'Brand Manager', 'Marketing Specialist'],
      secondary: ['Content Marketing Manager', 'Growth Marketing Manager', 'Marketing Coordinator']
    }
  };

  const normalizedTitle = baseTitle.toLowerCase();
  
  // 查找匹配的职位类型
  for (const [key, variations] of Object.entries(titleVariations)) {
    if (normalizedTitle.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedTitle)) {
      return variations;
    }
  }

  // 默认fallback
  return {
    primary: ['Developer', 'Specialist', 'Analyst'],
    secondary: ['Coordinator', 'Assistant', 'Consultant']
  };
}

/**
 * 测试GPT连接
 */
export async function testGPTConnection(): Promise<boolean> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: 'Test connection' }],
      max_tokens: 10,
    });
    
    console.log('[JobPlan] GPT connection test successful');
    return true;
  } catch (error) {
    console.error('[JobPlan] GPT connection test failed:', error);
    return false;
  }
} 