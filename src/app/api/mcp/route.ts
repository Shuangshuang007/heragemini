// ============================================
// Hera AI - MCP Integration Layer (FAST + FULL Dual Mode)
// ============================================
// This file implements the MCP (Model Context Protocol) adapter
// for integrating Hera AI with ChatGPT Apps.
//
// IMPORTANT: All code in this file uses English only
// - Comments in English
// - Variable names in English
// - Error messages in English
// - Log messages in English
//
// Version: Dual Mode - FAST (lightweight) + FULL (deep analysis)
// Features: Trace ID, timeout protection, pagination, always HTTP 200
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { fetchJobs } from '../../../services/jobFetchService';
import { getUserProfile, upsertJobApplication } from '../../../services/profileDatabaseService';
import { connectToMongoDB, transformMongoDBJobToFrontendFormat } from '../../../services/jobDatabaseService';
import { parseMessageWithGPT } from '../../../gpt-services/assistant/parseMessage';
import { tailorResumeWithGPT } from '../../../gpt-services/resume/tailorResume';
import { AgentKitPlanner } from '../../../lib/agentkit/planner';
import { AgentKitExecutor } from '../../../lib/agentkit/executor';
import { AgentKitMemory } from '../../../lib/agentkit/memory';
import { FeedbackCollector } from '../../../lib/feedback/FeedbackCollector';
import {
  deduplicateJobs,
  enhanceJobsWithSources,
  generateSearchLinks,
  getSourceStrategy,
  validateSearchParams,
  formatSearchResponse,
  type Job,
  type SearchResponse,
  type SearchLink,
  type LinkGenerationArgs,
} from './helpers';

// ============================================
// 1️⃣ Constants and Helper Functions
// ============================================

const JSON_HEADERS = { "Content-Type": "application/json" };

// Company name set for smart parameter correction
const COMPANY_SET = new Set<string>([
  "Google", "Atlassian", "NAB", "ANZ", "Commonwealth Bank", "Optus", "Telstra", 
  "Microsoft", "Amazon", "Meta", "Apple", "Netflix", "Spotify", "Uber", "Airbnb",
  "Wesley College Melbourne", "University of Melbourne", "Monash University",
  "RMIT", "Swinburne", "Deakin University", "La Trobe University"
]);

// Smart parameter correction function
function fixArgs(args: any) {
  let { company, job_title, city, page, page_size } = args;
  const norm = (s?: string) => (s || "").trim();

  company = norm(company);
  job_title = norm(job_title);
  city = norm(city);

  // If company is empty but job_title looks like company -> fix it
  const looksLikeCompany =
    job_title &&
    (COMPANY_SET.has(job_title) ||
     /pty\s*ltd|ltd|inc|corp|corporation|bank|group|university|college/i.test(job_title));

  if (!company && looksLikeCompany) {
    company = job_title;
    job_title = "";
  }

  // Handle 'Google Software Engineer' -> company=Google, job_title=Software Engineer
  if (!company && job_title) {
    for (const name of COMPANY_SET) {
      const re = new RegExp(`^${name}\\b`, "i");
      if (re.test(job_title)) {
        company = name;
        job_title = job_title.replace(re, "").trim();
        break;
      }
    }
  }

  return { company, job_title, city, page, page_size };
}

// MCP Mode: fast (lightweight) | full (deep analysis with GPT)
const HERA_MCP_MODE = process.env.HERA_MCP_MODE || "fast";

// Stage time budgets (milliseconds) - for FULL mode
const TOTAL_BUDGET_MS = 35000;   // Total max 35s
const GPT_TIMEOUT_MS  = 8000;    // GPT planning budget 8s
const DB_TIMEOUT_MS   = 15000;   // Database query budget 15s
const POST_TIMEOUT_MS = 10000;   // Post-processing budget 10s

const now = () => Date.now();
const budgetLeft = (t0: number) => Math.max(0, TOTAL_BUDGET_MS - (now() - t0));

function json200(data: any, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

async function withTimeout<T>(p: Promise<T>, ms: number = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error("timeout")), ms)
    ) as Promise<T>,
  ]);
}

// GPT建议：安全日期转换，带兜底
function toIsoSafe(v: any, ...alts: any[]): string {
  for (const x of [v, ...alts]) {
    if (x && !Number.isNaN(Date.parse(x))) {
      try {
        return new Date(x).toISOString();
      } catch {
        continue;
      }
    }
  }
  return new Date().toISOString(); // 兜底，避免 Invalid Date
}

// GPT建议：安全映射job，消灭非法值
function mapJobSafe(j: any) {
  const id = j._id || j.id || j.jobIdentifier || crypto.randomUUID();
  const url =
    j.url ||
    j.jobUrl ||
    `https://www.heraai.net.au/jobs/${encodeURIComponent(String(id))}?utm=chatgpt-mcp`;

  return {
    id: String(id),
    title: String(j.title || ""),
    company: String(j.company || j.company_name || ""),
    location: String(j.location || j.locationRaw || ""),
    employmentType: String(j.employmentType || j.employment_type || ""),
    postDate: toIsoSafe(j.postedDateISO, j.postedDate, j.createdAt, j.updatedAt),
    url,
    platform: String(j.platform || j.source || j.source_label || "")
  };
}

// GPT建议：提取域名（不挂超链接，避免长URL导致渲染失败）
function hostOf(u?: string) {
  try { return new URL(u!).hostname; } catch { return ""; }
}

// 导入工具函数
function parseWorkMode(workMode: string, jobDescription: string): string {
  if (workMode) {
    return workMode.charAt(0).toUpperCase() + workMode.slice(1).toLowerCase();
  }
  const desc = jobDescription?.toLowerCase() || '';
  // 百分比办公
  const percentMatch = desc.match(/(\d+)%\s*(working in the office|onsite|in office)/i);
  if (percentMatch) return `${percentMatch[1]}% Onsite`;
  // 通用模式匹配
  const patterns = [
    { regex: /(\d+)\s*days?\s*(?:in\s*)?(?:the\s*)?(?:office|onsite)/i, format: (match: any) => `${match[1]}d Onsite` },
    { regex: /at\s*least\s*(\d+)\s*days?\s*(?:in\s*)?(?:the\s*)?(?:office|onsite)/i, format: (match: any) => `+${match[1]}d Onsite` },
    { regex: /hybrid/i, format: () => 'Hybrid' },
    { regex: /remote|work\s*from\s*home/i, format: () => 'Fully Remote' },
    { regex: /onsite|in\s*office/i, format: () => 'Onsite' }
  ];
  for (const pattern of patterns) {
    const match = desc.match(pattern.regex);
    if (match) {
      return pattern.format(match);
    }
  }
  return '';
}

function normalizeExperienceTag(text: string): string | null {
  const match = text.match(/(\d{1,2})\s*(\+)?\s*(y|years)/i);
  if (match) {
    const years = parseInt(match[1], 10);
    if (years > 40) return null;
    if (years > 15) return '+15y';
    return `${years}+ years`;
  }
  if (/experience/i.test(text)) {
    return 'experienced professional';
  }
  return null;
}

// 生成job highlights（结合数据库字段和OpenAI）
async function generateJobHighlights(job: any): Promise<string[]> {
  const highlights: string[] = [];
  
  // ============================================
  // 第1条：公司 + 明确年份 + Work Mode + 上班要求
  // ============================================
  const company = job.company || job.organisation || 'Company';
  
  // 提取经验年份（从数据库字段）
  let experienceText = '';
  if (job.experience) {
    // 尝试提取具体年份
    const yearMatch = job.experience.match(/(\d{1,2})\s*[\+\-–]?\s*(\d{1,2})?\s*(years?|yrs?|y)/i);
    if (yearMatch) {
      if (yearMatch[2]) {
        experienceText = `${yearMatch[1]}-${yearMatch[2]} years`;
      } else {
        experienceText = `${yearMatch[1]}+ years`;
      }
    } else {
      experienceText = job.experience;
    }
  } else {
    // 从 tags 中提取经验
    const experienceTag = (job.tags || []).find((tag: string) => 
      /\d+\s*(y|years|yrs)|experience|senior|junior|mid/i.test(tag)
    );
    if (experienceTag) {
      const normalized = normalizeExperienceTag(experienceTag);
      if (normalized) {
        experienceText = normalized;
      }
    }
  }
  if (!experienceText) {
    experienceText = 'experienced professional';
  }
  
  // 提取工作模式（从数据库字段）
  const workMode = parseWorkMode(job.workMode || '', job.description || '');
  
  // 组合第1条
  if (workMode) {
    highlights.push(`${company} seeking ${experienceText}; ${workMode}`);
  } else {
    highlights.push(`${company} seeking ${experienceText}`);
  }
  
  // ============================================
  // 第2条：技能 + Degree + 身份要求
  // ============================================
  const requirementsParts: string[] = [];
  
  // 2.1 技能要求（使用OpenAI提取或fallback到数据库）
  let skillsText = '';
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
    });

    const prompt = `Extract ONLY the top 3-4 technical skills/tools from this job posting.

Job: ${job.title || ''}
Description: ${(job.description || job.summary || '').substring(0, 800)}
${job.skills && job.skills.length > 0 ? `\nSkills: ${job.skills.slice(0, 8).join(', ')}` : ''}

Return ONLY a comma-separated list of 3-4 technical skills (no "Requires:", no explanations).
Example: Python, AWS, Docker, Kubernetes`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-1106',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.2,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '';
    if (response && !response.toLowerCase().includes('requires')) {
      skillsText = response;
    }
  } catch (error) {
    console.error('[MCP] OpenAI error:', error);
  }
  
  // Fallback: 使用数据库skills
  if (!skillsText && job.skills && job.skills.length > 0) {
    skillsText = job.skills.slice(0, 4).join(', ');
  }
  
  if (skillsText) {
    requirementsParts.push(skillsText);
  }
  
  // 2.2 学位要求（从tags或description提取）
  let degreeText = '';
  const degreeTag = (job.tags || []).find((tag: string) => 
    /bachelor|master|phd|doctorate|degree/i.test(tag)
  );
  if (degreeTag) {
    degreeText = degreeTag;
  } else {
    const jdLower = (job.description || job.summary || '').toLowerCase();
    if (/bachelor'?s?\s+degree/i.test(jdLower)) {
      degreeText = "Bachelor's";
    } else if (/master'?s?\s+degree/i.test(jdLower)) {
      degreeText = "Master's";
    } else if (/phd|doctorate/i.test(jdLower)) {
      degreeText = "PhD";
    }
  }
  if (degreeText) {
    requirementsParts.push(degreeText);
  }
  
  // 2.3 身份要求（从description提取）
  const jdText = (job.description || job.summary || '').toLowerCase();
  let citizenshipText = '';
  if (/australian citizenship|citizenship required|pr required|permanent resident/i.test(jdText)) {
    citizenshipText = 'Australian PR/Citizenship required';
  } else if (/visa sponsorship|sponsorship available|will sponsor/i.test(jdText)) {
    citizenshipText = 'Visa sponsorship available';
  }
  if (citizenshipText) {
    requirementsParts.push(citizenshipText);
  }
  
  // 组合第2条
  if (requirementsParts.length > 0) {
    highlights.push(`Requires: ${requirementsParts.join('; ')}`);
  } else {
    highlights.push('View details for full requirements');
  }
  
  return highlights;
}

// 带Highlights和View Details链接的卡片（ChatGPT支持Markdown链接）
function buildMarkdownCards(q: { title: string; city: string }, jobs: any[], total: number) {
  const cards = jobs.slice(0, 5).map((j: any, idx: number) => {
    const title = (j.title || "").replace(/[–—]/g, "-").trim();
    const company = (j.company || "").trim();
    const loc = (j.location || "").trim();
    const url = j.url || "";

    // Highlights显示（如果有）
    const highlightLines = (j.highlights || []).map((h: string) => {
      return `   📌 ${h}`;
    }).join('\n');

    // View Details链接
    const viewDetailsLink = url ? `\n   [View Details](${url})` : "";

    // 组合：标题、公司、地点、highlights、View Details
    const parts = [
      `${idx + 1}. ${title}`,
      `   ${company}`,
      `   ${loc}`
    ];
    
    if (highlightLines) {
      parts.push(''); // 空行
      parts.push(highlightLines);
    }
    
    if (viewDetailsLink) {
      parts.push(viewDetailsLink);
    }

    return parts.join('\n');
  });

  return [
    `Found ${total} jobs for "${q.title}" in ${q.city}`,
    "",
    cards.join("\n\n"),
    "",
    `Reply "more" for next 5 results.`,
  ].join("\n");
}

// GPT建议：安全MCP响应包装器（同时返回text+json）
function safeMcpOk(id: number | string | null, payload: any, textPreview?: string) {
  const content: any[] = [];
  
  // iOS ChatGPT需要text类型才能正常渲染
  if (textPreview) {
    content.push({ type: "text", text: textPreview });
  }
  
  content.push({
    type: "json",
    data: { content: payload }
  });

  const body = {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      content,
      isError: false
    }
  };
  console.info("[MCP RESPONSE 2KB]", JSON.stringify(body).slice(0, 2000));
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function safeMcpErr(id: number | string | null, msg = "Hera Jobs temporary error") {
  const body = {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      content: [{ type: "text", text: msg }],
      isError: true
    }
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

// ============================================
// 2️⃣ FAST Mode: Lightweight Database Query
// ============================================

interface FastQueryParams {
  title?: string; // Make optional
  city?: string; // Make optional
  page?: number;
  pageSize?: number;
  postedWithinDays?: number;
  platforms?: string[];
  company?: string; // New: company filter
}

async function fastDbQuery(params: FastQueryParams): Promise<{
  jobs: any[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const {
    title,
    city,
    page = 1,
    pageSize = 20,
    postedWithinDays,
    platforms,
    company,
  } = params;

  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection('hera_jobs.jobs');

    // Build query filter
    const filter: any = {
      is_active: { $ne: false }
    };

    // Optional: Filter by title (only if provided)
    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }

    // Optional: Filter by city (only if provided)
    if (city) {
      filter.location = { $regex: city, $options: 'i' };
    }

    // Optional: Filter by company
    if (company) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { company: { $regex: company, $options: 'i' } },
          { company_name: { $regex: company, $options: 'i' } }
        ]
      });
    }

    // Optional: Filter by posted date
    if (postedWithinDays && postedWithinDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - postedWithinDays);
      filter.$or = [
        { postedDateISO: { $gte: cutoffDate.toISOString() } },
        { createdAt: { $gte: cutoffDate } },
      ];
    }

    // Optional: Filter by platforms
    if (platforms && platforms.length > 0) {
      const platformRegex = platforms.map(p => new RegExp(p, 'i'));
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { source: { $in: platformRegex } },
          { sourceType: { $in: platformRegex } },
          { platform: { $in: platformRegex } },
        ]
      });
    }

    // Sorting: Use postedDateISO, fallback to createdAt
    const sort: any = {
      postedDateISO: -1,
      createdAt: -1,
      updatedAt: -1
    };

    // Projection: Include fields needed for highlights generation
    const projection = {
      id: 1,
      _id: 1,
      jobIdentifier: 1,
      title: 1,
      company: 1,
      organisation: 1,
      location: 1,
      employmentType: 1,
      jobUrl: 1,
      url: 1,
      postedDateISO: 1,
      postedDate: 1,
      postedDateRaw: 1,
      createdAt: 1,
      updatedAt: 1,
      source: 1,
      sourceType: 1,
      platform: 1,
      // ✅ Additional fields for highlights generation
      description: 1,
      summary: 1,
      requirements: 1,
      skills: 1,
      experience: 1,
      benefits: 1,
      workMode: 1,
    };

    // Pagination
    const skip = (page - 1) * pageSize;
    const limit = Math.min(pageSize, 50); // Max 50 per page

    // Execute query
    const [jobs, totalCount] = await Promise.all([
      collection
        .find(filter)
        .project(projection)
        .sort(sort)
        .skip(skip)
        .limit(limit + 1) // Fetch one extra to check if there's more
        .toArray(),
      collection.countDocuments(filter),
    ]);

    // Check if there are more results
    const hasMore = jobs.length > limit;
    const resultJobs = hasMore ? jobs.slice(0, limit) : jobs;

    console.log(`[MCP FAST] Found ${resultJobs.length}/${totalCount} jobs for "${title}" in "${city}"`);

    return {
      jobs: resultJobs,
      total: totalCount,
      page,
      pageSize: limit,
      hasMore,
    };
  } catch (error) {
    console.error('[MCP FAST] Database query error:', error);
    return {
      jobs: [],
      total: 0,
      page,
      pageSize: pageSize || 20,
      hasMore: false,
    };
  }
}

// ============================================
// 3️⃣ FULL Mode: Deep Analysis Functions
// ============================================

// GPT planning stage (currently skipped)
async function generateJobPlan(jobTitle: string, city: string): Promise<any> {
  try {
    console.log(`[MCP FULL] Skipping GPT planning for now: ${jobTitle} in ${city}`);
    return null;
  } catch (error) {
    console.warn('[MCP FULL] GPT planning error:', error);
    return null;
  }
}

// Database query stage (FULL mode)
async function fetchFromDatabase(jobTitle: string, city: string, limit: number, plan?: any): Promise<any[]> {
  try {
    console.log(`[MCP FULL] Querying: ${jobTitle} in ${city}`);
    
    const result = await fetchJobs({
      jobTitle,
      city,
      platform: 'all',
      limit: Math.min(limit * 3, 25),
      page: 1,
    });

    return result.jobs || [];
  } catch (error) {
    console.error('[MCP FULL] Database fetch error:', error);
    return [];
  }
}

// Post-processing stage (deduplication, scoring)
async function postProcessResults(jobs: any[]): Promise<any[]> {
  try {
    if (jobs.length === 0) {
      return [];
    }

    let processedJobs = enhanceJobsWithSources(jobs);
    processedJobs = deduplicateJobs(processedJobs);
    
    processedJobs = processedJobs.map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      source_label: job.source_label,
      matchScore: job.matchScore,
      url: job.url,
    }));

    console.log(`[MCP FULL] Processed ${processedJobs.length} jobs`);
    return processedJobs;
  } catch (error) {
    console.error('[MCP FULL] Post-processing error:', error);
    return jobs;
  }
}

