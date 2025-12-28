import OpenAI from 'openai';
import { createOpenAIClient, chatCompletionsWithFallback } from '../../utils/openaiClient';

const openai = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});

export async function parseMessageWithGPT({ message, context, jobContext }: { message: string, context?: any[], jobContext?: any }) {
  // 取最近3-5轮对话
  const history = (context || []).slice(-5);
  let systemPrompt = `You are Hera AI, an intelligent career agent.\n\nYour job is to understand the user's career preferences and update their job search profile accordingly.\n\nAlways think step by step.\n\nWhen the user mentions preferences such as job title, city, salary expectations, seniority, industry, open to relocation, or career priorities, summarize these changes and output ONLY a JSON object in the following format:\n\n{\n  \"action\": \"update_profile_and_refetch\",\n  \"updates\": {\n    \"city\": \"Sydney\",\n    \"jobTitle\": \"HR Manager\",\n    \"expectedSalary\": \"150,000 AUD\"\n  }\n}\n\nIf the user message contains career advice related keywords (such as \"good fit\", \"career switch\", \"transition\", \"change role\", \"转行\", \"换工作\", \"适合\", \"转岗\", \"转型\") or is asking about career suitability, output:\n\n{\n  \"action\": \"career_advice\",\n  \"response\": \"I understand you're looking for career advice. Based on your question, I can provide some general guidance. Would you like me to give you more specific advice based on your profile?\"\n}\n\nIf the user message does not imply any change to the job search preferences or career advice, return:\n\n{\n  \"action\": \"none\"\n}\n\nImportant:\n- ONLY return JSON. No explanation, no free text.\n- If multiple updates are mentioned, combine them into one object.\n- Be concise and structured.`;
  if (jobContext && jobContext.title && jobContext.company) {
    systemPrompt = `You are Hera AI, an intelligent career agent.\n\nThe user is currently discussing the following job:\nJob Title: ${jobContext.title}\nCompany: ${jobContext.company}${jobContext.location ? `\nLocation: ${jobContext.location}` : ''}${jobContext.postedDate ? `\nPosted: ${jobContext.postedDate}` : ''}${jobContext.summary ? `\nSummary: ${jobContext.summary}` : ''}\n\nWhen the user asks about this job, company, or their fit, please answer based on the job context.\nIf the user switches topic to career advice or job search preferences, follow the original instructions.\n\n` + systemPrompt;
  }
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  const completion = await chatCompletionsWithFallback(
    openai,
    {
      model: 'gpt-3.5-turbo-1106',
      messages,
      temperature: 0,
      max_tokens: 512,
    },
    'gemini-2.0-flash-exp'
  );

  // Type guard: ensure completion is ChatCompletion, not Stream
  if (!('choices' in completion)) {
    throw new Error('Unexpected response type: expected ChatCompletion');
  }

  let response = completion.choices[0].message.content || '';
  response = response.replace(/^```json\s*|```$/g, '').trim();
  return response;
} 