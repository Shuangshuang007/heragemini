/**
 * Shared job list/detail payload builders for MCP and main site.
 * Single source of truth: list = first-round payload (aligned with main site Job List);
 * detail = full job (aligned with main site Job Detail / GET /api/jobs/[id]).
 */

import type { Job } from '@/types/job';

// ----- List layer (first round: recommend / refine / search) -----
// Aligned with main site JobSummaryCard and buildMarkdownCards list view.

export interface JobListPayload {
  id: string;
  title: string;
  company: string;
  location: string;
  platform: string;
  jobUrl: string;
  postedDate: string | null;
  salary: string | null;
  employmentType: string | null;
  workMode: string | null;
  experienceTag: string | null;
  skillsMustHave: string[];
  keyRequirements: string[];
  matchScore: number | null;
  subScores: {
    experience?: number;
    industry?: number;
    skills?: number;
    other?: number;
  } | null;
  highlights: string[];
  summary: string;
}

function toString(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function toArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => toString(x)).filter(Boolean);
}

function locationToString(loc: unknown): string {
  if (loc == null) return '';
  if (typeof loc === 'string') return loc.trim();
  if (Array.isArray(loc)) {
    const first = loc[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'city' in first) {
      const parts = [first.city, (first as any).state, (first as any).country].filter(Boolean);
      return parts.join(', ');
    }
    return loc.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)[0] || '';
  }
  if (typeof loc === 'object' && loc !== null && 'city' in loc) {
    const o = loc as { city?: string; state?: string; country?: string };
    return [o.city, o.state, o.country].filter(Boolean).join(', ');
  }
  return '';
}

/**
 * Build list-layer payload from a raw job (DB doc or scored job from recommend/refine/search).
 * Use this for first-round responses so MCP and main site share one definition.
 */
export function buildJobListPayload(job: any): JobListPayload {
  const id = String(job?.id ?? job?.jobIdentifier ?? job?._id ?? '');
  const jobUrl = job?.jobUrl ?? job?.url ?? '';
  const highlights =
    (Array.isArray(job?.matchHighlights) && job.matchHighlights.length > 0
      ? job.matchHighlights
      : toArray(job?.highlights)) ?? [];

  return {
    id,
    title: toString(job?.title),
    company: toString(job?.company ?? job?.company_name),
    location: locationToString(job?.location ?? job?.locationRaw ?? job?.locations),
    platform: toString(job?.platform ?? job?.source ?? job?.source_label),
    jobUrl: jobUrl && typeof jobUrl === 'string' && jobUrl.startsWith('http') ? jobUrl : job?.url ?? '',
    postedDate: job?.postedDate ?? job?.postedDateRaw ?? job?.postDate ?? null,
    salary: job?.salary ?? null,
    employmentType: job?.employmentType ?? job?.employment_type ?? null,
    workMode: job?.workMode ?? null,
    experienceTag: job?.experienceTag ?? job?.experience_label ?? job?.seniority ?? null,
    skillsMustHave: toArray(job?.skillsMustHave ?? job?.skillsMust).slice(0, 5),
    keyRequirements: toArray(job?.keyRequirements).slice(0, 5),
    matchScore:
      typeof job?.matchScore === 'number' && job.matchScore >= 0 ? job.matchScore : null,
    subScores: job?.subScores && typeof job.subScores === 'object' ? job.subScores : null,
    highlights: highlights.slice(0, 5),
    summary: toString(job?.summary ?? ''),
  };
}

// ----- Detail layer (on-demand: show more / get_job_detail) -----
// Same shape as main site Job and GET /api/jobs/[id] response.

export type JobDetailPayload = Job;

/**
 * Build detail payload from a job already in frontend format (e.g. from transformMongoDBJobToFrontendFormat
 * or from recommend pipeline). Main site GET /api/jobs/[id] returns this shape.
 * Use for get_job_detail MCP tool and any "show more" response.
 */
export function buildJobDetailPayload(job: any): JobDetailPayload | null {
  if (!job) return null;
  const id = job.id ?? job.jobIdentifier ?? job?._id?.toString?.();
  if (!id) return null;

  return {
    id: String(id),
    title: toString(job.title),
    company: toString(job.company ?? job.company_name),
    location: job.location ?? locationToString(job.locationRaw ?? job.locations),
    description: job.description,
    salary: job.salary,
    requirements: toArray(job.requirements),
    benefits: toArray(job.benefits),
    jobType: job.jobType,
    employmentType: job.employmentType ?? job.employment_type,
    workMode: job.workMode,
    experience: job.experience,
    postedDate: job.postedDate ?? job.postedDateRaw,
    platform: toString(job.platform ?? job.source),
    url: job.url ?? job.jobUrl ?? '',
    experienceTag: job.experienceTag,
    skillsMustHave: toArray(job.skillsMustHave ?? job.skillsMust),
    skillsNiceToHave: toArray(job.skillsNiceToHave ?? job.skillsNice),
    highlights: toArray(job.highlights),
    keyRequirements: toArray(job.keyRequirements),
    workRights: job.workRights ?? undefined,
    tags: Array.isArray(job.tags) ? job.tags : [],
    skills: toArray(job.skills),
    matchScore: typeof job.matchScore === 'number' ? job.matchScore : undefined,
    subScores: job.subScores ?? undefined,
    matchAnalysis: job.matchAnalysis,
    matchHighlights: Array.isArray(job.matchHighlights) ? job.matchHighlights : [],
    summary: job.summary,
    detailedSummary: job.detailedSummary,
    industry: job.industry,
  } as JobDetailPayload;
}
