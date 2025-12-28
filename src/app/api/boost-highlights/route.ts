import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createOpenAIClient, chatCompletionsWithFallback } from '@/utils/openaiClient';

const openai = createOpenAIClient({
  apiKey: process.env.BOOST_SUMMARY_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

const SYSTEM = `
You are an expert resume consultant.

Goal: Write a single, concise Career Highlights paragraph that scans the entire resume and surfaces the most marketable strengths.

Hard constraints (must follow):
- Exactly 2 sentences, total 45–65 words. English only.
- Prioritize cross-role, cross-company impact. Use one specific metric if it exists; otherwise keep it neutral.
- Mention at most ONE high‑value credential (either a notable degree OR employer), not both unless both are clearly decisive.
- Mention tools/technologies at most once, with no more than two items (no laundry lists).
- Use strong verbs and plain syntax; avoid fillers like “successfully”, “consistently”, “demonstrated ability to”.
- No bullets, no headings, no emojis. Output only the paragraph.

Style:
- Results‑oriented, specific, credible; do not invent facts.
- Vary verbs; avoid stacked clauses (“while/with/that”) unless necessary.
`.trim();

function buildUserPrompt(resumeData: any, existingHighlights?: string) {
  // Flatten minimal contexts for brevity
  const summary = resumeData?.summary || '';
  const experiences = (resumeData?.employment || [])
    .map((e: any) => `${e.position || ''} @ ${e.company || ''} — ${e.description || ''}`)
    .join('\n');
  const education = (resumeData?.education || [])
    .map((ed: any) => `${ed.degree || ''} @ ${ed.school || ''} — ${ed.summary || ''}`)
    .join('\n');
  const skills = Array.isArray(resumeData?.skills) ? JSON.stringify(resumeData.skills) : '';

  return `
Here is the parsed resume data (full context). Use only what is present.

SUMMARY:
${summary}

WORK EXPERIENCES (title, company, dates, achievements/metrics):
${experiences}

EDUCATION (degree, school, notes if any):
${education}

SKILLS / TOOLS:
${skills}

EXISTING CAREER HIGHLIGHTS (if any, for rewrite):
${existingHighlights || ''}

Task:
- If existing highlights is empty → Generate new according to constraints.
- If it exists → Rewrite to meet the constraints (shorter, clearer), preserving factual content.

Return only the two-sentence paragraph (45–65 words total).
`.trim();
}

export async function POST(req: NextRequest) {
  const { resumeData, currentHighlights = '' } = await req.json();

  const models = ['gpt-4.1-mini-2025-04-14', 'gpt-4.1-mini'];
  let resp: any;
  let lastErr: any;

  for (const model of models) {
    try {
      resp = await chatCompletionsWithFallback(
        openai,
        {
          model,
          temperature: 0.3,
          top_p: 0.9,
          presence_penalty: 0.6,
          frequency_penalty: 0.5,
          n: 1,
          max_tokens: 160,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildUserPrompt(resumeData, currentHighlights || undefined) },
          ],
        },
        'gemini-2.0-flash-exp'
      );
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!resp) throw lastErr ?? new Error('No completion');

  // Type guard: ensure resp is ChatCompletion, not Stream
  if (!('choices' in resp)) {
    throw new Error('Unexpected response type: expected ChatCompletion');
  }

  const text = resp.choices[0]?.message?.content?.trim() || '';

  // Fallback compressor to enforce <= 65 words and 2 sentences
  const wordCount = (s = '') => s.trim().split(/\s+/).filter(Boolean).length;
  async function ensureShortParagraph(input: string) {
    if (wordCount(input) <= 65 && /[.!?]$/.test(input.trim())) return input.trim();
    const prompt = `
Shorten the following Career Highlights to EXACTLY two sentences and no more than 65 words total.
Keep the strongest impact and one concrete metric if present. Remove filler words and tool lists.
Return only the two-sentence paragraph.

Text:
${input}
    `.trim();
    const r = await chatCompletionsWithFallback(
      openai,
      {
        model: models[1] || 'gpt-4.1-mini',
        temperature: 0.2,
        max_tokens: 160,
        messages: [{ role: 'user', content: prompt }],
      },
      'gemini-2.0-flash-exp'
    );
    // Type guard: ensure r is ChatCompletion, not Stream
    if (!('choices' in r)) {
      throw new Error('Unexpected response type: expected ChatCompletion');
    }
    return (r.choices[0].message?.content || '').trim();
  }

  const paragraph = await ensureShortParagraph(text);

  return NextResponse.json({ highlights: paragraph });
}


