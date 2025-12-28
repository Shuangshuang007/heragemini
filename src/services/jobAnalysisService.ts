import OpenAI from 'openai';
import { getLocationWeight } from '../utils/greaterAreaMap';
import { createOpenAIClient, chatCompletionsWithFallback } from '../utils/openaiClient';

const openai = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});

export function needsJobAnalysis(job: any) {
  if (!job) {
    console.log('[JobAnalysis] needsJobAnalysis: job is null/undefined');
    return false;
  }
  
  // 检查 summary 和 highlights（来自 pipeline）
  const hasBasicInfo = job.summary && job.summary.length > 30 && Array.isArray(job.highlights) && job.highlights.length > 0;
  // 检查 detailedSummary（需要 GPT 生成，用于 JobDetailPanel 的详细展示）
  const hasDetailedSummary = job.detailedSummary && job.detailedSummary.length > 50;
  // 检查 matchAnalysis（如果有 userProfile，需要生成详细的匹配分析）
  const hasMatchAnalysis = job.matchAnalysis && job.matchAnalysis.length > 100;
  
  const needsAnalysis = !(hasBasicInfo && hasDetailedSummary);
  
  console.log('[JobAnalysis] needsJobAnalysis check:', {
    hasBasicInfo,
    hasDetailedSummary,
    hasMatchAnalysis,
    needsAnalysis,
    summaryLength: job.summary?.length || 0,
    highlightsCount: Array.isArray(job.highlights) ? job.highlights.length : 0,
    detailedSummaryLength: job.detailedSummary?.length || 0,
    matchAnalysisLength: job.matchAnalysis?.length || 0,
  });
  
  return needsAnalysis;
}

