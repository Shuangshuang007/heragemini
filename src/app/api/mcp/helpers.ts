// ============================================
// Hera AI MCP - Helper Functions
// ============================================
// This file contains utility functions for the MCP integration layer
// including deduplication, source optimization, and link generation
//
// IMPORTANT: All code in this file uses English only
// - Comments in English
// - Variable names in English
// - Error messages in English
// - Log messages in English
//
// Version: Phase 0 - Optimized
// ============================================

// ============================================
// Job Deduplication
// ============================================

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  platform?: string;
  matchScore?: number;
  [key: string]: any;
}

/**
 * Deduplicate jobs based on company + title + location fingerprint
 * Keeps the first occurrence of each unique job
 */
export function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const deduplicatedJobs: Job[] = [];

  for (const job of jobs) {
    // Create fingerprint: company + title + location (normalized)
    const fingerprint = createJobFingerprint(job);
    
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      deduplicatedJobs.push(job);
    }
  }

  return deduplicatedJobs;
}

/**
 * Create a unique fingerprint for job deduplication
 * Uses normalized company + title + location
 */
function createJobFingerprint(job: Job): string {
  const norm = (v: any) => (v == null ? "" : String(v));

  const normalizeLocation = (loc: any): string => {
    if (!loc) return "";
    if (typeof loc === "string") return loc;
    if (Array.isArray(loc)) {
      // 支持 ["Sydney","NSW"] 或 [{city,state}, ...]
      return loc
        .flatMap((x) => {
          if (!x) return [];
          if (typeof x === "string") return [x];
          if (typeof x === "object")
            return [[x.city, x.state, x.region, x.country].filter(Boolean).join(", ")].filter(Boolean);
          return [String(x)];
        })
        .filter(Boolean)
        .join(", ");
    }
    if (typeof loc === "object") {
      return [loc.city, loc.state, loc.region, loc.country].filter(Boolean).join(", ");
    }
    return String(loc);
  };

  const company = norm(job.company || job.company_name).toLowerCase().trim().replace(/\s+/g, " ");
  const title = norm(job.title || job.job_title).toLowerCase().trim().replace(/\s+/g, " ");
  // 兼容 locations/location/locationRaw
  const rawLoc = (job as any).locations ?? (job as any).location ?? (job as any).locationRaw ?? "";
  const location = normalizeLocation(rawLoc).toLowerCase().trim().replace(/\s+/g, " ");

  return `${company}_${title}_${location}`;
}

// ============================================
// Source Strategy Optimization
// ============================================

export interface SourceStrategy {
  sources: string[];
  strategy: string;
  priority: string[];
}

/**
 * Determine optimal source strategy based on country and user preferences
 */
export function getSourceStrategy(
  countryCode: string,
  userSources: string[] = ['all']
): SourceStrategy {
  // If user specified exact sources, respect their choice
  if (!userSources.includes('all')) {
    return {
      sources: userSources,
      strategy: 'user_specified_sources',
      priority: userSources,
    };
  }

  // Country-based optimization
  switch (countryCode.toUpperCase()) {
    case 'AU':
      return {
        sources: ['seek', 'linkedin', 'jora', 'adzuna'],
        strategy: 'multi_source_with_seek_priority',
        priority: ['seek', 'linkedin', 'jora', 'adzuna'],
      };
    
    case 'US':
      return {
        sources: ['linkedin', 'zip'],
        strategy: 'multi_source_us_optimized',
        priority: ['linkedin', 'zip'],
      };
    
    case 'GB':
    case 'UK':
      return {
        sources: ['linkedin', 'indeed'],
        strategy: 'multi_source_uk_optimized',
        priority: ['linkedin', 'indeed'],
      };
    
    default:
      return {
        sources: ['linkedin'],
        strategy: 'multi_source_global',
        priority: ['linkedin'],
      };
  }
}

// ============================================
// Job Source Enhancement
// ============================================

/**
 * Add source badges and labels to jobs
 */
export function enhanceJobsWithSources(jobs: Job[]): Job[] {
  return jobs.map((job) => {
    const source = (job.platform || 'unknown').toLowerCase();
    const sourceLabel = getSourceLabel(source);
    
    return {
      ...job,
      source,
      source_label: sourceLabel,
    };
  });
}

