import { MongoClient, ObjectId } from 'mongodb';
import { getHotJobsQuery } from '../constants/hotJobs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'hera';
const COLLECTION_NAME = 'jobs';

let client: MongoClient | null = null;
let db: any = null;

const EXPERIENCE_REGEX = /\b(\d{1,2})(?:\s*[\-–]\s*(\d{1,2}))?\s*(?:\+|plus)?\s*(years?|yrs)\b/i;

function sanitizeString(value?: string | null): string {
  return (value || '').toString().trim();
}

function mapArrayField(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(sanitizeString).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;•|]/)
      .map(item => item.replace(/^[\-\*\u2022]+\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeLocation(value: any): string | string[] {
  if (Array.isArray(value)) {
    const normalized = value.map(item => sanitizeString(item)).filter(Boolean);
    return normalized.length > 0 ? normalized : '';
  }
  if (typeof value === 'string') {
    const parts = value.split(/[,|;/]/).map(part => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts;
    }
    return sanitizeString(value);
  }
  if (value && typeof value === 'object') {
    const parts = [value.city, value.state, value.country].map(sanitizeString).filter(Boolean);
    if (parts.length > 0) {
      return parts.join(', ');
    }
  }
  return '';
}

function extractExperienceTagFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(EXPERIENCE_REGEX);
  if (!match) return undefined;

  const [, start, end] = match;
  if (end) {
    return `${start}-${end}y experience`;
  }
  if (match[0].includes('+') || /plus/i.test(match[0])) {
    return `${start}+y experience`;
  }
  return `${start}y experience`;
}

function deriveExperienceTag(mongoJob: any): string | undefined {
  if (!mongoJob) return undefined;

  const directTag = sanitizeString(mongoJob.experienceTag || mongoJob.experience_label || mongoJob.seniority);
  if (directTag) return directTag;

  const fromExperienceField = extractExperienceTagFromText(mongoJob.experience);
  if (fromExperienceField) return fromExperienceField;

  const fromTagsArray = Array.isArray(mongoJob.tags)
    ? mongoJob.tags.find((tag: string) => /junior|mid|senior|lead|manager/i.test(tag))
    : undefined;
  if (fromTagsArray) return sanitizeString(fromTagsArray);

  return (
    extractExperienceTagFromText(mongoJob.description) ||
    extractExperienceTagFromText(mongoJob.summary) ||
    undefined
  );
}

function resolvePlatformLabel(mongoJob: any): string {
  if (mongoJob.sourceType === 'CorporateDirect') {
    return 'CorporateDirect';
  }
  if (mongoJob.sourceType === 'PublicSector') {
    return 'PublicSector';
  }
  if (Array.isArray(mongoJob.source) && mongoJob.source.length > 0) {
    return sanitizeString(mongoJob.source[0]);
  }
  if (mongoJob.source) {
    return sanitizeString(mongoJob.source);
  }
  if (mongoJob.platform) {
    return sanitizeString(mongoJob.platform);
  }
  return 'Unknown';
}

function buildLocationFilter(city: string) {
  if (!city) return null;
  const regex = { $regex: city, $options: 'i' };
  // 主站查询统一使用 locations（字符串字段，有索引），前端仍通过 normalizeLocation 还原 location
  return {
    locations: regex,
  };
}

export function transformMongoDBJobToFrontendFormat(mongoJob: any): any | null {
  // 支持 id, jobIdentifier, _id 作为唯一标识
  // jobIdentifier 是连接 pipeline 和 hera.jobs 的纽带，用于跨平台去重
  const jobId = mongoJob?.id || mongoJob?.jobIdentifier || (mongoJob?._id ? mongoJob._id.toString() : null);
  if (!jobId) return null;
  
  const experienceTag = deriveExperienceTag(mongoJob);
  const normalizedLocation = normalizeLocation(mongoJob.location || mongoJob.locationRaw || mongoJob.locations);

  return {
    id: jobId,
    title: sanitizeString(mongoJob.title),
    company: sanitizeString(mongoJob.company || mongoJob.organisation),
    location: normalizedLocation,
    description: sanitizeString(mongoJob.description || mongoJob.summary),
    salary: sanitizeString(mongoJob.salary),
    requirements: mapArrayField(mongoJob.requirements),
    benefits: mapArrayField(mongoJob.benefits),
    jobType: sanitizeString(mongoJob.employmentType || mongoJob.jobType),
    employmentType: sanitizeString(mongoJob.employmentType),
    experience: sanitizeString(mongoJob.experience),
    postedDate: sanitizeString(mongoJob.postedDateRaw || mongoJob.postedDate),
    platform: resolvePlatformLabel(mongoJob),
    url: sanitizeString(mongoJob.jobUrl || mongoJob.url),
    tags: [
      ...(Array.isArray(mongoJob.tags) ? mongoJob.tags.map(sanitizeString).filter(Boolean) : []),
      ...(experienceTag ? [experienceTag] : []),
    ],
    skills: mapArrayField(mongoJob.skills),
    skillsMustHave: mapArrayField(mongoJob.skillsMust || mongoJob.skillsMustHave),
    skillsNiceToHave: mapArrayField(mongoJob.skillsNice || mongoJob.skillsNiceToHave),
    highlights: mapArrayField(mongoJob.highlights),
    keyRequirements: mapArrayField(mongoJob.keyRequirements),
    workRights: mongoJob.workRights || null,
    openToRelocate: mongoJob.openToRelocate,
    matchScore: mongoJob.matchScore,
    subScores: mongoJob.subScores || null,
    matchAnalysis: sanitizeString(mongoJob.matchAnalysis),
    matchHighlights: Array.isArray(mongoJob.matchHighlights) ? mongoJob.matchHighlights : [],
    summary: sanitizeString(mongoJob.summary),
    detailedSummary: sanitizeString(mongoJob.detailedSummary),
    hotjob: mongoJob.hotjob ?? false,
    source: Array.isArray(mongoJob.source) ? mongoJob.source : mongoJob.source ? [mongoJob.source] : [],
    sourceType: mongoJob.sourceType,
    functionality: mongoJob.functionality,
    industry: mongoJob.industry,
    workMode: sanitizeString(mongoJob.workMode),
    experienceTag,
  };
}

export async function connectToMongoDB() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 增加到30秒
      connectTimeoutMS: 30000, // 增加到30秒
      socketTimeoutMS: 60000, // 增加到60秒
      maxPoolSize: 10, // 限制连接池大小
      minPoolSize: 2, // 最小连接数
    });
    await client.connect();
    db = client.db(DB_NAME);
  } else if (!db) {
    db = client.db(DB_NAME);
  }

  return { client, db };
}