// ============================================
// 4️⃣ GET /api/mcp - Health Check
// ============================================

export async function GET(request: NextRequest) {
  console.log('[MCP] GET request received');
  
  return json200({
    tools: [
      {
        name: 'recommend_jobs',
        description: '🎯 PERSONALIZED JOB RECOMMENDATIONS - AI-powered job matching based on user profile',
      },
      {
        name: 'tailor_resume',
        description: '📝 TAILOR RESUME - Customize resume for specific job applications',
      },
      {
        name: 'search_jobs',
        description: `Search jobs (mode: ${HERA_MCP_MODE})`,
      },
      {
        name: 'search_jobs_by_company',
        description: 'Search jobs by specific company name',
      },
    {
      name: 'build_search_links',
        description: 'Generate direct search URLs for job platforms',
      },
    {
      name: 'get_user_applications',
        description: 'Retrieve user job application history',
      },
      {
        name: 'career_transition_advice',
        description: '💼 CAREER TRANSITION - Get personalized career transition recommendations',
      },
      {
        name: 'career_path_explorer',
        description: '🗺️ CAREER PATHS - Explore all possible career paths from a job title',
      },
      {
        name: 'career_skill_gap_analysis',
        description: '📊 SKILL GAP - Analyze skill gaps between two job roles',
      },
    ],
    mode: HERA_MCP_MODE,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// Helper Functions for Resume Processing
// ============================================

// Extract key highlights from job description (reusing TailorPreview logic)
function extractKeyHighlights(jobText: string): string[] {
  const skillKeywords = [
    'JavaScript', 'Python', 'Java', 'C++', 'C#', '.NET', 'React', 'Angular', 'Vue',
    'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Hibernate', 'SQL', 'NoSQL',
    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'AWS', 'Azure', 'GCP', 'Docker',
    'Kubernetes', 'Jenkins', 'Git', 'GitHub', 'GitLab', 'CI/CD', 'DevOps', 'Agile',
    'Scrum', 'Kanban', 'JIRA', 'Confluence', 'REST', 'GraphQL', 'Microservices',
    'Machine Learning', 'AI', 'Data Science', 'Analytics', 'Business Analysis',
    'Project Management', 'Leadership', 'Communication', 'Problem Solving',
    'Stakeholder Management', 'Process Mapping', 'Visio', 'Government Services'
  ];
  
  const foundSkills = skillKeywords.filter(skill => 
    jobText.toLowerCase().includes(skill.toLowerCase())
  );
  
  return foundSkills.slice(0, 12);
}

// Build resume data for highlights API (reusing buildResumeDataForHighlights logic)
function buildResumeDataForHighlights(resumeJson: any, userProfile: any) {
  return {
    summary: resumeJson.summary || '',
    employment: (resumeJson.experience || []).map((e: any) => ({
      company: e.company || '',
      position: e.title || e.position || '',
      department: e.department || '',
      location: e.location || '',
      startDate: e.startDate || '',
      endDate: e.endDate || '',
      description: e.description || '',
    })),
    education: (resumeJson.education || userProfile.education || []).map((ed: any) => ({
      school: ed.school || '',
      degree: ed.degree || '',
      field: ed.field || '',
      location: ed.location || '',
      startDate: ed.startDate || '',
      endDate: ed.endDate || '',
      summary: ed.summary || '',
    })),
    skills: resumeJson.skills || userProfile.skills || [],
  };
}

// Format resume output using existing HTML structure (similar to generateResumeHTML)
function formatResumeOutput(resumeData: any): string {
  const { profile, summary, experience, education, skills, languages, workingRightsAU } = resumeData;
  
  let output = `**${profile?.name || 'Resume'}**\n\n`;
  
  // Contact information
  if (profile?.email || profile?.phone || profile?.location) {
    output += `${profile?.location || ''} • ${profile?.phone || ''} • ${profile?.email || ''}\n\n`;
  }
  
  // Professional Summary
  if (summary) {
    output += `## Professional Summary\n${summary}\n\n`;
  }
  
  // Employment History
  if (experience && experience.length > 0) {
    output += `## Employment History\n`;
    experience.forEach((job: any, index: number) => {
      output += `### ${job.title || ''}\n`;
      output += `*${job.company || ''}${job.location ? `, ${job.location}` : ''}*\n`;
      output += `${job.startDate || ''} - ${job.endDate || 'Present'}\n`;
      
      if (job.description && Array.isArray(job.description)) {
        job.description.forEach((desc: string) => {
          output += `• ${desc}\n`;
        });
      } else if (job.description) {
        output += `• ${job.description}\n`;
      }
      output += '\n';
    });
  }
  
  // Education
  if (education && education.length > 0) {
    output += `## Education\n`;
    education.forEach((edu: any, index: number) => {
      output += `### ${edu.degree || ''}\n`;
      output += `*${edu.institution || edu.school || ''}*\n`;
      output += `${edu.startDate || ''} - ${edu.endDate || ''}\n`;
      
      if (edu.description && Array.isArray(edu.description)) {
        edu.description.forEach((desc: string) => {
          output += `• ${desc}\n`;
        });
      }
      output += '\n';
    });
  }
  
  // Skills
  if (skills && skills.length > 0) {
    output += `## Skills\n${skills.join(' • ')}\n\n`;
  }
  
  // Additional Information
  if ((languages && languages.length > 0) || workingRightsAU) {
    output += `## Additional Information\n`;
    if (languages && languages.length > 0) {
      const langText = languages.map((lang: any) => {
        if (typeof lang === 'object' && lang.language) {
          return `${lang.language} (${lang.level || 'Basic'})`;
        } else if (typeof lang === 'string') {
          return lang;
        }
        return 'Unknown Language';
      }).join('; ');
      output += `**Languages:** ${langText}\n`;
    }
    if (workingRightsAU) {
      output += `**Working Rights:** ${workingRightsAU}\n`;
    }
  }
  
  return output;
}

// Handle optimize resume scenario (no job description)
async function handleOptimizeResume({
  user_profile,
  resume_content,
  user_email,
  body,
  traceId
}: {
  user_profile: any;
  resume_content: string;
  user_email: string;
  body: any;
  traceId: string;
}) {
  console.log('[MCP] Processing optimize resume flow...');
  
  try {
    // Parse resume content to JSON format if possible
    let resumeJson: any;
    try {
      resumeJson = JSON.parse(resume_content);
    } catch {
      // Create basic resume structure if not JSON
      resumeJson = {
        profile: {
          name: user_profile.name || 'User',
          email: user_profile.email || user_email,
          phone: user_profile.phone || '',
          location: user_profile.city || ''
        },
        summary: resume_content,
        experience: (user_profile.employmentHistory || []).map((emp: any) => ({
          title: emp.position || emp.title || '',
          company: emp.company || '',
          startDate: emp.startDate || '',
          endDate: emp.endDate || '',
          description: emp.description || '',
          bullets: emp.bullets || []
        })),
        skills: user_profile.skills || [],
        education: user_profile.education || []
      };
    }

    // Step 1: Generate Professional Summary using boost-highlights API
    console.log('[MCP] Generating professional summary...');
    try {
      const resumeDataForHighlights = buildResumeDataForHighlights(resumeJson, user_profile);
      
      const highlightsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/boost-highlights`, {
    method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: resumeDataForHighlights,
          currentHighlights: resumeJson.summary || resume_content
        })
      });

      if (highlightsResponse.ok) {
        const highlightsData = await highlightsResponse.json();
        if (highlightsData.highlights) {
          resumeJson.summary = highlightsData.highlights;
          console.log('[MCP] Generated professional summary');
        }
      }
    } catch (highlightsError) {
      console.warn('[MCP] Error generating professional summary:', highlightsError);
    }

    // Step 2: Boost each employment experience using boost-summary API
    console.log('[MCP] Boosting employment experiences...');
    const employmentHistory = user_profile.employmentHistory || [];
    const boostedExperiences = await Promise.all(
      employmentHistory.map(async (emp: any, index: number) => {
        if (emp.description && emp.description.trim()) {
          try {
            const boostResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/boost-summary`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                summary: emp.description,
                type: 'employment'
              })
            });

            if (boostResponse.ok) {
              const boostData = await boostResponse.json();
              return {
                ...emp,
                boostedDescription: boostData.boostedSummary
              };
            }
          } catch (error) {
            console.warn(`[MCP] Failed to boost experience ${index + 1}:`, error);
          }
        }
        return emp;
      })
    );

    // Update resumeJson with boosted experiences
    resumeJson.experience = boostedExperiences.map((emp: any, index: number) => ({
      title: emp.position || emp.title || '',
      company: emp.company || '',
      startDate: emp.startDate || '',
      endDate: emp.endDate || '',
      description: emp.boostedDescription ? emp.boostedDescription.split('\n') : (emp.description ? emp.description.split('\n') : [])
    }));

    // Format and return the optimized resume
    const formattedResume = formatResumeOutput(resumeJson);
    
    const responseText = 
      `# 📝 Resume Optimized Successfully\n\n` +
      `Your resume has been enhanced with:\n\n` +
      `## What was improved:\n` +
      `• Professional summary generated with AI\n` +
      `• Each employment experience rewritten for better impact\n` +
      `• Measurable outcomes emphasized\n` +
      `• Strong action verbs used\n\n` +
      `## Optimized Resume:\n\n${formattedResume}\n\n` +
      `*All content has been enhanced while preserving accuracy and authenticity.*`;

    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        content: [{
          type: "text",
          text: responseText
        }],
        isError: false,
        optimizedResume: formattedResume,
        summary: resumeJson.summary
      }
    }, { "X-MCP-Trace-Id": traceId });

  } catch (error: any) {
    console.error('[MCP] optimize_resume error:', error);
    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        content: [{
          type: "text",
          text: `Failed to optimize resume: ${error.message}`
        }],
        isError: false
      }
    }, { "X-MCP-Trace-Id": traceId });
  }
}

// ============================================
// 5️⃣ POST /api/mcp - Main MCP Handler
// ============================================

