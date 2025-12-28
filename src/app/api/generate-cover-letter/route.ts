import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, chatCompletionsWithFallback } from '@/utils/openaiClient';

// Generate Cover Letter GPT API Key 优先级说明：
// 1. 优先读取 GENERATE_COVER_LETTER_OPENAI_API_KEY
// 2. 若未设置，则回退到 OPENAI_API_KEY
const generateCoverLetterApiKey = process.env.GENERATE_COVER_LETTER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const openai = createOpenAIClient({
  apiKey: generateCoverLetterApiKey,
  baseURL: 'https://api.openai.com/v1',
});

export async function POST(req: NextRequest) {
  try {
    const { resumeData, jobTitle, company, jobDescription } = await req.json();

    if (!resumeData || !jobTitle) {
      return NextResponse.json(
        { error: 'Resume data and job title are required' },
        { status: 400 }
      );
    }

    const prompt = `You are a professional cover letter writer with expertise in the Australian job market.

Generate a compelling cover letter based on the following information:

RESUME SUMMARY:
${resumeData.summary || 'No summary provided'}

KEY SKILLS (Top 8 only):
${resumeData.skills?.slice(0,8).join(', ') || 'No skills listed'}

RELEVANT EXPERIENCE (most recent 3):
${resumeData.experience?.slice(0,3).map((exp: any) => 
  `${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate}): ${exp.description}`
).join('\n') || 'No relevant experience provided'}

JOB DETAILS:
- Position: ${jobTitle}
- Company: ${company || 'Not specified'}
- Job Description: ${jobDescription || 'Not provided'}

Requirements for the cover letter:
1. Professional and enthusiastic tone
2. Highlight relevant skills and experience from the resume
3. Show understanding of the role and company
4. Include specific examples that demonstrate fit
5. Keep it concise (200-300 words)
6. Use Australian business English
7. Focus on achievements and measurable impacts
8. Show enthusiasm for the opportunity
9. Structure the letter in 3–4 short paragraphs:
   • Opening: motivation for role & company
   • Middle: link skills/experience with examples
   • Closing: enthusiasm + state you look forward to interview

**CRITICAL FORMATTING RULES:**
- Start EXACTLY with "Dear Hiring Manager,"
- End with the last paragraph of your argument
- DO NOT include "Best regards," "Sincerely," "Yours truly," or any other closing
- DO NOT include "[Your Name]" or any placeholder text
- DO NOT include any signature line
- DO NOT include any example text, brackets, or instructions
- Just the main body paragraphs from "Dear Hiring Manager," to the end of your last argument
- The final paragraph must naturally close with interest in an interview (do not leave the ending abrupt).

Return ONLY the cover letter body content, nothing else.`;

    const completion = await chatCompletionsWithFallback(
      openai,
      {
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      },
      'gemini-2.0-flash-exp'
    );

    // Type guard: ensure completion is ChatCompletion, not Stream
    if (!('choices' in completion)) {
      throw new Error('Unexpected response type: expected ChatCompletion');
    }

    const coverLetter = completion.choices[0].message.content;

    return NextResponse.json({ coverLetter });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return NextResponse.json(
      { error: 'Failed to generate cover letter' },
      { status: 500 }
    );
  }
}
