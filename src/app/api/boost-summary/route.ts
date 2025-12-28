import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, chatCompletionsWithFallback } from '@/utils/openaiClient';

// Boost Summary GPT API Key 优先级说明：
// 1. 优先读取 BOOST_SUMMARY_OPENAI_API_KEY
// 2. 若未设置，则回退到 OPENAI_API_KEY
const boostSummaryApiKey = process.env.BOOST_SUMMARY_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const openai = createOpenAIClient({
  apiKey: boostSummaryApiKey,
  baseURL: 'https://api.openai.com/v1',
});

export async function POST(req: NextRequest) {
  const { summary } = await req.json();

  const prompt = `
You are a professional resume writer with 10+ years of experience in the Australian job market and executive search.

You are helping a candidate improve their resume by rewriting a summary for one specific role or education entry. Please make the rewrite:
- Result-oriented
- Focused on measurable outcomes
- Using strong action verbs
- Analytical in tone
- Concise and ATS-friendly
- Format as bullet points with "• " prefix
- Separate bullet points with newline characters
- For education summaries: Focus on academic projects, research, internships, coursework, and relevant achievements
- For employment summaries: Focus on job responsibilities, achievements, and measurable impacts

Here is the original summary:
"""
${summary}
"""

Please return only the rewritten summary in bullet point format (each bullet point starting with "• " and separated by newlines, no explanations, no additional formatting).
  `.trim();

  const chatResponse = await chatCompletionsWithFallback(
    openai,
    {
      model: 'gpt-4-turbo', // 使用最新的 GPT-4 Turbo 模型
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    },
    'gemini-2.0-flash-exp'
  );

  // Type guard: ensure chatResponse is ChatCompletion, not Stream
  if (!('choices' in chatResponse)) {
    throw new Error('Unexpected response type: expected ChatCompletion');
  }

  const boostedSummary = chatResponse.choices[0].message.content;

  return NextResponse.json({ boostedSummary });
} 