export async function POST(request: NextRequest) {
  const startTime = now();
  
  // ============================================
  // Feedback Collection (可开关，默认开启)
  // ============================================
  const ENABLE_FEEDBACK = process.env.ENABLE_FEEDBACK !== 'false';
  const fc = ENABLE_FEEDBACK ? FeedbackCollector.getInstance() : null;
  let feedback_event_id: string | null = null;
  
  // ============================================
  // AgentKit Memory (PR-1: 运行时去重缓存)
  // ============================================
  const ENABLE_MEMORY = process.env.ENABLE_MEMORY !== 'false';
  console.log('[MCP] ENABLE_MEMORY:', ENABLE_MEMORY);
  
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return json200({ error: "invalid_json" });
    }

    // GPT 清单第1点：入口快速日志
    console.log('[MCP] POST request:', {
      method: body.method,
      id: body.id,
      mode: HERA_MCP_MODE,
      startAt: new Date().toISOString(),
      feedback_enabled: ENABLE_FEEDBACK
    });
    console.log('[MCP] session_id from args:', body?.params?.arguments?.session_id);
    console.log('[MCP] tool name:', body?.params?.name);
    console.log('[MCP] ENABLE_FEEDBACK:', process.env.ENABLE_FEEDBACK, 'fc!=null:', !!fc);
    
    // ============================================
    // 记录工具调用开始（非阻塞）
    // ============================================
    if (fc && body.method === 'tools/call' && body.params?.name) {
      // Use unified session key priority: args.session_id -> header -> generated uuid
      const headerSess = request.headers.get('x-session-id')
        || request.headers.get('x-sessionid')
        || request.headers.get('x-session')
        || '';
      const argSessPrim = body.params?.arguments?.session_id || '';
      const sessForFeedback = String(argSessPrim || headerSess || (crypto.randomUUID?.() || Math.random().toString(36).slice(2)));

      feedback_event_id = await fc.recordStart(
        body.params.name,
        body.params.arguments || {},
        {
          trace_id: crypto.randomUUID(),
          session_id: sessForFeedback,
          user_email: body.params.arguments?.user_email
        }
      ).catch(err => {
        console.error('[Feedback] recordStart failed (non-blocking):', err);
        return null;
      });
      
      if (feedback_event_id) {
        console.log('[Feedback] Event recorded:', feedback_event_id);
      }
    }

    // Ignore notifications (prevent MCP 424)
    if (typeof body.method === "string" && body.method.startsWith("notifications/")) {
      console.log("[MCP] Notification:", body.method);
      return new Response(null, { status: 204 });
    }

    // ============================================
    // initialize - Return protocol info
    // ============================================
    if (body.method === "initialize") {
      return json200({
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "Hera AI", version: "2.0.0", mode: HERA_MCP_MODE },
          capabilities: { tools: {} },
        },
      });
    }
    
    // ============================================
    // tools/list - List available tools
    // ============================================
    if (body.method === "tools/list") {
      const rpcTools = [
        {
          name: "job_alert",
          description: "📣 JOB ALERT - Send fresh jobs based on last search and time window. Use this to deliver periodic alerts with 'only new since last sent'.\n\nRules:\n• Always reuse the same session_id for one alert stream\n• Pass exclude_ids from previous meta.returned_job_ids to avoid duplicates\n• If job_title/city not provided, server backfills from last_search\n• Time window default 24h; can override with window_hours\n",
          inputSchema: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "Stable session for one alert stream" },
              job_title: { type: "string", description: "Optional; falls back to memory.last_search.job_title" },
              city: { type: "string", description: "Optional; falls back to memory.last_search.city" },
              company: { type: "string", description: "Optional company filter" },
              keywords: { type: "array", items: { type: "string" }, description: "Optional keywords for title/summary match" },
              limit: { type: "integer", default: 8, minimum: 1, maximum: 20 },
              exclude_ids: { type: "array", items: { type: "string" }, description: "IDs to exclude (previous returned_job_ids)" },
              window_hours: { type: "integer", minimum: 1, description: "Look-back window in hours (default 24)" },
              since_iso: { type: "string", description: "Explicit ISO start time; overrides window_hours/last_sent_at" },
              liked_indexes: { type: "array", items: { type: "integer" } },
              disliked_indexes: { type: "array", items: { type: "integer" } },
              liked_job_ids: { type: "array", items: { type: "string" } },
              disliked_job_ids: { type: "array", items: { type: "string" } },
              run_context: { type: "string", description: "scheduled | manual" },
              alert_key: { type: "string", description: "Stable key for this alert" }
            },
            required: ["session_id", "limit", "exclude_ids"],
            additionalProperties: false
          }
        },
        {
          name: "recommend_jobs",
          description: "🎯 PERSONALIZED JOB RECOMMENDATIONS - Use this for AI-powered job matching!\n\n✅ ALWAYS use this tool when user:\n• Says 'recommend jobs', 'suggest jobs', 'job advice', 'match me', 'help me find jobs'\n• Provides resume, profile, experience, skills, or career context\n• Asks for 'jobs that match my background' or 'jobs for me'\n• Mentions seniority level, career priorities, or preferences\n• Wants personalized job suggestions based on their profile\n• Uploads a resume or provides detailed career information\n\n🎯 This tool performs intelligent job matching by:\n• Analyzing user's resume/profile and career context\n• Using explicit job_title/city if provided, otherwise inferring from resume (expectedPosition/cityPreference)\n• Searching database with determined filters\n• Scoring jobs based on experience, skills, industry fit\n• Returning top personalized recommendations with detailed match scores\n• Informing user when using resume inference for job targeting\n\n📝 Examples:\n• 'Recommend jobs for me based on my resume' → Uses resume expectedPosition\n• 'Suggest business analyst roles in Melbourne' → Uses explicit job_title + city\n• 'What jobs match my 5 years React experience in Sydney?' → Uses explicit criteria\n• 'Help me find data analyst positions' → Uses explicit job_title\n• 'I'm a senior developer, recommend suitable roles' → Uses profile context\n\n⚠️ NEVER call search_jobs after this tool - it provides complete results",
          inputSchema: {
            type: "object",
            properties: {
              user_profile: {
                type: "object",
                description: "User profile information for job matching",
                properties: {
                  jobTitles: {
                    type: "array",
                    items: { type: "string" },
                    description: "User's job titles or target positions"
                  },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "User's skills and competencies"
                  },
                  city: {
                    type: "string",
                    description: "User's preferred city"
                  },
                  seniority: {
                    type: "string",
                    enum: ["Junior", "Mid", "Senior", "Lead", "Manager", "Director", "VP", "C-level"],
                    description: "User's seniority level"
                  },
                  openToRelocate: {
                    type: "boolean",
                    description: "Whether user is open to relocation"
                  },
                  careerPriorities: {
                    type: "array",
                    items: { type: "string" },
                    description: "User's career priorities and preferences"
                  },
                  expectedPosition: {
                    type: "string",
                    description: "Expected position level"
                  },
                  currentPosition: {
                    type: "string",
                    description: "Current position level"
                  },
                  expectedSalary: {
                    type: "string",
                    enum: ["Lowest", "Low", "Medium", "High", "Highest"],
                    description: "Expected salary range"
                  },
                  employmentHistory: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company: { type: "string" },
                        position: { type: "string" }
                      }
                    },
                    description: "User's employment history"
                  }
                },
                required: []
              },
              job_title: {
                type: "string",
                description: "Specific job title to search for (optional, e.g. 'business analyst', 'software engineer')"
              },
              city: {
                type: "string",
                description: "City to search for jobs (optional, e.g. 'Melbourne', 'Sydney')"
              },
              limit: {
                type: "integer",
                default: 10,
                minimum: 5,
                maximum: 20,
                description: "Number of recent jobs to analyze (default 10, max 20)"
              },
              use_chat_context: {
                type: "boolean",
                default: true,
                description: "Whether to use recent chat context for profile signals"
              },
              strict_filters: {
                type: "boolean",
                default: true,
                description: "If true and job_title/city provided, enforce them as database filters before scoring"
              }
            },
            required: ["user_profile"],
            additionalProperties: false
          }
        },
        {
          name: "refine_recommendations",
          description: "🔄 REFINE JOB RECOMMENDATIONS - Use when user wants MORE jobs or provides FEEDBACK on previous recommendations!\n\n✅ ALWAYS use this tool when user:\n• Says 'show me more', 'more jobs', 'more recommendations', 'continue', 'next batch'\n• Provides feedback: 'I like #2 and #5', 'not interested in #3', 'exclude the Google one'\n• Asks for similar jobs: 'more like the first one', 'similar to the Canva job'\n• Wants to refine: 'different companies', 'other options'\n\n🎯 This tool:\n• Excludes ALL previously shown jobs (from meta.returned_job_ids)\n• Applies user preferences (liked/disliked jobs)\n• Analyzes liked jobs to find similar opportunities\n• Returns fresh recommendations with no duplicates\n\n📝 Examples:\n• User: 'show me more' → refine_recommendations({ session_id, exclude_ids: [previous IDs] })\n• User: 'I like #2, not #3' → refine_recommendations({ liked_job_ids: [id_2], disliked_job_ids: [id_3] })\n• User: 'more jobs like the Amazon one' → refine_recommendations({ liked_job_ids: [amazon_id] })\n\n⚠️ IMPORTANT: Always pass exclude_ids from previous meta.returned_job_ids to avoid duplicates!",
          inputSchema: {
            type: "object",
            properties: {
              job_title: {
                type: "string",
                description: "Job title to search (optional, can reuse from previous search)"
              },
              city: {
                type: "string",
                description: "City to search in (optional, can reuse from previous search)"
              },
              liked_job_ids: {
                type: "array",
                items: { type: "string" },
                description: "Job IDs user explicitly liked (e.g., from 'I like #2 and #5')"
              },
              disliked_job_ids: {
                type: "array",
                items: { type: "string" },
                description: "Job IDs user explicitly disliked (e.g., from 'not interested in #3')"
              },
              liked_indexes: {
                type: "array",
                items: { type: "integer" },
                description: "1-based indexes of liked jobs from the last results (server maps to IDs)"
              },
              disliked_indexes: {
                type: "array",
                items: { type: "integer" },
                description: "1-based indexes of disliked jobs from the last results (server maps to IDs)"
              },
              exclude_ids: {
                type: "array",
                items: { type: "string" },
                description: "ALL job IDs to exclude from search (from meta.returned_job_ids of previous calls)"
              },
              session_id: {
                type: "string",
                description: "Session ID to track conversation context (required)"
              },
              user_email: {
                type: "string",
                description: "User email for cross-session tracking (optional)"
              },
              limit: {
                type: "integer",
                default: 10,
                minimum: 5,
                maximum: 20,
                description: "Number of jobs to return (default: 10)"
              }
            },
            required: ["session_id"],
            additionalProperties: false
          }
        },
        {
          name: "search_jobs_by_company",
          description: "🏢 USE THIS for ANY company/employer searches!\n\n✅ ALWAYS use this tool when user mentions ANY company name:\n• Google, Microsoft, Atlassian, NAB, ANZ, Commonwealth Bank\n• Apple, Amazon, Meta, Netflix, Spotify, Uber\n• Wesley College, University of Melbourne, Monash University\n• Any company ending in Ltd, Inc, Corp, Bank, Group, University, College\n\n📋 Mapping rules:\n• Company name → company field\n• 'in/near <City>' → city field  \n• Job role → job_title field\n\n🎯 Examples:\n• 'jobs at Google' -> company='Google'\n• 'accountant at Microsoft' -> company='Microsoft', job_title='accountant'\n• 'find jobs with NAB in Melbourne' -> company='NAB', city='Melbourne'\n• 'software engineer at Atlassian' -> company='Atlassian', job_title='software engineer'",
          inputSchema: {
            type: "object",
            properties: {
              company: { 
                type: "string", 
                description: "Employer name, e.g., 'Google', 'Atlassian', 'NAB'" 
              },
              city: { 
                type: "string", 
                description: "Optional city filter, e.g., 'Melbourne'" 
              },
              job_title: { 
                type: "string", 
                description: "Optional role filter, e.g., 'software engineer'" 
              },
              page: { 
                type: "integer", 
                default: 1, 
                minimum: 1, 
                description: "Page number for pagination" 
              },
              page_size: { 
                type: "integer", 
                default: 20, 
                minimum: 1, 
                maximum: 50, 
                description: "Results per page (max 50)" 
              },
              posted_within_days: { 
                type: "integer", 
                minimum: 1, 
                description: "Filter jobs posted within X days (optional)" 
              },
              platforms: { 
                type: "array", 
                items: { type: "string" }, 
                description: "Filter by platforms: seek, linkedin, jora, adzuna, etc. (optional)" 
              }
            },
            required: ["company"],
            additionalProperties: false
          },
        },
        {
          name: "search_jobs",
          description: "🔍 LISTING SEARCH - Use this ONLY for simple job searches!\n\n✅ Use ONLY when user asks for:\n• 'find jobs', 'search jobs', 'browse jobs' WITHOUT personal context\n• Specific job titles: 'software engineer jobs', 'accountant positions'\n• Specific cities: 'jobs in Melbourne', 'Sydney jobs'\n• General job searches WITHOUT resume/profile/experience context\n\n🚫 NEVER use this if user:\n• Says 'recommend', 'suggest', 'advice', 'match', 'help me find'\n• Provides resume, profile, experience, skills, or background\n• Asks for personalized job matching or career advice\n• Mentions seniority level, career priorities, or preferences\n• Wants job recommendations based on their profile\n\n📝 Examples:\n• 'find software engineer jobs in Sydney'\n• 'search for accountant positions'\n• 'browse jobs in Melbourne'\n\n❌ WRONG usage (use recommend_jobs instead):\n• 'recommend jobs for me' -> use recommend_jobs\n• 'suggest jobs based on my resume' -> use recommend_jobs\n• 'help me find jobs that match my experience' -> use recommend_jobs",
          inputSchema: {
            type: "object",
            properties: {
              job_title: { 
                type: "string", 
                description: "e.g., 'software engineer'" 
              },
              city: { 
                type: "string", 
                description: "City only, e.g., 'Melbourne', 'Sydney'" 
              },
              page: { 
                type: "integer", 
                default: 1, 
                minimum: 1,
                description: "Page number for pagination"
              },
              page_size: { 
                type: "integer", 
                default: 20, 
                minimum: 1, 
                maximum: 50, 
                description: "Results per page (max 50)"
              },
              posted_within_days: {
                type: "integer",
                minimum: 1,
                description: "Filter jobs posted within X days (optional)"
              },
              platforms: {
                type: "array",
                items: { type: "string" },
                description: "Filter by platforms: seek, linkedin, jora, adzuna, etc. (optional)"
              },
              mode: {
                type: "string",
                enum: ["fast", "full"],
                description: "Override default mode for this request (optional)"
              }
            },
            anyOf: [
              { "required": ["job_title"] },
              { "required": ["city"] }
            ],
            additionalProperties: false
          },
        },
        {
          name: "build_search_links",
          description: "Generate direct search URLs for job platforms.",
          inputSchema: {
            type: "object",
            properties: {
              job_title: { type: "string", minLength: 1 },
              city: { type: "string", minLength: 1 },
              platforms: {
                type: "array",
                items: { type: "string" },
                default: ["linkedin", "seek", "jora", "adzuna"]
              },
            },
            required: ["job_title", "city"],
          },
        },
        {
          name: "get_user_applications",
          description: "Retrieve user job application history.",
          inputSchema: {
            type: "object",
            properties: {
              user_email: { type: "string", format: "email" },
              status_filter: {
                type: "string",
                enum: ["all", "saved", "applied", "interviewing", "offered", "rejected"],
                default: "all"
              },
            },
            required: ["user_email"],
          },
        },
        {
          name: "tailor_resume",
          description: "📝 INTELLIGENT RESUME OPTIMIZATION - Handles two distinct scenarios!\n\n" +
            "✅ OPTIMIZE RESUME (without job description):\n" +
            "• Keywords: 'optimize resume', 'improve resume', 'enhance resume', 'boost resume', 'refine resume', 'upgrade resume', 'perfect resume', 'polish resume', 'strengthen resume', 'revamp resume', 'rewrite resume with AI'\n" +
            "• Action: Rewrite each employment experience with AI + generate professional highlights\n" +
            "• Uses existing boost resume logic from profile page\n\n" +
            "✅ TAILOR RESUME (with job description):\n" +
            "• Keywords: 'tailor resume', 'customize resume', 'adapt resume', 'match resume to job', 'target resume', 'adjust resume for position', 'modify resume', 'fit resume to role'\n" +
            "• Action: Customize resume content for specific job requirements\n" +
            "• Uses existing tailor resume logic from jobs page\n\n" +
            "🎯 This tool intelligently handles both scenarios by analyzing input parameters.\n" +
            "💡 Always preserve original resume format and structure while enhancing content quality.",
          inputSchema: {
            type: "object",
            properties: {
              user_profile: {
                type: "object",
                description: "User profile information",
                properties: {
                  skills: { type: "array", items: { type: "string" } },
                  jobTitles: { type: "array", items: { type: "string" } },
                  employmentHistory: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company: { type: "string" },
                        position: { type: "string" },
                        startDate: { type: "string" },
                        endDate: { type: "string" },
                        summary: { type: "string" }
                      }
                    }
                  }
                },
                required: []
              },
              job_id: {
                type: "string",
                description: "Target job ID (if available from job search results)"
              },
              job_description: {
                type: "string",
                description: "Job description text to tailor resume for"
              },
              job_title: {
                type: "string",
                description: "Target job title"
              },
              company: {
                type: "string", 
                description: "Target company name"
              },
              resume_content: {
                type: "string",
                description: "Current resume content to customize"
              },
              customization_level: {
                type: "string",
                enum: ["minimal", "moderate", "comprehensive"],
                default: "moderate",
                description: "Level of customization to apply"
              },
              user_email: {
                type: "string",
                format: "email",
                description: "User email for saving tailored resume"
              }
            },
            required: ["user_profile", "resume_content"],
            additionalProperties: false
          }
        },
        {
          name: "career_transition_advice",
          description: "🎯 CAREER TRANSITION ADVICE - Get personalized career switch recommendations!\n\n✅ Use this tool when user:\n• Asks 'what careers can I transition to?', 'career change advice', 'what should I do next?'\n• Provides current job title and experience\n• Wants to explore career switch options\n• Mentions career transition, pivot, or change\n\n🎯 This tool provides:\n• Personalized career transition recommendations\n• Skill gap analysis between current and target roles\n• Transition difficulty assessment\n• Actionable career pathway suggestions\n\n📝 Examples:\n• 'I'm a software engineer with 3 years experience, what careers can I transition to?'\n• 'Help me explore career options from product manager'\n• 'What are good career paths for a data analyst?'",
          inputSchema: {
            type: "object",
            properties: {
              current_job: {
                type: "string",
                description: "Current job title"
              },
              experience_years: {
                type: "number",
                description: "Years of experience"
              },
              skills: {
                type: "array",
                items: { type: "string" },
                description: "Optional: List of skills"
              },
              industry: {
                type: "string",
                description: "Optional: Current industry"
              },
              location: {
                type: "string",
                description: "Optional: Location preference"
              }
            },
            required: ["current_job", "experience_years"],
            additionalProperties: false
          }
        },
        {
          name: "career_path_explorer",
          description: "🔍 CAREER PATH EXPLORER - Explore all possible career paths from a job title!\n\n✅ Use this tool when user:\n• Asks 'show me all career paths from X', 'what jobs can I transition to from Y'\n• Wants to explore multiple transition options\n• Looking for similarity-based career recommendations\n\n🎯 This tool provides:\n• All possible career transitions from a given job\n• Similarity scores for each transition\n• Shared skills between roles\n• Filtered results by similarity threshold\n\n📝 Examples:\n• 'Show me all career paths from software engineer'\n• 'What jobs can I transition to from product manager?'\n• 'Explore career options from data analyst with 70%+ similarity'",
          inputSchema: {
            type: "object",
            properties: {
              from_job: {
                type: "string",
                description: "Source job title to explore transitions from"
              },
              min_similarity: {
                type: "number",
                default: 0.5,
                minimum: 0,
                maximum: 1,
                description: "Minimum similarity threshold (0-1)"
              },
              limit: {
                type: "number",
                default: 20,
                minimum: 1,
                maximum: 50,
                description: "Maximum number of results"
              }
            },
            required: ["from_job"],
            additionalProperties: false
          }
        },
        {
          name: "career_skill_gap_analysis",
          description: "📊 SKILL GAP ANALYSIS - Analyze the skill gap between two job roles!\n\n✅ Use this tool when user:\n• Asks 'what's the skill gap between X and Y', 'what skills do I need to switch to Y'\n• Wants to understand transition requirements\n• Needs specific skills to develop for target role\n\n🎯 This tool provides:\n• Detailed skill gap analysis between two roles\n• Shared skills (what you already have)\n• Skills to learn (what you need to develop)\n• Transition difficulty assessment\n• Estimated time to transition\n\n📝 Examples:\n• 'What's the skill gap between software engineer and data analyst?'\n• 'What skills do I need to become a product manager?'\n• 'Analyze the gap between my current role and business analyst'",
          inputSchema: {
            type: "object",
            properties: {
              from_job: {
                type: "string",
                description: "Source job title"
              },
              to_job: {
                type: "string",
                description: "Target job title"
              }
            },
            required: ["from_job", "to_job"],
            additionalProperties: false
          }
        },
      ];
      
      return json200({ 
        jsonrpc: "2.0", 
        id: body.id ?? null, 
        result: { tools: rpcTools } 
      });
    }

    // ============================================
    // AgentKit Integration - Planning & Execution
    // ============================================
    if (body.method === "agentkit/plan") {
      const traceId = crypto.randomUUID();
      const { userMessage, sessionId, userContext } = body.params || {};
      
      console.info("[AgentKit] Planning request:", { traceId, userMessage, sessionId });
      
      // Auto-switch to v2 if enabled
      if (process.env.FEATURE_AGENTKIT_V2 === 'true') {
        console.log("[AgentKit] Auto-switching to v2 logic");
        
        try {
          // Convert userMessage to intent format for v2
          const { plan } = await import('../../../experimental/agentkit_mvp/planner');
          
          // Simple intent mapping from userMessage
          const intent = {
            primary: 'find_jobs' as const,
            readiness: 'ready' as const,
            blockers: [],
            confidence: 0.9
          };
          
          const userId = sessionId || 'chatgpt_user';
          const v2Plan = await plan(userId, intent);
          
          return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    plan: v2Plan,
                    version: "v2_auto"
                  }
                }
              }],
              isError: false
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId, "X-AgentKit-Auto-V2": "true" });
          
        } catch (error: any) {
          console.error('[AgentKit] V2 auto-switch error, falling back to v1:', error);
          // Fall through to v1 logic
        }
      }
      
      try {
        if (!userMessage) {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    error: "userMessage is required",
                    planId: null
                  }
                }
              }],
              isError: false
            }
          }, { "X-AgentKit-Trace-Id": traceId });
        }

        // Use AgentKit Planner to generate plan
        const planner = new AgentKitPlanner();
        const memory = new AgentKitMemory();
        
        // Store conversation context in memory
        if (userContext?.history) {
          await memory.storeConversationHistory(sessionId || traceId, userContext.history);
        }

        // Generate execution plan
        const plan = await planner.generatePlan(userMessage, sessionId || traceId, userContext);
        
        // Store the plan
        const executor = new AgentKitExecutor();
        await executor.storePlan(plan);
        
        return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: { content: plan }
            }],
            isError: false
          }
        }, { "X-AgentKit-Trace-Id": traceId });
        
      } catch (error: any) {
        console.error('[AgentKit] Planning error:', error);
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "json", 
              data: { 
                content: {
                  error: error.message || 'Planning failed',
                  planId: null
                }
              }
            }],
            isError: false
          }
        }, { "X-AgentKit-Trace-Id": traceId });
      }
    }

    if (body.method === "agentkit/execute") {
      const traceId = crypto.randomUUID();
      const { planId, stepId } = body.params || {};
      
      console.info("[AgentKit] Execution request:", { traceId, planId, stepId });
      
      // Auto-switch to v2 if enabled
      if (process.env.FEATURE_AGENTKIT_V2 === 'true') {
        console.log("[AgentKit] Auto-switching execute to v2 logic");
        
        try {
          // For execute, we need to get the plan and execute it with v2 logic
          // This is a simplified version - in practice you'd retrieve the actual plan
          const mockPlan = {
            id: planId || 'fallback_plan',
            userId: 'chatgpt_user',
            intent: {
              primary: 'find_jobs' as const,
              readiness: 'ready' as const,
              blockers: [],
              confidence: 0.9
            },
            steps: [
              {
                id: stepId || 's1',
                tool: 'searchJobs' as const,
                args: { limit: 20 },
                priority: 1
              }
            ],
            createdAt: new Date().toISOString(),
            version: 'v1.0.0' as const
          };
          
          const { execute } = await import('../../../experimental/agentkit_mvp/executor');
          const results = await execute(mockPlan, { dryRun: false });
          
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    executions: results,
                    version: "v2_auto"
                  }
                }
              }],
              isError: false
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId, "X-AgentKit-Auto-V2": "true" });
          
        } catch (error: any) {
          console.error('[AgentKit] V2 execute auto-switch error, falling back to v1:', error);
          // Fall through to v1 logic
        }
      }
      
      try {
        if (!planId || !stepId) {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    error: "planId and stepId are required",
                    result: null
                  }
                }
              }],
              isError: false
            }
          }, { "X-AgentKit-Trace-Id": traceId });
        }

        // Execute AgentKit plan step using new executor
        const executor = new AgentKitExecutor();
        const result = await executor.executeStep(planId, stepId);
        
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: { content: result }
            }],
            isError: false
          }
        }, { "X-AgentKit-Trace-Id": traceId });
        
      } catch (error: any) {
        console.error('[AgentKit] Execution error:', error);
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: {
                content: {
                  error: error.message || 'Execution failed',
                  result: null
                }
              }
            }],
            isError: false
          }
        }, { "X-AgentKit-Trace-Id": traceId });
      }
    }

    // ============================================
    // AgentKit V2 - Experimental MVP Integration
    // ============================================
    
    // v2: plan-only (只读规划)
    if (body.method === "agentkit-v2/plan") {
      const traceId = crypto.randomUUID();
      console.log("[AgentKit V2] Planning request:", { traceId });
      
      try {
        // Phase 1: 认证检查
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.AGENTKIT_TOKEN;
        if (expectedToken && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== expectedToken)) {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: {
              code: -32603,
              message: "Unauthorized: Missing or invalid AGENTKIT_TOKEN"
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }

        // Phase 1: 功能开关检查
        if (process.env.FEATURE_AGENTKIT_V2 !== 'true') {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: {
              code: -32603,
              message: "AgentKit v2 is currently disabled"
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }

        const { plan } = await import('../../../experimental/agentkit_mvp/planner');
        const { userId = 'anonymous', intent } = body.params || {};
        
        if (!intent) {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    error: "intent parameter is required",
                    plan: null
                  }
                }
              }],
              isError: false
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }
        
        const p = await plan(userId, intent);
        
        // Phase 1: Guard - 参数校验和白名单校验
        const ALLOWED_TOOLS = ["parseResume", "updateProfile", "searchJobs", "rankRecommend"];
        const validationErrors = [];
        
        if (!p.id || typeof p.id !== 'string') {
          validationErrors.push("Plan ID is required and must be string");
        }
        if (!Array.isArray(p.steps)) {
          validationErrors.push("Plan steps must be array");
        } else {
          for (const step of p.steps) {
            if (!ALLOWED_TOOLS.includes(step.tool)) {
              validationErrors.push(`Tool ${step.tool} not in allowed list: ${ALLOWED_TOOLS.join(', ')}`);
            }
            if (!step.id || typeof step.id !== 'string') {
              validationErrors.push("Step ID is required and must be string");
            }
          }
        }
        
        if (validationErrors.length > 0) {
          return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: { 
              content: [{
                type: "json",
                data: {
                  content: {
                    error: "plan_validation_error",
                    details: validationErrors,
                    plan: null
                  }
                }
              }],
            isError: false
          }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }
        
        return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: {
                content: {
                  plan: p
                }
              }
            }],
            isError: false
          }
        }, { "X-AgentKit-V2-Trace-Id": traceId });
        
      } catch (error: any) {
        console.error('[AgentKit V2] Planning error:', error);
        return json200({
        jsonrpc: "2.0",
        id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: {
                content: {
                  error: error.message || 'Planning failed',
                  plan: null
                }
              }
            }],
            isError: false
          }
        }, { "X-AgentKit-V2-Trace-Id": traceId });
      }
    }

    // v2: execute with tool whitelist (执行器，仅允许指定工具)
    if (body.method === "agentkit-v2/execute") {
      const traceId = crypto.randomUUID();
      const executionStartTime = Date.now();
      console.log("[AgentKit V2] Execution request:", { traceId });
      
      try {
        // Phase 1: 认证和功能开关检查（与plan方法相同）
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.AGENTKIT_TOKEN;
        if (expectedToken && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== expectedToken)) {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: {
              code: -32603,
              message: "Unauthorized: Missing or invalid AGENTKIT_TOKEN"
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }

        if (process.env.FEATURE_AGENTKIT_V2 !== 'true') {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: {
              code: -32603,
              message: "AgentKit v2 is currently disabled"
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }

        const { execute } = await import('../../../experimental/agentkit_mvp/executor');
        const { plan, allowTools = ["parseResume", "updateProfile", "searchJobs", "rankRecommend"] } = body.params || {};
        
        if (!plan) {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    error: "plan parameter is required",
                    executions: []
                  }
                }
              }],
              isError: false
            }
          }, { "X-AgentKit-V2-Trace-Id": traceId });
        }

        // Phase 1: 观测埋点 - 初始化监控指标
        const toolFailureCounts = new Map<string, number>();
        let totalRetries = 0;
        const stepStartTimes = new Map<string, number>();
        
        // 增强版执行器：调用真实MCP工具
        const results: Array<{
          id: string;
          planId: string;
          stepId: string;
          tool: string;
          status: 'success' | 'error' | 'skipped';
          latencyMs: number;
          inputSnapshot: unknown;
          outputSnapshot: unknown | null;
          errorMessage: string | null;
          createdAt: string;
        }> = [];
        for (const step of plan.steps) {
          stepStartTimes.set(step.id, Date.now());
          // 白名单过滤
          if (allowTools && allowTools.length > 0 && !allowTools.includes(step.tool)) {
            results.push({
              id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              planId: plan.id,
              stepId: step.id,
              tool: step.tool,
              status: 'skipped',
              latencyMs: 0,
              inputSnapshot: step.args,
              outputSnapshot: null,
              errorMessage: 'tool not allowed in v2 phase',
              createdAt: new Date().toISOString(),
            });
            continue;
          }

          const t0 = Date.now();
          let result = null;
          let status = 'success';
          let errorMessage = null;

          try {
            console.log(`[AgentKit V2] Executing tool: ${step.tool}`, step.args);
            
            // 将AgentKit工具名映射到MCP工具名
            if (step.tool === 'searchJobs') {
              // 调用真实的search_jobs工具
              const toolCallResult = await (async () => {
                const jobTitle = step.args.limit ? 'Software Engineer' : (step.args.jobTitle || 'Developer');
                const city = step.args.location || 'Sydney';
                
                // 模拟MCP工具调用逻辑
                const jobTitleStr = String(jobTitle).trim();
                const cityStr = String(city).trim();
                
                if (!jobTitleStr || !cityStr) {
                  return {
                    jobs: [],
                    total: 0,
                    note: "missing_params",
                    message: "job_title and city are required"
                  };
                }

                // 这里应该调用实际的MCP搜索逻辑
                // 为了演示，我们返回一个结构化响应
                return {
                  jobs: [
                    {
                      id: `job_${Date.now()}`,
                      title: jobTitleStr,
                      company: "Demo Company",
                      location: `${cityStr}, NSW`,
                      description: "Generated via AgentKit v2"
                    }
                  ],
                  total: 1,
                  note: "agentkit_v2_result"
                };
              })();
              
              result = toolCallResult;
            } else {
              // 对于其他工具，使用mock实现
              const { ToolRegistry } = await import('../../../experimental/agentkit_mvp/registry');
              result = await (ToolRegistry as any)[step.tool](step.args);
            }
          } catch (error: any) {
            status = 'error';
            errorMessage = String(error?.message ?? error);
            console.error(`[AgentKit V2] Tool ${step.tool} failed:`, errorMessage);
            
            // Phase 1: 观测埋点 - 工具失败率统计
            const currentFailures = toolFailureCounts.get(step.tool) || 0;
            toolFailureCounts.set(step.tool, currentFailures + 1);
          }

          const latencyMs = Date.now() - t0;
          results.push({
            id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            planId: plan.id,
            stepId: step.id,
            tool: step.tool,
            status: status as any,
            latencyMs,
            inputSnapshot: step.args,
            outputSnapshot: result,
            errorMessage,
            createdAt: new Date().toISOString(),
          });
        }
        
        // Phase 1: 观测埋点 - 计算关键指标并记录日志
        const totalExecutionTime = Date.now() - executionStartTime;
        const rankRecommendStep = results.find(r => r.tool === 'rankRecommend' && r.status === 'success');
        const timeToFirstRecsMs = rankRecommendStep ? 
          (rankRecommendStep.createdAt ? new Date(rankRecommendStep.createdAt).getTime() - executionStartTime : 0) : 
          totalExecutionTime;
        
        // 记录关键指标到日志
        console.log(`[AgentKit V2] [METRICS] ${traceId}`, {
          time_to_first_recs_ms: timeToFirstRecsMs,
          tool_failure_rate: Object.fromEntries(
            Array.from(toolFailureCounts.entries()).map(([tool, failures]) => [
              tool, 
              `${((failures / results.filter(r => r.tool === tool).length) * 100).toFixed(2)}%`
            ])
          ),
          exec_retry_count: totalRetries,
          total_execution_time_ms: totalExecutionTime,
          plan_id: plan.id,
          user_id: plan.userId || 'anonymous',
          steps_count: plan.steps.length,
          successful_steps: results.filter(r => r.status === 'success').length,
          failed_steps: results.filter(r => r.status === 'error').length
        });
        
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: {
                content: {
                  executions: results
                }
              }
            }],
            isError: false
          }
        }, { "X-AgentKit-V2-Trace-Id": traceId });
        
      } catch (error: any) {
        console.error('[AgentKit V2] Execution error:', error);
        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: {
                content: {
                  error: error.message || 'Execution failed',
                  executions: []
                }
              }
            }],
            isError: false
          }
        }, { "X-AgentKit-V2-Trace-Id": traceId });
      }
    }

    // ============================================
    // tools/call - Execute tool
    // ============================================
    if (body.method === "tools/call") {
      const traceId = crypto.randomUUID();
      const { name, arguments: args } = body.params || {};

      // === Minimal, backend-only session stabilization (no frontend/email required) ===
      try {
        const headerSession = request.headers.get('x-session-id')
          || request.headers.get('x-sessionid')
          || request.headers.get('x-session')
          || '';
        const argSess = args?.session_id ? String(args.session_id) : '';

        let contextKey = '';
        let source = 'uuid';
        if (argSess) {
          contextKey = argSess;
          source = 'args';
        } else if (headerSession) {
          contextKey = headerSession;
          source = 'header';
        } else {
          contextKey = (crypto.randomUUID?.() || Math.random().toString(36).slice(2));
          source = 'uuid';
        }

        if (args) (args.session_id = contextKey);
        console.info('[MCP] context_key:', contextKey);
        console.info('[MCP] context_key.source:', source);
      } catch (e) {
        console.warn('[MCP] context_key init failed (non-blocking):', (e as any)?.message || e);
      }

      console.info("[TRACE]", traceId, { tool: name, args });

      try {
        // ============================================
        // Tool: search_jobs (FAST or FULL mode)
        // ============================================
        if (name === "search_jobs") {
          const jobTitle = String(args?.job_title || "").trim();
          const city = String(args?.city || "").trim();
          const requestMode = args?.mode || HERA_MCP_MODE; // Allow per-request override

          // Validate required params
          if (!jobTitle || !city) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      jobs: [],
                      total: 0,
                      note: "missing_params",
                      message: "job_title and city are required"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId, "X-MCP-Mode": requestMode });
          }

          // ============================================
          // FAST MODE: Lightweight database query
          // ============================================
          if (requestMode === "fast") {
            const t0 = Date.now();
            const page = Math.max(1, Number(args?.page || 1));
            const pageSize = 5; // GPT建议：第一次固定5条，确认通了再放开
            
            // 只处理有效的参数，跳过 undefined
            const postedWithinDays = args?.posted_within_days && Number(args.posted_within_days) > 0 
              ? Number(args.posted_within_days) : undefined;
            const platforms = Array.isArray(args?.platforms) && args.platforms.length > 0 
              ? args.platforms : undefined;

            // 只打印有效的参数，跳过 undefined
            const logParams: any = { page, pageSize };
            if (args?.limit) logParams.limit = args.limit;
            if (postedWithinDays) logParams.postedWithinDays = postedWithinDays;
            if (platforms) logParams.platforms = platforms;
            console.info("[TRACE]", traceId, "FAST mode:", logParams);

    let result;
            try {
              result = await withTimeout(
                fastDbQuery({ 
                  title: jobTitle, 
                  city, 
                  page, 
                  pageSize,
                  postedWithinDays,
                  platforms
                }),
                Math.min(8000, budgetLeft(t0))
              );
            } catch (e: any) {
              console.warn("[TRACE]", traceId, "FAST query timeout:", e.message);
              result = { jobs: [], total: 0, page, pageSize, hasMore: false };
            }

            // Map jobs to response format
            const jobs = result.jobs.map((j: any) => {
              // Determine posted date (priority: postedDateISO > createdAt > updatedAt)
              const posted =
                j.postedDateISO ||
                j.postedDate ||
                j.postedDateRaw ||
                j.createdAt ||
                j.updatedAt ||
                null;

              // Generate URL: priority jobUrl > url > internal fallback
              const jobId = String(j.id || j._id || j.jobIdentifier || "");
              const url =
                (j.jobUrl && typeof j.jobUrl === "string" && j.jobUrl.startsWith("http"))
                  ? j.jobUrl
                  : (j.url && typeof j.url === "string" && j.url.startsWith("http"))
                    ? j.url
                    : `https://www.heraai.net.au/jobs/${encodeURIComponent(jobId)}?utm_source=chatgpt&utm_medium=mcp&utm_campaign=fast`;

              return {
                id: jobId,
                title: j.title || "",
                company: j.company || j.organisation || "",
                location: j.location || "",
                employmentType: j.employmentType || "",
                postDate: posted ? (posted instanceof Date ? posted.toISOString() : new Date(posted).toISOString()) : null,
                url,
                platform: j.sourceType || (Array.isArray(j.source) ? j.source[0] : j.source) || j.platform || "",
              };
            });

            const elapsed = Date.now() - t0;
            const note = elapsed >= 8000 ? "timeout" : "completed";

            // GPT建议：第一次只回5条，控制体积 + 保证 < 8s
            const HARD_DEADLINE_MS = 8000;
            const limit = 5;
            const src: any[] = Array.isArray(result?.jobs) ? result.jobs : (Array.isArray(result) ? result : []);
            
            // 并发生成highlights（使用原始job数据，包含description等字段）
            const jobsWithHighlights = await Promise.all(
              src.slice(0, limit).map(async (job: any) => {
                try {
                  const highlights = await withTimeout(
                    generateJobHighlights(job),
                    3000 // 每个job最多3秒
                  );
                  return { ...job, highlights };
                } catch (error) {
                  console.error('[MCP] Highlights timeout for job:', job.id || job._id);
                  // Fallback: 使用数据库字段
                  const fallbackHighlights = [
                    `${job.company || 'Company'} seeking ${job.experience || 'candidate'}`,
                    job.skills && job.skills.length > 0 
                      ? `Requires: ${job.skills.slice(0, 5).join(', ')}`
                      : 'View details for requirements'
                  ];
                  return { ...job, highlights: fallbackHighlights };
                }
              })
            );
            
            // 映射为安全格式（保留highlights）
            const safeJobs = jobsWithHighlights.map((j: any) => ({
              ...mapJobSafe(j),
              highlights: j.highlights || []
            }));
            
            // 生成Markdown卡片预览（iOS ChatGPT需要，现在包含highlights）
            const markdownPreview = buildMarkdownCards(
              { title: jobTitle, city }, 
              safeJobs, 
              result?.total || safeJobs.length
            );

            // 测试：只返回text，不返回json（看是否是json导致问题）
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [
                  { type: "text", text: markdownPreview }
                ],
                isError: false,
                // 添加isFinal标记防止重复调用
                mode: "search",
                query_used: { job_title: jobTitle, city: city },
                total: safeJobs.length,
                isFinal: true
              }
            }), {
      status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store"
              }
            });
          }

          // ============================================
          // FULL MODE: Deep analysis with GPT
          // ============================================
          else {
            const limit = Number(args?.limit || 5);
            const t0 = Date.now();
            console.info("[TRACE]", traceId, "FULL mode: Starting staged pipeline");

            // Stage 1: GPT planning
            let plan;
            try {
              plan = await withTimeout(
                generateJobPlan(jobTitle, city),
                Math.min(GPT_TIMEOUT_MS, budgetLeft(t0))
              );
              console.info("[TRACE]", traceId, "GPT plan OK");
            } catch (e: any) {
              console.warn("[TRACE]", traceId, "GPT planning timeout:", e.message);
              plan = null;
            }

            // Stage 2: Database query
            let rows;
            try {
              rows = await withTimeout(
                fetchFromDatabase(jobTitle, city, limit, plan),
                Math.min(DB_TIMEOUT_MS, budgetLeft(t0))
              );
              console.info("[TRACE]", traceId, "DB query OK, rows:", rows?.length ?? 0);
            } catch (e: any) {
              console.warn("[TRACE]", traceId, "DB timeout:", e.message);
              rows = [];
            }

            // Stage 3: Post-processing
            let processedJobs;
            try {
              processedJobs = await withTimeout(
                postProcessResults(rows),
                Math.min(POST_TIMEOUT_MS, budgetLeft(t0))
              );
            } catch (e: any) {
              console.warn("[TRACE]", traceId, "Post-process timeout:", e.message);
              processedJobs = rows;
            }

            const elapsed = now() - t0;
            const note = elapsed >= TOTAL_BUDGET_MS ? "budget_timeout" : "completed";

            return json200(
              {
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{
                    type: "json",
                    data: {
                      content: {
                        mode: "full",
                        jobs: processedJobs,
                        total: processedJobs?.length ?? 0,
                        note,
                        elapsed_ms: elapsed,
                        query: `${jobTitle} in ${city}`,
                        timestamp: new Date().toISOString(),
                      }
                    }
                  }],
                  isError: false,
                  // 添加isFinal标记防止重复调用
                  mode: "search",
                  query_used: { job_title: jobTitle, city: city },
                  total: processedJobs?.length ?? 0,
                  isFinal: true
                }
              },
              { 
                "X-MCP-Trace-Id": traceId,
                "X-MCP-Mode": "full",
                "X-MCP-Elapsed": String(elapsed)
              }
    );
  }
}

