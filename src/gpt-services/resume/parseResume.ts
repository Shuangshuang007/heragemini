import OpenAI from 'openai';
import * as mammoth from 'mammoth';
import { createOpenAIClient, chatCompletionsWithFallback } from '../../utils/openaiClient';

// 添加 API Key 检查函数
function checkApiKey() {
  const apiKey = process.env.OPENAI_API_KEY_Parse_Resume;
  if (!apiKey) {
    console.log('❌ Error: OPENAI_API_KEY_Parse_Resume not found in .env.local');
    return false;
  }
  return apiKey.startsWith('sk-');
}

const openai = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY_Parse_Resume,
  baseURL: 'https://api.openai.com/v1',
});

// 添加文本预处理函数
function preprocessResumeText(text: string): string {
  // 移除多余的空白字符
  text = text.replace(/\s+/g, ' ').trim();
  
  // 确保关键信息之间有适当的分隔
  text = text
    .replace(/([.!?])\s*([A-Z])/g, '$1\n$2')  // 在句子之间添加换行
    .replace(/([a-z])\s*([A-Z])/g, '$1\n$2')  // 在小写字母后跟大写字母时添加换行
    .replace(/\n{3,}/g, '\n\n')               // 将多个换行减少为两个
    .trim();
  
  // 如果文本太长，截取前面的部分（避免超出 token 限制）
  const maxLength = 10000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength);
  }
  
  return text;
}

// 添加文件类型检查和处理函数
export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  console.log('File type:', fileType);
  
  try {
    let text = '';
    
    if (fileType === 'text/plain') {
      // Process text file
      text = await file.text();
    } else if (fileType === 'application/pdf') {
      // Process PDF file
      const arrayBuffer = await file.arrayBuffer();
      const dataBuffer = Buffer.from(arrayBuffer);
      // 明确确认类型是 Node.js Buffer
      if (!Buffer.isBuffer(dataBuffer)) {
        throw new Error('PDF input is not a Node.js Buffer');
      }
      const pdfParse = (await import('pdf-parse-debugging-disabled')).default;
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               fileType === 'application/msword') {
      // Process Word file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    // Clean and preprocess text
    text = preprocessResumeText(text);
    console.log('Processed text length:', text.length);
    
    return text;
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error('Unable to read file content, please ensure the file format is correct');
  }
}

