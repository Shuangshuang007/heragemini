/**
 * Hot Jobs 配置
 * 定义热门职位和城市组合，这些组合将优先从MongoDB获取数据
 */

import { cityOptionsMap } from './cities';

// 从 Profile 下拉菜单中提取所有城市（cityOptionsMap）
let cachedProfileCities: string[] | null = null;

/**
 * 从 Profile 下拉菜单（cityOptionsMap）中提取所有城市
 * @returns 所有城市的 value 数组
 */
function getAllProfileCities(): string[] {
  if (cachedProfileCities !== null) {
    return cachedProfileCities;
  }

  const cities: string[] = [];
  
  // 从 cityOptionsMap 中提取所有城市的 value
  Object.values(cityOptionsMap).forEach(countryCities => {
    countryCities.forEach(city => {
      if (city.value && !cities.includes(city.value)) {
        cities.push(city.value);
      }
    });
  });

  cachedProfileCities = cities;
  return cities;
}

/**
 * 规范化城市名称用于匹配
 * 处理各种格式：Sydney, Sydney NSW, sydney_nsw, New York, New York, NY 等
 */
function normalizeCityForMatch(city: string): string {
  if (!city) return '';
  
  // 转换为小写
  let normalized = city.toLowerCase().trim();
  
  // 移除州/省/国家后缀（如 ", NSW", ", NY", ", VIC" 等）
  normalized = normalized.replace(/,\s*[a-z]{2,3}$/i, '');
  
  // 移除下划线格式（如 sydney_nsw -> sydney）
  normalized = normalized.replace(/_/g, ' ');
  
  // 移除多余空格
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Hot Jobs 配置
export const HOT_JOBS_CONFIG = {
  // 支持的城市（已废弃，现在从 cityOptionsMap 动态提取）
  supportedCities: ['sydney', 'melbourne'],
  
  // 精确匹配的热门职位
  exactMatches: [
    'Software Engineer',
    'Data Scientist', 
    'Business Analyst',
    'Project Manager',
    'Marketing Manager',
    'Sales Representative',
    'Accountant',
    'Financial Analyst',
    'Human Resources Manager',
    'Operations Manager',
    'Product Manager',
    'UX Designer',
    'Graphic Designer',
    'Content Writer',
    'Social Media Manager',
    'Digital Marketing Specialist',
    'IT Support Specialist',
    'Network Administrator',
    'Database Administrator',
    'DevOps Engineer',
    'Quality Assurance Engineer',
    'Business Development Manager',
    'Legal Counsel',
    'Administrative Assistant',
    'Executive Assistant',
    'Office Manager',
    'Supply Chain Manager',
    'Logistics Coordinator',
    'Retail Manager',
    'Store Manager',
    'Event Planner',
    'Public Relations Specialist',
    'Communications Manager',
    'Research Scientist',
    'Environmental Scientist',
    'Real Estate Agent',
    'Insurance Broker',
    'Compliance Officer',
    'Investment Banker',
    'Financial Advisor',
    'Customer Success Manager',
    'Technical Support Engineer',
    'Systems Administrator',
    'Security Engineer',
    'Cloud Architect',
    'Machine Learning Engineer',
    'AI Research Scientist',
    'Blockchain Developer',
    'Mobile App Developer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Game Developer',
    'UI Designer',
    'Product Designer',
    'Construction Manager',
    'Environmental Engineer',
    'Chemical Engineer',
    'Aerospace Engineer',
    'Robotics Engineer',
    'Network Engineer',
    'Security Analyst',
    'Data Analyst',
    'Business Intelligence Analyst',
    'Market Research Analyst',
    'Management Consultant',
    'Strategy Consultant',
    'IT Consultant',
    'Talent Acquisition Specialist',
    'Recruiter',
    'Financial Controller',
    'Chief Financial Officer',
    'Chief Technology Officer',
    'Chief Information Officer',
    'Chief Operating Officer',
    'Chief Executive Officer',
    'Creative Director',
    'University Professor',
    'Lecturer',
    'Psychologist',
    'Therapist',
    'Social Worker',
    'Graduate Program',
    'Internship Program'
  ],
  
  // 模糊匹配关键词
  fuzzyMatchKeywords: [
    'engineer',
    'developer', 
    'manager',
    'analyst',
    'specialist',
    'consultant',
    'director',
    'officer',
    'coordinator',
    'assistant',
    'scientist',
    'designer',
    'architect',
    'administrator',
    'support',
    'advisor',
    'planner',
    'supervisor',
    'lead',
    'service',
    'representative',
    'agent',
    'broker',
    'counselor',
    'therapist',
    'teacher',
    'lecturer',
    'professor',
    'nurse',
    'doctor',
    'dentist',
    'lawyer',
    'accountant',
    'banker',
    'trader',
    'investor',
    'marketer',
    'sales',
    'recruiter',
    'hr',
    'human',
    'resources',
    'operations',
    'logistics',
    'supply',
    'chain',
    'retail',
    'store',
    'restaurant',
    'hotel',
    'event',
    'public',
    'relations',
    'communications',
    'research',
    'laboratory',
    'environmental',
    'sustainability',
    'real',
    'estate',
    'property',
    'insurance',
    'claims',
    'risk',
    'compliance',
    'audit',
    'tax',
    'investment',
    'financial',
    'fund',
    'portfolio',
    'credit',
    'loan',
    'mortgage',
    'bank',
    'branch',
    'customer',
    'success',
    'technical',
    'systems',
    'security',
    'cloud',
    'machine',
    'learning',
    'ai',
    'artificial',
    'intelligence',
    'blockchain',
    'mobile',
    'app',
    'frontend',
    'backend',
    'full',
    'stack',
    'game',
    'ui',
    'product',
    'industrial',
    'fashion',
    'interior',
    'landscape',
    'urban',
    'construction',
    'site',
    'quantity',
    'surveyor',
    'building',
    'inspector',
    'safety',
    'environmental',
    'chemical',
    'mining',
    'petroleum',
    'aerospace',
    'automotive',
    'robotics',
    'control',
    'telecommunications',
    'network',
    'penetration',
    'tester',
    'forensic',
    'data',
    'business',
    'intelligence',
    'market',
    'actuary',
    'statistician',
    'economist',
    'policy',
    'management',
    'strategy',
    'it',
    'information',
    'technology',
    'talent',
    'acquisition',
    'recruitment',
    'compensation',
    'benefits',
    'payroll',
    'chief',
    'executive',
    'creative',
    'art',
    'music',
    'film',
    'theatre',
    'museum',
    'gallery',
    'library',
    'school',
    'university',
    'college',
    'academic',
    'teaching',
    'tutor',
    'educational',
    'curriculum',
    'instructional',
    'e-learning',
    'education',
    'student',
    'admissions',
    'career',
    'guidance',
    'psychologist',
    'psychiatrist',
    'social',
    'worker',
    'child',
    'care',
    'elderly',
    'disability',
    'mental',
    'health',
    'community',
    'public',
    'health',
    'promotion',
    'occupational',
    'food',
    'quality',
    'control',
    'graduate',
    'internship',
    'program',
    'trainee',
    'entry'
  ],
  
  // MongoDB查询限制
  maxJobsPerQuery: 600,
  
  // 是否启用模糊匹配
  enableFuzzyMatch: true,
  
  // 模糊匹配的相似度阈值
  fuzzyMatchThreshold: 0.7
};

import { generateJobPlanFromGPT, UserProfile } from '../gpt-services/JobPlan/generateJobPlan';
import { buildAndExecuteQuery } from '../lib/dbsearchqueryBuilder';
import { greaterAreaMap } from '../utils/greaterAreaMap';

/**
 * 新版 Hot Jobs 查询：GPT推荐+MongoDB统一模糊查询
 * @param profile 用户Profile（需包含targetTitle, city等）
 * @returns { jobs, summary }
 */
export async function getHotJobsQuery(profile: UserProfile) {
  // 1. 调用GPT推荐服务
  const gptResult = await generateJobPlanFromGPT(profile);
  
  // 2. 从localStorage获取原始Profile的jobTitle
  let originalTitle = '';
  if (typeof window !== 'undefined') {
    try {
      const userProfileStr = localStorage.getItem('userProfile');
      const originalProfile = userProfileStr ? JSON.parse(userProfileStr) : {};
      originalTitle = originalProfile.jobTitle?.[0] || profile.targetTitle || '';
    } catch (error) {
      console.warn('Failed to get original jobTitle from localStorage:', error);
      originalTitle = profile.targetTitle || '';
    }
  } else {
    originalTitle = profile.targetTitle || '';
  }
  
  // 3. 组合所有titles：原始title + GPT生成的titles
  const gptTitles = [...gptResult.primaryTitles, ...gptResult.secondaryTitles];
  const allTitles = originalTitle ? [originalTitle, ...gptTitles] : gptTitles;
  
  const city = profile.city;

  // 4. 构建扩展搜索组合
  // 从城市名称中提取基础城市名（去除州/省缩写）
  // 例如: "New York, NY" -> "New York", "Sydney, NSW" -> "Sydney"
  const baseCityName = city.match(/^(.+?),\s*[A-Z]{2,3}$/)?.[1]?.trim() || city.trim();
  const greaterArea = greaterAreaMap[baseCityName] || greaterAreaMap[city];
  
  const locationList = greaterArea 
    ? [...greaterArea.core, ...greaterArea.fringe]
    : [city];
  
  // 构建搜索组合：每个职位标题 × 每个位置
  const searchPairs = allTitles.flatMap(title =>
    locationList.map(loc => ({
      title,
      location: loc
    }))
  );

  // 5. 构建并执行MongoDB查询（使用所有titles）
  const jobs = await buildAndExecuteQuery(allTitles, city);

  // 6. 根据title优先级调整matchScore
  const adjustedJobs = jobs.map(job => {
    let adjustedScore = job.matchScore || 75;
    
    // 检查是否匹配原始title（不扣分）
    if (originalTitle && job.title.toLowerCase().includes(originalTitle.toLowerCase())) {
      // 保持原分数，不扣分
    }
    // 检查是否匹配primary titles（-3分）
    else if (gptResult.primaryTitles.some(title => 
      job.title.toLowerCase().includes(title.toLowerCase())
    )) {
      adjustedScore = Math.max(adjustedScore - 3, 50); // 最低50分
    }
    // 检查是否匹配secondary titles（-5分）
    else if (gptResult.secondaryTitles.some(title => 
      job.title.toLowerCase().includes(title.toLowerCase())
    )) {
      adjustedScore = Math.max(adjustedScore - 5, 50); // 最低50分
    }
    
    return {
      ...job,
      matchScore: adjustedScore
    };
  });

  // 7. 返回调整后的结果和GPT推荐摘要
  return {
    jobs: adjustedJobs, // 返回调整分数后的jobs
    summary: gptResult.summarySentences,
    reasoning: gptResult.reasoning,
    searchStrategy: gptResult.searchStrategy,
    searchPairs
  };
}

/**
 * 判断是否为Hot Job
 * @param jobTitle 职位名称
 * @param city 城市
 * @returns 是否为Hot Job
 */
export function isHotJob(jobTitle: string, city: string): boolean {
  if (!jobTitle || !city) {
    return false;
  }

  // 1. 从 Profile 下拉菜单中提取所有城市
  const profileCities = getAllProfileCities();
  
  // 2. 规范化输入的城市名称
  const normalizedInputCity = normalizeCityForMatch(city);
  
  // 3. 检查城市是否在 Profile 城市列表中（宽松匹配）
  const isHotCity = profileCities.some(profileCity => {
    const normalizedProfileCity = normalizeCityForMatch(profileCity);
    
    // 精确匹配或包含匹配
    return normalizedInputCity === normalizedProfileCity ||
           normalizedInputCity.includes(normalizedProfileCity) ||
           normalizedProfileCity.includes(normalizedInputCity);
  });

  if (!isHotCity) {
    // 如果不在 Profile 城市列表中，使用原有逻辑作为 fallback
    const cityStr = city.toLowerCase();
    const isLegacyHotCity = /sydney/.test(cityStr) || /melbourne/.test(cityStr);
    if (!isLegacyHotCity) {
    return false;
    }
  }
  
  // 4. 检查职位匹配（保留原有逻辑）
  const normalizedJobTitle = jobTitle.toLowerCase();
  const exactMatch = HOT_JOBS_CONFIG.exactMatches.some(
    hotJob => hotJob.toLowerCase() === normalizedJobTitle
  );
  
  if (exactMatch) {
    return true;
  }
  
  // 检查关键词匹配
  if (HOT_JOBS_CONFIG.enableFuzzyMatch) {
    const keywordMatch = HOT_JOBS_CONFIG.fuzzyMatchKeywords.some(
      keyword => normalizedJobTitle.includes(keyword.toLowerCase())
    );
    if (keywordMatch) {
      return true;
    }
  }
  
  return false;
} 