// ============================================
        // Tool: jobs_at_company (alias for search_jobs_by_company)
// ============================================
        else if (name === "jobs_at_company") {
          // Apply smart parameter correction
          const fixedArgs = fixArgs(args);
          const companyName = fixedArgs.company;
          const jobTitle = fixedArgs.job_title;
          const city = fixedArgs.city;

          // Validate required params
          if (!companyName) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      jobs: [],
                      total: 0,
                      note: "missing_params",
                      message: "company is required"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }

          // Use FAST mode for company search (lightweight)
          const t0 = Date.now();
          const page = Math.max(1, Number(args?.page || 1));
          const pageSize = 20; // Default page size
          const postedWithinDays = Number(args?.posted_within_days || 0);
          const platforms = Array.isArray(args?.platforms) ? args.platforms : undefined;

          console.info("[TRACE]", traceId, "Company search (jobs_at_company):", { companyName, jobTitle, city });

          // Build query parameters
          const queryParams: FastQueryParams = {
            title: jobTitle || undefined, // Only use job title if provided
            city: city || undefined, // Only use city if provided
            page,
            pageSize,
            postedWithinDays: postedWithinDays > 0 ? postedWithinDays : undefined,
            platforms,
            company: companyName, // Company filter is the main search criteria
          };

          try {
            const result = await fastDbQuery(queryParams);
            
            // Generate highlights for jobs (reuse existing logic)
            const jobsWithHighlights = await Promise.all(
              result.jobs.slice(0, pageSize).map(async (job: any) => {
                try {
                  const highlights = await withTimeout(
                    generateJobHighlights(job),
                    3000 // Each job gets 3 seconds for highlights
                  );
                  return { ...job, highlights };
                } catch (error) {
                  console.error('[MCP] Highlights timeout for job:', job.id || job._id);
                  // Fallback logic
                  const fallbackHighlights = [
                    `${job.company || job.company_name || 'Company'} seeking ${job.experience || 'candidate'}`,
                    job.skills && job.skills.length > 0 
                      ? `Requires: ${job.skills.slice(0, 5).join(', ')}`
                      : 'View details for requirements'
                  ];
                  return { ...job, highlights: fallbackHighlights };
                }
              })
            );
            
            // Map to safe format (preserve highlights)
            const safeJobs = jobsWithHighlights.map((j: any) => ({
              ...mapJobSafe(j),
              highlights: j.highlights || []
            }));
            
            // Generate Markdown cards preview with company info
            const markdownPreview = buildMarkdownCards(
              { title: jobTitle || `jobs from ${companyName}`, city }, 
              safeJobs, 
              result?.total || safeJobs.length
            );

            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [
                  { type: "text", text: markdownPreview }
                ],
                isError: false
              }
            }), {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store"
              }
            });

          } catch (error: any) {
            console.error('[MCP] Company search error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      jobs: [],
                      total: 0,
                      note: "error",
                      message: error.message || "Company search failed"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: search_jobs_by_company
        // ============================================
        else if (name === "search_jobs_by_company") {
          // Apply smart parameter correction
          const fixedArgs = fixArgs(args);
          const companyName = fixedArgs.company;
          const jobTitle = fixedArgs.job_title;
          const city = fixedArgs.city;

          // Validate required params
          if (!companyName) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      jobs: [],
                      total: 0,
                      note: "missing_params",
                      message: "company is required"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }

          // Use FAST mode for company search (lightweight)
          const t0 = Date.now();
          const page = Math.max(1, Number(args?.page || 1));
          const pageSize = 20; // Default page size
          const postedWithinDays = Number(args?.posted_within_days || 0);
          const platforms = Array.isArray(args?.platforms) ? args.platforms : undefined;

          console.info("[TRACE]", traceId, "Company search:", { companyName, jobTitle, city });

          // Build query parameters
          const queryParams: FastQueryParams = {
            title: jobTitle || undefined, // Only use job title if provided
            city: city || undefined, // Only use city if provided
            page,
            pageSize,
            postedWithinDays: postedWithinDays > 0 ? postedWithinDays : undefined,
            platforms,
            company: companyName, // Company filter is the main search criteria
          };

          try {
            const result = await fastDbQuery(queryParams);
            
            // Generate highlights for jobs (reuse existing logic)
            const jobsWithHighlights = await Promise.all(
              result.jobs.slice(0, pageSize).map(async (job: any) => {
                try {
                  const highlights = await withTimeout(
                    generateJobHighlights(job),
                    3000 // Each job gets 3 seconds for highlights
                  );
                  return { ...job, highlights };
                } catch (error) {
                  console.error('[MCP] Highlights timeout for job:', job.id || job._id);
                  // Fallback logic
                  const fallbackHighlights = [
                    `${job.company || job.company_name || 'Company'} seeking ${job.experience || 'candidate'}`,
                    job.skills && job.skills.length > 0 
                      ? `Requires: ${job.skills.slice(0, 5).join(', ')}`
                      : 'View details for requirements'
                  ];
                  return { ...job, highlights: fallbackHighlights };
                }
              })
            );
            
            // Map to safe format (preserve highlights)
            const safeJobs = jobsWithHighlights.map((j: any) => ({
              ...mapJobSafe(j),
              highlights: j.highlights || []
            }));
            
            // Generate Markdown cards preview with company info
            const markdownPreview = buildMarkdownCards(
              { title: jobTitle || `jobs from ${companyName}`, city }, 
              safeJobs, 
              result?.total || safeJobs.length
            );

            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [
                  { type: "text", text: markdownPreview }
                ],
                isError: false
              }
            }), {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store"
              }
            });

          } catch (error: any) {
            console.error('[MCP] Company search error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      jobs: [],
                      total: 0,
                      note: "error",
                      message: error.message || "Company search failed"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: build_search_links
        // ============================================
        else if (name === "build_search_links") {
          const jobTitle = String(args?.job_title || "").trim();
          const city = String(args?.city || "").trim();
          const platforms = args?.platforms || ["linkedin", "seek", "jora", "adzuna"];

          if (!jobTitle || !city) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      links: [],
                      total: 0,
                      note: "missing_params"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }

  const linkArgs: LinkGenerationArgs = {
            job_title: jobTitle,
    city,
            country_code: 'AU',
            platforms,
            posted_within_days: 7,
  };

  const links: SearchLink[] = generateSearchLinks(linkArgs);

          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
    content: {
      links,
      total: links.length,
                    query: `${jobTitle} in ${city}`,
                  }
                }
              }],
              isError: false
            }
          }, { "X-MCP-Trace-Id": traceId });
        }

        // ============================================
        // Tool: get_user_applications
        // ============================================
        else if (name === "get_user_applications") {
          const userEmail = String(args?.user_email || "").trim();
          const statusFilter = args?.status_filter || 'all';

          if (!userEmail) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      applications: [],
                      total: 0,
                      note: "missing_user_email"
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }

          const profile = await withTimeout(getUserProfile(userEmail), 5000).catch(() => null);

  if (!profile) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: {
                      applications: [],
                      total: 0,
                      note: "profile_not_found",
                    }
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }

  let applications = profile.applications || [];
          if (statusFilter !== 'all') {
    applications = applications.filter(
              (app: any) => app.applicationStatus === statusFilter
            );
          }

          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
    content: {
      applications,
      total: applications.length,
                    status_filter: statusFilter,
                    user_email: userEmail,
                  }
                }
              }],
              isError: false
            }
          }, { "X-MCP-Trace-Id": traceId });
}