export async function parseResumeWithGPT(text: string) {
  try {
    console.log('○ Calling OpenAI API to parse resume...');
    // Call OpenAI API to parse resume
    const completion = await chatCompletionsWithFallback(
      openai,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional resume parser. Your task is to extract **the full list** of work and education experiences from the given resume text. Do not limit the output to the most recent or prominent items — include all relevant entries, even those earlier in time. The resume may contain: - Bullet-point lists - Paragraphs - Tables - Headers like \"Experience\", \"Work History\", \"Education\", \"Academic Background\", etc. - Dates formatted in various ways: \"2023–Present\", \"Feb 2018 – Jan 2022\", \"11/2019–current\", etc. Please note: 1) Dates must be returned in YYYY-MM or YYYY format; 2) For Present, Now, etc., return current year and month; 3) If date doesn't exist, return empty string; 4) Return only JSON, no explanations\n\n**CRITICAL: Name Extraction Rules:**\n- **ALWAYS extract the candidate's full name from the resume**\n- Look for the name at the top of the resume, usually in the header section\n- Common patterns: \"John Smith\", \"J. Smith\", \"Smith, John\", \"John A. Smith\"\n- Split the full name into firstName and lastName\n- For names with middle initials: \"John A. Smith\" → firstName: \"John\", lastName: \"Smith\"\n- For names with prefixes/suffixes: \"Dr. John Smith Jr.\" → firstName: \"John\", lastName: \"Smith\"\n- If the name appears in multiple formats, use the most prominent/complete version\n- **DO NOT leave firstName or lastName empty** unless absolutely no name information is found\n\n**Date Extraction Rules:**\n- For employment and education dates:\n  * If only a year is provided (e.g., '2016'), return just the year as '2016'\n  * If both year and month are provided, return 'YYYY-MM'\n  * Do not guess or fabricate months if not provided\n  * If no date is available, return empty string ''\n\n**CRITICAL: Company Name and Location Parsing Rules:**\n- **Distinguish between \"location mixed into company name\" vs \"company name includes location\"**\n- **Patterns that indicate location mixed into company name:**\n  * Company name ends with city name (Beijing, Shanghai, Melbourne, Sydney)\n  * Company name contains city name in parentheses\n  * Company name follows pattern \"COMPANY + CITY\" where COMPANY is not a known multinational\n  * Resume has separate location field but company name also contains location\n- **Patterns that indicate legitimate company name with location:**\n  * Known multinational subsidiaries (Microsoft Singapore, Google Australia, Apple China)\n  * Company name where location is part of official branding\n  * Company name follows established multinational patterns\n- **Examples:**\n  * \"OCEAN LINK Beijing\" → Separate: company=\"OCEAN LINK\", location=\"Beijing\"\n  * \"Microsoft Singapore\" → Keep together: company=\"Microsoft Singapore\", location=\"\"\n  * \"ZHAOPIN LTD (智联招聘) Beijing\" → Separate: company=\"ZHAOPIN LTD\", location=\"Beijing\"\n  * \"51Talk Beijing\" → Separate: company=\"51Talk\", location=\"Beijing\"\n- **Focus on the resume's original format and context to make this determination**\n\n**School Name Standardization Rules:**\n- Convert school names to Title Case format (first letter of each word capitalized)\n- Examples: \"THE UNIVERSITY OF CHICAGO\" → \"The University of Chicago\"\n- Examples: \"PEKING UNIVERSITY\" → \"Peking University\"\n- Preserve official abbreviations (MIT, UCLA, etc.)\n- Preserve official brand names for business schools\n- Handle multi-language school names properly\n\n**Education Location Parsing Rules:**\n- Extract location information from education entries\n- Look for location in school name (e.g., \"University of Melbourne, Melbourne, Australia\")\n- Look for location in degree description or field of study\n- Look for location mentioned separately in education section\n- Common patterns:\n  * \"University Name, City, Country\"\n  * \"School Name - City\"\n  * \"Degree from University Name (City)\"\n  * \"Field of Study at University Name, Location\"\n- Examples:\n  * \"The University of Chicago Booth School of Business, Chicago, IL\" → location: \"Chicago, IL\"\n  * \"Peking University, Beijing, China\" → location: \"Beijing, China\"\n  * \"Master of Business Administration from Harvard University\" → location: \"Cambridge, MA\"\n  * \"University of Melbourne, Melbourne, Australia\" → location: \"Melbourne, Australia\"\n- If location is not explicitly mentioned, leave as empty string\n- Do not guess or fabricate location information"
          },
          {
            role: "user",
            content: `
Please extract information from the following resume in the following format (must return strict JSON format):

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "country": "",
  "city": "",
  "jobTitles": [],
  "skills": [],
  "seniority": "entry|mid|senior|executive",
  "workingRights": "Working rights text (e.g. 'Australian Citizen', 'US Permanent Resident (Green Card)', 'Singapore Permanent Resident', etc.)",
  "otherWorkingRights": [
    {
      "country": "Country name",
      "workingRights": "Working rights text",
      "status": "CITIZEN|PR|OPEN_WORK_VISA|EMPLOYER_SPONSORED|STUDENT_LIMITED|DEPENDENT_WITH_WORK_RIGHTS|NO_RIGHT|OTHER",
      "visaType": "Optional visa type (e.g. '482', 'H1B', 'EP')"
    }
  ],
  "languages": [
    {
      "language": "",
      "level": ""
    }
  ],
  "education": [
    { 
      "school": "", 
      "degree": "", 
      "field": "",
      "startYear": "", 
      "endYear": "",
      "location": "",
      "summary": "• [First bullet point]\\n• [Second bullet point]\\n• [Third bullet point]"
    }
  ],
  "employmentHistory": [
    { 
      "company": "", 
      "position": "", 
      "startDate": "YYYY-MM or YYYY", 
      "endDate": "YYYY-MM or YYYY",  
      "location": "",
      "summary": "• [First bullet point]\\n• [Second bullet point]\\n• [Third bullet point]"
    }
  ],
  "others": [
    {
      "kind": "volunteering|club|award|speaking|publication|competition|interest|custom",
      "title": "",
      "organization": "",
      "role": "",
      "location": "",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or Present",
      "links": [{ "label": "", "url": "" }],
      "summary": "• [First point]\\n• [Second point]"
    }
  ]
}

Notes:
- Employment and education dates can be in YYYY-MM or YYYY format
- If only year is provided in resume (e.g., "2016"), return just "2016"
- If both year and month are provided, return "YYYY-MM"
- Do not guess or fabricate months if not provided in resume
- For current work (Present, Now, Current, etc.), endDate should be "Present"
- For education dates:
  * If only one year is provided (e.g., "2016"), treat it as the end year (graduation year)
  * If both start and end years are provided, use both
  * Do not guess or fabricate start dates if not provided
- If date doesn't exist, return empty string ""
- Do not use default values or placeholder dates
- If some fields (like location or field) are not available, omit them — don't guess or fabricate
- Ensure entries are listed in chronological order, with the most recent first

**Summary Processing Rules:**
- **If the resume already has bullet points**: Preserve all original bullet points exactly as they appear, but proofread for:
  * Obvious grammar and spelling errors
  * Remove duplicate information
  * Fix punctuation and formatting
- **If the resume has paragraph text**: Extract key information into bullet points, maintaining the original meaning and details
- **Format**: Each bullet point should start with "• " and be separated by newline characters (\n)
- **Preservation**: Keep all original information, do not add or remove significant content
- **Proofreading only**: Focus on correcting obvious errors
- **Accuracy**: Maintain the exact meaning and details from the original resume

**Education Summary Extraction Rules:**
- **ALWAYS extract education summary information** from the resume, including:
  * Scholarships, awards, honors, and academic achievements
  * Research projects, thesis topics, and academic publications
  * Relevant coursework, specializations, and academic activities
  * Internships, academic competitions, and leadership roles
  * GPA, academic rankings, and merit-based recognitions
- **If no education summary information is found**, return empty string ""
- **Format education summary as bullet points** starting with "• " and separated by newlines
- **Examples of education summary content**:
  * "• Chicago Booth 1898 Scholarship"
  * "• Received the Highest Comprehensive Award, First-Class Merit Scholarship"
  * "• GPA: 3.8/4.0, Dean's List for 3 consecutive years"
  * "• Research Assistant in Machine Learning Lab"
  * "• President of Computer Science Club"
- **Do not fabricate or guess** education summary information if not present in the resume

**Others Extraction Rules:**
- Identify and extract sections related to volunteering/community service, clubs/teams/societies (incl. Toastmasters), awards/competitions, speaking/publications, and professional interests.
- For each item, keep factual details only; do not invent.
- Dates must follow the same format rules as employment/education.
- If URLs are present, include them under links; otherwise omit.
- Summary must use bullet points starting with "• " and newline-separated.

**CRITICAL: Country Inference Logic:**
- **Phone number analysis**: If phone starts with +61, country should be "Australia"
- **City analysis**: If city is Melbourne, Sydney, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin, Gold Coast, Newcastle, Wollongong, Geelong, Townsville, Cairns, Toowoomba, Ballarat, Bendigo, Albury, Launceston, Rockhampton, Mackay, Bundaberg, Coffs Harbour, Wagga Wagga, Hervey Bay, Mildura, Shepparton, Gladstone, Mount Gambier, Whyalla, Port Lincoln, Kalgoorlie, Geraldton, Albany, Karratha, Broome, Alice Springs, Katherine, Tennant Creek, country should be "Australia"
- **Education analysis**: If education mentions Australian universities (University of Melbourne, University of Sydney, Monash University, University of Queensland, University of Western Australia, Australian National University, etc.), country should be "Australia"
- **Work experience analysis**: If work experience mentions Australian companies or locations, country should be "Australia"
- **Default logic**: If phone is +61 OR city is Australian OR education/work is in Australia, set country to "Australia"
- **Fallback**: If no clear indicators, leave country as empty string

**Working Rights Logic:**
- Extract working rights for the primary country (based on country inference)
- For primary country, use standard format: "Country Name + Status" (e.g. "Australian Citizen", "US Permanent Resident (Green Card)")
- If person has multiple countries' work rights mentioned in resume, add them to "otherWorkingRights" array
- For each work right, try to infer:
  * status: CITIZEN, PR, OPEN_WORK_VISA, EMPLOYER_SPONSORED, STUDENT_LIMITED, DEPENDENT_WITH_WORK_RIGHTS, NO_RIGHT, or OTHER
  * visaType: Extract specific visa type if mentioned (e.g. "482", "H1B", "EP")
- If person has work experience in a country or studied there, likely has work rights in that country
- If visa type is mentioned (e.g. "H1B visa", "482 visa"), extract it to visaType field

**Seniority Inference Logic:**
- entry: 0-3 years experience, junior positions
- mid: 3-7 years experience, intermediate roles  
- senior: 7-10 years experience, senior/lead positions
- executive: 10+ years experience + management role (Manager, Director, VP, etc.)
- Consider job titles and years of experience for accurate inference
- For executive level, must have both 10+ years experience AND management role
- **CRITICAL: Return only the value (entry, mid, senior, executive), NOT the display text**
- **DO NOT return "Entry Level", "Mid Level", "Senior Level", "Executive Level"**
- **ONLY return: entry, mid, senior, or executive**

**Languages Logic:**
- If person has consistently received education in English-speaking countries (Australia, US, UK, Canada, etc.), default English to "Native"
- If person has studied in English-medium institutions or has English as primary language of instruction, default English to "Native"
- If person has work experience in English-speaking environments, consider English as "Fluent" or "Native"
- For other languages, infer from education background, work experience, or explicitly mentioned language skills
- Choose level from: "Native", "Fluent", "Conversational", "Basic"

Here is the resume content:
${text}
          `.trim()
          }
        ],
        temperature: 0,
        max_tokens: 8192, // Gemini 最大支持 8192 tokens
        // 注意：Gemini 可能不支持 response_format，但会在 prompt 中要求返回 JSON
        response_format: { type: "json_object" } // 尝试使用，如果失败会在 fallback 中处理
      },
      'gemini-2.0-flash-exp'
    );
    
    // Type guard: ensure completion is ChatCompletion, not Stream
    if (!('choices' in completion)) {
      throw new Error('Unexpected response type: expected ChatCompletion');
    }
    
    let raw = completion.choices?.[0]?.message?.content || '';
    raw = raw.replace(/^```json\s*|```$/g, '').trim();
    console.log('✓ Received response from API');
    console.log('Raw response length:', raw.length);
    console.log('Raw response preview (first 500 chars):\n' + raw.substring(0, 500));

    try {
      // 尝试提取 JSON 部分（如果响应包含其他文本）
      let jsonText = raw;
      
      // 如果响应包含 JSON 块，提取它
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      // Gemini 可能返回未转义的换行符，需要修复
      // 在字符串值中，将实际的换行符转义为 \\n
      // 使用正则表达式匹配 JSON 字符串值中的换行符
      jsonText = jsonText.replace(/: "([^"]*)"([,\n}])/g, (match, content, suffix) => {
        // 如果内容包含未转义的换行符，转义它们
        if (content.includes('\n') && !content.includes('\\n')) {
          const escaped = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          return `: "${escaped}"${suffix}`;
        }
        return match;
      });
      
      // 处理多行字符串值（更健壮的方法）
      // 匹配 ": "..." 格式的字符串值，包括跨行的
      jsonText = jsonText.replace(/: "([^"]*(?:"[^",}\]]*)*)"([,\n}])/g, (match, content, suffix) => {
        // 检查是否有未转义的换行符
        if (content.match(/(?<!\\)\n/)) {
          const escaped = content
            .replace(/\\(?!["\\/bfnrt])/g, '\\\\') // 转义反斜杠（除了已转义的）
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
          return `: "${escaped}"${suffix}`;
        }
        return match;
      });
      
      // 更简单但更可靠的方法：使用状态机修复字符串值中的换行符
      let fixedJson = '';
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        const nextChar = jsonText[i + 1];
        
        if (escapeNext) {
          fixedJson += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          fixedJson += char;
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          fixedJson += char;
          continue;
        }
        
        if (inString && char === '\n') {
          // 在字符串值中，将换行符转义
          fixedJson += '\\n';
        } else if (inString && char === '\r') {
          fixedJson += '\\r';
        } else if (inString && char === '\t') {
          fixedJson += '\\t';
        } else {
          fixedJson += char;
        }
      }
      
      jsonText = fixedJson;
      
      // 检查 JSON 是否完整（以 } 结尾）
      if (!jsonText.trim().endsWith('}')) {
        console.warn('⚠️ JSON response may be truncated, attempting to fix...');
        // 尝试修复不完整的 JSON（添加缺失的闭合括号）
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        if (missingBraces > 0) {
          jsonText += '\n' + '}'.repeat(missingBraces);
          console.log(`Added ${missingBraces} closing brace(s) to fix JSON`);
        }
      }
      
      const parsed = JSON.parse(jsonText);
      console.log('✓ Successfully parsed JSON response');
      
      // 只清理乱码字符，不改变数据结构
      // 清理 workingRights 字段的乱码
      if (parsed.workingRights) {
        if (typeof parsed.workingRights === 'string') {
          parsed.workingRights = parsed.workingRights
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 移除控制字符
            .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // 保留可打印字符和Unicode字符
            .trim();
        }
      }
      
      // 清理 otherWorkingRights 数组中的乱码，并确保同一个国家只有一个条目（保留第一个）
      if (Array.isArray(parsed.otherWorkingRights)) {
        const seenCountries = new Set<string>();
        
        parsed.otherWorkingRights = parsed.otherWorkingRights
          .map((item: any) => {
            if (item && typeof item === 'object') {
              // 清理乱码
              if (item.workingRights && typeof item.workingRights === 'string') {
                item.workingRights = item.workingRights
                  .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                  .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
                  .trim();
              }
              if (item.country && typeof item.country === 'string') {
                item.country = item.country
                  .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                  .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
                  .trim();
              }
              if (item.status && typeof item.status === 'string') {
                item.status = item.status
                  .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                  .trim();
              }
              if (item.visaType && typeof item.visaType === 'string') {
                item.visaType = item.visaType
                  .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                  .trim();
              }
              
              return item;
            }
            return null;
          })
          .filter((item: any) => {
            // 过滤掉无效项
            if (!item || typeof item !== 'object') {
              return false;
            }
            
            // 基于国家去重：同一个国家只保留第一个
            const country = (item.country || '').trim().toLowerCase();
            if (!country) {
              return true; // 没有国家信息的保留
            }
            
            if (seenCountries.has(country)) {
              return false; // 重复的国家，过滤掉
            }
            
            seenCountries.add(country);
            return true; // 第一个出现的国家，保留
          });
      }
      
      // Log parsed data details
      console.log(`Found ${parsed.skills?.length || 0} skills`);
      console.log(`Found ${parsed.education?.length || 0} education entries`);
      console.log(`Found ${parsed.employmentHistory?.length || 0} employment entries`);
      console.log(`Working rights: ${parsed.workingRights || 'not set'}`);
      
      if (parsed.employmentHistory?.length > 0) {
        console.log('Employment history dates:');
        parsed.employmentHistory.forEach((emp: any, index: number) => {
          console.log(`  ${index + 1}. ${emp.company}: ${emp.startDate} to ${emp.endDate}`);
        });
      }

      return parsed;
    } catch (e) {
      console.error('❌ Error: Failed to parse JSON response');
      console.error('Raw response:\n' + raw);
      throw new Error("Failed to parse response as JSON");
    }
  } catch (error: any) {
    console.error('❌ Error: Resume parsing failed');
    console.error('Error details:\n' + error.stack);
    throw new Error(`Resume parsing failed: ${error.message}`);
  }
} 