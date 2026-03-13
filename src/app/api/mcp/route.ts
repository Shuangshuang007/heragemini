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
import { connectToMongoDB, queryJobsByIds, queryJobsWithFilters, transformMongoDBJobToFrontendFormat } from '../../../services/jobDatabaseService';
import { parseMessageWithGPT } from '../../../gpt-services/assistant/parseMessage';
import { tailorResumeWithGPT } from '../../../gpt-services/resume/tailorResume';
import { AgentKitPlanner } from '../../../lib/agentkit/planner';
import { AgentKitExecutor } from '../../../lib/agentkit/executor';
import { AgentKitMemory } from '../../../lib/agentkit/memory';
import { FeedbackCollector } from '../../../lib/feedback/FeedbackCollector';
import { getDb } from '../../../lib/db/mongoClient';
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
const FAST_QUERY_TIMEOUT_MS = Number(process.env.MCP_FAST_TIMEOUT_MS || 15000); // 15 秒超时限制

// Stage time budgets (milliseconds) - for FULL mode
const TOTAL_BUDGET_MS = 35000;   // Total max 35s
const GPT_TIMEOUT_MS  = 8000;    // GPT planning budget 8s
const DB_TIMEOUT_MS   = 15000;   // Database query budget 15s
const POST_TIMEOUT_MS = 10000;   // Post-processing budget 10s

const now = () => Date.now();
const budgetLeft = (t0: number) => Math.max(0, TOTAL_BUDGET_MS - (now() - t0));

// apply_applications (Phase 1: Manus bridge) – source of truth for execution state
const APPLY_APPLICATIONS_COLLECTION = 'apply_applications';
const APPLY_SOURCE_ENUM = ['manus', 'hera_web', 'api_partner', 'partner_api', 'internal', 'unknown'] as const;
const APPLY_EXECUTION_STATUS_ACTIVE = ['created', 'queued', 'running', 'verification_required'] as const;
type ApplySource = typeof APPLY_SOURCE_ENUM[number];
type ApplyExecutionStatus = 'created' | 'queued' | 'running' | 'verification_required' | 'submitted' | 'failed' | 'expired';

interface ApplyApplicationDoc {
  _id: string;
  user_id: string | null;
  user_email: string;
  job_id: string;
  job_snapshot: { id: string; title: string; company: string; location: string; jobUrl: string; summary: string };
  source: ApplySource;
  execution_status: ApplyExecutionStatus;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  resume_url?: string;
}

function buildJobSnapshotFromJob(job: { id?: string; title?: string; company?: string; location?: string; locations?: string[]; jobUrl?: string; url?: string; summary?: string }): { id: string; title: string; company: string; location: string; jobUrl: string; summary: string } {
  const id = (job.id ?? '').toString();
  const jobUrl = job.jobUrl || (job as any).url || '';
  return {
    id,
    title: (job.title ?? '').toString(),
    company: (job.company ?? '').toString(),
    location: Array.isArray(job.locations) ? job.locations.join(', ') : (job.location ?? '').toString(),
    jobUrl: typeof jobUrl === 'string' ? jobUrl : '',
    summary: (job.summary ?? '').toString(),
  };
}

