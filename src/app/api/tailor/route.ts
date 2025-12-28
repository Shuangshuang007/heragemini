import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, chatCompletionsWithFallback } from '@/utils/openaiClient';

export async function POST(request: NextRequest) {
  try {
    const { resumeJson, jobUrl, highlights, jdSummary, requiredList } = await request.json();
    
    // 调试：显示接收到的数据
    console.log('📥 /api/tailor 接收数据:', {
      resumeJsonKeys: Object.keys(resumeJson || {}),
      jobUrl,
      highlights,
      highlightsCount: highlights?.length || 0,
      requiredList,
      requiredListCount: requiredList?.length || 0,
      jdSummary: jdSummary?.substring(0, 100) + '...',
      resumeJsonSample: {
        profile: resumeJson?.profile ? '✓' : '✗',
        experience: resumeJson?.experience ? `${resumeJson.experience.length} items` : '✗',
        skills: resumeJson?.skills ? `${resumeJson.skills.length} items` : '✗'
      }
    });

    if (!resumeJson || !highlights || !Array.isArray(highlights)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 构建 prompt
    const prompt = `System Prompt
You are an ATS resume tailoring assistant.

Your task:
Given the candidate's current resume JSON and job description details, rewrite and enrich each work experience section so that it highlights achievements, skills, and responsibilities relevant to the job.

Strict rules:
- Preserve all factual data from the original resume (company, dates, education, job titles, locations).
- Keep EXACTLY the same JSON keys and nesting as the input.
- Only modify: "summary", "experience[*].bullets", and "skills".
- For bullets:
  * Keep recent roles (last 2) at 3–6 bullets, older roles at 1–3.
  * Rewrite existing bullets to incorporate job-specific language from JD Summary and Highlights.
  * Add new bullets if the JD shows key requirements that are plausible for the candidate's background.
  * Start each bullet with a strong action verb and include context, action, and measurable impact where possible.
  * When rewriting bullets, prefer using the exact verbs and terminology from the Job Description (JD) to ensure ATS keyword matching. Do not substitute synonyms if the JD provides a specific term.
- For skills:
  * Merge original and JD-relevant skills, remove duplicates, order by relevance to the JD.
- Do not fabricate specific technologies or responsibilities the candidate could not have had based on their background.
- Return ONLY a valid JSON object with the same keys and structure as the input.

ATS matching rule:
- "Required" terms are defined as hard requirements supplied in the User prompt (the union of JD experience requirement, hard skills/certifications, and working-rights/legal requirements). Location, employment type, work mode, and soft skills are not "Required".
- If the User prompt supplies "Required", you MUST, when truthful for the candidate, include each required term VERBATIM (exact spelling/punctuation) in at least one of:
  (a) the "skills" list, and/or
  (b) a bullet under the most relevant experience, and/or
  (c) the "summary".
- Prefer the exact canonical forms from "Required" (e.g., "Objective-C").
- Experience years: NEVER downgrade the candidate's real years. If the JD requires "5+ years" and the candidate has 8, keep "8 years" and phrase as "Exceeds requirement of 5+ years with 8 years experience".
- Working rights: If present in the resume, repeat them verbatim; if not, do not fabricate.
- Do NOT invent technologies, years, or qualifications not supported by the candidate's history.

User Prompt
Here is the candidate's current resume JSON (keep keys/structure identical):
${JSON.stringify(resumeJson, null, 2)}

Job Information:
- Job URL: ${jobUrl}
- Job Highlights (deduped 8–12 phrases): ${JSON.stringify(highlights)}
- Required (verbatim hard requirements for ATS): ${JSON.stringify(requiredList || [])}
- JD Summary:
${jdSummary || 'No detailed job description available.'}

Instructions:
1. Update "summary" to reflect the most important strengths and achievements relevant to the JD Summary and Highlights.
2. For each experience:
   - Keep "title", "company", "location", "startDate", "endDate", "description" unchanged.
   - Rewrite "bullets" to incorporate key skills, tools, and results from the JD.
   - Add new bullets if the JD suggests important relevant achievements that the candidate plausibly had.
3. Update "skills" by merging original skills with JD-required skills that match the candidate's profile.
4. Keep "education", "languages", and "workingRightsAU" unchanged unless a minor reword is needed for clarity.
5. Return ONLY the updated resume JSON in the exact same structure as the input.
6. ATS exact-term coverage:
   For each item in "Required", if it is truthful for the candidate, include the exact term:
   - In "skills" (merge without duplicates), and
   - At least once in either the summary or a relevant bullet.
   Use the exact spelling/punctuation from "Required".
   For experience years, do not replace actual years with JD years; emphasize meets/exceeds requirement.
   Do not add items that are untrue.`;

    // 调试：显示发送给 GPT 的 prompt 长度
    console.log('🤖 发送给 GPT 的 prompt 长度:', prompt.length);
    console.log('🔑 使用的模型:', 'gpt-4.1-mini-2025-04-14');
    console.log('🔑 API Key 状态:', {
      hasKey: !!process.env.TAILOR_RESUME_API_KEY,
      keyLength: process.env.TAILOR_RESUME_API_KEY?.length || 0,
      keyPrefix: process.env.TAILOR_RESUME_API_KEY?.substring(0, 7) || 'N/A'
    });
    
    // 构建 OpenAI API 请求体
    const openaiRequestBody = {
      model: 'gpt-4.1-mini-2025-04-14', // 改回之前能用的模型
      messages: [
        {
          role: 'user' as const,
          content: prompt
        }
      ],
      temperature: 0.2, // 保持低温度确保一致性
      top_p: 0.9,
      max_tokens: 4000
    };
    
    console.log('🤖 OpenAI API 请求体:', {
      model: openaiRequestBody.model,
      temperature: openaiRequestBody.temperature,
      maxTokens: openaiRequestBody.max_tokens,
      promptLength: prompt.length
    });
    
    // 调用 OpenAI API（带 Gemini fallback）
    const openaiClient = createOpenAIClient({
      apiKey: process.env.TAILOR_RESUME_API_KEY,
      baseURL: 'https://api.openai.com/v1',
    });

    let completion;
    try {
      completion = await chatCompletionsWithFallback(
        openaiClient,
        openaiRequestBody,
        'gemini-2.0-flash-exp'
      );
    } catch (error: any) {
      console.error('🤖 API 调用失败:', {
        error: error.message,
        status: error.status
      });
      throw error;
    }

    // Type guard: ensure completion is ChatCompletion, not Stream
    if (!('choices' in completion)) {
      throw new Error('Unexpected response type: expected ChatCompletion');
    }

    const gptResponse = completion.choices[0]?.message?.content;
    
    // 调试：显示 GPT 响应信息
    console.log('🤖 GPT 响应数据:', {
      model: completion.model,
      usage: completion.usage,
      responseLength: gptResponse?.length || 0
    });

    if (!gptResponse) {
      throw new Error('No response from GPT');
    }

    // 尝试解析 JSON
    let parsedResume;
    
    // 调试：显示GPT原始响应
    console.log('🤖 GPT 原始响应内容:', gptResponse.substring(0, 500) + '...');
    console.log('🤖 GPT 响应是否以 { 开头:', gptResponse.trim().startsWith('{'));
    console.log('🤖 GPT 响应是否以 } 结尾:', gptResponse.trim().endsWith('}'));
    
    try {
      parsedResume = JSON.parse(gptResponse);
      console.log('✅ JSON 解析成功，返回数据结构:', {
        hasProfile: !!parsedResume.profile,
        hasExperience: !!parsedResume.experience,
        experienceCount: parsedResume.experience?.length || 0,
        hasSkills: !!parsedResume.skills,
        skillsCount: parsedResume.skills?.length || 0
      });
    } catch (parseError) {
      console.warn('First JSON parse failed, attempting to extract JSON...');
      
      // 尝试从响应中提取 JSON（参考 ResumeGPT 的做法）
      let extractedJson = gptResponse;
      
      // 如果响应被 markdown 包围，尝试提取
      if (gptResponse.includes('```json')) {
        const jsonMatch = gptResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          extractedJson = jsonMatch[1];
          console.log('🔍 从 markdown 中提取到 JSON');
        }
      } else if (gptResponse.includes('```')) {
        // 如果只是被 ``` 包围
        const codeMatch = gptResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          extractedJson = codeMatch[1];
          console.log('🔍 从代码块中提取到 JSON');
        }
      }
      
      // 尝试解析提取的内容
      try {
        parsedResume = JSON.parse(extractedJson);
        console.log('✅ 提取后 JSON 解析成功');
      } catch (extractError) {
        console.warn('Extraction failed, retrying with GPT...');
        
        // 如果还是失败，重试一次
        const retryPrompt = prompt + '\n\nReturn ONLY the JSON object, no markdown, no comments.';
        
        const retryCompletion = await chatCompletionsWithFallback(
          openaiClient,
          {
            model: 'gpt-4.1-mini', // 重试使用 gpt-4.1-mini
            messages: [
              {
                role: 'user',
                content: retryPrompt
              }
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 4000
          },
          'gemini-2.0-flash-exp'
        );

        // Type guard: ensure retryCompletion is ChatCompletion, not Stream
        if (!('choices' in retryCompletion)) {
          throw new Error('Unexpected response type: expected ChatCompletion');
        }

        const retryGptResponse = retryCompletion.choices[0]?.message?.content;

        if (!retryGptResponse) {
          throw new Error('No response from GPT retry');
        }

        try {
          parsedResume = JSON.parse(retryGptResponse);
          console.log('✅ 重试后 JSON 解析成功');
        } catch (retryParseError) {
          throw new Error('JSON parse failed after retry');
        }
      }
    }

    // 返回完整的 resumeJson
    return NextResponse.json(parsedResume);

  } catch (error) {
    console.error('Tailor API error:', error);
    return NextResponse.json(
      { error: 'Tailor failed. Please try again.' },
      { status: 500 }
    );
  }
}
