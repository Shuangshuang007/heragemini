import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createOpenAIClient, chatCompletionsWithFallback } from '../../utils/openaiClient';

const openai = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});

interface CareerAdviceParams {
  profile: any;
  latestPreferences: any;
  question: string;
  context?: any;
  replyLang?: 'zh' | 'en';
}

export async function getCareerAdvice({
  profile,
  latestPreferences,
  question,
  context,
  replyLang = 'en'
}: CareerAdviceParams) {
  // 根据 replyLang 设置回复语言
  const replyLangPrompt = replyLang === 'zh'
    ? '请用中文简明扼要地回复。'
    : 'Please reply concisely in English.';

  // 构建 system prompt，优先使用最新偏好，其次 profile
  const systemPrompt = `你是专业的职业发展顾问。请优先参考用户最近表达的偏好（如Location、Job Title等），Profile 作为补充。
用户最新偏好：${JSON.stringify(latestPreferences, null, 2)}
用户Profile：${JSON.stringify(profile, null, 2)}
用户问题：${question}
如果有上下文：${JSON.stringify(context, null, 2)}
请结合上述信息，给出个性化职业建议。${replyLangPrompt}禁止推荐具体职位、禁止触发任何职位检索，只能给出职业发展建议。`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ];

  const completion = await chatCompletionsWithFallback(
    openai,
    {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 512,
    },
    'gemini-2.0-flash-exp' // Gemini fallback model
  );

  // Type guard: ensure completion is ChatCompletion, not Stream
  if (!('choices' in completion)) {
    throw new Error('Unexpected response type: expected ChatCompletion');
  }

  return completion.choices[0].message.content || '';
} 