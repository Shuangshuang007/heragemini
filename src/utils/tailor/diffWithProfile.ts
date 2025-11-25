import { PersonalInfo } from '@/types/profile';
import { Job } from '@/types/job';
import { normalizeWorkingRightsAU, meetsWorkingRightsRequirement } from '@/utils/tailor/workingRights';

/**
 * 比对 JD 必要条件和用户 Profile，返回匹配和缺失的关键词
 * 直接使用 Job 中已经提取和标准化的 requirements 数据
 * @param job - Job 对象，包含 requirements 数据
 * @param profile - 用户 Profile
 * @returns { met: string[], missing: string[] } 匹配和缺失的关键词
 */
export function diffWithProfile(job: Job, profile: PersonalInfo) {
  const met: string[] = [];
  const missing: string[] = [];

  // 如果没有用户 Profile，所有条件都标记为缺失
  if (!profile) {
    // 获取所有 requirements 并标记为缺失
    const allRequirements = [
      ...(job.keyRequirements || []),
      ...(job.skillsMustHave || []),
      ...(job.skillsNiceToHave || []),
      ...(job.requirements || []),
      ...(job.skills || [])
    ];
    return { met, missing: allRequirements };
  }

  // 获取 Job 的 requirements 数据，按优先级排序
  const jobRequirements: string[] = [];
  
  // 1. 优先使用 keyRequirements（已经过标准化处理）
  if (job.keyRequirements && job.keyRequirements.length > 0) {
    jobRequirements.push(...job.keyRequirements);
  }
  
  // 2. 其次使用结构化 skills
  if (job.skillsMustHave && job.skillsMustHave.length > 0) {
    jobRequirements.push(...job.skillsMustHave);
  }
  if (job.skillsNiceToHave && job.skillsNiceToHave.length > 0) {
    jobRequirements.push(...job.skillsNiceToHave);
  }
  
  // 3. 如果仍为空，使用 legacy requirements
  if (jobRequirements.length === 0 && job.requirements && job.requirements.length > 0) {
    jobRequirements.push(...job.requirements);
  }
  
  // 4. 最后使用 legacy skills
  if (jobRequirements.length === 0 && job.skills && job.skills.length > 0) {
    jobRequirements.push(...job.skills);
  }

  // 如果没有 requirements，直接返回空结果
  if (jobRequirements.length === 0) {
    return { met, missing };
  }

  // 用户工作权利（兼容两个字段名）
  const userWRRaw = (profile?.workingRightsAU || (profile as any)?.WR_AU || '') as string;

  // 在 jobRequirements 中找是否有 WR 相关要求
  const wrReq = jobRequirements.find((r) =>
    /citizen|permanent\s*resident|full.*work\s*rights|工作权利|公民|永居/i.test(String(r))
  );

  if (wrReq) {
    if (meetsWorkingRightsRequirement(String(wrReq), userWRRaw)) {
      met.push('Working rights (AU)');   // 只放说明性条目，不加入技能池
    } else {
      missing.push('Working rights (AU)');
    }
  }

  // 构建用户 Profile 的关键词集合（用于快速查找）
  const profileKeywords = new Set<string>();

  // 从技能中提取关键词
  if (profile.skills && Array.isArray(profile.skills)) {
    profile.skills.forEach(skill => {
      if (skill && skill.name && typeof skill.name === 'string') {
        profileKeywords.add(skill.name.toLowerCase().trim());
      }
    });
  }

  // 从工作经验中提取关键词
  if (profile.employment && Array.isArray(profile.employment)) {
    profile.employment.forEach(exp => {
      if (exp && exp.description) {
        const words = exp.description.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) { // 过滤掉太短的词
            profileKeywords.add(word.trim());
          }
        });
      }
      if (exp && exp.position) {
        profileKeywords.add(exp.position.toLowerCase().trim());
      }
      if (exp && exp.company) {
        profileKeywords.add(exp.company.toLowerCase().trim());
      }
    });
  }

  // 从教育背景中提取关键词
  if (profile.education && Array.isArray(profile.education)) {
    profile.education.forEach(edu => {
      if (edu && edu.degree) {
        profileKeywords.add(edu.degree.toLowerCase().trim());
      }
      if (edu && edu.field) {
        profileKeywords.add(edu.field.toLowerCase().trim());
      }
      if (edu && edu.school) {
        profileKeywords.add(edu.school.toLowerCase().trim());
      }
    });
  }

  // 从个人简介中提取关键词
  if (profile.about) {
    const words = profile.about.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        profileKeywords.add(word.trim());
      }
    });
  }

  // 从职业头衔中提取关键词
  if (profile.jobTitle && typeof profile.jobTitle === 'string') {
    profileKeywords.add(profile.jobTitle.toLowerCase().trim());
  }

  // 从专业简介中提取关键词
  if (profile.shortBio) {
    const words = profile.shortBio.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        profileKeywords.add(word.trim());
      }
    });
  }

  // 比对每个 Job requirement
  jobRequirements.forEach(requirement => {
    if (!requirement || typeof requirement !== 'string') {
      return;
    }

    const reqLower = requirement.toLowerCase().trim();
    
    // 检查是否完全匹配
    if (profileKeywords.has(reqLower)) {
      met.push(requirement);
      return;
    }

    // 检查部分匹配（包含关系）
    let isMatched = false;
    for (const profileKeyword of profileKeywords) {
      if (reqLower.includes(profileKeyword) || profileKeyword.includes(reqLower)) {
        met.push(requirement);
        isMatched = true;
        break;
      }
    }

    // 如果没有匹配，标记为缺失
    if (!isMatched) {
      missing.push(requirement);
    }
  });

  return { met, missing };
}

/**
 * 获取 Job 的标准化 requirements 列表
 * 使用与 JobSummaryCard 相同的逻辑
 * @param job - Job 对象
 * @returns 标准化的 requirements 数组
 */
export function getJobRequirements(job: Job): string[] {
  const requirements: string[] = [];
  
  // 1. 优先使用 keyRequirements
  if (job.keyRequirements && job.keyRequirements.length > 0) {
    requirements.push(...job.keyRequirements);
  }
  
  // 2. 然后使用结构化技能
  if (job.skillsMustHave && job.skillsMustHave.length > 0) {
    requirements.push(...job.skillsMustHave);
  }
  if (job.skillsNiceToHave && job.skillsNiceToHave.length > 0) {
    requirements.push(...job.skillsNiceToHave);
  }
  
  // 3. 如果没有结构化字段，使用 legacy requirements
  if (requirements.length === 0 && job.requirements && job.requirements.length > 0) {
    requirements.push(...job.requirements);
  }
  
  // 4. 最后使用 legacy skills
  if (requirements.length === 0 && job.skills && job.skills.length > 0) {
    requirements.push(...job.skills);
  }
  
  return requirements;
}
