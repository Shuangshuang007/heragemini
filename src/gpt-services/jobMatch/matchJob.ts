import OpenAI from 'openai';
import { getLocationWeight } from '../../utils/greaterAreaMap';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
  defaultHeaders: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  }
});

interface JobMatchRequest {
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string[];
  jobLocation: string;
  // ✅ 新增字段（来自数据库）
  skillsMustHave?: string[];
  skillsNiceToHave?: string[];
  keyRequirements?: string[];
  highlights?: string[];
  workMode?: string;
  salary?: string;
  industry?: string;
  workRights?: {
    country?: string;
    requiresStatus?: string;
    sponsorship?: 'required' | 'available' | 'not_available' | 'unknown';
    citizenshipRequired?: boolean;
  };
  userProfile: {
    jobTitles: string[];
    skills: string[];
    city: string;
    seniority: string;
    openToRelocate: boolean;
    careerPriorities?: string[];
    expectedSalary?: string;
    currentPosition?: string;
    expectedPosition?: string;
    employmentHistory?: Array<{
      company: string;
      position: string;
    }>;
    workingRightsAU?: string;
    workingRightsOther?: string;
  };
}

// 判断用户类型
function determineUserType(userProfile: JobMatchRequest['userProfile']): 'opportunity' | 'fit' | 'neutral' {
  const careerPriorities = userProfile.careerPriorities || [];
  
  // 检查是否选择了机会型选项
  const opportunityPriorities = ['Company Reputation', 'Higher Compensation', 'Clear Promotion Pathways'];
  const hasOpportunityPriority = opportunityPriorities.some(priority => 
    careerPriorities.includes(priority)
  );
  
  // 检查是否选择了匹配型选项
  const fitPriorities = ['Work-Life Balance', 'Industry Fit', 'Functional Fit'];
  const hasFitPriority = fitPriorities.some(priority => 
    careerPriorities.includes(priority)
  );
  
  // 检查其他条件
  const isSeniorWithHighSalary = userProfile.seniority === 'Senior' && 
    userProfile.expectedSalary === 'Highest';
  
  const hasSignificantPositionJump = userProfile.currentPosition && 
    userProfile.expectedPosition &&
    ['Director', 'VP', 'C-level'].includes(userProfile.expectedPosition) &&
    ['Manager', 'Senior Manager'].includes(userProfile.currentPosition);
  
  // 判断用户类型
  if (hasOpportunityPriority || 
      (isSeniorWithHighSalary) || 
      (userProfile.openToRelocate && hasOpportunityPriority) ||
      hasSignificantPositionJump) {
    return 'opportunity';
  }
  
  if (careerPriorities.includes('Work-Life Balance') ||
      (careerPriorities.includes('Industry Fit') && careerPriorities.includes('Functional Fit')) ||
      (!hasOpportunityPriority && !userProfile.openToRelocate)) {
    return 'fit';
  }
  
  return 'neutral';
}

