/**
 * OpenAI Client with Gemini Fallback
 * 
 * 优先使用 OpenAI，如果失败则自动 fallback 到 Gemini
 * 使用 OpenAI SDK 兼容的方式，几乎不需要修改现有代码
 */

import OpenAI from 'openai';

interface ClientConfig {
  apiKey?: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * 创建支持 fallback 的 OpenAI 客户端
 * 
 * @param config 客户端配置
 * @returns OpenAI 客户端实例
 */
export function createOpenAIClient(config: ClientConfig = {}): OpenAI {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  const baseURL = config.baseURL || 'https://api.openai.com/v1';
  
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: config.defaultHeaders,
  });
}

/**
 * 创建 Gemini fallback 客户端
 * 
 * @param apiKey Gemini API Key（从环境变量 GEMINI_API_KEY 读取）
 * @returns OpenAI 兼容的客户端实例
 */
export function createGeminiClient(apiKey?: string): OpenAI {
  const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  
  return new OpenAI({
    apiKey: geminiApiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
}

/**
 * 带 fallback 的 chat completions 调用
 * 
 * @param client OpenAI 客户端（主客户端）
 * @param params chat.completions.create 的参数
 * @param fallbackModel Gemini 模型名称（默认: gemini-2.0-flash-exp）
 * @returns Chat completion 结果
 */
export async function chatCompletionsWithFallback(
  client: OpenAI,
  params: Parameters<typeof client.chat.completions.create>[0],
  fallbackModel: string = 'gemini-2.0-flash-exp'
): Promise<ReturnType<typeof client.chat.completions.create>> {
  try {
    // 优先尝试 OpenAI
    const result = await client.chat.completions.create(params);
    console.log('[OpenAI Client] Successfully used OpenAI');
    return result;
  } catch (error: any) {
    // 检查是否是账户被停用或其他严重错误
    const errorMessage = error?.message || '';
    const isAccountDeactivated = 
      errorMessage.includes('deactivated') ||
      errorMessage.includes('account') ||
      error?.status === 401 ||
      error?.status === 403;
    
    if (isAccountDeactivated || error?.status >= 500) {
      console.warn('[OpenAI Client] OpenAI failed, falling back to Gemini:', errorMessage);
      
      // 尝试使用 Gemini fallback
      try {
        const geminiClient = createGeminiClient();
        
        // 转换模型名称和参数
        // Gemini 可能不支持某些参数，需要清理
        const geminiParams: any = {
          model: fallbackModel,
          messages: params.messages,
        };
        
        // 只添加 Gemini 支持的参数
        // Gemini 不支持 presence_penalty 和 frequency_penalty，需要忽略
        if (params.temperature !== undefined) {
          geminiParams.temperature = params.temperature;
        }
        // Gemini 的 max_tokens 限制可能不同，如果太大可能失败
        // 限制在合理范围内
        if (params.max_tokens !== undefined && params.max_tokens !== null) {
          // Gemini 2.0 flash exp 最大支持 8192 tokens
          geminiParams.max_tokens = Math.min(params.max_tokens, 8192);
        }
        if (params.top_p !== undefined) {
          geminiParams.top_p = params.top_p;
        }
        // Gemini 可能不支持 response_format，先不添加，看看是否会导致问题
        // 如果 Gemini 支持，可以在 prompt 中要求返回 JSON
        // if (params.response_format) {
        //   geminiParams.response_format = params.response_format;
        // }
        // Gemini 不支持 presence_penalty 和 frequency_penalty，不添加
        // if (params.presence_penalty !== undefined) {
        //   geminiParams.presence_penalty = params.presence_penalty;
        // }
        // if (params.frequency_penalty !== undefined) {
        //   geminiParams.frequency_penalty = params.frequency_penalty;
        // }
        if (params.n !== undefined && params.n === 1) {
          // Gemini 只支持 n=1
          geminiParams.n = params.n;
        }
        
        const result = await geminiClient.chat.completions.create(geminiParams);
        console.log('[OpenAI Client] Successfully used Gemini fallback');
        return result;
      } catch (fallbackError: any) {
        console.error('[OpenAI Client] Gemini fallback also failed:', {
          message: fallbackError?.message,
          status: fallbackError?.status,
          statusText: fallbackError?.statusText,
          error: fallbackError?.error,
          response: fallbackError?.response?.data || fallbackError?.response
        });
        // 如果 Gemini 也失败，抛出原始错误
        throw error;
      }
    } else {
      // 其他错误（如速率限制、参数错误等），直接抛出
      throw error;
    }
  }
}

/**
 * 创建带 fallback 的客户端包装器
 * 这个函数返回一个包装的客户端，所有调用都会自动 fallback
 */
export function createOpenAIClientWithFallback(config: ClientConfig = {}): OpenAI & {
  chat: {
    completions: {
      create: typeof chatCompletionsWithFallback;
    };
  };
} {
  const client = createOpenAIClient(config);
  
  return {
    ...client,
    chat: {
      ...client.chat,
      completions: {
        ...client.chat.completions,
        create: (params: any) => chatCompletionsWithFallback(client, params),
      },
    },
  } as any;
}