/**
 * Get display label for source platform
 */
function getSourceLabel(source: string): string {
  const sourceMap: Record<string, string> = {
    'seek': 'SEEK',
    'linkedin': 'LinkedIn',
    'jora': 'Jora',
    'adzuna': 'Adzuna',
    'indeed': 'Indeed',
    'zip': 'ZipRecruiter',
    'unknown': 'Unknown',
  };
  
  return sourceMap[source.toLowerCase()] || source.toUpperCase();
}

// ============================================
// Deep Link Generation
// ============================================

export interface SearchLink {
  platform: string;
  url: string;
  label: string;
}

export interface LinkGenerationArgs {
  job_title: string;
  city: string;
  country_code?: string;
  platforms?: string[];
  posted_within_days?: number;
}

/**
 * Generate deep search links for job platforms
 */
export function generateSearchLinks(args: LinkGenerationArgs): SearchLink[] {
  const {
    job_title,
    city,
    country_code = 'AU',
    platforms = ['linkedin', 'seek', 'jora', 'adzuna'],
    posted_within_days = 7,
  } = args;

  const links: SearchLink[] = [];

  for (const platform of platforms) {
    const link = generatePlatformLink(platform, {
      job_title,
      city,
      country_code,
      posted_within_days,
    });
    
    if (link) {
      links.push(link);
    }
  }

  return links;
}

/**
 * Generate search link for a specific platform
 */
function generatePlatformLink(
  platform: string,
  args: Omit<LinkGenerationArgs, 'platforms'>
): SearchLink | null {
  const { job_title, city, country_code = 'AU', posted_within_days = 7 } = args;

  switch (platform.toLowerCase()) {
    case 'linkedin':
      return generateLinkedInLink(job_title, city, country_code, posted_within_days);
    
    case 'seek':
      return generateSeekLink(job_title, city, posted_within_days);
    
    case 'jora':
      return generateJoraLink(job_title, city);
    
    case 'adzuna':
      return generateAdzunaLink(job_title, city);
    
    case 'indeed':
      return generateIndeedLink(job_title, city, country_code);
    
    default:
      return null;
  }
}

/**
 * Generate LinkedIn search link
 */