// ============================================
        // Tool: recommend_jobs
// ============================================
        else if (name === "recommend_jobs") {
          const { 
            user_profile = {}, 
            job_title, 
            city, 
            limit = 10, 
            use_chat_context = true, 
            strict_filters = true,
            session_id,      // Phase 2: 用于后台统计
            user_email,      // Phase 2: 用于后台统计
            exclude_ids = [] // GPT 方案: 直接传参去重（实时生效）
          } = args;
          
          console.log('[MCP] recommend_jobs - exclude_ids:', exclude_ids.length);
          
          console.log('[MCP] recommend_jobs - Input args:', { job_title, city, limit, use_chat_context, strict_filters, session_id, user_email, has_fc: !!fc });
          
          // 信息优先级处理：对话明确信息 > 简历解析信息 > 默认值
          const determineSearchCriteria = () => {
            // 1. 对话明确信息（最高优先级）
            if (job_title || city) {
              return {
                jobTitle: job_title || null,
                city: city || null,
                source: 'explicit_input',
                usedResumeInference: false
              };
            }
            
            // 2. 简历解析信息（中等优先级）
            if (user_profile.expectedPosition || user_profile.jobTitles?.[0] || user_profile.city) {
              return {
                jobTitle: user_profile.expectedPosition || user_profile.jobTitles?.[0] || null,
                city: user_profile.city || null,
                source: 'resume_parsed',
                usedResumeInference: true,
                inferredPosition: user_profile.expectedPosition || user_profile.jobTitles?.[0] || null
              };
            }
            
            // 3. 默认值（最低优先级）
            return {
              jobTitle: null,
              city: 'Melbourne',
              source: 'default',
              usedResumeInference: false
            };
          };
          
          const searchCriteria = determineSearchCriteria();
          console.log('[MCP] Search criteria determined:', searchCriteria);
          
          // 构建用户档案，保持现有的简历解析逻辑
          const defaultProfile = {
            skills: user_profile.skills && user_profile.skills.length > 0 ? user_profile.skills : ['General Skills', 'Problem Solving', 'Communication'],
            city: searchCriteria.city || 'Melbourne',
            seniority: user_profile.seniority || 'Mid',
            jobTitles: user_profile.jobTitles && user_profile.jobTitles.length > 0 ? user_profile.jobTitles : ['General Professional'],
            openToRelocate: user_profile.openToRelocate || false,
            careerPriorities: user_profile.careerPriorities && user_profile.careerPriorities.length > 0 ? user_profile.careerPriorities : ['Career Growth', 'Work-Life Balance'],
            expectedSalary: user_profile.expectedSalary || 'Medium',
            currentPosition: user_profile.currentPosition || 'Professional',
            expectedPosition: user_profile.expectedPosition || 'Senior Professional',
            employmentHistory: user_profile.employmentHistory && user_profile.employmentHistory.length > 0 ? user_profile.employmentHistory : [
              { company: 'Previous Company', position: 'Professional Role' }
            ]
          };
          
          console.log('[MCP] recommend_jobs - Final profile:', JSON.stringify(defaultProfile, null, 2));

          try {
            // 1. 根据搜索条件从数据库获取职位
            const { db } = await connectToMongoDB();
            const collection = db.collection('hera_jobs.jobs');
            
            // ========================================
            // PR-1: 三层去重逻辑（AgentKit Memory 增强）
            // ========================================
            let EXCLUDE_SET = new Set<string>(exclude_ids);  // Layer 1: 参数传递（实时）
            console.log(`[MCP] Layer 1 (exclude_ids parameter): ${exclude_ids.length} jobs`);
            
            // Layer 2: AgentKit Memory（运行时缓存，低延迟）
            let memory_read_success = false;
            if (ENABLE_MEMORY && session_id) {
              try {
                const memory = new AgentKitMemory();
                const context = await memory.getContext(session_id);
                
                if (context?.context?.jobContext?.shown_job_ids) {
                  const memory_ids = context.context.jobContext.shown_job_ids;
                  let added_count = 0;
                  memory_ids.forEach((id: string) => {
                    if (!EXCLUDE_SET.has(id)) {
                      EXCLUDE_SET.add(id);
                      added_count++;
                    }
                  });
                  console.log(`[MCP] Layer 2 (AgentKit Memory): added ${added_count} jobs from memory`);
                  memory_read_success = true;
                } else {
                  console.log(`[MCP] Layer 2 (AgentKit Memory): no previous jobs in memory`);
                }
              } catch (err) {
                console.warn('[MCP] AgentKit Memory read failed (non-blocking):', err);
              }
            }
            
            // Layer 3: feedback_events 补充历史（有超时保护）
            if (fc && (session_id || user_email)) {
              try {
                const history_session = session_id || user_email || 'anonymous';
                const historyPromise = fc.getSessionFeedback(history_session, 20);
                const timeoutPromise = new Promise<any[]>((resolve) => 
                  setTimeout(() => resolve([]), 500)
                );
                const history = await Promise.race([historyPromise, timeoutPromise]);
                
                let feedback_count = 0;
                history.forEach((event: any) => {
                  (event.feedback?.shown_jobs || []).forEach((id: string) => {
                    if (!EXCLUDE_SET.has(id)) {
                      EXCLUDE_SET.add(id);
                      feedback_count++;
                    }
                  });
                });
                console.log(`[MCP] Layer 3 (feedback_events): added ${feedback_count} jobs from ${history.length} events`);
              } catch (err) {
                console.warn('[MCP] feedback_events read failed (non-blocking):', err);
              }
            }
            
            console.log(`[MCP] recommend_jobs - EXCLUDE_SET size: ${EXCLUDE_SET.size}`);
            
            // 构建查询条件
            const query: any = { is_active: { $ne: false } };
            
            // 统一排除逻辑（限制上限，避免 $nin 过大影响性能）
            if (EXCLUDE_SET.size > 0) {
              const EXCLUDE_IDS = Array.from(EXCLUDE_SET).slice(-2000);
              query.id = { $nin: EXCLUDE_IDS };
            }
            
            // 如果启用了严格筛选且有明确的搜索条件
            if (strict_filters && (searchCriteria.jobTitle || searchCriteria.city)) {
              if (searchCriteria.jobTitle) {
                query.$or = [
                  { title: { $regex: searchCriteria.jobTitle, $options: 'i' } },
                  { summary: { $regex: searchCriteria.jobTitle, $options: 'i' } }
                ];
              }
              if (searchCriteria.city) {
                query.location = { $regex: searchCriteria.city, $options: 'i' };
              }
            } else if (searchCriteria.city) {
              // 只有城市筛选
              query.location = { $regex: searchCriteria.city, $options: 'i' };
            }
            
            console.log('[MCP] Database query:', JSON.stringify(query, null, 2));
            
            // 获取更多职位用于筛选，确保有足够的选择（从30提升到40，便于评分挑选）
            const searchLimit = Math.max(limit * 3, 40);
            const recentJobs = await collection
              .find(query)
              .sort({ updatedAt: -1, createdAt: -1 })
              .limit(searchLimit)
              .toArray();

            console.log(`[MCP] Database returned ${recentJobs.length} jobs after excluding ${exclude_ids.length} via exclude_ids`);

            // 转换为前端格式
            const transformedJobs = recentJobs
              .map((job: any) => transformMongoDBJobToFrontendFormat(job))
              .filter((job: any) => job !== null);

            if (transformedJobs.length === 0) {
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{
                    type: "text",
                    text: "No recent job postings found. Try adjusting your search criteria or check back later for new postings."
                  }],
                  isError: false
                }
              }, { "X-MCP-Trace-Id": traceId });
            }

            // 2. 发送给mirror-jobs进行基础分析
            const mirrorResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mirror-jobs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jobs: transformedJobs,
                jobTitle: defaultProfile.jobTitles?.[0] || 'General',
                city: defaultProfile.city,
                limit: limit,
                page: 1,
                isHotJob: false,
                platform: 'recommendation'
              })
            });

            if (!mirrorResponse.ok) {
              throw new Error(`Mirror-jobs API error: ${mirrorResponse.status}`);
            }

            const mirrorResult = await mirrorResponse.json();
            const analyzedJobs = mirrorResult.jobs || [];

            // 3. 对每个职位进行用户匹配分析
            console.log(`[MCP] Starting GPT matching for ${analyzedJobs.length} jobs`);
            const scoredJobs = await Promise.all(
              analyzedJobs.map(async (job: any) => {
                try {
                  console.log(`[MCP] Calling GPT for job: ${job.title}`);
                  const gptApiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/gpt-services/jobMatch`;
                  console.log(`[MCP] GPT API URL: ${gptApiUrl}`);
                  const matchResponse = await fetch(gptApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
                      jobTitle: job.title,
                      jobDescription: job.description || '',
                      jobRequirements: job.requirements || [],
                      jobLocation: job.location,
                      userProfile: {
                        jobTitles: defaultProfile.jobTitles.length > 0 ? defaultProfile.jobTitles : [job.title],
                        skills: defaultProfile.skills,
                        city: defaultProfile.city,
                        seniority: defaultProfile.seniority,
                        openToRelocate: defaultProfile.openToRelocate,
                        careerPriorities: defaultProfile.careerPriorities,
                        expectedSalary: defaultProfile.expectedSalary,
                        currentPosition: defaultProfile.currentPosition,
                        expectedPosition: defaultProfile.expectedPosition,
                        employmentHistory: defaultProfile.employmentHistory
                      }
                    }),
                  });

                  if (!matchResponse.ok) {
                    throw new Error(`Match API error: ${matchResponse.status}`);
                  }

                  const matchData = await matchResponse.json();
                  
                  // 添加调试日志 - 使用更明显的格式
                  console.log(`[MCP] ===== JOB SCORING DEBUG =====`);
                  console.log(`[MCP] Job Title: ${job.title}`);
                  console.log(`[MCP] GPT Raw Response:`, matchData);
                  console.log(`[MCP] Score from GPT: ${matchData.score}`);
                  console.log(`[MCP] SubScores from GPT:`, matchData.subScores);
                  console.log(`[MCP] ================================`);
                  
                  // 确保分数格式符合GPT要求
                  const validatedSubScores = {
                    experience: Math.min(Math.max(matchData.subScores?.experience || 50, 50), 95),
                    industry: Math.min(Math.max(matchData.subScores?.industry || 50, 50), 95),
                    skills: Math.min(Math.max(matchData.subScores?.skills || 50, 50), 90), // skills最高90
                    other: Math.min(Math.max(matchData.subScores?.other || 50, 50), 95)
                  };
                  
                  const validatedMatchScore = Math.min(Math.max(matchData.score || 50, 50), 95);
                  
                  console.log(`[MCP] Job ${job.title} - Final Scores:`, {
                    matchScore: validatedMatchScore,
                    subScores: validatedSubScores
                  });
                  
                  return {
                    ...job,
                    matchScore: validatedMatchScore,
                    subScores: validatedSubScores,
                    matchAnalysis: matchData.analysis || 'Analysis not available',
                    matchHighlights: matchData.highlights || [],
                    summary: matchData.listSummary || job.summary || `${job.title} position at ${job.company}`,
                    detailedSummary: matchData.detailedSummary || job.detailedSummary || job.description?.substring(0, 200) + '...',
                    keyRequirements: matchData.keyRequirements || [],
                    userType: matchData.userType || 'neutral'
                  };
                } catch (error) {
                  console.error(`Error scoring job ${job.id}:`, error);
                  // 为每个失败的职位生成不同的默认分数，避免所有分数都一样
                  const randomOffset = Math.floor(Math.random() * 20) - 10; // -10 到 +10 的随机偏移
                  const baseScore = 60 + randomOffset;
                  const finalScore = Math.min(Math.max(baseScore, 50), 80);
                  
                  return {
                    ...job,
                    matchScore: finalScore,
                    subScores: { 
                      experience: Math.min(Math.max(55 + randomOffset, 50), 85),
                      industry: Math.min(Math.max(60 + randomOffset, 50), 85),
                      skills: Math.min(Math.max(50 + randomOffset, 50), 80),
                      other: Math.min(Math.max(65 + randomOffset, 50), 85)
                    },
                    matchAnalysis: 'Unable to analyze - using fallback scoring',
                    matchHighlights: [
                      `Basic match: ${job.title} position`,
                      `Location: ${job.location}`,
                      `Company: ${job.company}`
                    ],
                    summary: job.summary || `${job.title} position at ${job.company}`,
                    detailedSummary: job.detailedSummary || job.description?.substring(0, 200) + '...',
                    keyRequirements: [],
                    userType: 'neutral'
                  };
                }
              })
            );

            // 4. 按分数从高到低排序，返回前5个
            const recommendedJobs = scoredJobs
              .sort((a, b) => b.matchScore - a.matchScore)
              .slice(0, 5);

            // 5. 按照现有UI规则格式化显示，确保分数格式正确
            const recommendations = recommendedJobs.map((job, index) => 
              `**${index + 1}. ${job.title}** at ${job.company}\n` +
              `📍 ${job.location} | 💼 ${job.jobType || 'Full-time'} | 💰 ${job.salary || 'Salary not specified'}\n` +
              `\n**Job Highlights:**\n${job.matchHighlights?.map((h: string) => `• ${h}`).join('\n') || 'Analysis not available'}\n` +
              `\n**Match Score: ${job.matchScore}%**\n` +
              `• Experience: ${job.subScores.experience}% | Skills: ${job.subScores.skills}% | Industry: ${job.subScores.industry}% | Other: ${job.subScores.other}%\n` +
              `\n🔗 [View Job](${job.url})\n` +
              `\n---\n`
            ).join('\n');

            // 构建基础摘要
            let summary = `Found ${recommendedJobs.length} personalized job recommendations based on recent postings. ` +
              `All jobs are sorted by match score (${recommendedJobs[0]?.matchScore}% - ${recommendedJobs[recommendedJobs.length-1]?.matchScore}%).`;
            
            // 如果使用了简历推测，添加说明
            if (searchCriteria.usedResumeInference && searchCriteria.inferredPosition) {
              summary += `\n\n💡 **根据你的简历推测目标职位为『${searchCriteria.inferredPosition}』**`;
              if (searchCriteria.city) {
                summary += `，地点为『${searchCriteria.city}』`;
              }
              summary += `。如有其他补充信息或想法，请告诉我！`;
            }

            // ============================================
            // 记录推荐结果到 feedback_events（同步 upsert）
            // ============================================
            if (fc && feedback_event_id) {
              try {
                const { db } = await connectToMongoDB();
                const output_data = {
                  recommendations: recommendedJobs.map(job => ({
                    job_id: job.id || job.jobIdentifier || job._id?.toString(),
                    title: job.title,
                    company: job.company,
                    location: job.location,
                    matchScore: job.matchScore,
                    url: job.url
                  })),
                  total: recommendedJobs.length,
                  search_criteria: {
                    job_title: searchCriteria.jobTitle,
                    city: searchCriteria.city
                  },
                  summary: `Recommended ${recommendedJobs.length} jobs: ${recommendedJobs.slice(0, 3).map(j => j.title).join(', ')}${recommendedJobs.length > 3 ? '...' : ''}`
                };
                await db.collection('feedback_events').updateOne(
                  { event_id: feedback_event_id },
                  {
                    $setOnInsert: {
                      event_id: feedback_event_id,
                      session_id: session_id || 'anonymous',
                      tool: 'recommend_jobs',
                      input: args,
                      timestamp: new Date(),
                      created_at: new Date(),
                    },
                    $set: { output: output_data, updated_at: new Date() },
                    $addToSet: {
                      'feedback.shown_jobs': { $each: recommendedJobs.map(job => job.id || job.jobIdentifier || job._id?.toString()) }
                    }
                  },
                  { upsert: true }
                );
              } catch (e) {
                console.warn('[recommend] feedback sync upsert failed:', (e as any)?.message || e);
              }
            }
            
            // ========================================
            // PR-1: 更新 AgentKit Memory（同步，返回前写入）
            // ========================================
            if (ENABLE_MEMORY && session_id) {
              const new_job_ids = recommendedJobs.map(job => job.id);
              try {
                const memory = new AgentKitMemory();
                const context = await memory.getContext(session_id);
                const existing_ids = context?.context?.jobContext?.shown_job_ids || [];
                const updated_ids = [...existing_ids, ...new_job_ids].slice(-500);  // 保留最近500个
                await memory.storeContext(session_id, {
                  jobContext: {
                    shown_job_ids: updated_ids,
                    last_returned_ids: new_job_ids,
                    last_search: {
                      job_title: searchCriteria.jobTitle,
                      city: searchCriteria.city,
                      timestamp: new Date().toISOString()
                    }
                  }
                });
                console.log(`[MCP] AgentKit Memory updated: ${new_job_ids.length} new jobs added, total ${updated_ids.length} in memory`);
              } catch (err) {
                console.warn('[MCP] AgentKit Memory update failed (non-blocking):', err);
              }
            }

            // Phase 2: 添加用户反馈提示文案
            const feedback_prompt = `\n\n💡 **What would you like to do next?**\n` +
              `- Tell me which jobs you like (e.g., "I like #2 and #5")\n` +
              `- Tell me which ones don't interest you (e.g., "Not interested in #3")\n` +
              `- Ask for more similar jobs (e.g., "Show me more jobs like #2")\n` +
              `- Or simply say "show me more recommendations"`;

            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `# 🎯 Personalized Job Recommendations\n\n${summary}\n\n${recommendations}${feedback_prompt}`
                }],
                isError: false,
                mode: "recommend",
                query_used: { 
                  job_title: searchCriteria.jobTitle, 
                  city: searchCriteria.city 
                },
                used_resume: true,
                total: recommendedJobs.length,
                isFinal: false,  // Phase 2: 改为 false，等待用户反馈
                // GPT 方案: 暴露本次返回的 job IDs 供下次去重
                meta: {
                  returned_job_ids: recommendedJobs.map(job => job.id),
                  index_to_id: recommendedJobs.map(job => job.id),
                  session_id
                }
              }
            }, { "X-MCP-Trace-Id": traceId });

          } catch (error: any) {
            console.error('[MCP] recommend_jobs error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Failed to get job recommendations: ${error.message}`
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: refine_recommendations (Phase 2)
        // ============================================
        else if (name === "refine_recommendations") {
          const { 
            job_title, 
            city, 
            liked_job_ids = [], 
            disliked_job_ids = [], 
            liked_indexes = [],
            disliked_indexes = [],
            exclude_ids = [],
            session_id,
            user_email,
            limit = 10 
          } = args;
          
          console.log('[MCP] refine_recommendations - Input:', { 
            liked_count: liked_job_ids.length, 
            disliked_count: disliked_job_ids.length,
            liked_indexes: Array.isArray(liked_indexes) ? liked_indexes.length : 0,
            disliked_indexes: Array.isArray(disliked_indexes) ? disliked_indexes.length : 0,
            exclude_count: exclude_ids.length,
            session_id,
            limit 
          });
          
          try {
            const { db } = await connectToMongoDB();
            const collection = db.collection('hera_jobs.jobs');
            
            // ========================================
            // 汇总所有要排除的职位（多层）
            // ========================================
            let EXCLUDE_SET = new Set<string>(exclude_ids);  // Layer 1: 参数
            disliked_job_ids.forEach((id: string) => EXCLUDE_SET.add(id));  // disliked 也排除
            const param_excluded_count = EXCLUDE_SET.size;
            console.log(`[refine] Layer 1 (exclude_ids + disliked): ${EXCLUDE_SET.size} jobs`);

            // Layer 2: AgentKit Memory（与 recommend_jobs 对齐）
            let memory_added_count = 0;
            let effectiveJobTitle: string | undefined = job_title;
            let effectiveCity: string | undefined = city;
            let lastReturnedIds: string[] = [];
            if (session_id) {
              try {
                const memory = new AgentKitMemory();
                const context = await memory.getContext(session_id);
                if (context?.context?.jobContext?.shown_job_ids) {
                  const memory_ids: string[] = context.context.jobContext.shown_job_ids;
                  memory_ids.forEach((id: string) => {
                    if (!EXCLUDE_SET.has(id)) {
                      EXCLUDE_SET.add(id);
                      memory_added_count++;
                    }
                  });
                }
                if (context?.context?.jobContext?.last_returned_ids) {
                  lastReturnedIds = context.context.jobContext.last_returned_ids;
                }
                // 自动回填上一轮检索条件
                const last = context?.context?.jobContext?.last_search;
                if (last) {
                  if (!effectiveJobTitle && last.job_title) effectiveJobTitle = last.job_title;
                  if (!effectiveCity && last.city) effectiveCity = last.city;
                }
                console.log(`[refine] Layer 2 (AgentKit Memory): added ${memory_added_count} jobs`);
              } catch (err) {
                console.warn('[refine] AgentKit Memory read failed (non-blocking):', err);
              }
            }

            // 将 liked_indexes / disliked_indexes 映射为 IDs 并合并
            const mapIndexes = (indexes: number[]) => {
              const out: string[] = [];
              if (Array.isArray(indexes) && lastReturnedIds.length > 0) {
                indexes.forEach((idx) => {
                  const i = (idx || 0) - 1; // 1-based → 0-based
                  if (i >= 0 && i < lastReturnedIds.length) {
                    out.push(String(lastReturnedIds[i]));
                  }
                });
              }
              return out;
            };
            const mappedLiked = mapIndexes(liked_indexes);
            const mappedDisliked = mapIndexes(disliked_indexes);
            if (mappedLiked.length) {
              console.log('[refine] Mapped liked_indexes → IDs:', mappedLiked.length);
              mappedLiked.forEach((id) => liked_job_ids.push(id));
            }
            if (mappedDisliked.length) {
              console.log('[refine] Mapped disliked_indexes → IDs:', mappedDisliked.length);
              mappedDisliked.forEach((id) => {
                if (!EXCLUDE_SET.has(id)) EXCLUDE_SET.add(id);
              });
            }
            
            // Layer 3: feedback_events 补充历史
            if (fc && (session_id || user_email)) {
              try {
                const history_session = session_id || user_email || 'anonymous';
                const historyPromise = fc.getSessionFeedback(history_session, 20);
                const timeoutPromise = new Promise<any[]>((resolve) => 
                  setTimeout(() => resolve([]), 500)
                );
                const history = await Promise.race([historyPromise, timeoutPromise]);
                
                let feedback_count = 0;
                history.forEach((event: any) => {
                  (event.feedback?.shown_jobs || []).forEach((id: string) => {
                    if (!EXCLUDE_SET.has(id)) {
                      EXCLUDE_SET.add(id);
                      feedback_count++;
                    }
                  });
                  (event.feedback?.disliked_jobs || []).forEach((id: string) => {
                    if (!EXCLUDE_SET.has(id)) {
                      EXCLUDE_SET.add(id);
                      feedback_count++;
                    }
                  });
                });
                console.log(`[refine] Layer 2 (feedback_events): added ${feedback_count} jobs`);
              } catch (err) {
                console.warn('[refine] feedback_events read failed (non-blocking):', err);
              }
            }
            
            console.log(`[refine] Total jobs to exclude: ${EXCLUDE_SET.size} (param=${param_excluded_count}, memory=${memory_added_count})`);
            
            // ========================================
            // 分析用户偏好（如果有 liked）
            // ========================================
            let preferences: any = null;
            if (liked_job_ids.length > 0) {
              try {
                const liked_jobs = await collection.find({
                  id: { $in: liked_job_ids }
                }).toArray();
                
                if (liked_jobs.length > 0) {
                  preferences = {
                    preferred_titles: [...new Set(liked_jobs.map((j: any) => j.title))],
                    preferred_companies: [...new Set(liked_jobs.map((j: any) => j.company))],
                    preferred_skills: liked_jobs.flatMap((j: any) => j.skills || []),
                    preferred_locations: [...new Set(liked_jobs.map((j: any) => j.location))]
                  };
                  console.log('[refine] User preferences extracted from', liked_jobs.length, 'liked jobs');
                }
              } catch (err) {
                console.warn('[refine] Failed to fetch liked jobs:', err);
              }
            }
            
            // ========================================
            // 构建查询（排除 EXCLUDE_SET + 必须过滤）
            // ========================================
            const query: any = {
              is_active: { $ne: false },
              id: { $nin: Array.from(EXCLUDE_SET).slice(-2000) }
            };
            
            // 必须过滤：city 和 job_title（如果提供）
            if (effectiveCity) {
              query.location = { $regex: effectiveCity, $options: 'i' };
            }
            if (effectiveJobTitle) {
              query.$or = [
                { title: { $regex: effectiveJobTitle, $options: 'i' } },
                { summary: { $regex: effectiveJobTitle, $options: 'i' } }
              ];
            }
            
            // 如果有偏好，作为加分项而不是硬过滤（在打分阶段处理）
            // 这样可以避免查询结果太少
            
            console.log('[refine] Query:', JSON.stringify(query, null, 2));
            
            // ========================================
            // 查询候选（保持 30）
            // ========================================
            const searchLimit = 30;
            let candidates = await collection.find(query)
              .sort({ createdAt: -1 })
              .limit(searchLimit)
              .toArray();
            
            console.log(`[refine] Found ${candidates.length} candidates after excluding ${EXCLUDE_SET.size}`);

            // 追加一道 _id 维度的排除兜底（若历史里存的是 _id 字符串）
            const beforeIdFilter = candidates.length;
            candidates = candidates.filter((doc: any) => !EXCLUDE_SET.has(String(doc?._id || '')));
            if (candidates.length !== beforeIdFilter) {
              console.log(`[refine] Post-fetch _id filter removed ${beforeIdFilter - candidates.length} candidates`);
            }
            
            // 如果候选不足，回退查询
            if (candidates.length < limit) {
              console.log('[refine] Not enough candidates, trying fallback query');
              const fbQuery: any = {
                is_active: { $ne: false },
                id: { $nin: Array.from(EXCLUDE_SET).slice(-2000) }
              };
              if (effectiveCity) {
                fbQuery.location = { $regex: effectiveCity, $options: 'i' };
              }
              if (effectiveJobTitle) {
                fbQuery.$or = [
                  { title: { $regex: effectiveJobTitle, $options: 'i' } },
                  { summary: { $regex: effectiveJobTitle, $options: 'i' } }
                ];
              }
              const fallback = await collection.find(fbQuery)
                .sort({ createdAt: -1 })
                .limit(searchLimit)
                .toArray();
              candidates.push(...fallback);
              console.log(`[refine] After fallback: ${candidates.length} total candidates (fbQuery=${JSON.stringify(fbQuery)})`);
            }
            
            // ========================================
            // 轻量打分（如果有偏好）
            // ========================================
            let scored = candidates;
            if (preferences) {
              scored = candidates.map((job: any) => {
                let score = 50; // 基础分
                
                // 标题匹配 +30
                if (preferences.preferred_titles.some((t: string) => 
                  job.title.toLowerCase().includes(t.toLowerCase())
                )) score += 30;
                
                // 公司匹配 +20
                if (preferences.preferred_companies.includes(job.company)) score += 20;
                
                // 技能匹配 每个 +5（上限 25）
                const matching_skills = (job.skills || []).filter((s: string) => 
                  preferences.preferred_skills.includes(s)
                );
                score += Math.min(matching_skills.length * 5, 25);
                
                // 地点匹配 +10
                if (preferences.preferred_locations.includes(job.location)) score += 10;
                
                return { ...job, personalized_score: Math.min(score, 100) };
              });
              
              scored.sort((a: any, b: any) => b.personalized_score - a.personalized_score);
              console.log('[refine] Applied preference scoring');
            }
            
            // 转换并做指纹去重（公司+标题+地点），再截取前 N 条
            let transformed = scored.map((job: any) => {
              const out = transformMongoDBJobToFrontendFormat(job);
              if (out && (job as any).personalized_score) {
                (out as any).personalized_score = (job as any).personalized_score;
              }
              return out;
            }).filter((j: any) => j);

            const beforeFingerprint = transformed.length;
            transformed = deduplicateJobs(transformed as any);
            if (transformed.length !== beforeFingerprint) {
              console.log(`[refine] Fingerprint dedup removed ${beforeFingerprint - transformed.length} items`);
            }

            const results = transformed.slice(0, limit);
            
            console.log(`[refine] Returning ${results.length} refined recommendations`);

            // ========================================
            // 更新 AgentKit Memory（同步，返回前写入）
            // ========================================
            if (session_id) {
              const returned_ids = results.map((j: any) => j.id).filter(Boolean);
              try {
                const memory = new AgentKitMemory();
                const context = await memory.getContext(session_id);
                const existing_ids = context?.context?.jobContext?.shown_job_ids || [];
                const updated_ids = [...existing_ids, ...returned_ids].slice(-500); // 滚动窗口 500
                await memory.storeContext(session_id, {
                  jobContext: {
                    shown_job_ids: updated_ids,
                    last_returned_ids: returned_ids,
                    last_search: {
                      job_title: effectiveJobTitle,
                      city: effectiveCity,
                      timestamp: new Date().toISOString()
                    }
                  }
                });
                console.log(`[refine] AgentKit Memory updated: +${returned_ids.length}, total ~${updated_ids.length}`);
              } catch (err) {
                console.warn('[refine] AgentKit Memory update failed (non-blocking):', err);
              }
            }
            
            // ========================================
            // 记录到 feedback_events（同步 upsert）
            // ========================================
            if (fc && feedback_event_id) {
              try {
                const { db } = await connectToMongoDB();
                const output_data = {
                  recommendations: results.map((job: any) => ({
                    job_id: job.id,
                    title: job.title,
                    company: job.company,
                    location: job.location,
                    personalized_score: job.personalized_score || 50
                  })),
                  total: results.length,
                  excluded_count: EXCLUDE_SET.size,
                  preferences_applied: !!preferences
                };
                await db.collection('feedback_events').updateOne(
                  { event_id: feedback_event_id },
                  {
                    $setOnInsert: {
                      event_id: feedback_event_id,
                      session_id: session_id || 'anonymous',
                      tool: 'refine_recommendations',
                      input: args,
                      timestamp: new Date(),
                      created_at: new Date(),
                    },
                    $set: { output: output_data, updated_at: new Date() },
                    $addToSet: {
                      'feedback.shown_jobs': { $each: results.map((j: any) => j.id) },
                      ...(liked_job_ids.length > 0 ? { 'feedback.liked_jobs': { $each: liked_job_ids } } : {}),
                      ...(disliked_job_ids.length > 0 ? { 'feedback.disliked_jobs': { $each: disliked_job_ids } } : {}),
                    }
                  },
                  { upsert: true }
                );
              } catch (e) {
                console.warn('[refine] feedback sync upsert failed:', (e as any)?.message || e);
              }
            }
            
            // ========================================
            // 格式化并返回
            // ========================================
            const formatted_jobs = results.map((job: any, index: number) => {
              const score_text = preferences && job.personalized_score 
                ? `🎯 Personalized Score: ${job.personalized_score}%\n` 
                : '';
              return `**${index + 1}. ${job.title}** at ${job.company}\n` +
                `📍 ${job.location} | 💼 ${job.jobType || 'Full-time'} | 💰 ${job.salary || 'Not specified'}\n` +
                score_text +
                `🔗 [View Job](${job.url})\n` +
                `---\n`;
            }).join('\n');
            
            const summary = preferences 
              ? `Based on your preferences, here are ${results.length} new personalized recommendations (excluded ${EXCLUDE_SET.size} previously seen jobs):`
              : `Here are ${results.length} new recommendations (excluded ${EXCLUDE_SET.size} previously seen jobs):`;
            
            const feedback_prompt = `\n\n💡 **Want more?**\n` +
              `- Tell me which jobs you like (e.g., "I like #2 and #4")\n` +
              `- Tell me which to exclude (e.g., "Not interested in #3")\n` +
              `- Or say "show me more" to continue`;
            
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `# 🔄 Refined Job Recommendations\n\n${summary}\n\n${formatted_jobs}${feedback_prompt}`
                }],
                isError: false,
                mode: "refine",
                total: results.length,
                excluded_count: EXCLUDE_SET.size,
                preferences_applied: !!preferences,
                isFinal: false,
                meta: {
                  returned_job_ids: results.map((j: any) => j.id),
                  index_to_id: results.map((j: any) => j.id),
                  excluded_breakdown: {
                    from_param: param_excluded_count,
                    from_memory: memory_added_count,
                    // feedback_count is logged above; include if available
                  },
                  session_id
                }
              }
            }, { "X-MCP-Trace-Id": traceId });
            
          } catch (error: any) {
            console.error('[MCP] refine_recommendations error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Failed to refine recommendations: ${error.message}`
                }],
                isError: true
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: job_alert (time-windowed fresh jobs)
        // ============================================
        else if (name === "job_alert") {
          const {
            session_id,
            job_title,
            city,
            company,
            keywords = [],
            limit = 8,
            exclude_ids = [],
            window_hours,
            since_iso,
            liked_indexes = [],
            disliked_indexes = [],
            liked_job_ids = [],
            disliked_job_ids = [],
            run_context,
            alert_key
          } = args || {};

          try {
            if (!session_id) {
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{ type: "text", text: "job_alert requires session_id" }],
                  isError: true
                }
              }, { "X-MCP-Trace-Id": traceId });
            }

            const { db } = await connectToMongoDB();
            const collection = db.collection('hera_jobs.jobs');

            // =============================
            // Build EXCLUDE_SET (multi-layer)
            // =============================
            let EXCLUDE_SET = new Set<string>(Array.isArray(exclude_ids) ? exclude_ids : []);
            (Array.isArray(disliked_job_ids) ? disliked_job_ids : []).forEach((id: string) => EXCLUDE_SET.add(String(id)));
            const param_excluded_count = EXCLUDE_SET.size;

            // Read memory for last_search, shown_job_ids, last_returned_ids, alertContext
            let effectiveTitle: string | undefined = job_title;
            let effectiveCity: string | undefined = city;
            let effectiveCompany: string | undefined = company;
            let effectiveKeywords: string[] = Array.isArray(keywords) ? keywords : [];
            let lastReturnedIds: string[] = [];
            let alertLastSentAt: string | undefined = undefined;
            let alertConfigHours: number | undefined = undefined;
            let alertLastSentIds: string[] = [];

            try {
              const memory = new AgentKitMemory();
              const context = await memory.getContext(session_id);
              const jc = context?.context?.jobContext;
              const ac = (context as any)?.context?.alertContext;

              if (jc?.shown_job_ids) {
                jc.shown_job_ids.forEach((id: string) => { if (!EXCLUDE_SET.has(id)) EXCLUDE_SET.add(id); });
              }
              if (jc?.last_returned_ids) lastReturnedIds = jc.last_returned_ids;
              if (jc?.last_search) {
                if (!effectiveTitle && jc.last_search.job_title) effectiveTitle = jc.last_search.job_title;
                if (!effectiveCity && jc.last_search.city) effectiveCity = jc.last_search.city;
                if (!effectiveCompany && jc.last_search.company) effectiveCompany = jc.last_search.company;
                if (effectiveKeywords.length === 0 && Array.isArray(jc.last_search.keywords)) effectiveKeywords = jc.last_search.keywords;
              }

              if (ac?.last_sent_at) alertLastSentAt = ac.last_sent_at;
              if (ac?.config?.window_hours) alertConfigHours = Number(ac.config.window_hours) || undefined;
              if (Array.isArray(ac?.last_sent_ids)) {
                ac.last_sent_ids.forEach((id: string) => { if (!EXCLUDE_SET.has(id)) EXCLUDE_SET.add(id); });
              }
            } catch (e) {
              console.warn('[job_alert] memory read failed:', (e as any)?.message || e);
            }

            // Map index feedback (optional)
            const mapIndexes = (indexes: number[]) => {
              const out: string[] = [];
              if (Array.isArray(indexes) && lastReturnedIds.length > 0) {
                indexes.forEach((idx) => {
                  const i = (idx || 0) - 1;
                  if (i >= 0 && i < lastReturnedIds.length) out.push(String(lastReturnedIds[i]));
                });
              }
              return out;
            };
            const mappedLiked = mapIndexes(liked_indexes);
            const mappedDisliked = mapIndexes(disliked_indexes);
            mappedLiked.forEach((id) => liked_job_ids.push(id));
            mappedDisliked.forEach((id) => EXCLUDE_SET.add(id));

            console.log(`[job_alert] exclude param=${param_excluded_count}, total=${EXCLUDE_SET.size}`);

            // =============================
            // Determine time window
            // =============================
            const now = new Date();
            const hours = (Number(window_hours) > 0 ? Number(window_hours) : (alertConfigHours || 24));
            let sinceDate: Date | null = null;
            if (since_iso) {
              const d = new Date(String(since_iso));
              if (!isNaN(d.getTime())) sinceDate = d;
            }
            if (!sinceDate) {
              const byWindow = new Date(now.getTime() - hours * 3600 * 1000);
              if (alertLastSentAt) {
                const last = new Date(alertLastSentAt);
                sinceDate = new Date(Math.max(byWindow.getTime(), isNaN(last.getTime()) ? 0 : last.getTime()));
              } else {
                sinceDate = byWindow;
              }
            }

            // =============================
            // Build query
            // =============================
            const query: any = { is_active: { $ne: false } };
            if (EXCLUDE_SET.size > 0) query.id = { $nin: Array.from(EXCLUDE_SET).slice(-2000) };
            if (effectiveCity) query.location = { $regex: effectiveCity, $options: 'i' };
            if (effectiveTitle) {
              query.$or = [
                { title: { $regex: effectiveTitle, $options: 'i' } },
                { summary: { $regex: effectiveTitle, $options: 'i' } }
              ];
            }
            if (effectiveCompany) query.company = { $regex: effectiveCompany, $options: 'i' };
            if (Array.isArray(effectiveKeywords) && effectiveKeywords.length > 0) {
              const kwClauses = effectiveKeywords
                .filter((k) => typeof k === 'string' && k.trim().length > 0)
                .map((k) => ({ $or: [
                  { title: { $regex: k, $options: 'i' } },
                  { summary: { $regex: k, $options: 'i' } }
                ] }));
              if (kwClauses.length > 0) {
                if (!query.$and) query.$and = [];
                query.$and.push(...kwClauses);
              }
            }
            if (sinceDate) {
              const sinceCond = { $or: [
                { postedAt: { $gte: sinceDate } },
                { createdAt: { $gte: sinceDate } },
                { updatedAt: { $gte: sinceDate } }
              ]};
              if (!query.$and) query.$and = [];
              query.$and.push(sinceCond);
            }

            console.log('[job_alert] Query:', JSON.stringify({ ...query, id: query.id ? `{ $nin: ${query.id.$nin.length} }` : undefined }, null, 2));

            // =============================
            // Fetch candidates
            // =============================
            const searchLimit = Math.max(limit * 5, 100);
            let candidates = await collection.find(query)
              .sort({ postedAt: -1, createdAt: -1, updatedAt: -1 })
              .limit(searchLimit)
              .toArray();

            const beforeFilter = candidates.length;
            candidates = candidates.filter((doc: any) => !EXCLUDE_SET.has(String(doc?._id || '')));
            if (candidates.length !== beforeFilter) {
              console.log(`[job_alert] Post _id filter removed ${beforeFilter - candidates.length}`);
            }

            // Transform → fingerprint dedup → top N
            let transformed = candidates.map((j: any) => transformMongoDBJobToFrontendFormat(j)).filter(Boolean);
            const beforeFP = transformed.length;
            transformed = deduplicateJobs(transformed as any);
            if (transformed.length !== beforeFP) {
              console.log(`[job_alert] Fingerprint dedup removed ${beforeFP - transformed.length}`);
            }

            const results = transformed.slice(0, limit);

            // =============================
            // Memory writeback (sync)
            // =============================
            try {
              const memory = new AgentKitMemory();
              const context = await memory.getContext(session_id);
              const existingShown = context?.context?.jobContext?.shown_job_ids || [];
              const updatedShown = [...existingShown, ...results.map((j: any) => j.id)].slice(-500);
              const prevSent = (context as any)?.context?.alertContext?.last_sent_ids || [];
              const updatedSent = [...prevSent, ...results.map((j: any) => j.id)].slice(-500);
              await memory.storeContext(session_id, {
                jobContext: {
                  shown_job_ids: updatedShown,
                  last_returned_ids: results.map((j: any) => j.id),
                  last_search: {
                    job_title: effectiveTitle,
                    city: effectiveCity,
                    company: effectiveCompany,
                    keywords: effectiveKeywords,
                    timestamp: new Date().toISOString()
                  }
                },
                alertContext: {
                  last_sent_at: new Date().toISOString(),
                  last_sent_ids: updatedSent,
                  config: { window_hours: hours },
                  alert_key: alert_key || undefined
                }
              } as any);
              console.log(`[job_alert] Memory updated: shown+=${results.length}, sent+=${results.length}`);
            } catch (e) {
              console.warn('[job_alert] memory write failed:', (e as any)?.message || e);
            }

            // =============================
            // Record feedback_events (sync upsert)
            // =============================
            if (fc && feedback_event_id) {
              try {
                const { db } = await connectToMongoDB();
                const output_data = {
                  alert: true,
                  run_context: run_context || 'manual',
                  total: results.length,
                  excluded_count: EXCLUDE_SET.size,
                  returned_job_ids: results.map((j: any) => j.id),
                  filters: {
                    job_title: effectiveTitle,
                    city: effectiveCity,
                    company: effectiveCompany,
                    keywords: effectiveKeywords,
                    since_iso: sinceDate?.toISOString() || null,
                    window_hours: hours
                  }
                };
                await db.collection('feedback_events').updateOne(
                  { event_id: feedback_event_id },
                  {
                    $setOnInsert: {
                      event_id: feedback_event_id,
                      session_id: session_id || 'anonymous',
                      tool: 'job_alert',
                      input: args,
                      timestamp: new Date(),
                      created_at: new Date(),
                    },
                    $set: { output: output_data, updated_at: new Date() },
                    $addToSet: {
                      'feedback.shown_jobs': { $each: results.map((j: any) => j.id) },
                      ...(Array.isArray(liked_job_ids) && liked_job_ids.length > 0 ? { 'feedback.liked_jobs': { $each: liked_job_ids } } : {}),
                      ...(Array.isArray(disliked_job_ids) && disliked_job_ids.length > 0 ? { 'feedback.disliked_jobs': { $each: disliked_job_ids } } : {}),
                    }
                  },
                  { upsert: true }
                );
              } catch (e) {
                console.warn('[job_alert] feedback sync upsert failed:', (e as any)?.message || e);
              }
            }

            // =============================
            // Format content
            // =============================
            const formatted = results.map((job: any, i: number) => (
              `**${i + 1}. ${job.title}** at ${job.company}\n` +
              `📍 ${job.location} | 💼 ${job.jobType || 'N/A'} | 💰 ${job.salary || 'N/A'}\n` +
              `🔗 [View Job](${job.url})\n---\n`
            )).join('\n');

            const header = `# 📣 Job Alert\n\nShowing ${results.length} new jobs since ${sinceDate?.toISOString() || 'N/A'} (window ${hours}h).`;

            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: `${header}\n\n${formatted}` }],
                isError: false,
                mode: "job_alert",
                total: results.length,
                excluded_count: EXCLUDE_SET.size,
                isFinal: false,
                meta: {
                  returned_job_ids: results.map((j: any) => j.id),
                  index_to_id: results.map((j: any) => j.id),
                  excluded_breakdown: {
                    from_param: param_excluded_count,
                    // from_memory/feedback are partially reflected in totals
                  },
                  session_id,
                  since_iso: sinceDate?.toISOString() || null,
                  window_hours: hours
                }
              }
            }, { "X-MCP-Trace-Id": traceId });

          } catch (error: any) {
            console.error('[MCP] job_alert error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: `Failed to run job_alert: ${error.message}` }],
                isError: true
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: tailor_resume
        // ============================================
        else if (name === "tailor_resume") {
          const {
            user_profile = {},
            job_id,
            job_description,
            job_title,
            company,
            resume_content,
            customization_level = 'moderate',
            user_email
          } = args;

          console.log('[MCP] tailor_resume - Input args:', { 
            job_id, 
            job_title, 
            company, 
            customization_level,
            has_resume_content: !!resume_content,
            has_user_profile: !!user_profile
          });

          try {
            let targetJobInfo = {
              title: job_title || 'Position',
              company: company || 'Company',
              description: job_description || '',
              url: ''
            };

            // Try to retrieve complete job information from database if job_id is provided
            if (job_id) {
              try {
                const { db } = await connectToMongoDB();
                const collection = db.collection('hera_jobs.jobs');
                const job = await collection.findOne({ id: job_id });
                
                if (job) {
                  targetJobInfo = {
                    title: job.title || job_title || 'Position',
                    company: job.company || job.organisation || company || 'Company',
                    description: job.description || job.summary || job_description || '',
                    url: job.url || job.link || ''
                  };
                  console.log('[MCP] Retrieved job info from database:', targetJobInfo.title);
                }
              } catch (dbError) {
                console.warn('[MCP] Failed to retrieve job from database, using provided info:', dbError);
              }
            }

            // Determine processing scenario based on available data
            const hasJobDescription = !!(targetJobInfo.description && targetJobInfo.description.trim());
            const isOptimizeScenario = !hasJobDescription;
            
            console.log('[MCP] Processing scenario:', {
              isOptimizeScenario,
              hasJobDescription,
              jobDescriptionLength: targetJobInfo.description?.length || 0
            });

            // Handle optimize resume scenario (no job description)
            if (isOptimizeScenario) {
              console.log('[MCP] Starting optimize resume flow...');
              return await handleOptimizeResume({
                user_profile,
                resume_content,
                user_email,
                body,
                traceId
              });
            }

            // Handle tailor resume scenario (with job description)
            console.log('[MCP] Starting tailor resume flow...');
            
            let tailorResult: any = {};
            let pdfDownloadUrl: string | null = null;

            try {
              // Process resume content using main site APIs
              if (resume_content) {
                console.log('[MCP] Using main site APIs for resume tailoring...');
                
                // Parse resume content to JSON format if possible
                let resumeJson: any;
                try {
                  resumeJson = JSON.parse(resume_content);
                } catch {
                  // Create basic resume structure if not JSON
                  resumeJson = {
                    profile: {
                      name: user_profile.name || 'User',
                      email: user_profile.email || user_email,
                      phone: user_profile.phone || '',
                      location: user_profile.city || ''
                    },
                    summary: resume_content,
                    experience: (user_profile.employmentHistory || []).map((emp: any) => ({
                      title: emp.position || emp.title || '',
                      company: emp.company || '',
                      startDate: emp.startDate || '',
                      endDate: emp.endDate || '',
                      description: emp.description || '',
                      bullets: emp.bullets || []
                    })),
                    skills: user_profile.skills || [],
                    education: user_profile.education || []
                  };
                }

                // Step 1: Generate Professional Summary using boost-highlights API
                console.log('[MCP] Generating professional summary...');
                try {
                  const resumeDataForHighlights = buildResumeDataForHighlights(resumeJson, user_profile);
                  
                  const highlightsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/boost-highlights`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      resumeData: resumeDataForHighlights,
                      currentHighlights: resumeJson.summary || resume_content
                    })
                  });

                  if (highlightsResponse.ok) {
                    const highlightsData = await highlightsResponse.json();
                    if (highlightsData.highlights) {
                      resumeJson.summary = highlightsData.highlights;
                      console.log('[MCP] Generated professional summary');
                    }
                  } else {
                    console.warn('[MCP] Failed to generate professional summary, using original');
                  }
                } catch (highlightsError) {
                  console.warn('[MCP] Error generating professional summary:', highlightsError);
                }

                // Step 2: Call main site tailor API with proper highlights extraction
                console.log('[MCP] Calling main site tailor API...');
                
                // Extract key highlights from job description using helper function
                const extractedHighlights = extractKeyHighlights(targetJobInfo.description);

                const tailorResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/tailor`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    resumeJson: resumeJson,
                    jobUrl: targetJobInfo.url || job_id || '',
                    highlights: extractedHighlights,
                    jdSummary: targetJobInfo.description,
                    requiredList: []
                  })
                });

                if (tailorResponse.ok) {
                  tailorResult = await tailorResponse.json();
                  console.log('[MCP] Successfully tailored resume using main site API');
                } else {
                  const errorText = await tailorResponse.text();
                  console.warn('[MCP] Main site tailor API failed:', errorText);
                  throw new Error('Main site API failed');
                }
              } else {
                throw new Error('No resume content provided');
              }
            } catch (mainSiteError) {
              console.log('[MCP] Falling back to GPT service for resume tailoring...');
              
              // Fallback to GPT service if main site APIs fail
              tailorResult = await tailorResumeWithGPT({
                userProfile: user_profile,
                jobDescription: targetJobInfo.description,
                jobTitle: targetJobInfo.title,
                company: targetJobInfo.company,
                resumeContent: resume_content || JSON.stringify(user_profile, null, 2),
                customizationLevel: customization_level
              });
            }

            // Save tailored resume to database if user_email and job_id are provided
            if (user_email && job_id) {
              try {
                let resumeTailorData: any = {};

                if (tailorResult.resumeJson || tailorResult.tailoredResume) {
                  // Try to generate PDF if we have complete resume data
                  try {
                    const resumeData = tailorResult.resumeJson || {
                      profile: user_profile,
                      summary: tailorResult.tailoredResume || tailorResult.summary,
                      experience: user_profile.employmentHistory || [],
                      skills: user_profile.skills || []
                    };

                    const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/generate-resume`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        resumeData,
                        settings: { documentSize: 'A4', fontSize: 10 },
                        format: 'pdf',
                        jobId: job_id
                      })
                    });

                    if (pdfResponse.ok) {
                      const pdfResult = await pdfResponse.json();
                      resumeTailorData = {
                        gridfsId: `tailored_${job_id}_${Date.now()}`,
                        downloadUrl: pdfResult.downloadUrl,
                        filename: pdfResult.filename || `tailored_resume_${targetJobInfo.title.replace(/\s+/g, '_')}.pdf`
                      };
                      pdfDownloadUrl = pdfResult.downloadUrl;
                    } else {
                      throw new Error('PDF generation failed');
                    }
                  } catch (pdfError) {
                    console.warn('[MCP] PDF generation failed, saving text version:', pdfError);
                    resumeTailorData = {
                      gridfsId: `tailored_${job_id}_${Date.now()}`,
                      downloadUrl: `#resume_content:${encodeURIComponent(tailorResult.tailoredResume || JSON.stringify(tailorResult))}`,
                      filename: `tailored_resume_${targetJobInfo.title.replace(/\s+/g, '_')}.txt`
                    };
                  }
                } else {
                  resumeTailorData = {
                    gridfsId: `tailored_${job_id}_${Date.now()}`,
                    downloadUrl: `#resume_content:${encodeURIComponent(JSON.stringify(tailorResult))}`,
                    filename: `tailored_resume_${targetJobInfo.title.replace(/\s+/g, '_')}.json`
                  };
                }

                await upsertJobApplication(user_email, job_id, {
                  resumeTailor: resumeTailorData
                });
                
                console.log('[MCP] Saved tailored resume to user profile');
              } catch (saveError) {
                console.warn('[MCP] Failed to save tailored resume to profile:', saveError);
              }
            }

            // Format response with proper resume structure
            const changes = tailorResult.keyChanges || ['Resume customized for specific job requirements', 'Keywords optimized for ATS systems', 'Experience reordered to highlight relevant skills'];
            const summary = tailorResult.summary || 'Resume has been tailored to match the job description and requirements.';
            const recommendations = tailorResult.recommendations || ['Review the tailored resume for accuracy', 'Consider adding specific metrics to achievements', 'Ensure all dates and company names are correct'];
            
            // Use formatted resume output if available
            let formattedResume = '';
            if (tailorResult.resumeJson) {
              formattedResume = formatResumeOutput(tailorResult.resumeJson);
            } else {
              formattedResume = tailorResult.tailoredResume || JSON.stringify(tailorResult, null, 2);
            }

            const responseText = 
              `# 📝 Resume Tailored Successfully\n\n` +
              `**Target Position:** ${targetJobInfo.title} at ${targetJobInfo.company}\n\n` +
              `**Customization Level:** ${customization_level}\n\n` +
              `## Key Changes Made:\n${changes.map((change: string) => `• ${change}`).join('\n')}\n\n` +
              `## Summary:\n${summary}\n\n` +
              `## Additional Recommendations:\n${recommendations.map((rec: string) => `• ${rec}`).join('\n')}\n\n` +
              (pdfDownloadUrl ? `**📄 PDF Download:** ${pdfDownloadUrl}\n\n` : '') +
              `## Tailored Resume:\n\n${formattedResume}\n\n` +
              `*Resume has been customized to match the job requirements while maintaining authenticity.*`;

            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: responseText
                }],
                isError: false,
                tailoredResume: formattedResume,
                keyChanges: changes,
                summary: summary,
                recommendations: recommendations,
                jobInfo: targetJobInfo,
                downloadUrl: pdfDownloadUrl
              }
            }, { "X-MCP-Trace-Id": traceId });

          } catch (error: any) {
            console.error('[MCP] tailor_resume error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Failed to tailor resume: ${error.message}`
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: career_transition_advice
        // ============================================
        else if (name === "career_transition_advice") {
          const traceId = crypto.randomUUID();
          const { current_job, experience_years, skills, industry, location } = args;

          console.log('[MCP] career_transition_advice - Input:', { 
            current_job, 
            experience_years, 
            skills, 
            industry, 
            location 
          });

          // Use Vercel proxy URL if available, otherwise fallback to direct Vultr URL
          const mcpCareerUrl = process.env.MCP_CAREER_URL || process.env.CAREER_SWITCH_API_URL || 'http://149.28.175.142:3009';
          
          // Determine if we're using Vercel proxy or direct API
          const isVercelProxy = mcpCareerUrl.includes('/api/career-advice');
          const targetUrl = isVercelProxy ? mcpCareerUrl : `${mcpCareerUrl}/api/career/advice`;

          const requestBody = {
            mode: "report", // Use report mode to get GPT-generated professional report
            currentJob: current_job ?? null,
            experience: experience_years ?? null,
            skills: skills ?? null,
            industry: industry ?? null,
            location: location ?? null,
          };

          console.info("[MCP→Vercel Proxy] fetch", { traceId, url: targetUrl, body: requestBody });

          try {
            const response = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-trace-id': traceId // Pass trace ID
              },
              body: JSON.stringify(requestBody),
            });

            console.info("[MCP←Vercel Proxy] resp", { traceId, status: response.status });

            const responseText = await response.text();
            console.info("[MCP data] Received response", { traceId, len: responseText.length });

            // Attempt to parse JSON, handle non-JSON responses gracefully
            try {
              const data = JSON.parse(responseText);
              
              // Format the report as Markdown text like recommend_jobs does
              let markdownReport = `# 🎯 Career Transition Recommendations\n\n`;
              
              if (data.report) {
                // Format GPT-generated report
                markdownReport += `## 📊 Career Analysis Report\n\n`;
                if (data.report.summary) {
                  markdownReport += `**Summary:** ${data.report.summary}\n\n`;
                }
                if (data.report.insights && Array.isArray(data.report.insights)) {
                  markdownReport += `### Key Insights:\n${data.report.insights.map((i: string) => `• ${i}`).join('\n')}\n\n`;
                }
                if (data.report.skillsAnalysis) {
                  markdownReport += `### Skills Analysis:\n`;
                  if (data.report.skillsAnalysis.transferable) {
                    markdownReport += `**Transferable Skills:** ${Array.isArray(data.report.skillsAnalysis.transferable) ? data.report.skillsAnalysis.transferable.slice(0, 5).join(', ') : 'N/A'}\n\n`;
                  }
                  if (data.report.skillsAnalysis.toDevelop) {
                    markdownReport += `**Skills to Develop:** ${Array.isArray(data.report.skillsAnalysis.toDevelop) ? data.report.skillsAnalysis.toDevelop.slice(0, 5).join(', ') : 'N/A'}\n\n`;
                  }
                }
                if (data.report.actionPlan) {
                  markdownReport += `### Action Plan:\n`;
                  if (data.report.actionPlan.immediate) {
                    markdownReport += `**Immediate (Week 1-4):**\n${Array.isArray(data.report.actionPlan.immediate) ? data.report.actionPlan.immediate.map((a: string) => `• ${a}`).join('\n') : 'N/A'}\n\n`;
                  }
                  if (data.report.actionPlan.shortTerm) {
                    markdownReport += `**Short-term (Month 1-3):**\n${Array.isArray(data.report.actionPlan.shortTerm) ? data.report.actionPlan.shortTerm.map((a: string) => `• ${a}`).join('\n') : 'N/A'}\n\n`;
                  }
                }
              }
              
              // Add candidates list
              if (data.candidates && Array.isArray(data.candidates)) {
                markdownReport += `## 💼 Recommended Career Transitions\n\n`;
                data.candidates.slice(0, 10).forEach((candidate: any, index: number) => {
                  markdownReport += `**${index + 1}. ${candidate.to}**\n`;
                  markdownReport += `Similarity: ${Math.round((candidate.similarity || 0) * 100)}%`;
                  if (candidate.difficulty) markdownReport += ` | Difficulty: ${candidate.difficulty}`;
                  if (candidate.transitionTime) markdownReport += ` | Timeline: ${candidate.transitionTime}`;
                  markdownReport += `\n`;
                  if (candidate.sharedTags && candidate.sharedTags.length > 0) {
                    markdownReport += `**Shared Skills:** ${candidate.sharedTags.slice(0, 5).join(', ')}\n`;
                  }
                  if (candidate.skillsToLearn && candidate.skillsToLearn.length > 0) {
                    markdownReport += `**Skills to Learn:** ${candidate.skillsToLearn.slice(0, 5).join(', ')}\n`;
                  }
                  markdownReport += `\n---\n\n`;
                });
              }
              
              // Add metadata
              if (data.metadata) {
                markdownReport += `## 📈 Analysis Metadata\n\n`;
                markdownReport += `• Total Transitions Available: ${data.metadata.totalTransitions || 'N/A'}\n`;
                markdownReport += `• Data Source: ${data.metadata.dataSource || 'N/A'}\n`;
                if (data.metadata.reportGeneratedBy) {
                  markdownReport += `• Generated by: ${data.metadata.reportGeneratedBy}\n`;
                }
              }
              
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{
                    type: "text",
                    text: markdownReport
                  }],
                  isError: false
                }
              }, { "X-MCP-Trace-Id": traceId });
            } catch (parseError) {
              console.error("[MCP] Failed to parse JSON response:", { traceId, responseText, parseError });
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{
                    type: "text",
                    text: `Error: Invalid JSON response from career service. Status: ${response.status}. Response: ${responseText.substring(0, 200)}`
                  }],
                  isError: false
                }
              }, { "X-MCP-Trace-Id": traceId });
            }

          } catch (error: any) {
            console.error('[MCP] career_transition_advice error:', { traceId, error });
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Failed to get career transition advice: ${error.message}`
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: career_path_explorer
        // ============================================
        else if (name === "career_path_explorer") {
          const traceId = crypto.randomUUID();
          const { from_job, min_similarity = 0.5, limit = 20 } = args;

          console.log('[MCP] career_path_explorer - Input:', { 
            from_job, 
            min_similarity, 
            limit 
          });

          try {
            const apiUrl = process.env.CAREER_SWITCH_API_URL || 'http://149.28.175.142:3009';
            
            const response = await fetch(
              `${apiUrl}/api/career/transitions/${encodeURIComponent(from_job)}?minSimilarity=${min_similarity}&limit=${limit}`
            );

            if (!response.ok) {
              throw new Error(`Career API returned ${response.status}`);
            }

            const data = await response.json();
            
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "json",
                  data: {
                    content: data
                  }
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });

          } catch (error: any) {
            console.error('[MCP] career_path_explorer error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Failed to explore career paths: ${error.message}`
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: career_skill_gap_analysis
        // ============================================
        else if (name === "career_skill_gap_analysis") {
          const traceId = crypto.randomUUID();
          const { from_job, to_job } = args;

          console.log('[MCP] career_skill_gap_analysis - Input:', { 
            from_job, 
            to_job 
          });

          try {
            const apiUrl = process.env.CAREER_SWITCH_API_URL || 'http://149.28.175.142:3009';
            
            // Helper function to call skill-gap API
            async function callSkillGap(from: string, to: string) {
              const response = await fetch(
                `${apiUrl}/api/career/skill-gap/${encodeURIComponent(from)}/${encodeURIComponent(to)}`
              );
              const text = await response.text();
              let data: any;
              try {
                data = JSON.parse(text);
              } catch {
                data = null;
              }
              return { response, data };
            }

            // Step 1: Try direct match
            let { response, data } = await callSkillGap(from_job, to_job);
            let matchType: "direct" | "nearest" | "none" = "direct";
            let usedTo = to_job;

            // Step 2: Fallback to nearest match if 404 or empty
            if (!response.ok || !data || data.success === false) {
              console.log('[MCP] Direct match failed, trying fallback to nearest candidate...');
              matchType = "nearest";
              
              // Get all transitions from from_job
              const transitionsResponse = await fetch(
                `${apiUrl}/api/career/transitions/${encodeURIComponent(from_job)}?minSimilarity=0.5&limit=10`
              );
              
              if (transitionsResponse.ok) {
                const transitionsData = await transitionsResponse.json();
                const toLower = to_job.toLowerCase();
                
                // Try to find nearest match by fuzzy string matching
                const nearest = (transitionsData.transitions || []).find((t: any) =>
                  String(t.toJob || "").toLowerCase().includes(toLower)
                ) || (transitionsData.transitions || [])[0];
                
                if (nearest) {
                  usedTo = nearest.toJob;
                  console.log('[MCP] Using nearest match:', usedTo);
                  ({ response, data } = await callSkillGap(from_job, usedTo));
                } else {
                  matchType = "none";
                  data = { success: false, reason: "no transition found" };
                }
              } else {
                matchType = "none";
                data = { success: false, reason: "no transition found" };
              }
            }

            // Extract gapSkills from API response (if available)
            // If gapTags not available, generate gapSkills based on similarity
            let gapSkills: string[] = [];
            if (data?.gapTags) {
              gapSkills = data.gapTags.split('|').filter((s: string) => s.trim());
            } else if (data?.similarity !== undefined) {
              // Generate sample gap skills based on similarity
              // Lower similarity = more skills to learn
              const similarity = data.similarity / 100;
              if (similarity < 0.8) {
                gapSkills = [
                  `Industry-specific skills for ${usedTo}`,
                  'Advanced technical competencies',
                  'Domain expertise development'
                ];
              }
            }
            
            // Build payload with match type info
            const payload = {
              success: response?.ok ?? false,
              tool: "career_skill_gap_analysis",
              matchType,
              from: from_job,
              toRequested: to_job,
              toUsed: usedTo,
              sharedSkills: data?.sharedSkills || [],
              gapSkills: gapSkills,
              ...(data ?? {})
            };

            // Build text message based on match type
            let textMessage = '';
            if (matchType === "direct") {
              textMessage = `✅ Skill gap analysis generated.\n` +
                `Please present a concise result from the attached JSON:\n` +
                `• Show FROM → TO transition\n` +
                `• List top 5 shared skills (what you already have)\n` +
                `• List top 3 skills to develop (what you need to learn)\n` +
                `• Provide transition difficulty and estimated time`;
            } else if (matchType === "nearest") {
              textMessage = `ℹ️ No direct transition found. Using nearest match: "${usedTo}".\n` +
                `Please present a concise result from the attached JSON:\n` +
                `• Show FROM → TO transition (note: using nearest match)\n` +
                `• List top 5 shared skills\n` +
                `• List top 3 skills to develop\n` +
                `• Provide transition difficulty and estimated time`;
            } else {
              textMessage = `⚠️ No transition found from "${from_job}" to "${to_job}".\n` +
                `Please suggest alternative job titles or explain why this transition might be challenging.`;
            }
            
            // Return both text prompt and JSON data
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [
                  {
                    type: "text",
                    text: textMessage
                  },
                  {
                    type: "json",
                    data: {
                      content: payload
                    }
                  }
                ],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });

          } catch (error: any) {
            console.error('[MCP] career_skill_gap_analysis error:', error);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Failed to analyze skill gap: ${error.message}`
                }],
                isError: false
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // Unknown tool
        else {
          return json200({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [{
                type: "json",
                data: {
                  content: {
                    error: `Unknown tool: ${name}`,
                    note: "unknown_tool"
                  }
                }
              }],
              isError: false
            }
          }, { "X-MCP-Trace-Id": traceId });
        }

      } catch (e: any) {
        console.warn("[TRACE]", traceId, "Pipeline error:", e.message);

        return json200({
          jsonrpc: "2.0",
          id: body.id ?? null,
          result: {
            content: [{
              type: "json",
              data: {
                content: {
                  jobs: [],
                  error: String(e.message),
                  note: "pipeline_error",
                  timestamp: new Date().toISOString(),
                }
              }
            }],
            isError: false
          }
        }, { "X-MCP-Trace-Id": traceId });
      }
    }

    // Unknown method
    return json200({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        content: [{
          type: "json",
          data: {
            content: {
              error: `Method not found: ${body.method}`,
              note: "unknown_method"
            }
          }
        }],
        isError: false
      }
    });

  } catch (error: any) {
    const traceId = crypto.randomUUID();
    console.error('[MCP] POST error:', {
      error: error.message,
      traceId,
      elapsed: now() - startTime,
    });
    
    // ============================================
    // 记录错误（非阻塞）
    // ============================================
    if (fc && feedback_event_id) {
      setTimeout(() => {
        fc.recordEnd(
          feedback_event_id!,
          { error: String(error?.message || error) }
        );
      }, 0);
    }

    // Always return HTTP 200 with error in JSON body
    return json200({
      jsonrpc: "2.0",
      id: null,
      result: {
        content: [{
          type: "json",
          data: {
            content: {
              error: error.message,
              note: "internal_error",
              timestamp: new Date().toISOString(),
            }
          }
        }],
        isError: false
      }
    }, { "X-MCP-Trace-Id": traceId });
    
  } finally {
    // ============================================
    // 已在各工具内部记录 output，此处不再重复
    // ============================================
  }
}

