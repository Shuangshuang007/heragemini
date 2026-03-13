/**
 * Shared job list/detail payload builders for MCP and main site.
 * Single source of truth: list = first-round payload (aligned with main site Job List);
 * detail = exactly what JobDetailPanel displays (one module, panel and Manus identical).
 */

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
// Exactly what JobDetailPanel displays. No description (panel does not show it).
// Single source of truth: GET /api/jobs/[id] and MCP get_job_detail both use buildJobDetailPayload.

export interface JobDetailPayload {
  id: string;
  title: string;
  company: string;
  location: string | string[];
  postedDate?: string;
  url: string;
  highlights: string[];
  matchScore?: number;
  subScores?: { experience?: number; industry?: number; skills?: number; other?: number };
  summary?: string;
  workMode?: string;
  salary?: string;
  skillsMustHave: string[];
  skillsNiceToHave: string[];
  keyRequirements: string[];
  workRights?: {
    requiresStatus?: string;
    sponsorship?: string;
    country?: string;
    citizenshipRequired?: boolean;
  };
}

/**
 * Build detail payload from a job (frontend format or DB). Only fields that JobDetailPanel uses.
 * Used by GET /api/jobs/[id] and MCP get_job_detail so main site and Manus receive identical shape.
 */
export function buildJobDetailPayload(job: any): JobDetailPayload | null {
  if (!job) return null;
  const id = job.id ?? job.jobIdentifier ?? job?._id?.toString?.();
  if (!id) return null;

  const loc = job.location ?? job.locationRaw ?? job.locations;
  const location =
    Array.isArray(loc) && loc.length > 0
      ? loc
      : typeof loc === 'string'
        ? loc
        : locationToString(loc);

  return {
    id: String(id),
    title: toString(job.title),
    company: toString(job.company ?? job.company_name),
    location,
    postedDate: job.postedDate ?? job.postedDateRaw ?? undefined,
    url: toString(job.url ?? job.jobUrl ?? ''),
    highlights: toArray(job.highlights),
    matchScore: typeof job.matchScore === 'number' ? job.matchScore : undefined,
    subScores: job.subScores && typeof job.subScores === 'object' ? job.subScores : undefined,
    summary: job.summary != null ? String(job.summary).trim() : undefined,
    workMode: job.workMode != null ? String(job.workMode).trim() : undefined,
    salary: job.salary != null ? String(job.salary).trim() : undefined,
    skillsMustHave: toArray(job.skillsMustHave ?? job.skillsMust),
    skillsNiceToHave: toArray(job.skillsNiceToHave ?? job.skillsNice),
    keyRequirements: toArray(job.keyRequirements),
    workRights: job.workRights ?? undefined,
  };
}