function generateLinkedInLink(
  jobTitle: string,
  city: string,
  countryCode: string,
  days: number
): SearchLink {
  const daysInSeconds = days * 86400;
  const location = countryCode === 'AU' 
    ? `${city}, Australia`
    : `${city}, ${getCountryName(countryCode)}`;
  
  return {
    platform: 'linkedin',
    url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      jobTitle
    )}&location=${encodeURIComponent(location)}&f_TPR=r${daysInSeconds}`,
    label: 'Open on LinkedIn',
  };
}

/**
 * Generate SEEK search link (Australia)
 */
function generateSeekLink(jobTitle: string, city: string, days: number): SearchLink {
  const slugify = (str: string) =>
    str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  
  return {
    platform: 'seek',
    url: `https://www.seek.com.au/${slugify(jobTitle)}-jobs/in-${slugify(
      city
    )}?daterange=${days}`,
    label: 'Open on SEEK',
  };
}

/**
 * Generate Jora search link (Australia)
 */
function generateJoraLink(jobTitle: string, city: string): SearchLink {
  return {
    platform: 'jora',
    url: `https://au.jora.com/j?sp=search&q=${encodeURIComponent(
      jobTitle
    )}&l=${encodeURIComponent(city + ' VIC')}`,
    label: 'Open on Jora',
  };
}

/**
 * Generate Adzuna search link
 */
function generateAdzunaLink(jobTitle: string, city: string): SearchLink {
  return {
    platform: 'adzuna',
    url: `https://www.adzuna.com.au/search?q=${encodeURIComponent(
      jobTitle
    )}&w=${encodeURIComponent(city)}`,
    label: 'Open on Adzuna',
  };
}

/**
 * Generate Indeed search link
 */
function generateIndeedLink(jobTitle: string, city: string, countryCode: string): SearchLink {
  const domain = getIndeedDomain(countryCode);
  const location = countryCode === 'AU' 
    ? `${city} VIC`
    : `${city}`;
  
  return {
    platform: 'indeed',
    url: `https://${domain}/jobs?q=${encodeURIComponent(
      jobTitle
    )}&l=${encodeURIComponent(location)}`,
    label: 'Open on Indeed',
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get country name from country code
 */
function getCountryName(countryCode: string): string {
  const countryMap: Record<string, string> = {
    'AU': 'Australia',
    'US': 'United States',
    'GB': 'United Kingdom',
    'UK': 'United Kingdom',
    'CA': 'Canada',
    'NZ': 'New Zealand',
  };
  
  return countryMap[countryCode.toUpperCase()] || countryCode;
}

/**
 * Get Indeed domain for country
 */
function getIndeedDomain(countryCode: string): string {
  const domainMap: Record<string, string> = {
    'AU': 'au.indeed.com',
    'US': 'www.indeed.com',
    'GB': 'uk.indeed.com',
    'UK': 'uk.indeed.com',
    'CA': 'ca.indeed.com',
    'NZ': 'nz.indeed.com',
  };
  
  return domainMap[countryCode.toUpperCase()] || 'www.indeed.com';
}

/**
 * Validate and sanitize input parameters
 */
export function validateSearchParams(args: any): {
  isValid: boolean;
  errors: string[];
  sanitized: any;
} {
  const errors: string[] = [];
  const sanitized: any = {};

  // Required fields
  if (!args.job_title || typeof args.job_title !== 'string') {
    errors.push('job_title is required and must be a string');
  } else {
    sanitized.job_title = args.job_title.trim();
  }

  if (!args.city || typeof args.city !== 'string') {
    errors.push('city is required and must be a string');
  } else {
    sanitized.city = args.city.trim();
  }

  // Optional fields with defaults
  sanitized.country_code = (args.country_code || 'AU').toString().toUpperCase();
  sanitized.sources = Array.isArray(args.sources) ? args.sources : ['all'];
  sanitized.enable_deduplication = Boolean(args.enable_deduplication ?? true);
  sanitized.limit = Math.min(Math.max(parseInt(args.limit) || 25, 1), 100);
  sanitized.min_match_score = Math.min(Math.max(parseInt(args.min_match_score) || 0, 0), 100);

  // Validate country code format
  if (!/^[A-Z]{2}$/.test(sanitized.country_code)) {
    errors.push('country_code must be a valid ISO 3166-1 alpha-2 code (e.g., AU, US)');
  }

  // Validate sources array
  const validSources = ['all', 'linkedin', 'seek', 'jora', 'adzuna', 'indeed'];
  const invalidSources = sanitized.sources.filter((s: string) => !validSources.includes(s));
  if (invalidSources.length > 0) {
    errors.push(`Invalid sources: ${invalidSources.join(', ')}. Valid sources: ${validSources.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

// ============================================
// Response Formatting
// ============================================

export interface SearchResponse {
  jobs: Job[];
  total: number;
  total_before_dedup?: number;
  sources_used: string[];
  deduplication_enabled: boolean;
  country_optimized_for: string;
  search_strategy: string;
  metadata: {
    query: string;
    sources_requested: string[];
    country_code: string;
    limit: number;
    min_match_score: number;
  };
}

/**
 * Format search results with metadata
 */
export function formatSearchResponse(
  jobs: Job[],
  totalBeforeDedup: number,
  sourcesUsed: string[],
  searchStrategy: string,
  countryCode: string,
  metadata: any
): SearchResponse {
  return {
    jobs,
    total: jobs.length,
    total_before_dedup: totalBeforeDedup,
    sources_used: sourcesUsed,
    deduplication_enabled: metadata.enable_deduplication,
    country_optimized_for: countryCode,
    search_strategy: searchStrategy,
    metadata: {
      query: `${metadata.job_title} in ${metadata.city}`,
      sources_requested: metadata.sources,
      country_code: countryCode,
      limit: metadata.limit,
      min_match_score: metadata.min_match_score,
    },
  };
}

