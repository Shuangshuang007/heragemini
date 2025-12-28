import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createOpenAIClient, chatCompletionsWithFallback } from '../../utils/openaiClient';

const openai = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});

interface TailorResumeParams {
  userProfile: any;
  jobDescription: string;
  jobTitle: string;
  company: string;
  resumeContent: string;
  customizationLevel?: 'minimal' | 'moderate' | 'comprehensive';
}

interface TailorResumeResult {
  tailoredResume: string;
  keyChanges: string[];
  summary: string;
  recommendations: string[];
}

export async function tailorResumeWithGPT({
  userProfile,
  jobDescription,
  jobTitle,
  company,
  resumeContent,
  customizationLevel = 'moderate'
}: TailorResumeParams): Promise<TailorResumeResult> {
  
  const systemPrompt = `You are a professional resume customization expert specializing in the Australian job market.

Your task is to tailor a resume to match a specific job description while maintaining authenticity and highlighting the user's most relevant qualifications.

**Guidelines:**
- Keep all factual information accurate (dates, companies, positions, education)
- Reorder and emphasize relevant experiences and skills
- Use keywords from the job description naturally
- Maintain professional tone and formatting
- Focus on achievements and quantifiable results
- Align language with job requirements

**Customization Levels:**
- **minimal**: Minor keyword adjustments and reordering
- **moderate**: Reorder sections, emphasize relevant skills/experience, add keywords
- **comprehensive**: Significant restructuring, adding relevant terminology, optimizing for ATS

**Job Context:**
- Title: ${jobTitle}
- Company: ${company}
- Description: ${jobDescription}

**User Profile:**
${JSON.stringify(userProfile, null, 2)}

Please return a JSON object with:
- tailoredResume: The customized resume content
- keyChanges: Array of 3-5 key changes made
- summary: Brief summary of customization approach
- recommendations: Array of 2-3 additional suggestions for improvement`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Please tailor this resume for the position:\n\n${resumeContent}` }
  ];

  const completion = await chatCompletionsWithFallback(
    openai,
    {
      model: 'gpt-4-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    },
    'gemini-2.0-flash-exp'
  );

  // Type guard: ensure completion is ChatCompletion, not Stream
  if (!('choices' in completion)) {
    throw new Error('Unexpected response type: expected ChatCompletion');
  }

  const response = completion.choices[0]?.message?.content;
  
  if (!response) {
    throw new Error('No response from GPT for resume tailoring');
  }

  try {
    const result = JSON.parse(response) as TailorResumeResult;
    return result;
  } catch (error) {
    console.error('Error parsing GPT response for resume tailoring:', error);
    throw new Error('Failed to parse GPT response for resume tailoring');
  }
}