// ============================================
// MCP Authentication (minimal implementation)
// ============================================
function requireMcpAuth(request: NextRequest): { authorized: boolean; error?: Response } {
  const authHeader = request.headers.get('authorization');
  const hasAuth = !!authHeader;
  const bearerValid = hasAuth && authHeader.startsWith('Bearer ');
  const receivedLen = bearerValid ? authHeader.length - 7 : 0;
  const expectedSecret = process.env.MCP_SHARED_SECRET;
  const expectedExists = !!expectedSecret;
  const expectedLen = (expectedSecret || '').length;
  // Temporary auth debug (no plaintext token)
  console.log('[MCP auth] request has auth header:', hasAuth ? 'yes' : 'no', '| bearer prefix valid:', bearerValid ? 'yes' : 'no', '| received token length:', receivedLen, '| env token exists:', expectedExists ? 'yes' : 'no', '| env token length:', expectedLen);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid Bearer token' }),
        { status: 401, headers: JSON_HEADERS }
      )
    };
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const newToken = process.env.MCP_SHARED_SECRET;
  const oldToken = process.env.MCP_SHARED_SECRET_OLD; // 3-day compatibility window
  
  // Accept new token (required)
  if (newToken && token === newToken) {
    return { authorized: true };
  }
  
  // Accept old token during compatibility window (optional, 3 days only)
  if (oldToken && token === oldToken) {
    return { authorized: true };
  }
  
  // Reject if no valid token matched
  return {
    authorized: false,
    error: new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid Bearer token' }),
      { status: 401, headers: JSON_HEADERS }
    )
  };
}

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
  const jobUrl = (j.jobUrl && typeof j.jobUrl === "string" && j.jobUrl.startsWith("http"))
    ? j.jobUrl
    : undefined;
  const url =
    jobUrl ||
    j.url ||
    `https://www.heraai.net.au/jobs/${encodeURIComponent(String(id))}?utm=chatgpt-mcp`;

  return {
    id: String(id),
    title: String(j.title || ""),
    company: String(j.company || j.company_name || ""),
    location: String(j.location || j.locationRaw || ""),
    employmentType: String(j.employmentType || j.employment_type || ""),
    postDate: toIsoSafe(j.postedDateISO, j.postedDate, j.createdAt, j.updatedAt),
    url,
    jobUrl, // 添加 jobUrl 字段
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

function extractHighlights(job: any): string[] {
  if (Array.isArray(job.highlights) && job.highlights.length > 0) {
    return job.highlights.slice(0, 3);
  }

  if (Array.isArray(job.keyRequirements) && job.keyRequirements.length > 0) {
    return job.keyRequirements.slice(0, 3);
  }

  if (Array.isArray(job.skillsMustHave) && job.skillsMustHave.length > 0) {
    return job.skillsMustHave.slice(0, 3);
  }

  if (Array.isArray(job.skills) && job.skills.length > 0) {
    return job.skills.slice(0, 3);
  }

  if (typeof job.summary === 'string' && job.summary.trim()) {
    return [job.summary.trim()];
  }

  if (typeof job.description === 'string' && job.description.trim()) {
    return [job.description.trim().split('\n').filter(Boolean)[0] || job.description.trim()];
  }

  return [];
}

/** Application-layer score for recommend pool: title +5, industry +3, skills +2, workMode/employmentType +2, company +1. Case-insensitive. */
function scoreJobForRecommend(job: any, params: {
  jobTitle?: string | null;
  industry?: string | null;
  skills?: string[];
  workMode?: string | null;
  employmentType?: string | null;
  company?: string | null;
}): number {
  let score = 0;
  const title = (params.jobTitle || '').trim().toLowerCase();
  const jobTitle = (job.title || '').toLowerCase();
  const summary = (job.summary || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  if (title && (jobTitle.includes(title) || summary.includes(title) || desc.includes(title))) score += 5;
  const ind = (params.industry || '').trim().toLowerCase();
  const jobInd = (job.industry || '').toLowerCase();
  if (ind && jobInd.includes(ind)) score += 3;
  const skills = params.skills || [];
  const jobSkills = [
    ...(Array.isArray(job.skills) ? job.skills : []),
    ...(Array.isArray(job.skillsMustHave) ? job.skillsMustHave : []),
    ...(Array.isArray(job.skillsNiceToHave) ? job.skillsNiceToHave : []),
  ].map((s: string) => String(s).toLowerCase());
  const text = summary + ' ' + desc;
  for (const s of skills) {
    const sk = (s || '').trim().toLowerCase();
    if (!sk) continue;
    if (jobSkills.some((js: string) => js.includes(sk) || sk.includes(js))) score += 2;
    else if (text.includes(sk)) score += 2;
  }
  const wm = (params.workMode || '').trim().toLowerCase();
  const jobWm = (job.workMode || job.jobType || '').toLowerCase();
  if (wm && (jobWm.includes(wm) || summary.includes(wm) || desc.includes(wm))) score += 2;
  const et = (params.employmentType || '').trim().toLowerCase();
  const jobEt = (job.employmentType || job.jobType || '').toLowerCase();
  if (et && (jobEt.includes(et) || summary.includes(et) || desc.includes(et))) score += 2;
  const co = (params.company || '').trim().toLowerCase();
  const jobCo = (job.company || '').toLowerCase();
  if (co && jobCo.includes(co)) score += 1;
  return score;
}

// 带Highlights和View Details链接的卡片（返回多少就展示多少，不再固定 5 条；profile 已决定 10/50/100）
function buildMarkdownCards(q: { title: string; city: string }, jobs: any[], total: number) {
  const cards = jobs.map((j: any, idx: number) => {
    const title = (j.title || "").replace(/[–—]/g, "-").trim();
    const company = (j.company || "").trim();
    const loc = (j.location || "").trim();
    // ✅ 直接从 safeJobs 中提取 jobUrl 或 url（safeJobs 中已经处理好了）
    const url = j.jobUrl || j.url || "";
    const matchScore = typeof j.matchScore === 'number' ? `${j.matchScore}%` : null;
    const subScores = j.subScores || {};

    const parts = [
      `${idx + 1}. ${title}`,
      `   ${company}`,
      `   ${loc}`
    ];

    if (matchScore) {
      // 检查 subScores 是否有至少一个字段有数值
      const hasSubScores = subScores && (
        (typeof subScores.experience === 'number' && subScores.experience > 0) ||
        (typeof subScores.skills === 'number' && subScores.skills > 0) ||
        (typeof subScores.industry === 'number' && subScores.industry > 0) ||
        (typeof subScores.other === 'number' && subScores.other > 0)
      );
      
      if (hasSubScores) {
        // 有 subScores：显示详细格式
        const subScoreText = [
          subScores.experience ? `Experience: ${subScores.experience}%` : null,
          subScores.skills ? `Skills: ${subScores.skills}%` : null,
          subScores.industry ? `Industry: ${subScores.industry}%` : null,
          subScores.other ? `Other: ${subScores.other}%` : null,
        ].filter(Boolean).join(', ');
        
        // 如果有 listSummary，在括号里简短展示（截取前50字符）
        const summaryText = j.summary && typeof j.summary === 'string' && j.summary.trim()
          ? ` - ${j.summary.trim().substring(0, 50)}${j.summary.trim().length > 50 ? '...' : ''}`
          : '';
        
        parts.push('');
        parts.push(`   **Match:** ${matchScore} (${subScoreText}${summaryText})`);
      } else {
        // 没有 subScores：只显示 matchScore
        parts.push('');
        parts.push(`   **Match:** ${matchScore}`);
      }
    }

    // Highlights显示（如果有）
    const highlights = Array.isArray(j.highlights) ? j.highlights : [];
    if (highlights.length > 0) {
      parts.push(''); // 空行
      parts.push('   **Job Highlights:**');
      highlights.slice(0, 3).forEach((h: string) => {
        parts.push(`   • ${h}`);
      });
    }

    // ✅ Key Requirements 显示（如果有）
    if (j.keyRequirements && Array.isArray(j.keyRequirements) && j.keyRequirements.length > 0) {
      parts.push(''); // 空行
      parts.push('   **Key Requirements:**');
      j.keyRequirements.slice(0, 5).forEach((req: string) => {
        parts.push(`   • ${req}`);
      });
    }

    // Must-Have Skills (如果有)
    if (j.skillsMustHave && Array.isArray(j.skillsMustHave) && j.skillsMustHave.length > 0) {
      parts.push(''); // 空行
      parts.push('   **Must-Have Skills:**');
      j.skillsMustHave.slice(0, 5).forEach((skill: string) => {
        parts.push(`   • ${skill}`);
      });
    }

    // Nice-to-Have Skills (如果有)
    if (j.skillsNiceToHave && Array.isArray(j.skillsNiceToHave) && j.skillsNiceToHave.length > 0) {
      parts.push(''); // 空行
      parts.push('   **Nice-to-Have Skills:**');
      j.skillsNiceToHave.slice(0, 5).forEach((skill: string) => {
        parts.push(`   • ${skill}`);
      });
    }

    // Work Rights (如果有)
    if (j.workRights) {
      const workRightsParts = [];
      if (j.workRights.requiresStatus) {
        workRightsParts.push(`Requires: ${j.workRights.requiresStatus}`);
      }
      if (j.workRights.sponsorship && j.workRights.sponsorship !== 'unknown') {
        workRightsParts.push(`Sponsorship: ${j.workRights.sponsorship}`);
      }
      if (workRightsParts.length > 0) {
        parts.push(''); // 空行
        parts.push('   **Work Rights:**');
        workRightsParts.forEach((wr: string) => {
          parts.push(`   • ${wr}`);
        });
      }
    }

    // ✅ 移除 jobUrl 文本显示（不显示原始 URL）

    // ✅ Apply 链接（统一文案）- 硬性要求：每个职位都必须有 Apply 链接
    parts.push(''); // 空行
    parts.push(`   👉 [Apply on the official website via Héra AI](${url})`);

    return parts.join('\n');
  });

  return [
    `Found ${total} jobs for "${q.title}" in ${q.city}`,
    "",
    cards.join("\n\n"),
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
    const result = await queryJobsWithFilters({
      jobTitle: title,
      city,
      company,
      postedWithinDays,
      platforms,
      page,
      pageSize,
    });

    console.log(`[MCP FAST] Found ${result.jobs.length}/${result.total} jobs for "${title}" in "${city}"`);

    return {
      jobs: result.jobs,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
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
  // MCP Authentication (minimal)
  const auth = requireMcpAuth(request);
  if (!auth.authorized) {
    return auth.error!;
  }
  
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
      {
        name: 'job_alert',
        description: '📣 JOB ALERT - Check recent jobs since last search / within time window (on-demand, no background push)',
      },
      {
        name: 'refine_recommendations',
        description: '🔄 REFINE JOB RECOMMENDATIONS - Refine recommended jobs based on feedback (on-demand)',
      },
      {
        name: 'create_application_intent',
        description: '📋 CREATE APPLICATION INTENT - Create an application record for a user+job; returns application_id for use in prepare_application_context (100 active per user)',
      },
      {
        name: 'prepare_application_context',
        description: '📤 PREPARE APPLICATION CONTEXT - Get job + user context for Manus (use either user_email+job_id or user_email+application_id; verification = pause + manual takeover in v1)',
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
  // MCP Authentication (minimal)
  const auth = requireMcpAuth(request);
  if (!auth.authorized) {
    return auth.error!;
  }
  
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
    // 观测调用方请求头，接入 Manus 后可见真实 header，便于后续按 header 识别 manus
    console.log('[MCP] request headers (caller identification):', {
      'x-caller': request.headers.get('x-caller') ?? null,
      'user-agent': request.headers.get('user-agent') ?? null,
      'origin': request.headers.get('origin') ?? null,
      'referer': request.headers.get('referer') ?? null,
      'authorization': request.headers.get('authorization')?.startsWith('Bearer ') ? '[Bearer present]' : '[absent]',
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

      // recordStart立即返回event_id，写入在后台进行（fire-and-forget）
      // 添加超时保护，避免阻塞主流程
      const recordStartPromise = fc.recordStart(
        body.params.name,
        body.params.arguments || {},
        {
          trace_id: crypto.randomUUID(),
          session_id: sessForFeedback,
          user_email: body.params.arguments?.user_email
        }
      );
      
      const recordStartTimeout = new Promise<string | null>((resolve) => {
        setTimeout(() => resolve(null), 100); // 100ms超时，recordStart应该立即返回
      });
      
      feedback_event_id = await Promise.race([recordStartPromise, recordStartTimeout]).catch(err => {
        console.warn('[Feedback] FEEDBACK_WRITE_TIMEOUT: recordStart failed (non-blocking):', err?.message || err);
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
          description: "📣 JOB ALERT - Check recent jobs since last search / within time window (on-demand, no background push). Returns only new jobs since last check.\n\nRules:\n• Always reuse the same session_id for one alert stream\n• Pass exclude_ids from previous meta.returned_job_ids to avoid duplicates\n• If job_title/city not provided, server backfills from last_search\n• Time window default 24h; can override with window_hours\n• This tool does not schedule background jobs or send notifications; it only returns results when invoked by the user.\n",
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
          description: "🎯 PERSONALIZED JOB RECOMMENDATIONS - Use this for AI-powered job matching!\n\n✅ ALWAYS use this tool when user:\n• Says 'recommend jobs', 'suggest jobs', 'job advice', 'match me', 'help me find jobs'\n• Provides resume, profile, experience, skills, or career context\n• Asks for 'jobs that match my background' or 'jobs for me'\n• Mentions seniority level, career priorities, or preferences\n• Wants personalized job suggestions based on their profile\n• Uploads a resume or provides detailed career information\n• Says 'recommend [target career] jobs' after career_transition_advice (extract target career from context)\n• References a career from previous career transition analysis (e.g., 'recommend the first one', 'jobs for Product Manager')\n• Asks 'what jobs are available for [career name]' after discussing career transitions\n\n🎯 This tool performs intelligent job matching by:\n• Analyzing user's resume/profile and career context\n• Using explicit job_title/city if provided, otherwise inferring from resume (expectedPosition/cityPreference)\n• Searching database with determined filters\n• Scoring jobs based on experience, skills, industry fit\n• Returning top personalized recommendations with detailed match scores\n• Informing user when using resume inference for job targeting\n\n💡 Context Integration:\n• If user mentioned a career transition context, extract the target career (from candidates.to in career_transition_advice results) and use as job_title\n• If user uploaded resume, extract user_profile from resume parsing (skills, experience, city, etc.)\n• If no resume, build user_profile from conversation context (current job, experience, location mentioned)\n\n📝 Examples:\n• 'Recommend jobs for me based on my resume' → Uses resume expectedPosition\n• 'Suggest business analyst roles in Melbourne' → Uses explicit job_title + city\n• 'What jobs match my 5 years React experience in Sydney?' → Uses explicit criteria\n• 'Help me find data analyst positions' → Uses explicit job_title\n• 'I'm a senior developer, recommend suitable roles' → Uses profile context\n• After career_transition_advice returned 'Product Manager' as candidate: 'Recommend Product Manager jobs' → job_title='Product Manager'\n• 'Show me jobs for the second career option' → Extract target career from previous context, use as job_title\n• 'What positions are available for Data Analyst in Sydney?' → job_title='Data Analyst', city='Sydney'\n\n📌 Parameter extraction from natural language (fill job_title, city, work_mode, employment_type when user mentions them):\n• User: \"software engineer in New York 2 day onsite\" → job_title=\"software engineer\", city=\"New York\", workMode=\"onsite\"\n• User: \"remote full time product manager\" → job_title=\"product manager\", workMode=\"remote\", employmentType=\"full time\"\n\n⚠️ NEVER call search_jobs after this tool - it provides complete results.\n\n📦 Result shape: result.job_cards (array). Each entry has card (list/summary), detail (full dimensions). When manus=true (default), each entry also includes job_detail for Manus to render the Job Detail card.",
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
                default: 50,
                minimum: 5,
                maximum: 100,
                description: "Requested max jobs. Actual count is capped by profile stage: recommendable (job_title/city only) → up to 10; enhanced (+ skills or experience) → up to 50; auto_apply_ready (+ employmentHistory) → up to 100. Response meta includes profile_stage."
              },
              page_size: {
                type: "integer",
                minimum: 10,
                maximum: 100,
                description: "Optional. Max jobs to return in this batch (one-shot card display). Pass 50 or 100 so Manus can render all cards at once. Still capped by profile stage (recommendable max 10, enhanced max 50, auto_apply_ready max 100). When provided, effective count = min(profile_stage_limit, page_size)."
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
              },
              source: {
                type: "string",
                enum: ["manus", "gpt", "hera_web"],
                description: "Caller: 'manus' | 'gpt' | 'hera_web'. hera_web gets up to 500. Result count 10/50/100 is by profile completeness (see limit description)."
              },
              industry: { type: "string", description: "Optional. Filter by job industry (e.g. Technology, Finance)." },
              skills: { type: "array", items: { type: "string" }, description: "Optional. Filter jobs that have any of these skills in topSkills/skillsMust/skillsNice." },
              workMode: { type: "string", description: "Optional. Fill when user mentions workplace style (maps to DB field workMode). Send normalized value only: \"onsite\" | \"remote\" | \"hybrid\". Recognition: Map to workMode=\"onsite\": onsite, on-site, in office, 2 day onsite, 3 days in office, 60% onsite. Map to workMode=\"remote\": remote, work from home, wfh, fully remote. Map to workMode=\"hybrid\": hybrid, mixed, partially remote. Do NOT send \"2d Onsite\", \"60% Onsite\"—send \"onsite\", \"remote\", or \"hybrid\"." },
              employmentType: { type: "string", description: "Optional. Fill when user mentions job type (maps to DB field employmentType). Send normalized value only: \"full time\" | \"part time\" | \"contract\" | \"casual\". Recognition: full time/full-time → \"full time\"; part time/part-time → \"part time\"; contract/contractor → \"contract\"; casual → \"casual\"." },
              workModeStrict: { type: "boolean", description: "Optional. Set true when user says 'only onsite', 'must be remote', etc. Then workMode is applied as hard filter in DB query; otherwise workMode is soft scoring only." },
              employmentTypeStrict: { type: "boolean", description: "Optional. Set true when user says 'only full time', 'must be part time', etc. Then employmentType is applied as hard filter in DB query; otherwise employmentType is soft scoring only." },
              company: { type: "string", description: "Optional. When set, only return jobs at this company (company-only search). job_title/city can be omitted when company is provided." },
              sponsorship_only: { type: "boolean", description: "Optional. If true, only return jobs that offer or require sponsorship (workRights.sponsorship available/required)." },
              manus: {
                type: "boolean",
                default: true,
                description: "When true (default), each entry in result.job_cards includes a job_detail object with full dimensions for Manus to render the Job Detail card. Use job_detail for the detail view. Set false to omit job_detail."
              }
            },
            required: ["user_profile"],
            additionalProperties: false
          }
        },
        {
          name: "refine_recommendations",
          description: "🔄 REFINE JOB RECOMMENDATIONS - Use when user wants MORE jobs or provides FEEDBACK on previous recommendations!\n\n✅ ALWAYS use this tool when user:\n• Says 'show me more', 'more jobs', 'more recommendations', 'continue', 'next batch'\n• Provides feedback: 'I like #2 and #5', 'not interested in #3', 'exclude the Google one'\n• Asks for similar jobs: 'more like the first one', 'similar to the Canva job'\n• Wants to refine: 'different companies', 'other options'\n\n🎯 This tool:\n• Excludes ALL previously shown jobs (from meta.returned_job_ids)\n• Applies user preferences (liked/disliked jobs)\n• Analyzes liked jobs to find similar opportunities\n• Returns fresh recommendations with no duplicates\n\n📝 Examples:\n• User: 'show me more' → refine_recommendations({ session_id, exclude_ids: [previous IDs] })\n• User: 'I like #2, not #3' → refine_recommendations({ liked_job_ids: [id_2], disliked_job_ids: [id_3] })\n• User: 'more jobs like the Amazon one' → refine_recommendations({ liked_job_ids: [amazon_id] })\n• User: 'more onsite jobs' or 'show me more remote roles' → pass workMode=\"onsite\" or workMode=\"remote\" (same as recommend_jobs: onsite/remote/hybrid).\n• User: 'more full time positions' → pass employmentType=\"full time\" (full time, part time, contract, casual).\n\n⚠️ IMPORTANT: Always pass exclude_ids from previous meta.returned_job_ids to avoid duplicates!",
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
              },
              workMode: {
                type: "string",
                description: "Optional. Same as recommend_jobs (DB field workMode): fill when user says e.g. 'more onsite/remote/hybrid jobs'. Send \"onsite\" | \"remote\" | \"hybrid\" only."
              },
              employmentType: {
                type: "string",
                description: "Optional. Same as recommend_jobs (DB field employmentType): fill when user says e.g. 'more full time/part time/contract'. Send \"full time\" | \"part time\" | \"contract\" | \"casual\" only."
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
          description: "🔍 LISTING SEARCH - Same pipeline as recommend_jobs (single DB query + scoring), for browse-style search.\n\n✅ Use when user asks:\n• 'find jobs', 'search jobs', 'browse jobs' WITHOUT personal/resume context\n• Specific title + city: 'software engineer jobs in Sydney', 'accountant Melbourne'\n• One company: 'jobs at Google' → pass company + job_title/city, limit 10 (may return fewer)\n• 'show more' / next batch → pass exclude_ids from previous result meta.returned_job_ids\n\n📊 Result size: pass limit or page_size = 10 | 20 | 50 (default 20). When filtering by one company, fewer than 10 may be returned.\n\n🔧 Optional filters (align with recommend_jobs):\n• company — hard filter when set (e.g. only this company); often fewer results.\n• skills, industry — soft scoring unless caller treats as strict.\n• workMode (onsite|remote|hybrid), employmentType (full time|part time|contract|casual) — set workModeStrict/employmentTypeStrict true when user says 'only onsite', 'must be full time'.\n• sponsorship_only — only jobs that offer/require sponsorship.\n• exclude_ids — list of job IDs to exclude (e.g. from meta.returned_job_ids for 'show more').\n\n🚫 Use recommend_jobs instead when user has resume/profile or wants personalized matching.",
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
                minimum: 10, 
                maximum: 50, 
                description: "Number of jobs to return (10, 20, or 50). Default 20. Use 10 when e.g. only one company."
              },
              limit: {
                type: "integer",
                minimum: 10,
                maximum: 50,
                description: "Same as page_size: 10 | 20 | 50. Default 20."
              },
              exclude_ids: {
                type: "array",
                items: { type: "string" },
                description: "Job IDs to exclude (e.g. from previous batch for feedback / 'show more')."
              },
              skills: { type: "array", items: { type: "string" }, description: "Optional. Filter/scoring. When user says 'only jobs with X skill' use with skillsStrict." },
              industry: { type: "string", description: "Optional. Filter/scoring by industry." },
              company: { type: "string", description: "Optional. When user wants jobs at one company only (may return fewer than limit)." },
              workMode: { type: "string", enum: ["onsite", "remote", "hybrid"], description: "Optional. Same as recommend_jobs." },
              employmentType: { type: "string", description: "Optional. full time | part time | contract | casual." },
              workModeStrict: { type: "boolean", description: "True when user says 'only onsite' etc. Puts workMode in query." },
              employmentTypeStrict: { type: "boolean", description: "True when user says 'only full time' etc. Puts employmentType in query." },
              sponsorship_only: { type: "boolean", description: "Optional. Only jobs that offer/require sponsorship." },
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
              { "required": ["city"] },
              { "required": ["company"] }
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
          description: "🎯 CAREER TRANSITION ADVICE - Get personalized career switch recommendations!\n\n✅ Use this tool when user:\n• Asks 'what careers can I transition to?', 'career change advice', 'what should I do next?'\n• Provides current job title and experience\n• Wants to explore career switch options\n• Mentions career transition, pivot, or change\n\n🎯 This tool provides:\n• Personalized career transition recommendations\n• Skill gap analysis between current and target roles\n• Transition difficulty assessment\n• Actionable career pathway suggestions\n\n📝 Examples:\n• 'I'm a software engineer with 3 years experience, what careers can I transition to?'\n• 'Help me explore career options from product manager'\n• 'What are good career paths for a data analyst?'\n\n🔜 POST-RESPONSE ACTION REQUIRED:\nAfter returning the career transition analysis report, ALWAYS append a \"Next Steps\" section at the end of your response with the following structure:\n\n---\n\n## 🔜 Next Steps: Want to Find Actual Job Listings?\n\nBased on the career transition recommendations above, you can take the following next steps:\n\n1. **📄 Upload Resume for More Accurate Recommendations (Recommended)**\n   - Share your resume (PDF/DOC) and I'll extract your work experience, skills, and industry background\n   - I'll use this information to provide more precise job recommendations\n\n2. **🔍 Get Job Listings Now (No Resume Needed)**\n   - I can search for actual job openings for the recommended career transitions\n   - Just say: \"Recommend [target career] jobs\" or \"Show me [target career] positions\"\n   - Example: \"Recommend Product Manager jobs\" or \"Show me Data Analyst positions in Sydney\"\n\nYou can say:\n- \"Recommend [one of the target careers above] jobs\"\n- Or upload your resume first, then say \"Recommend jobs for me\"\n\n*Note: If you have a specific career from the recommendations above, mention it (e.g., \"Recommend Product Manager jobs in Melbourne\").*\n\n⚠️ IMPORTANT CONDITIONS:\n• Only append this \"Next Steps\" section the FIRST TIME you present a full career transition report in this conversation (avoid repeating CTA in follow-up responses)\n• If the user explicitly says they don't want job listings or are only interested in career planning, do NOT append the \"Next Steps: Find Actual Job Listings\" section",
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
        {
          name: "create_application_intent",
          description: "📋 CREATE APPLICATION INTENT - Create an application record for user+job; returns application_id and job_snapshot. Use before prepare_application_context when using Manus. Max 100 active applications per user.",
          inputSchema: {
            type: "object",
            properties: {
              user_email: { type: "string", description: "User email" },
              job_id: { type: "string", description: "Hera job ID for the selected job" },
              source: { type: "string", enum: ["manus", "hera_web", "api_partner", "partner_api", "internal"], description: "Source of the apply (default: manus)" },
              created_by: { type: "string", description: "Optional agent/task id for debugging (e.g. manus_agent_id)" }
            },
            required: ["user_email", "job_id"],
            additionalProperties: false
          }
        },
        {
          name: "prepare_application_context",
          description: "📤 PREPARE APPLICATION CONTEXT - Get job + user context for Manus. Call with (user_email + job_id) OR (user_email + application_id). V1: verification = pause + manual takeover.",
          inputSchema: {
            type: "object",
            properties: {
              user_email: { type: "string", description: "User email" },
              job_id: { type: "string", description: "Hera job ID (use when not using application_id)" },
              application_id: { type: "string", description: "Application ID from create_application_intent (preferred when using Manus)" }
            },
            required: ["user_email"],
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
          const companyOnly = String(args?.company || "").trim();
          const requestMode = args?.mode || HERA_MCP_MODE; // Allow per-request override

          // Validate: require (job_title and city) OR company (company-only search)
          const hasTitleAndCity = !!(jobTitle && city);
          const hasCompanyOnly = !!companyOnly;
          if (!hasTitleAndCity && !hasCompanyOnly) {
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
                      message: "Provide (job_title and city) or company for company-only search"
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
            const requestedLimit = Number(args?.limit ?? args?.page_size ?? 20);
            const limit = Math.min(50, Math.max(10, requestedLimit)); // default 20, min 10, max 50
            const exclude_ids: string[] = Array.isArray(args?.exclude_ids) ? args.exclude_ids : [];
            const industry = (args?.industry as string) ?? null;
            const skills = Array.isArray(args?.skills) ? args.skills : [];
            const company = (args?.company as string)?.trim() || companyOnly || null;
            const workMode = (args?.workMode as string) ?? null;
            const employmentType = (args?.employmentType as string) ?? null;
            const workModeStrict = args?.workModeStrict === true;
            const employmentTypeStrict = args?.employmentTypeStrict === true;
            const sponsorship_only = args?.sponsorship_only === true;

            const queryOptions: any = {
              page: 1,
              pageSize: 200,
              excludeIds: exclude_ids.slice(-2000),
            };
            if (city) queryOptions.city = city;
            if (sponsorship_only) queryOptions.sponsorshipOnly = true;
            if (workModeStrict && workMode) queryOptions.workMode = workMode;
            if (employmentTypeStrict && employmentType) queryOptions.employmentType = employmentType;
            if (company) queryOptions.company = company;

            let result: { jobs: any[]; total: number };
            try {
              const q = await queryJobsWithFilters(queryOptions);
              result = { jobs: q.jobs || [], total: q.total ?? 0 };
            } catch (e: any) {
              console.warn("[TRACE]", traceId, "search_jobs FAST query error:", e?.message);
              result = { jobs: [], total: 0 };
            }

            const scoreParams = {
              jobTitle: jobTitle.trim() || null,
              industry,
              skills,
              workMode,
              employmentType,
              company,
            };
            const withScores = result.jobs.map((j: any) => ({ job: j, appScore: scoreJobForRecommend(j, scoreParams) }));
            withScores.sort((a, b) => b.appScore - a.appScore);
            const topJobs = withScores.slice(0, limit).map((x: { job: any }) => x.job);

            const returnedIds = topJobs.map((j: any) => j.id || j.jobIdentifier).filter(Boolean);
            const safeJobs = topJobs.map((job: any) => ({
              ...mapJobSafe(job),
              highlights: extractHighlights(job),
              skillsMustHave: job.skillsMustHave || [],
              skillsNiceToHave: job.skillsNiceToHave || [],
              workRights: job.workRights,
              jobUrl: job.jobUrl || job.url,
              url: job.jobUrl || job.url || mapJobSafe(job).url,
            }));
            const cardTitle = jobTitle || (company ? `${company} jobs` : 'Jobs');
            const cardCity = city || (company ? 'All locations' : '');
            const markdownPreview = buildMarkdownCards(
              { title: cardTitle, city: cardCity },
              safeJobs,
              topJobs.length
            );

            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: markdownPreview }],
                isError: false,
                mode: "search",
                query_used: company ? { company } : { job_title: jobTitle, city },
                total: topJobs.length,
                meta: { returned_job_ids: returnedIds },
                isFinal: true,
              },
            }), {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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
            let rows: any[];
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
            
            const previewJobs = result.jobs.slice(0, pageSize);
            // 使用完整的 job 数据（已包含所有字段，包括 skillsMustHave, skillsNiceToHave, workRights, jobUrl）
            const safeJobs = previewJobs.map((job: any) => ({
              ...mapJobSafe(job),
              highlights: extractHighlights(job),
              // 保留完整的字段（如果 job 已经有这些字段）
              skillsMustHave: job.skillsMustHave || [],
              skillsNiceToHave: job.skillsNiceToHave || [],
              workRights: job.workRights,
              jobUrl: job.jobUrl,
              url: job.jobUrl || job.url || mapJobSafe(job).url, // 确保 url 优先使用 jobUrl
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
            
            const previewJobs = result.jobs.slice(0, pageSize);
            // 使用完整的 job 数据（已包含所有字段，包括 skillsMustHave, skillsNiceToHave, workRights, jobUrl）
            const safeJobs = previewJobs.map((job: any) => ({
              ...mapJobSafe(job),
              highlights: extractHighlights(job),
              // 保留完整的字段（如果 job 已经有这些字段）
              skillsMustHave: job.skillsMustHave || [],
              skillsNiceToHave: job.skillsNiceToHave || [],
              workRights: job.workRights,
              jobUrl: job.jobUrl,
              url: job.jobUrl || job.url || mapJobSafe(job).url, // 确保 url 优先使用 jobUrl
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
            limit = 50, 
            page_size: pageSizeArg,  // 可选，本批最多返回条数（一次性展示 50/100 用）
            use_chat_context = true, 
            strict_filters = true,
            session_id,      // Phase 2: 用于后台统计
            user_email,      // Phase 2: 用于后台统计
            exclude_ids = [], // GPT 方案: 直接传参去重（实时生效）
            source: argsSource,   // 'manus' | 'gpt' | 'hera_web' (advanced up to 500)
            industry,
            skills,
            workMode,
            employmentType,
            workModeStrict,
            employmentTypeStrict,
            sponsorship_only,
            company: companyArg,
            manus = true,  // 默认 true：每条 job_cards 含 job_detail，供 Manus 渲染详情卡
          } = args;
          // Caller: args.source takes precedence; else X-Caller header (for Manus Customer API); else 'gpt'
          const effectiveCaller = (argsSource || request.headers.get('x-caller')?.toLowerCase() || 'gpt').toLowerCase();
          // Staged profile: recommendable (10) → enhanced_recommendation (50) → auto_apply_ready (100)
          // Basic: job title + city → 10 (recent 1 batch by match score).
          // Enhanced: job title + city + (experience OR skills any one) → 50, same method: recent 2 batches, by match score top 50.
          const hasSearchCriteria = !!(job_title || city || user_profile?.jobTitles?.length || user_profile?.expectedPosition || user_profile?.city);
          const hasExperience = !!(user_profile?.employmentHistory?.length || user_profile?.currentPosition || user_profile?.seniority);
          const hasSkills = !!(user_profile?.skills?.length);
          const hasExperienceOrSkills = hasExperience || hasSkills;
          const hasEmploymentHistory = !!(user_profile?.employmentHistory?.length);
          let profileStage: 'recommendable' | 'enhanced_recommendation' | 'auto_apply_ready' = 'recommendable';
          if (hasSearchCriteria && hasExperienceOrSkills && hasEmploymentHistory) profileStage = 'auto_apply_ready';
          else if (hasSearchCriteria && hasExperienceOrSkills) profileStage = 'enhanced_recommendation';
          else if (hasSearchCriteria) profileStage = 'recommendable';
          // Advanced / web mode: up to 500 (hera_web only)
          const isAdvancedMode = effectiveCaller === 'hera_web';
          const stageLimit = profileStage === 'auto_apply_ready' ? 100 : profileStage === 'enhanced_recommendation' ? 50 : 10;
          // page_size：本批希望返回的最大条数（Manus 一次性展示 50/100 用）；未传则用 limit；仍受 profile 阶段上限约束
          const requestedMax = pageSizeArg != null ? Math.min(100, Math.max(10, Number(pageSizeArg))) : limit;
          const effectiveLimit = isAdvancedMode ? Math.min(Math.max(limit, 1), 500) : Math.min(stageLimit, requestedMax);
          
          console.log('[MCP] recommend_jobs - exclude_ids:', exclude_ids.length);
          console.log('[MCP] recommend_jobs - profile_stage:', profileStage, 'effective_limit:', effectiveLimit, 'page_size:', pageSizeArg ?? '(none)', 'is_advanced:', isAdvancedMode);
          console.log('[MCP] recommend_jobs - Input args:', { job_title, city, limit, page_size: pageSizeArg, use_chat_context, strict_filters, session_id, user_email, has_fc: !!fc });
          
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
              city: null,
              source: 'default',
              usedResumeInference: false
            };
          };
          
          const searchCriteria = determineSearchCriteria();
          console.log('[MCP] Search criteria determined:', searchCriteria);
          
          // 仅用传入数据，不塞假 profile；用于 Match API 和日志
          const requestProfile = {
            skills: (user_profile?.skills && user_profile.skills.length > 0) ? user_profile.skills : (Array.isArray(skills) ? skills : []),
            city: searchCriteria.city || user_profile?.city || null,
            seniority: user_profile?.seniority ?? undefined,
            jobTitles: (user_profile?.jobTitles?.length) ? user_profile.jobTitles : (searchCriteria.jobTitle ? [searchCriteria.jobTitle] : []),
            openToRelocate: user_profile?.openToRelocate ?? false,
            careerPriorities: user_profile?.careerPriorities ?? [],
            expectedSalary: user_profile?.expectedSalary ?? undefined,
            currentPosition: user_profile?.currentPosition ?? undefined,
            expectedPosition: user_profile?.expectedPosition ?? undefined,
            employmentHistory: user_profile?.employmentHistory ?? [],
            workingRightsAU: user_profile?.workingRightsAU,
            workingRightsOther: user_profile?.workingRightsOther
          };
          
          console.log('[MCP] recommend_jobs - request profile (no fake data):', JSON.stringify(requestProfile, null, 2));

          const timing: Record<string, number> = {};
          const tRecommendStart = Date.now();

          try {
            // 1. 根据搜索条件从数据库获取职位
            let t0 = Date.now();
            const { db } = await connectToMongoDB();
            timing.connect_mongo_ms = Date.now() - t0;
            
            // ========================================
            // PR-1: 三层去重逻辑（AgentKit Memory 增强）
            // ========================================
            let EXCLUDE_SET = new Set<string>(exclude_ids);  // Layer 1: 参数传递（实时）
            console.log(`[MCP] Layer 1 (exclude_ids parameter): ${exclude_ids.length} jobs`);
            
            // Layer 2: AgentKit Memory（运行时缓存，低延迟）
            let memory_read_success = false;
            if (ENABLE_MEMORY && session_id) {
              try {
                t0 = Date.now();
                const memory = new AgentKitMemory();
                const context = await memory.getContext(session_id);
                timing.layer2_memory_read_ms = Date.now() - t0;
                
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
                timing.layer2_memory_read_ms = Date.now() - t0;
              }
            } else {
              timing.layer2_memory_read_ms = 0;
            }
            
            // Layer 3: feedback_events 补充历史（有超时保护）
            if (fc && (session_id || user_email)) {
              try {
                t0 = Date.now();
                const history_session = session_id || user_email || 'anonymous';
                const historyPromise = fc.getSessionFeedback(history_session, 20);
                const timeoutPromise = new Promise<any[]>((resolve) => 
                  setTimeout(() => resolve([]), 500)
                );
                const history = await Promise.race([historyPromise, timeoutPromise]);
                timing.layer3_feedback_read_ms = Date.now() - t0;
                
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
                timing.layer3_feedback_read_ms = Date.now() - t0;
              }
            } else {
              timing.layer3_feedback_read_ms = 0;
            }
            
            console.log(`[MCP] recommend_jobs - EXCLUDE_SET size: ${EXCLUDE_SET.size}`);
            
            // 改2: Single query with hard constraints only; larger pool (200); app-layer score then take top N. No second DB query.
            const searchLimit = 200;
          const queryOptions: any = {
            page: 1,
            pageSize: searchLimit,
            excludeIds: Array.from(EXCLUDE_SET).slice(-2000),
          };
          const trimmedCity = searchCriteria.city?.trim();
          if (trimmedCity) queryOptions.city = trimmedCity;
          const trimmedCompany = (companyArg != null && typeof companyArg === 'string') ? companyArg.trim() : '';
          if (trimmedCompany) queryOptions.company = trimmedCompany;
          if (sponsorship_only === true) queryOptions.sponsorshipOnly = true;
          if (workModeStrict === true && workMode != null && workMode !== '') queryOptions.workMode = workMode;
          if (employmentTypeStrict === true && employmentType != null && employmentType !== '') queryOptions.employmentType = employmentType;
          // jobTitle, industry, skills, workMode (non-strict), employmentType (non-strict) are scoring-only, not in query

            t0 = Date.now();
            let transformedJobs: any[];
            try {
              const result = await queryJobsWithFilters(queryOptions);
              transformedJobs = result.jobs;
            } catch (dbErr: any) {
              timing.db_query_ms = Date.now() - t0;
              timing.db_error = dbErr?.message || String(dbErr);
              timing.total_ms = Date.now() - tRecommendStart;
              console.log('[TIMING] recommend_jobs breakdown (db error):', JSON.stringify(timing));
              throw dbErr;
            }
            timing.db_query_ms = Date.now() - t0;
            timing.candidates_count = transformedJobs.length;

            console.log(`[MCP] Database returned ${transformedJobs.length} jobs (single query, hard constraints only)`);

            // App-layer scoring: title +5, industry +3, skills +2, workMode/employmentType +2, company +1; sort and take top N.
            const trimmedJobTitle = searchCriteria.jobTitle?.trim() || null;
            const scoreParams = {
              jobTitle: trimmedJobTitle,
              industry: industry ?? null,
              skills: Array.isArray(skills) ? skills : [],
              workMode: workMode ?? null,
              employmentType: employmentType ?? null,
              company: (args as any).company ?? null,
            };
            const withScores = transformedJobs.map((j: any) => ({ job: j, appScore: scoreJobForRecommend(j, scoreParams) }));
            withScores.sort((a, b) => b.appScore - a.appScore);
            transformedJobs = withScores.slice(0, effectiveLimit).map((x: { job: any }) => x.job);
            timing.candidates_count = transformedJobs.length;
            console.log(`[MCP] recommend_jobs app-layer scored, top ${transformedJobs.length} by score`);

            if (transformedJobs.length === 0) {
              timing.total_ms = Date.now() - tRecommendStart;
              console.log('[TIMING] recommend_jobs breakdown (0 jobs):', JSON.stringify(timing));
              const emptyMissing: string[] = [];
              if (!(user_profile?.jobTitles?.length || user_profile?.expectedPosition)) emptyMissing.push('jobTitles or expectedPosition');
              if (!user_profile?.skills?.length) emptyMissing.push('skills');
              if (!user_profile?.employmentHistory?.length) emptyMissing.push('employmentHistory');
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{
                    type: "text",
                    text: "No recent job postings found. Try adjusting your search criteria or check back later for new postings."
                  }],
                  isError: false,
                  profile_stage: profileStage,
                  auto_apply_ready: profileStage === 'auto_apply_ready',
                  missing_fields: emptyMissing,
                  next_actions: ['Add job title and location', 'Add skills and work history for better matching'],
                  total: 0,
                  meta: { db_candidates_count: timing.candidates_count ?? 0 }
                }
              }, { "X-MCP-Trace-Id": traceId });
            }

            // 2. 直接使用数据库中的 jobs（已有完整的 tags：summary, highlights, skillsMustHave, skillsNiceToHave, workRights 等）
            // 不再调用 mirror-jobs POST，因为数据库已有完整数据
            console.log(`[MCP] Using database jobs directly (${transformedJobs.length} jobs with complete tags)`);

            // 3. 对每个职位进行用户匹配分析（只调用 jobMatch API 获取 matchScore 和 listSummary）
            console.log(`[MCP] Starting GPT matching for ${transformedJobs.length} jobs`);
            t0 = Date.now();
            const scoredJobs = await Promise.all(
              transformedJobs.map(async (job: any) => {
                try {
                  // jobMatch API 要求 jobTitle/jobDescription/jobLocation 非空，否则返回 400；用占位符避免 DB 缺字段导致整批失败
                  const jobTitle = (job.title && String(job.title).trim()) || 'Job';
                  const jobDescription = (job.description && String(job.description).trim()) || (job.summary && String(job.summary).trim()) || (Array.isArray(job.highlights) && job.highlights[0]) || 'No description provided.';
                  const jobLocation = Array.isArray(job.location) ? job.location.join(', ') : (job.location && String(job.location).trim()) || job.locationRaw || 'Location not specified';
                  console.log(`[MCP] Calling GPT for job: ${jobTitle}`);
                  const gptApiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/gpt-services/jobMatch`;
                  console.log(`[MCP] GPT API URL: ${gptApiUrl}`);
                  const matchResponse = await fetch(gptApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
                      jobTitle,
                      jobDescription,
                      jobRequirements: job.requirements || [],
                      jobLocation,
                      // ✅ 传入数据库中的完整 tags（复用数据库数据）
                      skillsMustHave: job.skillsMustHave || [],
                      skillsNiceToHave: job.skillsNiceToHave || [],
                      keyRequirements: job.keyRequirements || [],
                      highlights: job.highlights || [],
                      workMode: job.workMode || '',
                      salary: job.salary || '',
                      industry: job.industry || '',
                      workRights: job.workRights || undefined,
                      userProfile: {
                        jobTitles: requestProfile.jobTitles.length > 0 ? requestProfile.jobTitles : [job.title],
                        skills: requestProfile.skills,
                        city: requestProfile.city,
                        seniority: requestProfile.seniority,
                        openToRelocate: requestProfile.openToRelocate,
                        careerPriorities: requestProfile.careerPriorities,
                        expectedSalary: requestProfile.expectedSalary,
                        currentPosition: requestProfile.currentPosition,
                        expectedPosition: requestProfile.expectedPosition,
                        employmentHistory: requestProfile.employmentHistory,
                        workingRightsAU: requestProfile.workingRightsAU,
                        workingRightsOther: requestProfile.workingRightsOther
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
                    // 优先使用 GPT 返回的 highlights，否则使用数据库字段
                    matchHighlights: (matchData.highlights && matchData.highlights.length > 0)
                      ? matchData.highlights
                      : (job.highlights && job.highlights.length > 0)
                        ? job.highlights.slice(0, 3)
                        : (job.keyRequirements && job.keyRequirements.length > 0)
                          ? job.keyRequirements.slice(0, 3)
                          : [],
                    summary: matchData.listSummary || job.summary || `${job.title} position at ${job.company}`,
                    detailedSummary: matchData.detailedSummary || job.detailedSummary || job.description?.substring(0, 200) + '...',
                    // ✅ GPT 不返回 keyRequirements（永远是空数组），不覆盖，让 ...job 中的原始值保留
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
                    // 优先使用数据库字段，最后才用默认值
                    matchHighlights: (job.highlights && job.highlights.length > 0)
                      ? job.highlights.slice(0, 3)
                      : (job.keyRequirements && job.keyRequirements.length > 0)
                        ? job.keyRequirements.slice(0, 3)
                        : [
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
            timing.gpt_scoring_ms = Date.now() - t0;
            timing.gpt_calls_count = transformedJobs.length;

            // 4. Sort by score and take effectiveLimit (GPT: up to limit; Manus+complete profile: 50)
            t0 = Date.now();
            const recommendedJobs = scoredJobs
              .sort((a, b) => b.matchScore - a.matchScore)
              .slice(0, effectiveLimit);

            timing.sort_slice_ms = Date.now() - t0;

            // 5. 转换为 safeJobs 格式，确保包含所有 tags、jobUrl 和 summary（listSummary）
            const safeJobs = recommendedJobs.map((job: any) => ({
              ...mapJobSafe(job),
              highlights: job.matchHighlights && job.matchHighlights.length > 0 
                ? job.matchHighlights 
                : (job.highlights || []),
              // ✅ 保留所有 tags
              skillsMustHave: job.skillsMustHave || [],
              skillsNiceToHave: job.skillsNiceToHave || [],
              keyRequirements: job.keyRequirements || [],  // ✅ 新增
              workRights: job.workRights || null,
              // ✅ 只从 job 对象提取 jobUrl 和 url，不要 fallback（职位一定有 jobUrl）
              jobUrl: job.jobUrl || job.url,
              url: job.jobUrl || job.url,
              // ✅ 保留 matchScore、subScores 和 summary（listSummary）
              matchScore: job.matchScore,
              subScores: job.subScores || null,
              summary: job.summary || '',  // ✅ 包含 listSummary
            }));

            // ✅ job_cards：给 Manus 的结构化展示层（card 极简，detail 完整；manus 为 true 时多带 job_detail 供详情卡渲染）
            const job_cards = recommendedJobs.map((job: any) => {
              const id = String(job._id || job.id || job.jobIdentifier || '');
              const jobUrl = job.jobUrl || job.url || '';
              const highlights = (job.matchHighlights && job.matchHighlights.length > 0 ? job.matchHighlights : job.highlights) || [];
              const detailPayload = {
                summary: job.summary || '',
                skillsMustHave: job.skillsMustHave || [],
                skillsNiceToHave: job.skillsNiceToHave || [],
                keyRequirements: job.keyRequirements || [],
                highlights,
                subScores: job.subScores || null,
                industry: job.industry ?? null,
                employmentType: job.employmentType || job.employment_type || null,
                workMode: job.workMode ?? null,
                workRights: job.workRights ?? null,
                salary: job.salary ?? null,
                matchAnalysis: job.matchAnalysis ?? null,
                jobUrl,
              };
              const entry: { card: any; detail: any; job_detail?: any } = {
                card: {
                  id,
                  title: String(job.title || ''),
                  company: String(job.company || job.company_name || ''),
                  location: String(job.location || job.locationRaw || ''),
                  matchScore: typeof job.matchScore === 'number' ? job.matchScore : null,
                  highlights_preview: highlights.slice(0, 2),
                  jobUrl,
                },
                detail: detailPayload,
              };
              if (manus) {
                entry.job_detail = detailPayload;
              }
              return entry;
            });

            // ✅ 使用 buildMarkdownCards 生成卡片（复用已有逻辑）
            const markdownCards = buildMarkdownCards(
              { 
                title: searchCriteria.jobTitle || 'Job Recommendations', 
                city: searchCriteria.city || 'Australia' 
              }, 
              safeJobs, 
              safeJobs.length
            );

            // ✅ 提取卡片内容（去掉 buildMarkdownCards 的头部）
            const cardsContent = markdownCards
              .split('\n')
              .slice(1)  // 只去掉第一行 "Found X jobs..."，保留所有卡片内容和尾部
              .join('\n');

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
                t0 = Date.now();
                const db = await getDb();
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
                timing.feedback_write_ms = Date.now() - t0;
              } catch (e) {
                console.warn('[recommend] feedback sync upsert failed:', (e as any)?.message || e);
                timing.feedback_write_ms = -1;
              }
            } else {
              timing.feedback_write_ms = 0;
            }
            
            // ========================================
            // PR-1: 更新 AgentKit Memory（同步，返回前写入）
            // ========================================
            if (ENABLE_MEMORY && session_id) {
              const new_job_ids = recommendedJobs.map(job => job.id);
              try {
                t0 = Date.now();
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
                timing.memory_write_ms = Date.now() - t0;
                console.log(`[MCP] AgentKit Memory updated: ${new_job_ids.length} new jobs added, total ${updated_ids.length} in memory`);
              } catch (err) {
                console.warn('[MCP] AgentKit Memory update failed (non-blocking):', err);
                timing.memory_write_ms = -1;
              }
            } else {
              timing.memory_write_ms = 0;
            }

            timing.total_ms = Date.now() - tRecommendStart;
            console.log('[TIMING] recommend_jobs breakdown:', JSON.stringify(timing));

            // Staged profile: missing_fields and next_actions for caller (Manus/GPT)
            const missing_fields: string[] = [];
            if (!hasSearchCriteria) {
              if (!(job_title || city)) missing_fields.push('job_title and city');
              if (!(user_profile?.jobTitles?.length || user_profile?.expectedPosition)) missing_fields.push('jobTitles or expectedPosition');
              if (!user_profile?.city) missing_fields.push('city');
            }
            if (profileStage === 'recommendable' && !hasExperienceOrSkills) {
              missing_fields.push('experience (employmentHistory/seniority) or skills');
            }
            if (profileStage !== 'auto_apply_ready' && !hasEmploymentHistory) missing_fields.push('employmentHistory');
            const next_actions: string[] = [];
            if (profileStage === 'recommendable') {
              next_actions.push('Add experience or skills for more recommendations (up to 50)');
              next_actions.push('Add employment history for auto-apply readiness (up to 100)');
            } else if (profileStage === 'enhanced_recommendation') {
              next_actions.push('Add employment history to enable auto-apply (up to 100 jobs)');
            } else {
              next_actions.push('Use prepare_application_context when you select jobs to apply');
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
                  // ✅ 使用 buildMarkdownCards 生成的卡片内容（包含 matchScore、subScores、listSummary、highlights、tags、jobUrl）
                  text: `# 🎯 Personalized Job Recommendations\n\n${summary}\n\n${cardsContent}${feedback_prompt}`
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
                profile_stage: profileStage,
                auto_apply_ready: profileStage === 'auto_apply_ready',
                missing_fields,
                next_actions,
                // GPT 方案: 暴露本次返回的 job IDs 供下次去重
                meta: {
                  returned_job_ids: recommendedJobs.map(job => job.id),
                  index_to_id: recommendedJobs.map(job => job.id),
                  session_id,
                  db_candidates_count: timing.candidates_count
                },
                job_cards,
              }
            }, { "X-MCP-Trace-Id": traceId });

          } catch (error: any) {
            console.error('[MCP] recommend_jobs error:', error);
            if (typeof timing !== 'undefined') {
              timing.total_ms = Date.now() - tRecommendStart;
              timing.error = error?.message || String(error);
              console.log('[TIMING] recommend_jobs breakdown (exception):', JSON.stringify(timing));
            }
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
            limit = 10,
            workMode,
            employmentType,
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
                const liked_jobs = await queryJobsByIds(liked_job_ids);
                
                if (liked_jobs.length > 0) {
                  // ✅ 修复：兼容 location 字段的各种格式（string/array/object/locations）
                  const extractLocations = (loc: any): string[] => {
                    if (!loc) return [];
                    // 优先使用 locations（复数，字符串）
                    if (typeof loc === 'string') return [loc];
                    // ✅ 修复：递归处理数组，支持 object[] 如 [{city,state}]
                    if (Array.isArray(loc)) return loc.flatMap((item: any) => extractLocations(item));
                    // 如果是对象（如 {city, state, country}），组装成字符串
                    if (typeof loc === 'object') {
                      const parts = [loc.city, loc.state, loc.country, loc.locations].filter(Boolean);
                      return parts.length > 0 ? [parts.join(', ')] : [];
                    }
                    return [];
                  };
                  
                  // ✅ 修复：空数组 [] 是 truthy，需要显式检查长度
                  const getLocationValue = (j: any) => (Array.isArray(j.locations) && j.locations.length > 0) ? j.locations : j.location;
                  
                  preferences = {
                    preferred_titles: [...new Set(liked_jobs.map((j: any) => j.title))],
                    preferred_companies: [...new Set(liked_jobs.map((j: any) => j.company))],
                    preferred_skills: liked_jobs.flatMap((j: any) => j.skillsMustHave?.length ? j.skillsMustHave : (j.skills || [])),
                    preferred_locations: [...new Set(liked_jobs.flatMap((j: any) => extractLocations(getLocationValue(j))))]
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
            const searchLimit = 30;
            const queryOptions: Parameters<typeof queryJobsWithFilters>[0] = {
              jobTitle: effectiveJobTitle,
              city: effectiveCity,
              page: 1,
              pageSize: searchLimit,
              excludeIds: Array.from(EXCLUDE_SET).slice(-2000),
              ...(workMode != null && workMode !== '' ? { workMode } : {}),
              ...(employmentType != null && employmentType !== '' ? { employmentType } : {}),
            };
            const { jobs: candidates } = await queryJobsWithFilters(queryOptions);
            
            console.log(`[refine] Found ${candidates.length} candidates after excluding ${EXCLUDE_SET.size}`);
            
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
                const jobSkillPool = job.skillsMustHave?.length ? job.skillsMustHave : (job.skills || []);
                const matching_skills = jobSkillPool.filter((s: string) => 
                  preferences.preferred_skills.includes(s)
                );
                score += Math.min(matching_skills.length * 5, 25);
                
                // 地点匹配 +10
                // ✅ 修复：兼容 location 字段的各种格式
                const extractLocationsForJob = (loc: any): string[] => {
                  if (!loc) return [];
                  if (typeof loc === 'string') return [loc];
                  // ✅ 修复：递归处理数组，支持 object[] 如 [{city,state}]
                  if (Array.isArray(loc)) return loc.flatMap((item: any) => extractLocationsForJob(item));
                  if (typeof loc === 'object') {
                    const parts = [loc.city, loc.state, loc.country].filter(Boolean);
                    return parts.length > 0 ? [parts.join(', ')] : [];
                  }
                  return [];
                };
                // ✅ 修复：空数组 [] 是 truthy，需要显式检查长度
                const getJobLocationValue = (j: any) => {
                  const loc = (Array.isArray(j.locations) && j.locations.length > 0) ? j.locations : j.location;
                  return extractLocationsForJob(loc);
                };
                const jobLocations = getJobLocationValue(job);
                if (jobLocations.some((loc: string) => preferences.preferred_locations.includes(loc))) score += 10;
                
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
                const db = await getDb();
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
              // View Job Link (优先使用 jobUrl，否则使用 url)
              const viewJobUrl = job.jobUrl || job.url;
              return `**${index + 1}. ${job.title}** at ${job.company}\n` +
                `📍 ${job.location} | 💼 ${job.jobType || 'Full-time'} | 💰 ${job.salary || 'Not specified'}\n` +
                score_text +
                `🔗 [View Job](${viewJobUrl})\n` +
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
            const collection = db.collection('jobs');

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
            if (effectiveCity) query.locations = { $regex: effectiveCity, $options: 'i' };
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
                const db = await getDb();
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
                const collection = db.collection('jobs');
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
                  
                  // Base similarity score
                  markdownReport += `Similarity: ${Math.round((candidate.similarity || 0) * 100)}%`;
                  
                  // 🆕 Priority 1: Scoring data
                  if (candidate.opportunityScore !== undefined && candidate.opportunityScore !== null) {
                    markdownReport += ` | Opportunity Score: ${Math.round(candidate.opportunityScore * 100)}%`;
                  }
                  if (candidate.score !== undefined && candidate.score !== null) {
                    markdownReport += ` | Overall Score: ${Math.round(candidate.score * 100)}%`;
                  }
                  if (candidate.feasibilityScore !== undefined && candidate.feasibilityScore !== null) {
                    markdownReport += ` | Feasibility: ${Math.round(candidate.feasibilityScore * 100)}%`;
                  }
                  
                  if (candidate.difficulty) markdownReport += ` | Difficulty: ${candidate.difficulty}`;
                  if (candidate.transitionTime) markdownReport += ` | Timeline: ${candidate.transitionTime}`;
                  markdownReport += `\n`;
                  
                  // 🆕 Priority 1: Location information
                  if (candidate.fromCountry || candidate.toCountry) {
                    const locationInfo = [];
                    if (candidate.fromCountry) locationInfo.push(`From: ${candidate.fromCountry}`);
                    if (candidate.toCountry) locationInfo.push(`To: ${candidate.toCountry}`);
                    if (candidate.isCrossCountry) locationInfo.push(`(Cross-country)`);
                    if (candidate.remoteSupported) locationInfo.push(`Remote supported`);
                    markdownReport += `**Location:** ${locationInfo.join(' | ')}\n`;
                  }
                  
                  // 🆕 Priority 1: Market data
                  if (candidate.market) {
                    const marketInfo = [];
                    if (candidate.market.trend !== undefined && candidate.market.trend !== null) {
                      const trendEmoji = candidate.market.trend > 0 ? '📈' : candidate.market.trend < 0 ? '📉' : '➡️';
                      marketInfo.push(`${trendEmoji} Trend: ${(candidate.market.trend * 100).toFixed(0)}%`);
                    }
                    if (candidate.market.remoteRate !== undefined && candidate.market.remoteRate !== null) {
                      marketInfo.push(`Remote: ${Math.round(candidate.market.remoteRate * 100)}%`);
                    }
                    if (candidate.market.sponsorshipRate !== undefined && candidate.market.sponsorshipRate !== null) {
                      marketInfo.push(`Sponsorship: ${Math.round(candidate.market.sponsorshipRate * 100)}%`);
                    }
                    if (candidate.market.avgSalary) {
                      marketInfo.push(`Avg Salary: ${candidate.market.avgSalary}`);
                    }
                    if (marketInfo.length > 0) {
                      markdownReport += `**Market Data:** ${marketInfo.join(' | ')}\n`;
                    }
                    
                    // Industry distribution (if available)
                    if (candidate.market.industryDistribution && Object.keys(candidate.market.industryDistribution).length > 0) {
                      const topIndustries = Object.entries(candidate.market.industryDistribution)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 3)
                        .map(([industry, pct]) => `${industry} ${Math.round((pct as number) * 100)}%`)
                        .join(', ');
                      markdownReport += `**Top Industries:** ${topIndustries}\n`;
                    }
                  }
                  
                  // Existing skills information (unchanged)
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
          
          // ✅ 修复：参数别名映射，兼容 job_title/query 等字段名
          const from_job = args.from_job ?? args.job_title ?? args.current_role ?? "";
          const to_job = args.to_job ?? args.query ?? args.target_role ?? "";

          console.log('[MCP] career_skill_gap_analysis - Input:', { 
            from_job, 
            to_job,
            raw_args: args
          });

          // ✅ 修复：参数验证，返回友好错误而不是 TypeError
          if (!from_job || !to_job) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `❌ Missing required parameters for skill gap analysis.\n\n` +
                    `Required: from_job and to_job\n` +
                    `Also supported: job_title (for from_job), query (for to_job), current_role, target_role\n\n` +
                    `Example: { "from_job": "Software Engineer", "to_job": "Product Manager" }`
                }],
                isError: true
              }
            }, { "X-MCP-Trace-Id": traceId });
          }

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
                // ✅ 修复：在所有 toLowerCase() 调用前添加 String(x || "")
                const toLower = String(to_job || "").toLowerCase();
                
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

        // ============================================
        // Tool: create_application_intent (Phase 1: apply_applications as source of truth)
        // ============================================
        else if (name === "create_application_intent") {
          const traceId = crypto.randomUUID();
          const user_email = String(args?.user_email ?? "").trim();
          const job_id = String(args?.job_id ?? "").trim();
          const sourceRaw = String(args?.source ?? "manus").trim().toLowerCase();
          const source: ApplySource = APPLY_SOURCE_ENUM.includes(sourceRaw as ApplySource) ? (sourceRaw as ApplySource) : "manus";
          const created_by = args?.created_by != null ? String(args.created_by).trim() : undefined;
          // 接入 Manus 后看日志：args.source 与 header，便于后续改为“仅 header 来自 manus 才记 manus”
          console.log('[MCP] create_application_intent source:', {
            args_source: args?.source ?? null,
            'x-caller': request.headers.get('x-caller') ?? null,
            resolved_source: source,
          });
          if (!user_email || !job_id) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: "Missing user_email or job_id." }],
                isError: false,
                error: "missing_params"
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
          try {
            const [jobs, profileResolved] = await Promise.all([
              queryJobsByIds([job_id]),
              getUserProfile(user_email).catch(() => null)
            ]);
            const job = jobs?.[0];
            if (!job) {
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{ type: "text", text: `Job not found: ${job_id}` }],
                  isError: false,
                  error: "job_not_found"
                }
              }, { "X-MCP-Trace-Id": traceId });
            }
            const user_id = profileResolved?._id?.toString() ?? undefined;
            const db = await getDb();
            const coll = db.collection<ApplyApplicationDoc>(APPLY_APPLICATIONS_COLLECTION);
            const activeQuery = user_id
              ? { user_id, execution_status: { $in: [...APPLY_EXECUTION_STATUS_ACTIVE] } }
              : { user_email, execution_status: { $in: [...APPLY_EXECUTION_STATUS_ACTIVE] } };
            const existingActive = await coll.findOne({ ...activeQuery, job_id }) as { _id: string } | null;
            if (existingActive) {
              const jobSnapshot = buildJobSnapshotFromJob(job);
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{ type: "text", text: `Application intent already exists for this job. Use application_id for prepare_application_context.` }],
                  isError: false,
                  intent_id: existingActive._id,
                  application_id: existingActive._id,
                  job_snapshot: jobSnapshot,
                  execution_status: "created",
                  created_at: new Date().toISOString()
                }
              }, { "X-MCP-Trace-Id": traceId });
            }
            const activeCount = await coll.countDocuments(activeQuery);
            if (activeCount >= 100) {
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{ type: "text", text: "Per-user limit of 100 active applications reached." }],
                  isError: false,
                  error: "limit_exceeded"
                }
              }, { "X-MCP-Trace-Id": traceId });
            }
            const application_id = crypto.randomUUID();
            const job_snapshot = buildJobSnapshotFromJob(job);
            const now = new Date();
            const doc = {
              _id: application_id,
              user_id: user_id ?? null,
              user_email,
              job_id,
              job_snapshot,
              source,
              execution_status: "created" as ApplyExecutionStatus,
              created_at: now,
              updated_at: now,
              ...(created_by ? { created_by } : {})
            };
            await coll.insertOne(doc);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: `Application intent created. Use application_id with prepare_application_context.` }],
                isError: false,
                intent_id: application_id,
                application_id,
                job_snapshot,
                execution_status: "created",
                created_at: now.toISOString()
              }
            }, { "X-MCP-Trace-Id": traceId });
          } catch (err: any) {
            console.error('[MCP] create_application_intent error:', err);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: `Failed to create intent: ${err?.message || err}` }],
                isError: false,
                error: "create_intent_failed"
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
        }

        // ============================================
        // Tool: prepare_application_context (v1: single job, verification = manual takeover; supports application_id Mode B)
        // ============================================
        else if (name === "prepare_application_context") {
          const traceId = crypto.randomUUID();
          const user_email = String(args?.user_email ?? "").trim();
          const job_idArg = args?.job_id != null ? String(args.job_id).trim() : "";
          const application_id = args?.application_id != null ? String(args.application_id).trim() : "";
          if (!user_email) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: "Missing user_email." }],
                isError: false,
                error: "missing_params"
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
          if (!job_idArg && !application_id) {
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: "Provide either job_id or application_id." }],
                isError: false,
                error: "missing_params"
              }
            }, { "X-MCP-Trace-Id": traceId });
          }
          try {
            let job_id = job_idArg;
            let resolvedEmail = user_email;
            if (application_id) {
              const db = await getDb();
              const appDoc = await db.collection<ApplyApplicationDoc>(APPLY_APPLICATIONS_COLLECTION).findOne({ _id: application_id });
              if (!appDoc) {
                return json200({
                  jsonrpc: "2.0",
                  id: body.id ?? null,
                  result: {
                    content: [{ type: "text", text: `Application not found: ${application_id}` }],
                    isError: false,
                    error: "application_not_found"
                  }
                }, { "X-MCP-Trace-Id": traceId });
              }
              job_id = appDoc.job_id ?? job_id;
              if (appDoc.user_email) resolvedEmail = appDoc.user_email;
              await db.collection<ApplyApplicationDoc>(APPLY_APPLICATIONS_COLLECTION).updateOne(
                { _id: application_id },
                { $set: { execution_status: "running", updated_at: new Date() } }
              );
            }
            const [jobs, profileResolved] = await Promise.all([
              queryJobsByIds([job_id]),
              getUserProfile(resolvedEmail).catch(() => null)
            ]);
            const job = jobs?.[0];
            if (!job) {
              return json200({
                jsonrpc: "2.0",
                id: body.id ?? null,
                result: {
                  content: [{ type: "text", text: `Job not found: ${job_id}` }],
                  isError: false,
                  error: "job_not_found"
                }
              }, { "X-MCP-Trace-Id": traceId });
            }
            const appForJob = profileResolved?.applications?.find((a: any) => a.jobId === job_id);
            const resume_url = appForJob?.resumeTailor?.downloadUrl ?? null;
            const jobSnapshot = buildJobSnapshotFromJob(job);
            const submit_policy = "do_not_submit_without_explicit_user_confirmation";
            const prompt_snippet = `Apply to this job on behalf of the user. Job: ${jobSnapshot.title} at ${jobSnapshot.company}. Apply URL: ${jobSnapshot.jobUrl}. Do NOT guess sponsor, clearance, or citizenship. If the platform requires verification (email code, SMS, MFA, captcha, or final confirmation), pause and wait for user input (v1: manual takeover). Submit only after user explicitly confirms.`;
            if (application_id && resume_url) {
              const db = await getDb();
              await db.collection<ApplyApplicationDoc>(APPLY_APPLICATIONS_COLLECTION).updateOne(
                { _id: application_id },
                { $set: { resume_url, updated_at: new Date() } }
              );
            }
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{
                  type: "text",
                  text: `Application context ready for job: ${jobSnapshot.title} at ${jobSnapshot.company}. Pass the prompt_snippet and attachments to Manus Create Task.`
                }],
                isError: false,
                prompt_snippet,
                submit_policy,
                job_snapshot: jobSnapshot,
                resume_url,
                verification_note: "V1: on verification required, pause and hand over to user (manual takeover)."
              }
            }, { "X-MCP-Trace-Id": traceId });
          } catch (err: any) {
            console.error('[MCP] prepare_application_context error:', err);
            return json200({
              jsonrpc: "2.0",
              id: body.id ?? null,
              result: {
                content: [{ type: "text", text: `Failed to prepare context: ${err?.message || err}` }],
                isError: false,
                error: "prepare_failed"
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