// 过滤公司历史年限，避免误提公司历史作为候选人经验
function isCompanyHistory(text: string): boolean {
  const companyHistoryPatterns = [
    /(our|we('|')?ve|company|organization|history|years of service|established in)\s+(over\s+)?\d{1,3}\s*(years|yrs|y)/i,
    /(over our|our \d{1,3}|for over \d{1,3}|we've been|established in)\s+\d{1,3}\s*(years|yrs|y)/i,
    /(company|organization|firm|business)\s+(with|of|having)\s+\d{1,3}\s*(years|yrs|y)/i,
    /(since|founded in|established in)\s+\d{4}/i,
    /(celebrating|marking)\s+\d{1,3}\s*(years|yrs|y)/i
  ];
  
  return companyHistoryPatterns.some(pattern => pattern.test(text));
}

// 过滤无效key requirement的工具函数
const INVALID_KEYWORDS = [
  'melbourne', 'sydney', 'australia', 'vic', 'nsw', 'location', 'experience',
  'team player', 'communication skills', 'customer care', 'multitasking', 'focus', 'commitment',
  'empathy', 'positive attitude', 'attitude', 'work ethic', 'adaptability', 'flexibility', 'problem solving', 'initiative', 'motivation', 'collaboration', 'interpersonal', 'punctuality', 'reliability', 'dependability', 'organization', 'organisational', 'time management', 'attention to detail', 'detail oriented', 'self-motivated', 'self starter', 'leadership', 'responsibility', 'creativity', 'critical thinking', 'willingness to learn', 'fast learner', 'passion', 'dedication', 'drive', 'energy', 'enthusiasm', 'integrity', 'trustworthy', 'respect', 'patience', 'work independently', 'work under pressure', 'work as part', 'work as a team', 'work collaboratively', 'work well with others', 'good attitude', 'good communication', 'good listener', 'good team player', 'good work ethic', 'good organizational', 'good organisational', 'good time management', 'good attention to detail', 'good problem solving', 'good initiative', 'good motivation', 'good collaboration', 'good interpersonal', 'good punctuality', 'good reliability', 'good dependability', 'good organization', 'good organisational', 'good self-motivation', 'good self starter', 'good leadership', 'good responsibility', 'good creativity', 'good critical thinking', 'good willingness to learn', 'good fast learner', 'good passion', 'good dedication', 'good drive', 'good energy', 'good enthusiasm', 'good integrity', 'good trustworthy', 'good respect', 'good patience', 'good work independently', 'good work under pressure', 'good work as part', 'good work as a team', 'good work collaboratively', 'good work well with others'
];
/**
 * 检查工作权限匹配情况（简化版）
 * 只处理明确的 citizenshipRequired 和 requiresStatus
 * 用户未填写时不减分，用户填写但不满足时减分 10%
 * @returns penalty: 减分百分比 (0 或 0.1)
 */
function checkWorkRightsMatch(
  jobWorkRights?: { country?: string; requiresStatus?: string; sponsorship?: string; citizenshipRequired?: boolean },
  userWorkingRightsAU?: string,
  userWorkingRightsOther?: string
): number {
  // 如果 Job 没有工作权限要求，不减分
  if (!jobWorkRights) {
    return 0;
  }

  const userWR = userWorkingRightsAU || userWorkingRightsOther || '';
  
  // 用户未填写工作权限：不减分也不加分（保持原样）
  if (!userWR || !userWR.trim()) {
    return 0;
  }

  const userWRLower = userWR.toLowerCase();

  // 检查 citizenshipRequired
  if (jobWorkRights.citizenshipRequired) {
    const isCitizen = /citizen/i.test(userWR);
    if (!isCitizen) {
      return 0.1; // 10% 减分
    }
  }

  // 检查 requiresStatus（如 "Permanent Resident", "Full Work Rights"）
  if (jobWorkRights.requiresStatus) {
    const requiresStatusLower = jobWorkRights.requiresStatus.toLowerCase();
    const hasRequiredStatus = 
      userWRLower.includes(requiresStatusLower) || 
      (requiresStatusLower.includes('permanent') && /permanent|pr/i.test(userWR)) ||
      (requiresStatusLower.includes('full') && /full.*work|temporary.*full/i.test(userWR));
    
    if (!hasRequiredStatus) {
      return 0.1; // 10% 减分
    }
  }

  // 默认匹配，不减分
  return 0;
}

function filterKeyRequirements(raw: string[]): string[] {
  return raw
    .map(req => req.trim())
    .filter(req =>
      req.length > 0 &&
      req.split(/\s+/).length <= 3 &&
      !INVALID_KEYWORDS.some(keyword => req.toLowerCase().includes(keyword))
    );
}

// 计算职位匹配分数
export async function calculateMatchScore(
  userType: 'opportunity' | 'fit' | 'neutral',
  jobData: Omit<JobMatchRequest, 'userProfile'> & { platform?: string },
  userProfile: JobMatchRequest['userProfile']
): Promise<{ 
  score: number; 
  subScores: { experience: number; industry: number; skills: number; other: number };
  highlights: string[]; 
  listSummary: string; 
  detailedSummary: string; 
  keyRequirements: string[]; 
  analysis: string 
}> {
  // 从 jobData 中提取 must-have 和 nice-to-have skills（如果可用）
  const jobSkillsMustHave = (jobData as any).skillsMustHave || [];
  const jobSkillsNiceToHave = (jobData as any).skillsNiceToHave || [];
  const jobKeyRequirements = (jobData as any).keyRequirements || [];
  const jobHighlights = (jobData as any).highlights || [];
  const jobWorkMode = (jobData as any).workMode || '';
  const jobSalary = (jobData as any).salary || '';
  const jobIndustry = (jobData as any).industry || '';

  const prompt = `As a professional career advisor, analyze how well I match this job position based on my profile.

Job Details:
- Title: ${jobData.jobTitle}
- Description: ${jobData.jobDescription}
- Location: ${jobData.jobLocation}
${jobIndustry ? `- Industry: ${jobIndustry}` : ''}
${jobWorkMode ? `- Work Mode: ${jobWorkMode}` : ''}
${jobSalary ? `- Salary: ${jobSalary}` : ''}
${jobSkillsMustHave.length > 0 ? `- Must-Have Skills: ${jobSkillsMustHave.join(', ')}` : ''}
${jobSkillsNiceToHave.length > 0 ? `- Nice-to-Have Skills: ${jobSkillsNiceToHave.join(', ')}` : ''}
${jobKeyRequirements.length > 0 ? `- Key Requirements: ${jobKeyRequirements.join(', ')}` : ''}
${jobData.jobRequirements.length > 0 && jobSkillsMustHave.length === 0 ? `- Required Skills: ${jobData.jobRequirements.join(', ')}` : ''}

My Profile:
- Skills: ${userProfile.skills.join(', ') || 'Not specified'}
- Location: ${userProfile.city}
- Seniority Level: ${userProfile.seniority}
- Open to Relocation: ${userProfile.openToRelocate ? 'Yes' : 'No'}
- Career Priorities: ${userProfile.careerPriorities?.join(', ') || 'Not specified'}
- Expected Position: ${userProfile.expectedPosition || 'Not specified'}
- Current Position: ${userProfile.currentPosition || 'Not specified'}

Scoring dimensions (each 50–95, integer):

1) ExperienceScore: years, seniority, and similar responsibilities.

2) SkillsScore: coverage of must-have skills first, then nice-to-haves.

3) IndustryScore: match with job industry and domain context.

4) OtherScore: location fit, career priorities, and any extra good/bad signals.

Compute MatchScore like this (do not change the formula):

MatchScore = round(0.3 * ExperienceScore + 0.3 * SkillsScore + 0.2 * IndustryScore + 0.15 * OtherScore)

Guidelines:

- Be strict. 

  50–65 = weak match, 66–80 = medium, 81–90 = strong, 91–95 = exceptional.

- If must-have skills are mostly missing, SkillsScore must stay below 70 and MatchScore below 70.

- If location is clearly impossible (e.g. candidate cannot relocate and job is onsite in another country), OtherScore should be low.

Match summary (important):

- ONE sentence, max 25 words.

- Explain briefly WHY the match is good or limited.

- Mention seniority/years plus 1–2 key skills or domain aspects.

- Do NOT explain the formula. Do NOT repeat raw scores. Avoid generic phrases like "great match" without reasons.

Return JSON ONLY, no extra text, in this exact format:

{
  "experienceScore": 82,
  "industryScore": 78,
  "skillsScore": 88,
  "otherScore": 70,
  "matchScore": 83,
  "matchSummary": "8+ years .NET and cloud experience, strong fit for senior backend role in fintech with good alignment to Sydney location and growth priorities."
}
`;

  // ✅ 模型 fallback：优先使用 gpt-4o-mini，失败则回退到 gpt-4.1-mini
  const models = ['gpt-4o-mini', 'gpt-4.1-mini'];
  let completion;
  let lastError;
  
  for (const model of models) {
    try {
      completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a professional career advisor providing job match analysis and scoring. Always return valid JSON only, no extra text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      console.log(`[JobMatch] Successfully used model: ${model}`);
      break; // 成功则跳出循环
    } catch (error: any) {
      lastError = error;
      console.warn(`[JobMatch] Model ${model} failed, trying fallback...`, error.message);
      if (model === models[models.length - 1]) {
        // 如果所有模型都失败，抛出最后一个错误
        throw error;
      }
    }
  }
  
  if (!completion) {
    throw lastError || new Error('Failed to get completion from any model');
  }

  const response = completion.choices[0].message.content || '';
  
  // 解析 JSON 响应
  let parsedResponse: {
    experienceScore?: number;
    industryScore?: number;
    skillsScore?: number;
    otherScore?: number;
    matchScore?: number;
    matchSummary?: string;
  } = {};
  
  try {
    // 尝试直接解析 JSON
    parsedResponse = JSON.parse(response);
  } catch (error) {
    // 如果直接解析失败，尝试提取 JSON 部分
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[JobMatch] Failed to parse JSON response:', e);
      }
    }
  }
  
  // 提取分数（确保在有效范围内）
  const experienceScore = Math.min(Math.max(parsedResponse.experienceScore || 75, 50), 95);
  const industryScore = Math.min(Math.max(parsedResponse.industryScore || 75, 50), 95);
  const skillsScore = Math.min(Math.max(parsedResponse.skillsScore || 75, 50), 90);
  let otherScore = Math.min(Math.max(parsedResponse.otherScore || 75, 50), 95);
  
  // ✅ 工作权限匹配检查（在 OtherScore 基础上按百分比减分）
  const workRightsPenalty = checkWorkRightsMatch(
    (jobData as any).workRights,
    userProfile.workingRightsAU,
    userProfile.workingRightsOther
  );
  
  if (workRightsPenalty > 0) {
    const originalOtherScore = otherScore;
    otherScore = Math.max(50, Math.round(otherScore * (1 - workRightsPenalty)));
    console.log(`[WorkRights] Penalty applied: ${originalOtherScore} → ${otherScore} (${(workRightsPenalty * 100).toFixed(0)}% reduction)`);
  }
  
  // 使用新公式计算 MatchScore
  const calculatedMatchScore = Math.round(
    0.3 * experienceScore + 
    0.3 * skillsScore + 
    0.2 * industryScore + 
    0.15 * otherScore
  );
  
  // 使用 GPT 返回的 matchScore，如果无效则使用计算值
  const matchScore = parsedResponse.matchScore && parsedResponse.matchScore >= 50 && parsedResponse.matchScore <= 95
    ? parsedResponse.matchScore
    : Math.min(Math.max(calculatedMatchScore, 50), 95);
  
  const matchSummary = parsedResponse.matchSummary || '';
  
  return {
    score: matchScore,
    subScores: {
      experience: experienceScore,
      industry: industryScore,
      skills: skillsScore,
      other: otherScore
    },
    highlights: [], // 列表视图不再需要 highlights
    listSummary: matchSummary, // 使用 matchSummary 作为 listSummary
    detailedSummary: '', // 列表视图不再需要 detailedSummary
    keyRequirements: [], // 列表视图不再需要 keyRequirements
    analysis: '' // 列表视图不再需要详细 analysis
  };
}

// 导出主函数
export async function matchJobWithGPT(data: JobMatchRequest) {
  try {
    // 确定用户类型
    const userType = determineUserType(data.userProfile);
    
    // 计算匹配分数和分析
    const result = await calculateMatchScore(userType, data, data.userProfile);
    
    return {
      ...result,
      userType
    };
  } catch (error) {
    console.error('Error analyzing job match:', error);
    throw new Error('Failed to analyze job match');
  }
}