export async function analyzeJobWithGPT(job: any, cityHint?: string, userProfile?: any) {
  console.log('[JobAnalysis] analyzeJobWithGPT called:', {
    jobTitle: job.title,
    company: job.company,
    hasDescription: !!job.description,
    descriptionLength: job.description?.length || 0,
    hasUserProfile: !!userProfile,
    userProfileSkills: userProfile?.skills?.length || 0,
  });
  
  const prompt = `Analyze this job posting and provide:
1. A concise summary (2-3 sentences)
2. A detailed summary (4-5 sentences) divided into three sections:
   - Who we are: Brief company introduction and culture
   - Who we are looking for: Key requirements and ideal candidate profile
   - Benefits and Offerings: What makes this position attractive
3. A match score (0-100)
4. **A comprehensive matching analysis** (if user profile is provided) written in paragraphs:
   a) Overview (1-2 paragraphs):
      Provide a holistic assessment of how well the candidate matches this position, considering both technical and cultural fit.
      Include key factors that influenced the match score.
   b) Strengths to Stand Out (1 paragraph):
      Highlight the strongest matching points and competitive advantages for this position.
      Focus on direct matches in skills, experience, and qualifications.
   c) Potential Improvement Areas (1 paragraph):
      Address gaps in required skills or experience.
      Provide specific suggestions for the application process (focus only on application-stage advice).
      Note any immediate steps that could strengthen the application.
   d) Transferable Advantages (1 paragraph):
      Discuss relevant skills and experiences that, while not direct matches, could add value.
      Explain how these transferable skills apply to the role.
   e) Other Considerations (optional, 1 paragraph):
      Include any additional factors worth noting (e.g., international experience, industry transitions).
      Mention any unique circumstances that could influence the application.
5. A structured WORKMODE field (e.g., "2 Day Onsite", "Hybrid", "Fully Remote", etc.), based on both the raw WorkMode and the job description. If job description provides more detail, use that.

Job Title: ${job.title}
Company: ${job.company}
Location: ${Array.isArray(job.location) ? job.location.join(', ') : job.location}
RawWorkMode: ${job.workMode || 'Not specified'}
Description: ${job.description || 'No description provided'}
${userProfile ? `
User Profile:
- Skills: ${(userProfile.skills || []).join(', ') || 'Not specified'}
- Location: ${userProfile.city || 'Not specified'}
- Seniority Level: ${userProfile.seniority || 'Not specified'}
- Open to Relocation: ${userProfile.openToRelocate ? 'Yes' : 'No'}
- Career Priorities: ${(userProfile.careerPriorities || []).join(', ') || 'Not specified'}
- Expected Position: ${userProfile.expectedPosition || 'Not specified'}
- Current Position: ${userProfile.currentPosition || 'Not specified'}
` : ''}

Format your response as:
SUMMARY:
[concise summary]

WORKMODE:
[structured work mode]

DETAILED_SUMMARY:
Who we are:
[paragraph]

Who we are looking for:
[paragraph]

Benefits and Offerings:
[paragraph]

SCORE:
[number 0-100]

${userProfile ? `
ANALYSIS:
Overview:
[1-2 paragraphs assessing overall match quality]

Strengths to Stand Out:
[1 paragraph highlighting key matching points]

Potential Improvement Areas:
[1 paragraph addressing gaps and application advice]

Transferable Advantages:
[1 paragraph discussing relevant indirect matches]

Other Considerations:
[1 paragraph on additional factors, if applicable]
` : `
ANALYSIS:
[2-3 sentences general match analysis]
`}`;

  // ✅ 模型 fallback：优先使用 gpt-4o-mini，失败则回退到 gpt-4.1-mini
  const models = ['gpt-4o-mini', 'gpt-4.1-mini'];
  let completion;
  let lastError;
  
  for (const model of models) {
    try {
      completion = await chatCompletionsWithFallback(
        openai,
        {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: userProfile ? 1500 : 500,
          temperature: 0.7,
        },
        'gemini-2.0-flash-exp' // Gemini fallback model
      );
      console.log(`[JobAnalysis] Successfully used model: ${model}`);
      break; // 成功则跳出循环
    } catch (error: any) {
      lastError = error;
      console.warn(`[JobAnalysis] Model ${model} failed, trying fallback...`, error.message);
      if (model === models[models.length - 1]) {
        // 如果所有模型都失败，抛出最后一个错误
        throw error;
      }
    }
  }
  
  if (!completion) {
    throw lastError || new Error('Failed to get completion from any model');
  }

  // Type guard: ensure completion is ChatCompletion, not Stream
  if (!('choices' in completion)) {
    throw new Error('Unexpected response type: expected ChatCompletion');
  }

  const response = completion.choices[0]?.message?.content || '';
  
  console.log('[JobAnalysis] GPT response received, length:', response.length);
  console.log('[JobAnalysis] GPT response preview:', response.substring(0, 200) + '...');

  const workModeMatch = response.match(/WORKMODE:\s*([^\n]+)/i);
  const summaryMatch = response.match(/SUMMARY:\s*([\s\S]*?)(?=WORKMODE:|DETAILED_SUMMARY:|SCORE:|$)/);
  const detailedSummaryMatch = response.match(/DETAILED_SUMMARY:\s*([\s\S]*?)(?=SCORE:|ANALYSIS:|$)/);
  const scoreMatch = response.match(/SCORE:\s*(\d+)/);
  const analysisMatch = response.match(/ANALYSIS:\s*([\s\S]*?)$/);

  console.log('[JobAnalysis] Parsed response:', {
    hasWorkMode: !!workModeMatch,
    hasSummary: !!summaryMatch,
    hasDetailedSummary: !!detailedSummaryMatch,
    hasScore: !!scoreMatch,
    hasAnalysis: !!analysisMatch,
    score: scoreMatch ? parseInt(scoreMatch[1]) : null,
  });

  const city = cityHint || job.city || (Array.isArray(job.location) ? job.location[0]?.split(',')[0] : job.location?.split(',')[0]) || '';
  const locationWeight = getLocationWeight(job.location, city);
  const baseScore = scoreMatch ? parseInt(scoreMatch[1]) : 75;

  const result = {
    workMode: workModeMatch?.[1]?.trim() || job.workMode || '',
    summary: summaryMatch?.[1]?.trim() || `${job.title || 'Unknown'} position at ${job.company || 'Unknown'}.`,
    detailedSummary: detailedSummaryMatch?.[1]?.trim() || job.description?.substring(0, 200) + '...' || '',
    matchScore: Math.round(baseScore * locationWeight),
    matchAnalysis: analysisMatch?.[1]?.trim() || 'Analysis completed.',
  };
  
  console.log('[JobAnalysis] Final result:', {
    workMode: result.workMode?.substring(0, 50),
    summaryLength: result.summary?.length || 0,
    detailedSummaryLength: result.detailedSummary?.length || 0,
    matchScore: result.matchScore,
    matchAnalysisLength: result.matchAnalysis?.length || 0,
  });

  return result;
}