export async function queryJobsFromDatabase(jobTitle: string, city: string, limit: number = 600): Promise<any[]> {
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection(COLLECTION_NAME);
    const query: any = { is_active: { $ne: false } };

    if (jobTitle) {
      const keywordRegex = { $regex: jobTitle, $options: 'i' };
      query.$or = [
        { title: keywordRegex },
        { summary: keywordRegex },
        { description: keywordRegex },
      ];
    }

    if (city) {
      const locationFilter = buildLocationFilter(city);
      if (locationFilter) {
        query.$and = query.$and || [];
        query.$and.push(locationFilter);
      }
    }

    const jobs = await collection
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    return jobs;
  } catch (error) {
    console.error('[JobDatabaseService] MongoDB query error:', error);
    return [];
  }
}

export async function queryHotJobsFromDatabase(jobTitle: string, city: string, limit: number = 600): Promise<any[]> {
  try {
    const { jobs } = await getHotJobsQuery({ targetTitle: jobTitle, city });
    return jobs.slice(0, limit);
  } catch (error) {
    console.error('[JobDatabaseService-HotJobs] MongoDB query error:', error);
    return [];
  }
}

export async function getJobById(jobId: string): Promise<any | null> {
  if (!jobId) return null;
  
  // 重试机制：最多重试3次
  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { db } = await connectToMongoDB();
      const collection = db.collection(COLLECTION_NAME);

      const filters: any[] = [{ id: jobId }, { jobIdentifier: jobId }];
      if (ObjectId.isValid(jobId)) {
        filters.push({ _id: new ObjectId(jobId) });
      }

      const job = await collection.findOne({
        $or: filters,
      }, {
        maxTimeMS: 30000, // 查询超时30秒
      });

      if (job) {
        console.log(`[JobDatabaseService] getJobById success: ${jobId} (attempt ${attempt})`);
        return job;
      }
      
      // 如果没找到，不再重试
      console.warn(`[JobDatabaseService] getJobById not found: ${jobId}`);
      return null;
    } catch (error: any) {
      lastError = error;
      console.error(`[JobDatabaseService] getJobById error (attempt ${attempt}/3):`, error.message);
      
      // 如果是网络超时错误，等待后重试
      if (error.name === 'MongoNetworkTimeoutError' || error.name === 'MongoServerSelectionError') {
        if (attempt < 3) {
          const waitTime = attempt * 1000; // 1秒, 2秒
          console.log(`[JobDatabaseService] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // 其他错误或重试次数用完，直接返回
      break;
    }
  }
  
  console.error('[JobDatabaseService] getJobById failed after retries:', lastError);
  return null;
}

export async function updateJobFields(jobId: string, fields: Record<string, any>) {
  if (!jobId || !fields || Object.keys(fields).length === 0) return null;
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection(COLLECTION_NAME);

    const filters: any[] = [{ id: jobId }, { jobIdentifier: jobId }];
    if (ObjectId.isValid(jobId)) {
      filters.push({ _id: new ObjectId(jobId) });
    }

    const result = await collection.updateOne(
      { $or: filters },
      {
        $set: {
          ...fields,
          updatedAt: new Date(),
        },
      },
      { upsert: false }
    );

    return result;
  } catch (error) {
    console.error('[JobDatabaseService] updateJobFields error:', error);
    return null;
  }
}

export async function queryJobsWithFilters(options: {
  jobTitle?: string;
  city?: string;
  company?: string;
  postedWithinDays?: number;
  platforms?: string[];
  page?: number;
  pageSize?: number;
  excludeIds?: string[];
}): Promise<{
  jobs: any[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const query: any = { is_active: { $ne: false } };
    
    // Job title filter
    if (options.jobTitle) {
      const keywordRegex = { $regex: options.jobTitle, $options: 'i' };
      query.$or = [
        { title: keywordRegex },
        { summary: keywordRegex },
        { description: keywordRegex },
      ];
    }
    
    // City filter - MCP专用：只使用locations字段（有索引，查询快）
    // 返回时通过 transformMongoDBJobToFrontendFormat 的 normalizeLocation 函数保持 location 字段给前端
    if (options.city) {
      const cityRegex = { $regex: options.city, $options: 'i' };
      query.$and = query.$and || [];
      query.$and.push({
        locations: cityRegex
      });
    }
    
    // Company filter
    if (options.company) {
      query.company = { $regex: options.company, $options: 'i' };
    }
    
    // Platform filter
    if (options.platforms && options.platforms.length > 0) {
      const platformConditions: any[] = [];
      options.platforms.forEach(platform => {
        platformConditions.push(
          { source: { $regex: platform, $options: 'i' } },
          { platform: { $regex: platform, $options: 'i' } },
          { sourceType: { $regex: platform, $options: 'i' } }
        );
      });
      if (platformConditions.length > 0) {
        query.$or = query.$or || [];
        query.$or.push(...platformConditions);
      }
    }
    
    // Posted within days filter
    if (options.postedWithinDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.postedWithinDays);
      query.$or = query.$or || [];
      query.$or.push(
        { postedDate: { $gte: cutoffDate.toISOString() } },
        { createdAt: { $gte: cutoffDate } },
        { updatedAt: { $gte: cutoffDate } }
      );
    }
    
    // Exclude IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      query.$and = query.$and || [];
      query.$and.push({
        $nor: [
          { id: { $in: options.excludeIds } },
          { jobIdentifier: { $in: options.excludeIds } },
          { _id: { $in: options.excludeIds.map(id => ObjectId.isValid(id) ? new ObjectId(id) : null).filter(Boolean) } }
        ]
      });
    }
    
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;
    
    // Get total count
    const total = await collection.countDocuments(query);
    
    // Get jobs
    const jobs = await collection
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();
    
    // Transform to frontend format
    const transformedJobs = jobs
      .map(transformMongoDBJobToFrontendFormat)
      .filter((job: any) => job !== null);
    
    return {
      jobs: transformedJobs,
      total,
      page,
      pageSize,
      hasMore: skip + transformedJobs.length < total,
    };
  } catch (error) {
    console.error('[JobDatabaseService] queryJobsWithFilters error:', error);
    return {
      jobs: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || 20,
      hasMore: false,
    };
  }
}

export async function queryJobsByIds(jobIds: string[]): Promise<any[]> {
  if (!jobIds || jobIds.length === 0) {
    return [];
  }
  
  try {
    const { db } = await connectToMongoDB();
    const collection = db.collection(COLLECTION_NAME);
    
    // Build query with multiple ID formats
    const filters: any[] = [];
    
    // Add string ID filters
    filters.push({ id: { $in: jobIds } });
    filters.push({ jobIdentifier: { $in: jobIds } });
    
    // Add ObjectId filters for valid ObjectIds
    const objectIds = jobIds
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));
    if (objectIds.length > 0) {
      filters.push({ _id: { $in: objectIds } });
    }
    
    const jobs = await collection
      .find({ $or: filters })
      .toArray();
    
    // Transform to frontend format
    return jobs
      .map(transformMongoDBJobToFrontendFormat)
      .filter((job: any) => job !== null);
  } catch (error) {
    console.error('[JobDatabaseService] queryJobsByIds error:', error);
    return [];
  }
}

export async function closeMongoDBConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

process.on('SIGINT', async () => {
  await closeMongoDBConnection();
  process.exit(0);
});
