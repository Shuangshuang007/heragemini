import React, { useState, useEffect } from 'react';
import { PersonalInfo } from '@/types/profile';
import { Job } from '@/types/job';
import { diffWithProfile } from '@/utils/tailor/diffWithProfile';
import { formatTag, filterKeyRequirements } from '@/utils/tailor/tagUtils';
import { generateResumeHTML } from '@/utils/tailor/resumeHtmlGenerator';
import { normalizeExperienceTag } from '@/utils/employmentUtils';
import { EditableResumePreview } from './EditableResumePreview';
import { JobDetailPanel } from '@/components/JobDetailPanel';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { PaymentModal } from '@/components/PaymentModal';
import '@/styles/checkMode.css';

interface TailorPreviewProps {
  job: Job;
  userProfile: PersonalInfo;
  onGenerate: (previewData: any) => void;
  onCancel: () => void;
}

const formatJobLocation = (location: Job['location']) => {
  if (Array.isArray(location)) {
    return location.join(', ');
  }
  return location || '';
};

export function TailorPreview({ job: initialJob, userProfile, onGenerate, onCancel }: TailorPreviewProps) {
  // 重构后的状态管理
  const [isEditing, setIsEditing] = useState(true); // 默认开启编辑模式
  const [isTailoring, setIsTailoring] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckMode, setIsCheckMode] = useState(true); // 默认开启Check Required
  const [activePreview, setActivePreview] = useState<'editable' | 'pdf'>('editable'); // 当前面板类型
  const [review, setReview] = useState<any>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [editableData, setEditableData] = useState({
    summary: '',
    skills: [] as string[],
    experienceBullets: {} as Record<string, string[]>,
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    personalHighlights: [] as string[],
    experience: [] as any[],
    education: [] as any[]
  });
  const [isJobDetailsExpanded, setIsJobDetailsExpanded] = useState(false); // 新增：Job Details折叠状态
  
  // 控制Missing requirements提示条的状态
  const [missingRequirementsConfirmed, setMissingRequirementsConfirmed] = useState(false);
  
  // Cover Letter 相关状态
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [coverLetterContent, setCoverLetterContent] = useState('');
  const [isCoverLetterEditing, setIsCoverLetterEditing] = useState(true);
    const [coverLetterPreviewKey, setCoverLetterPreviewKey] = useState(0);
  
  // localStorage草稿管理
  const draftKey = `tailor_draft:${initialJob?.id || 'unknown'}`;
  
  // 订阅状态管理
  const premiumStatus = usePremiumStatus();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentErrorCode, setPaymentErrorCode] = useState<string>('');
  
  const [jobDetail, setJobDetail] = useState<Job | null>(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  // 只在 Job Details 展开时才 fetch 详细数据（避免不必要的 GPT 调用）
  useEffect(() => {
    let cancelled = false;
    
    // 如果 Job Details 未展开，不 fetch
    if (!isJobDetailsExpanded) {
      setJobDetail(null);
      setJobDetailLoading(false);
      return;
    }
    
    // 如果 Job Details 已展开，但还没有 job id，不 fetch
    if (!initialJob?.id) {
      return;
    }
    
    // ✅ 检查是否需要传递 userProfile（如果数据库没有 detailedSummary 或 matchAnalysis）
    const needsProfile = !initialJob.detailedSummary || !initialJob.matchAnalysis;
    
    // ✅ 准备 userProfile 参数（如果需要）
    let userProfileParam = '';
    if (needsProfile && userProfile) {
      try {
        // 只传递必要的字段
        // 从 employment 历史记录中提取当前职位（如果有）
        const currentEmployment = userProfile.employment?.find(emp => emp.isPresent) || userProfile.employment?.[0];
        const currentPosition = currentEmployment?.position || '';
        
        // expectedPosition 使用 jobTitle（期望职位）
        const expectedPosition = Array.isArray(userProfile.jobTitle) 
          ? userProfile.jobTitle[0] || '' 
          : (userProfile.jobTitle || '');
        
        const profileData = {
          skills: userProfile.skills || [],
          city: userProfile.city || '',
          seniority: userProfile.seniority || '',
          openToRelocate: userProfile.openForRelocation === 'yes',
          careerPriorities: userProfile.careerPriorities || [],
          expectedPosition: expectedPosition,
          currentPosition: currentPosition
        };
        userProfileParam = `?userProfile=${encodeURIComponent(JSON.stringify(profileData))}`;
      } catch (error) {
        console.warn('[TailorPreview] Failed to prepare userProfile:', error);
      }
    }
    
    setJobDetail(null);
    setJobDetailLoading(true);
    fetch(`/api/jobs/${initialJob.id}${userProfileParam}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setJobDetail(data.job);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[TailorPreview] Failed to load job detail:', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setJobDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialJob?.id, initialJob?.detailedSummary, initialJob?.matchAnalysis, isJobDetailsExpanded, userProfile]);

  const job = jobDetail || initialJob;
  
  // 调试：检查job对象
  console.log('🔍 TailorPreview - job对象:', {
    id: job?.id,
    title: job?.title,
    company: job?.company,
    hasId: !!job?.id,
    draftKey
  });
  
  // 保存完整状态到localStorage
  const saveDraft = () => {
    try {
      // 确保job和userProfile都存在
      if (!job || !userProfile) {
        console.warn('Cannot save draft: job or userProfile not ready');
        return;
      }
      
      // 获取完整的Missing Requirements信息
      const { met, missing } = diffWithProfile(job, userProfile);
      
      const draft = {
        editableData,
        coverLetterContent,
        missingRequirementsConfirmed,
        isEditing,
        isCoverLetterEditing,
        activePreview,
        isCheckMode,
        review,
        // 保存完整的Missing Requirements信息
        missingRequirements: {
          met: met.map(formatTag),
          missing: missing.map(formatTag)
        },
        // 保存Job requirements信息
        jobRequirements: {
          sourceReqs: sourceReqs,
          allReqs: allReqs
        },
        timestamp: new Date().toISOString()
      };
      
      // 每次保存都是覆盖，保存最新的完整状态
      localStorage.setItem(draftKey, JSON.stringify(draft));
      console.log('✓ 草稿已覆盖保存到localStorage:', draftKey);
    } catch (error) {
      console.warn('Failed to save draft to localStorage:', error);
    }
  };
  
  // 从localStorage恢复完整状态
  const loadDraft = () => {
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        
        // 恢复基本状态
        setEditableData(parsed.editableData);
        setCoverLetterContent(parsed.coverLetterContent);
        setMissingRequirementsConfirmed(parsed.missingRequirementsConfirmed);
        setIsEditing(parsed.isEditing);
        setIsCoverLetterEditing(parsed.isCoverLetterEditing);
        setActivePreview(parsed.activePreview);
        setIsCheckMode(parsed.isCheckMode);
        setReview(parsed.review);
        
        // 恢复Missing Requirements信息（如果有）
        if (parsed.missingRequirements) {
          console.log('✓ Missing Requirements已恢复:', parsed.missingRequirements);
        }
        
        // 恢复Job Requirements信息（如果有）
        if (parsed.jobRequirements) {
          console.log('✓ Job Requirements已恢复:', parsed.jobRequirements);
        }
        
        console.log('✓ 完整草稿已恢复:', draftKey);
        return true; // 有草稿
      }
    } catch (error) {
      console.warn('Failed to load draft from localStorage:', error);
    }
    return false; // 没有草稿
  };
  
  // 获取 Job requirements 并应用标准化逻辑
  const sourceReqs = job.keyRequirements?.length
    ? job.keyRequirements
    : job.skillsMustHave?.length
      ? job.skillsMustHave
    : job.requirements || [];
  const skills = job.skillsMustHave?.length
    ? job.skillsMustHave
    : job.skills || [];
  const niceSkills = job.skillsNiceToHave || [];
  const allReqs = [...filterKeyRequirements(sourceReqs), ...skills, ...niceSkills].map(formatTag);

  // 调用匹配函数
  const { met, missing } = diffWithProfile(job, userProfile);

  // 关键词对齐函数：用 JD 原词替换简历对应的短语
  const alignKeywords = (text: string, keywords: string[]): string => {
    let alignedText = text;
    keywords.forEach(keyword => {
      // 查找 Profile 中可能包含该关键词的短语
      const profilePhrases = findProfilePhrases(keyword, userProfile);
      profilePhrases.forEach(phrase => {
        // 只替换存在的短语
        if (alignedText.includes(phrase)) {
          alignedText = alignedText.replace(new RegExp(phrase, 'gi'), keyword);
        }
      });
    });
    return alignedText;
  };

  // 查找 Profile 中包含关键词的短语
  const findProfilePhrases = (keyword: string, profile: PersonalInfo): string[] => {
    const phrases: string[] = [];
    const keywordLower = keyword.toLowerCase();

    // 从技能中查找
    if (profile.skills) {
      profile.skills.forEach(skill => {
        if (skill.name?.toLowerCase().includes(keywordLower)) {
          phrases.push(skill.name);
        }
      });
    }

    // 从工作经验中查找
    if (profile.employment) {
      profile.employment.forEach(exp => {
        if (exp.position?.toLowerCase().includes(keywordLower)) {
          phrases.push(exp.position);
        }
        if (exp.description?.toLowerCase().includes(keywordLower)) {
          // 提取包含关键词的句子片段
          const sentences = exp.description.split(/[.!?]/);
          sentences.forEach(sentence => {
            if (sentence.toLowerCase().includes(keywordLower)) {
              phrases.push(sentence.trim());
            }
          });
        }
      });
    }

    // 从教育背景中查找
    if (profile.education) {
      profile.education.forEach(edu => {
        if (edu.degree?.toLowerCase().includes(keywordLower)) {
          phrases.push(edu.degree);
        }
        if (edu.field?.toLowerCase().includes(keywordLower)) {
          phrases.push(edu.field);
        }
      });
    }

    return phrases;
  };

  // 生成对齐后的 Summary
  const alignedSummary = userProfile.about 
    ? alignKeywords(userProfile.about, met)
    : userProfile.about;

  // 生成对齐后的 Skills（先渲染 met，再渲染其他技能）
  const alignedSkills = [
    ...met, // 先显示匹配的技能
    ...(userProfile.skills || [])
      .map(skill => skill.name)
      .filter(skillName => !met.includes(skillName)) // 过滤掉已经在 met 中的技能
  ];

  // 生成与 PDF 完全一致的简历数据
  const generateResumeData = () => {
    const { met, missing } = diffWithProfile(job, userProfile);
    
    // 构建与 PDF 生成完全一致的数据结构
    const resumeData = {
      profile: {
        name: editableData.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        email: editableData.email || userProfile.email || '',
        phone: editableData.phone || userProfile.phone || '',
        location: editableData.location || (userProfile.city ? `${userProfile.city}, ${userProfile.country || ''}` : userProfile.country || ''),
        title: '' // 不设置 title，避免与 personalHighlights 重复
      },
      linkedin: userProfile.linkedin || '',
      personalHighlights: editableData.personalHighlights || (userProfile.about ? 
        userProfile.about.split('\n')
          .filter((line: string) => line.trim())
          .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim()) : 
        ['Professional highlights and achievements']),
      summary: editableData.summary || alignedSummary || '',
      experience: editableData.experience && editableData.experience.length > 0 ? editableData.experience : (userProfile.employment || []).map((job: any) => ({
        title: job.position || job.title || '',
        company: job.company || '',
        location: formatJobLocation(job.location),
        startDate: job.startDate || '',
        endDate: job.isPresent ? 'Present' : job.endDate || '',
        description: job.description || '',
        bullets: job.description ? 
          job.description.split('\n')
            .filter((line: string) => line.trim())
            .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim()) : 
          ['Key responsibilities and achievements']
      })),
      education: (userProfile.education || []).map((edu: any) => ({
        degree: edu.degree || '',
        institution: edu.school || '',
        location: typeof edu.location === 'string' ? edu.location : '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        field: edu.field || '',
        description: Array.isArray(edu.summary) ? edu.summary : (edu.summary ? [edu.summary] : [])
      })),
      skills: editableData.skills || [],
      languages: (userProfile.languages || []).filter((lang: any, index: number, arr: any[]) => {
        // 去重逻辑：基于 language 和 level 的组合去重
        if (typeof lang === 'object' && lang.language) {
          const firstIndex = arr.findIndex(item => 
            typeof item === 'object' && 
            item.language === lang.language && 
            item.level === lang.level
          );
          return firstIndex === index;
        } else if (typeof lang === 'string') {
          const firstIndex = arr.findIndex(item => item === lang);
          return firstIndex === index;
        }
        return true;
      }).map((lang: any) => {
        // 标准化语言数据格式，确保与 PDF 生成一致
        if (typeof lang === 'object' && lang.language) {
          return {
            language: lang.language,
            level: lang.level || 'Basic'
          };
        } else if (typeof lang === 'string') {
          return {
            language: lang,
            level: 'Basic'
          };
        } else {
          return {
            language: 'Unknown Language',
            level: 'Basic'
          };
        }
      }),
      workingRightsAU: userProfile?.workingRightsAU || userProfile?.workingRightsOther || ''
    };
    
    // 确保所有必要字段都存在且不为 undefined
    const sanitizedData = {
      profile: {
        name: resumeData.profile.name || 'Resume',
        email: resumeData.profile.email || '',
        phone: resumeData.profile.phone || '',
        location: resumeData.profile.location || '',
        title: resumeData.profile.title || ''
      },
      linkedin: resumeData.linkedin || '',
      personalHighlights: Array.isArray(resumeData.personalHighlights) ? resumeData.personalHighlights : [],
      summary: resumeData.summary || '',
      experience: Array.isArray(resumeData.experience) ? resumeData.experience.map((job: any) => ({
        title: job.title || '',
        company: job.company || '',
        location: formatJobLocation(job.location),
        startDate: job.startDate || '',
        endDate: job.endDate || '',
        description: job.description || '',
        bullets: Array.isArray(job.bullets) ? job.bullets : (job.bullets ? [job.bullets] : [])
      })) : [],
      education: Array.isArray(resumeData.education) ? resumeData.education.map((edu: any) => ({
        degree: edu.degree || '',
        institution: edu.institution || '',
        location: typeof edu.location === 'string' ? edu.location : '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        field: edu.field || '',
        description: Array.isArray(edu.description) ? edu.description : (edu.description ? [edu.description] : [])
      })) : [],
      skills: Array.isArray(resumeData.skills) ? resumeData.skills : [],
      languages: Array.isArray(resumeData.languages) ? resumeData.languages.map((lang: any) => {
        // 确保 Languages 数据格式完全一致
        if (typeof lang === 'object' && lang.language) {
          return {
            language: lang.language,
            level: lang.level || 'Basic'
          };
        } else if (typeof lang === 'string') {
          return {
            language: lang,
            level: 'Basic'
          };
        } else {
          return {
            language: 'Unknown Language',
            level: 'Basic'
          };
        }
      }) : [],
      workingRightsAU: resumeData.workingRightsAU || ''
    };
    
    return sanitizedData;
  };

  // 从 Job 信息中提取关键 highlights 的函数
  const extractKeyHighlights = (jobText: string): string[] => {
    // 常见的技能关键词
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
    
    // 限制到8-12条
    return foundSkills.slice(0, 12);
  };

  // 构建硬性要求列表（用于ATS匹配）
  const buildRequiredList = (job: any, highlightsResult?: any): string[] => {
    const requiredList: string[] = [];
    
    // 1. 经验年限：来自已有的experienceTag
    const experienceTag = (job.tags || []).find((tag: string) => 
      /experience|graduate|entry level|senior|junior|mid-level|middle level|lead/i.test(tag)
    );
    if (experienceTag) {
      const normalized = normalizeExperienceTag(experienceTag);
      if (normalized && normalized !== 'Experience required') {
        // 规范化为标准格式："5+ years experience"
        const match = normalized.match(/(\d{1,2})\+?\s*y\s*experience/i);
        if (match) {
          const years = match[1];
          requiredList.push(`${years}+ years experience`);
        }
      }
    }
    
    // 2. 硬技能/要求：合并多个来源
    const hardSkills: string[] = [];
    
    // 优先使用keyRequirements
    if (job.keyRequirements && job.keyRequirements.length > 0) {
      hardSkills.push(...job.keyRequirements);
    }
    
    // 合并skills和requirements
    const allSkills = [
      ...(job.skills || []),
      ...(job.requirements || [])
    ];
    const filteredSkills = filterKeyRequirements(allSkills);
    hardSkills.push(...filteredSkills);
    
    // 如果有Highlights Summary的Key Requirements，也合并
    if (highlightsResult?.keyRequirements) {
      hardSkills.push(...highlightsResult.keyRequirements);
    }
    
    // 去重并格式化
    const uniqueSkills = [...new Set(hardSkills)].map(formatTag);
    requiredList.push(...uniqueSkills);
    
    // 3. 工作权利/法律要求：从JD描述中提取
    const jdText = [
      job.description || '',
      job.summary || '',
      job.detailedSummary || ''
    ].join(' ').toLowerCase();
    
    // 澳大利亚工作权利关键词
    const workingRightsPatterns = [
      /australian\s+(citizenship|citizen|pr|permanent\s+resident)/gi,
      /(nv1|nv2|baseline|negative\s+vetting|security\s+clearance)/gi,
      /work(ing)?\s+rights\s+in\s+australia/gi
    ];
    
    workingRightsPatterns.forEach(pattern => {
      const matches = jdText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = match.replace(/\s+/g, ' ').trim();
          if (normalized && !requiredList.includes(normalized)) {
            requiredList.push(normalized);
          }
        });
      }
    });
    
    // 4. 统一规范化 & 去重
    const normalizedList = requiredList.map(formatTag);
    
    // 规范化键去重（不改变显示值）
    const normalizedMap = new Map<string, string>();
    normalizedList.forEach(item => {
      const normKey = item.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      if (!normalizedMap.has(normKey)) {
        normalizedMap.set(normKey, item);
      }
    });
    
    const finalList = Array.from(normalizedMap.values());
    
    // 5. 数量上限控制（优先保留：经验年限 > 工作权利 > 技术/认证）
    if (finalList.length > 20) {
      const experienceItems = finalList.filter(item => /years?\s+experience/i.test(item));
      const workingRightsItems = finalList.filter(item => 
        /citizenship|pr|clearance|work\s+rights/i.test(item)
      );
      const skillItems = finalList.filter(item => 
        !/years?\s+experience|citizenship|pr|clearance|work\s+rights/i.test(item)
      );
      
      const priorityItems = [...experienceItems, ...workingRightsItems];
      const remainingSlots = 20 - priorityItems.length;
      const selectedSkills = skillItems.slice(0, Math.max(0, remainingSlots));
      
      return [...priorityItems, ...selectedSkills];
    }
    
    return finalList;
  };

  // 生成预览 HTML
  const previewHtml = generateResumeHTML(generateResumeData());

  // 处理 Tailor Resume
  const handleTailorResume = async () => {
    try {
      setIsTailoring(true);
      
      // 获取当前预览的完整数据
      const currentResumeData = generateResumeData();
      
      // 构建完整的 Job 信息，让 GPT 能看到所有上下文
      const jobContext = {
        title: job.title,
        company: job.company,
        location: formatJobLocation(job.location),
        description: job.description || '',
        summary: job.summary || '',
        detailedSummary: job.detailedSummary || '',
        requirements: job.requirements || [],
        skills: job.skills || [],
        keyRequirements: job.keyRequirements || []
      };
      
      // 从完整信息中提取 highlights
      const allJobInfo = [
        job.description || '',
        job.summary || '',
        job.detailedSummary || '',
        job.experience || '',           // 添加经验要求
        job.employmentType || '',       // 添加雇佣类型
        job.workMode || '',            // 添加工作模式
        ...(job.tags || []),           // 添加所有标签（包括经验级别）
        ...(job.requirements || []),
        ...(job.skills || []),
        ...(job.keyRequirements || [])
      ].filter(Boolean).join(' ');
      
      // 提取关键技能和短语（8-12条）
      const extractedHighlights = extractKeyHighlights(allJobInfo);
      
      // 构建硬性要求列表（用于ATS匹配）
      const requiredList = buildRequiredList(job);
      
      console.log('🔍 Job 完整信息:', jobContext);
      console.log('🔍 提取的 highlights:', extractedHighlights);
      console.log('🔍 硬性要求列表:', requiredList);
      
      // 调试：显示发送的数据
      console.log('🚀 Tailor Resume - 发送数据:', {
        resumeJson: currentResumeData,
        jobUrl: job.url || job.id || '',
        highlights: extractedHighlights,
        highlightsCount: extractedHighlights.length,
        requiredList: requiredList
      });
      
      // 调用 /api/tailor
      
      // 调用 /api/tailor
      const response = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeJson: currentResumeData,
          jobUrl: job.url || job.id || '',
          highlights: extractedHighlights,
          jdSummary: job.summary || job.description || job.detailedSummary || '',
          requiredList: requiredList
        })
      });
      
      if (!response.ok) {
        throw new Error('Tailor failed');
      }
      
      const newResumeData = await response.json();
      
      // 调试：显示 GPT 返回的数据
      console.log('✅ GPT 返回数据:', newResumeData);
      console.log('🔄 更新前的 editableData:', editableData);
      
      // 回填前：打印关键字段的"前后对比"
      console.log('📊 回填前 - 关键字段状态:', {
        summary: editableData.summary?.substring(0, 200) + '...',
        experienceCount: editableData.experience?.length || 0,
        skillsCount: editableData.skills?.length || 0,
        experienceBullets: editableData.experience?.map((exp: any, i: number) => ({
          index: i,
          bulletsLength: exp.bullets?.length || 0,
          firstBullet: exp.bullets?.[0]?.substring(0, 100) + '...'
        })) || []
      });
      
      // 整份替换预览数据（不要浅合并）
      setEditableData({
        summary: newResumeData.summary || '',
        skills: newResumeData.skills || [],
        experienceBullets: {}, // 重置 experienceBullets
        name: newResumeData.profile?.name || '',
        email: newResumeData.profile?.email || '',
        phone: newResumeData.profile?.phone || '',
        location: newResumeData.profile?.location || '',
        linkedin: newResumeData.linkedin || '',
        personalHighlights: newResumeData.personalHighlights || [],
        experience: newResumeData.experience || [],
        education: newResumeData.education || []
      });
      
      // 调试：确认所有字段都被正确更新
      console.log('🔧 字段更新确认:', {
        summary: newResumeData.summary?.substring(0, 50) + '...',
        skillsCount: newResumeData.skills?.length || 0,
        experienceCount: newResumeData.experience?.length || 0,
        firstExperienceBullets: newResumeData.experience?.[0]?.bullets?.length || 0,
        secondExperienceBullets: newResumeData.experience?.[1]?.bullets?.length || 0,
        educationCount: newResumeData.education?.length || 0,
        personalHighlightsCount: newResumeData.personalHighlights?.length || 0
      });
      
      // 回填后：打印关键字段的"前后对比"
      console.log('📊 回填后 - 关键字段状态:', {
        summary: newResumeData.summary?.substring(0, 200) + '...',
        experienceCount: newResumeData.experience?.length || 0,
        skillsCount: newResumeData.skills?.length || 0,
        experienceBullets: newResumeData.experience?.map((exp: any, i: number) => ({
          index: i,
          bulletsLength: exp.bullets?.length || 0,
          firstBullet: exp.bullets?.[0]?.substring(0, 100) + '...'
        })) || []
      });
      
      // 最小自测：检查是否真的改写了
      console.log('🧪 最小自测结果:', {
        // 1. 新的 summary 前 120 字
        newSummary: newResumeData.summary?.substring(0, 120) + '...',
        // 2. 最近两段经历的 bullet 数量
        exp0BulletsCount: newResumeData.experience?.[0]?.bullets?.length || 0,
        exp1BulletsCount: newResumeData.experience?.[1]?.bullets?.length || 0,
        // 3. 第一条 bullet 是否与输入不同
        exp0FirstBullet: newResumeData.experience?.[0]?.bullets?.[0]?.substring(0, 100) + '...',
        originalFirstBullet: editableData.experience?.[0]?.bullets?.[0]?.substring(0, 100) + '...',
        // 4. 验证信号
        experienceCount: newResumeData.experience?.length || 0,
        skillsCount: newResumeData.skills?.length || 0
      });
      
      // 静默调用 Check Required
      try {
        const checkResponse = await fetch('/api/required-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeJson: newResumeData,
            jobRequirements: {
              required: job.keyRequirements || [],
              niceToHave: job.skills || [],
              jdSummary: job.summary || job.description || ''
            }
          })
        });
        
        if (checkResponse.ok) {
          const checkResult = await checkResponse.json();
          setReview(checkResult.review);
          console.log('🔍 Auto Check Required Result:', checkResult.review);
        }
      } catch (checkError) {
        console.log('🔍 Auto Check Required failed (non-critical):', checkError);
      }
      
    } catch (error) {
      console.error('Tailor failed:', error);
      // 提示失败，不改现有预览
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('Tailor failed. Please try again.', 'error');
      }
    } finally {
      setIsTailoring(false);
    }
  };

  // 初始化编辑数据 - 只在组件首次渲染时执行
  useEffect(() => {
    setEditableData({
      summary: alignedSummary || '',
      skills: alignedSkills,
      experienceBullets: {},
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      personalHighlights: userProfile.about ? 
        userProfile.about.split('\n')
          .filter((line: string) => line.trim())
          .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim()) : 
        ['Professional highlights and achievements'],
      experience: [],
      education: []
    });
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 当组件挂载时，优先检查草稿，没有草稿才调用GPT
  useEffect(() => {
    const initializeComponent = async () => {
      // 1. 先检查localStorage草稿
      const hasDraft = loadDraft();
      
      if (hasDraft) {
        // 有草稿：直接恢复，跳过GPT
        console.log('✓ 草稿已恢复，跳过GPT调用');
        setPreviewKey(prev => prev + 1);
      } else {
        // 没有草稿：调用GPT生成
        console.log('🔄 没有草稿，调用GPT生成');
        await handleTailorResume();
        await handleCheckRequired();
        
        // 延迟保存初始状态到草稿，等状态稳定后再保存
        setTimeout(() => saveDraft(), 500);
      }
      
      // 2. 确保状态正确初始化
      setIsEditing(true);
      setIsCheckMode(true);
      setActivePreview('editable');
      
      console.log('🚀 组件初始化完成:', {
        isEditing: true,
        isCheckMode: true,
        activePreview: 'editable',
        hasDraft
      });
    };
    
    initializeComponent();
  }, [job, userProfile]); // 依赖job和userProfile，确保它们准备好后再执行

  // 内部 Check Required 函数 - 不再暴露为按钮，仅在初始化时调用
  const handleCheckRequired = async () => {
    try {
      setIsChecking(true);
      
      // 获取当前简历数据
      const currentResumeData = generateResumeData();
      
      // 调用 required-check API
      const response = await fetch('/api/required-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeJson: currentResumeData,
          jobRequirements: {
            required: job.keyRequirements || [],
            niceToHave: job.skills || [],
            jdSummary: job.summary || job.description || ''
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Check failed');
      }
      
      const checkResult = await response.json();
      setReview(checkResult.review);
      
      console.log('🔍 Auto Check Required Result:', checkResult.review);
      
    } catch (error) {
      console.error('Check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };



  // 处理技能编辑
  const handleSkillEdit = (index: number, value: string) => {
    const newSkills = [...editableData.skills];
    newSkills[index] = value;
    setEditableData(prev => ({ ...prev, skills: newSkills }));
    // 实时保存草稿
    setTimeout(() => saveDraft(), 100);
  };

  // 添加新技能
  const addSkill = () => {
    setEditableData(prev => ({ 
      ...prev, 
      skills: [...prev.skills, 'New Skill'] 
    }));
    // 实时保存草稿
    setTimeout(() => saveDraft(), 100);
  };

  // 删除技能
  const removeSkill = (index: number) => {
    const newSkills = editableData.skills.filter((_, i) => i !== index);
    setEditableData(prev => ({ ...prev, skills: newSkills }));
    // 实时保存草稿
    setTimeout(() => saveDraft(), 100);
  };

  // 处理 bullet 编辑
  const handleBulletEdit = (expIndex: number, bulletIndex: number, value: string) => {
    const currentBullets = editableData.experienceBullets[expIndex] || [];
    const newBullets = [...currentBullets];
    newBullets[bulletIndex] = value;
    
    setEditableData(prev => ({
      ...prev,
      experienceBullets: {
        ...prev.experienceBullets,
        [expIndex]: newBullets
      }
    }));
  };

  // 添加新 bullet
  const addBullet = (expIndex: number) => {
    const currentBullets = editableData.experienceBullets[expIndex] || [];
    const newBullets = [...currentBullets, 'New bullet point'];
    
    setEditableData(prev => ({
      ...prev,
      experienceBullets: {
        ...prev.experienceBullets,
        [expIndex]: newBullets
      }
    }));
  };

  // 删除 bullet
  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const currentBullets = editableData.experienceBullets[expIndex] || [];
    const newBullets = currentBullets.filter((_, i) => i !== bulletIndex);
    
    setEditableData(prev => ({
      ...prev,
      experienceBullets: {
        ...prev.experienceBullets,
        [expIndex]: newBullets
      }
    }));
  };

  // 重置编辑内容函数 - 保留但不暴露按钮（仅在DEV环境可用）
  const resetToOriginal = () => {
    setEditableData({
      summary: alignedSummary || '',
      skills: alignedSkills,
      experienceBullets: {},
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      personalHighlights: [],
      experience: [],
      education: []
    });
  };

  // 生成 Cover Letter 函数
  const generateCoverLetter = async () => {
    if (showCoverLetter) return; // 如果已经显示，直接返回
    
    setIsGeneratingCoverLetter(true);
    try {
      const resumeData = generateResumeData();
      const response = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData,
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.summary || job.description || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate cover letter');
      }

      const data = await response.json();
      
      // 格式化Cover Letter内容，使其具有更好的结构
      const formattedContent = formatCoverLetterContent(data.coverLetter, resumeData);
      setCoverLetterContent(formattedContent);
      setShowCoverLetter(true);
      setCoverLetterPreviewKey(prev => prev + 1);
    } catch (error) {
      console.error('Error generating cover letter:', error);
      alert('Failed to generate cover letter. Please try again.');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  // 清洗Cover Letter文本，去除重复内容
  const cleanCoverLetter = (raw: string) => {
    let text = raw.trim();

    // 1) 合并多余空行
    text = text.replace(/\n{3,}/g, "\n\n");

    // 2) 称呼重复：保留第一处 Dear ...，
    const dearRe = /(^|\n)Dear [^\n]+,\s*\n/gi;
    const matches = text.match(dearRe);
    if (matches && matches.length > 1) {
      // 去掉后续的 Dear...
      let firstIdx = text.indexOf(matches[0]) + matches[0].length;
      text = matches[0] + text.slice(firstIdx).replace(dearRe, "");
    }

    // 3) 落款重复：只保留一种 Sincerely 结尾
    const closingRe = /(Yours sincerely,|Yours faithfully,|Warm regards,|Kind regards,|Sincerely,)\s*\n/gi;
    const closings = [...text.matchAll(closingRe)];
    if (closings.length > 1) {
      // 保留最后一次，移除前面的
      const last = closings[closings.length - 1];
      text =
        text.slice(0, last.index!) +
        text.slice(last.index!).replace(closingRe, (m, _g, offset) =>
          offset === 0 ? m : ""
        );
    }

    // 4) 头部"Your Name / Address"占位行若与正文重复，去一份
    // 常见模板头部块清理（可按需扩展关键词）
    text = text.replace(
      /(?:Your Name|Your Address|Your Phone|your\.email@example\.com)[^\n]*\n/gi,
      ""
    );

    // 5) 清理重复的占位符和模板内容
    text = text.replace(
      /(?:\[\[\[City, State, Postcode\]|\[Email Address\]|\[Phone Number\]|\[Date\]|\[Office Address\]|Company Address)[^\n]*\n/gi,
      ""
    );

    // 6) 清理重复的Hiring Manager信息块
    const hiringManagerPattern = /Hiring Manager\s*\n[^\n]*\s*\n[^\n]*\s*\n/gi;
    const hiringManagerMatches = text.match(hiringManagerPattern);
    if (hiringManagerMatches && hiringManagerMatches.length > 1) {
      // 保留第一个，移除后续的
      const firstMatch = hiringManagerMatches[0];
      const firstIndex = text.indexOf(firstMatch);
      const afterFirst = text.slice(firstIndex + firstMatch.length);
      const cleanedAfter = afterFirst.replace(hiringManagerPattern, '');
      text = text.slice(0, firstIndex) + firstMatch + cleanedAfter;
    }

    return text.trim();
  };

  // 提取Cover Letter的纯正文内容（用于PDF生成，避免重复）
  const extractBodyContent = (fullContent: string) => {
    // 移除HTML标签
    let content = fullContent.replace(/<[^>]*>/g, '');
    
    // 查找正文开始位置（Dear Hiring Manager, 之后）
    const dearIndex = content.search(/Dear Hiring Manager,/i);
    if (dearIndex !== -1) {
      // 找到Dear Hiring Manager, 后的第一个换行符
      const afterDear = content.slice(dearIndex);
      const firstNewlineIndex = afterDear.indexOf('\n');
      if (firstNewlineIndex !== -1) {
        // 从Dear Hiring Manager, 后的第一个换行符开始，到结尾（不包括Sincerely部分）
        const bodyStart = dearIndex + firstNewlineIndex + 1;
        const sincerelyIndex = content.lastIndexOf('Sincerely,');
        if (sincerelyIndex !== -1 && sincerelyIndex > bodyStart) {
          return content.slice(bodyStart, sincerelyIndex).trim();
        } else {
          return content.slice(bodyStart).trim();
        }
      }
    }
    
    // 如果找不到Dear Hiring Manager,，返回原内容
    return content;
  };

  // 格式化Cover Letter内容，使其具有信件结构
  const formatCoverLetterContent = (content: string, resumeData: any) => {
    // 先清洗原始内容
    const cleanedContent = cleanCoverLetter(content);
    
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const name = resumeData.profile?.name || 'Your Name';
    const email = resumeData.profile?.email || 'your.email@example.com';
    const phone = resumeData.profile?.phone || 'Your Phone';
    const location = resumeData.profile?.location || 'Your Location';
    
    // 完整的表头信息：姓名 + 联系信息 + 日期 + 收件人信息
    return `${name}
${location} • ${phone} • ${email}

${today}

Hiring Manager
${job.company || 'Company Name'}
${formatJobLocation(job.location) || 'Location'}

${cleanedContent}

Sincerely,
${name}`;
  };

    // 下载 Cover Letter 函数 - 生成PDF格式
    const downloadCoverLetter = async () => {
      try {
        // 前置拦截：检查订阅状态
        if (!premiumStatus.isPremiumToday) {
          setPaymentErrorCode('PAYWALL_DOWNLOAD_COVER_LETTER');
          setShowPaymentModal(true);
          return;
        }
        
        // 检查是否有内容
        if (!coverLetterContent || coverLetterContent.trim() === '') {
          alert('Please generate a cover letter first');
          return;
        }

        console.log('📄 Generating cover letter PDF...');

        // 调用Cover Letter PDF API - 现在返回JSON响应
        const response = await fetch('/api/generate-cover-letter-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coverLetterContent: extractBodyContent(coverLetterContent), // 使用提取的纯正文内容
            job,
            userProfile
          })
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            // 构建完整的下载URL，包含email参数 - 与Profile页面完全一致
            const userEmail = userProfile.email;
            const fullDownloadUrl = userEmail 
              ? `${result.downloadUrl}?email=${encodeURIComponent(userEmail)}`
              : result.downloadUrl;
            
            console.log(`✅ Cover letter generated successfully! Download URL: ${fullDownloadUrl}`);
            
            // 直接下载文件，不打开新标签页（因为Tailor Resume弹窗已有Preview模式）
            const a = document.createElement('a');
            a.href = fullDownloadUrl;
            a.download = result.filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 显示成功提示
            if (typeof window !== 'undefined' && (window as any).showToast) {
              (window as any).showToast('Cover letter generated successfully!', 'success');
            }
          } else {
            throw new Error(result.error || 'Failed to generate cover letter');
          }
        } else {
          throw new Error(`Failed to generate cover letter: ${response.status}`);
        }
      } catch (error) {
        console.error('Error generating cover letter:', error);
        // 使用toast显示错误
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('Failed to generate cover letter', 'error');
        } else {
          // 兜底方案
          alert('Failed to generate cover letter. Please try again.');
        }
      }
    };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg relative">
      {/* 专业关闭按钮 - 位于模态框最右上角，避免与View Details按钮冲突 */}
      <button
                        onClick={() => {
                  // 关闭弹窗前立即保存草稿
                  saveDraft();
                  onCancel();
                }}
        className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
        title="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 可折叠的Job Details区域 */}
      <div className="mb-6">
        {/* 折叠标题栏 */}
        <div 
          className="px-0 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center border-b border-gray-200"
          onClick={() => setIsJobDetailsExpanded(!isJobDetailsExpanded)}
        >
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">{job.title} - {job.company}</h2>
          </div>
          <div className="flex items-center space-x-3 mt-2">
            <span className="text-sm text-gray-500">
              {isJobDetailsExpanded ? 'Hide Details' : 'View Details'}
            </span>
            <svg 
              className={`w-6 h-6 text-gray-500 transition-transform ${isJobDetailsExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {jobDetailLoading && (
          <p className="text-xs text-blue-600 mt-2">
            Loading latest job details...
          </p>
        )}
        
        {/* 可折叠内容 - 直接使用JobDetailPanel组件 */}
        {isJobDetailsExpanded && (
          <div className="mt-4">
            <JobDetailPanel 
              job={job} 
              language="en" 
              compact={false}
            />
          </div>
        )}
      </div>

      {/* Resume Preview标题和按钮 - 位于Missing Required Skills下面 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {isTailoring ? 'Tailoring Resume' : 'Tailored Resume'}
          </h3>
          {/* Tailoring 状态指示器 - 浅蓝色底色 + 蓝色旋转图标，不显示重复文字 */}
          {isTailoring && (
            <div className="flex items-center px-3 py-1 bg-blue-100 rounded-full">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 text-sm">
          {/* Preview 按钮 - 切换到PDF视图 */}
          <button
            onClick={() => {
                      setIsEditing(false);
        setIsCheckMode(false); // 预览时关闭高亮
        setActivePreview('pdf');
        // 保存草稿
        setTimeout(() => saveDraft(), 100);
              setPreviewKey(prev => prev + 1);
              console.log('🔄 切换到Preview模式');
            }}
            disabled={isTailoring}
            className={`px-3 py-1 rounded transition-colors ${
              !isEditing 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${isTailoring ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Preview
          </button>
          
          {/* Edit 按钮 - 切换到可编辑视图 */}
          <button
            onClick={() => {
                      setIsEditing(true);
        setIsCheckMode(true); // 编辑时开启高亮
        setActivePreview('editable');
        // 保存草稿
        setTimeout(() => saveDraft(), 100);
              setPreviewKey(prev => prev + 1);
              console.log('🔄 切换到Edit模式');
            }}
            disabled={isTailoring}
            className={`px-3 py-1 rounded transition-colors ${
              isEditing 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${isTailoring ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Edit
          </button>

          {/* Download 按钮 - 下载简历，深蓝色主题 */}
          <button
            onClick={() => {
              // 前置拦截：检查订阅状态
              if (!premiumStatus.isPremiumToday) {
                setPaymentErrorCode('PAYWALL_DOWNLOAD_RESUME');
                setShowPaymentModal(true);
                return;
              }
              
              // 使用当前编辑后的数据，确保 PDF 导出与预览一致
              const currentData = generateResumeData();
              console.log('📤 PDF 导出数据:', currentData);
              onGenerate(currentData);
            }}
            disabled={isTailoring}
            className={`px-3 py-1 text-sm rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 ${
              isTailoring ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Download
          </button>
        </div>
      </div>

      {/* Missing Required Skills横幅 - 移动到Tailored Resume标题下面 */}
      {review?.required?.missing?.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center">
            <svg 
              className="h-4 w-4 mr-2" 
              fill={missingRequirementsConfirmed ? "#374151" : "#C40233"} 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span style={{ 
              color: missingRequirementsConfirmed ? '#374151' : '#C40233', 
              fontSize: '14px' 
            }}>
              {missingRequirementsConfirmed ? 'Required skills confirmed: ' : 'Missing required skills: '}
              {review.required.missing.join(', ')} 
              {missingRequirementsConfirmed ? '(Skills have been verified)' : '(ATS may reject based on these)'}
            </span>
            
            {/* Confirm Added Skills 按钮 - 直接跟在文字后面，小按钮 */}
            {!missingRequirementsConfirmed && (
              <button
                onClick={() => {
                  setMissingRequirementsConfirmed(true);
                  // 保存草稿
                  setTimeout(() => saveDraft(), 100);
                }}
                className="ml-3 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors"
              >
                Confirm Added Skills
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* 顶部提示 - 使用API数据，移除重复的本地计算 */}
      {review?.required?.missing?.length === 0 ? (
        <div className="text-green-600 text-sm mb-4 p-3 bg-green-50 border border-green-200 rounded">
          ✅ All requirements met
        </div>
      ) : null}

      {/* 简历预览 - 直接在预览上编辑，类似 resume.com */}
      <div className="space-y-6">
        {/* 简历预览 - 支持内联编辑 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">
              {isEditing 
                ? 'Edit Mode (Click any text to start)'
                : 'Preview (Final PDF layout)'
              }
            </h3>
            {/* 移除Reset Changes按钮 */}
          </div>
          <div 
            className="bg-white p-6 relative"
            style={{ minHeight: '800px' }}
          >
            {isEditing ? (
              <EditableResumePreview 
                key={previewKey} // 强制重挂载
                resumeData={generateResumeData()}
                editableData={editableData}
                onUpdate={setEditableData}
                isEditing={isEditing}
                review={review}
                isCheckMode={isCheckMode}
              />
            ) : (
              <div 
                className="pdf-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml }} 
              />
            )}
          </div>
        </div>
      </div>

      {/* Cover Letter 区域 - 增加与Resume的间距 */}
      <div className="mt-6 space-y-4">
        {/* Cover Letter 标题和按钮 */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Cover Letter</h3>
          <div className="flex items-center space-x-2 text-sm">
            {!showCoverLetter ? (
              // Generate按钮 - 只在未生成时显示
              <button
                onClick={generateCoverLetter}
                disabled={isGeneratingCoverLetter || isTailoring}
                className="px-3 py-1 text-sm rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingCoverLetter ? 'Generating...' : 'Generate'}
              </button>
            ) : (
              // Preview、Edit、Download按钮 - 生成后显示
              <>
                {/* Preview 按钮 */}
                <button
                  onClick={() => {
                    setIsCoverLetterEditing(false);
                    // 保存草稿
                    setTimeout(() => saveDraft(), 100);
                    setCoverLetterPreviewKey(prev => prev + 1);
                  }}
                  disabled={isGeneratingCoverLetter}
                  className={`px-3 py-1 rounded transition-colors ${
                    !isCoverLetterEditing 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isGeneratingCoverLetter ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Preview
                </button>
                
                {/* Edit 按钮 */}
                <button
                  onClick={() => {
                    setIsCoverLetterEditing(true);
                    // 保存草稿
                    setTimeout(() => saveDraft(), 100);
                    setCoverLetterPreviewKey(prev => prev + 1);
                  }}
                  disabled={isGeneratingCoverLetter}
                  className={`px-3 py-1 rounded transition-colors ${
                    isCoverLetterEditing 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isGeneratingCoverLetter ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Edit
                </button>

                {/* Download 按钮 */}
                <button
                  onClick={downloadCoverLetter}
                  disabled={isGeneratingCoverLetter}
                  className={`px-3 py-1 text-sm rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 ${
                    isGeneratingCoverLetter ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Download
                </button>
              </>
            )}
          </div>
        </div>

        {/* Cover Letter 内容区域 - 只在生成后显示 */}
        {showCoverLetter && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-700">
                {isCoverLetterEditing 
                  ? 'Edit Mode (Click any text to start)'
                  : 'Preview (Final layout)'
                }
              </h4>
            </div>
            <div className="bg-white p-6 relative" style={{ minHeight: '400px' }}>
              {isCoverLetterEditing ? (
                <textarea
                  key={coverLetterPreviewKey}
                  value={coverLetterContent.replace(/<[^>]*>/g, '')}
                  onChange={(e) => {
                    setCoverLetterContent(e.target.value);
                    // 实时保存草稿
                    setTimeout(() => saveDraft(), 100);
                  }}
                  className="w-full h-full outline-none resize-none text-gray-800 font-sans border border-gray-300 rounded p-4"
                  style={{
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    lineHeight: '1.4',
                    fontSize: '14px',
                    minHeight: '360px',
                    cursor: 'text'
                  }}
                  placeholder="Edit your cover letter here..."
                />
              ) : (
                <div 
                  key={coverLetterPreviewKey}
                  className="w-full h-full text-gray-800 font-sans border border-gray-300 rounded p-4"
                  style={{
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    lineHeight: '1.2',
                    fontSize: '11px',
                    minHeight: '360px',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {coverLetterContent}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => setShowPaymentModal(false)}
          email={userProfile?.email || ''}
          errorCode={paymentErrorCode}
          postPaymentAction={() => {
            // 支付成功后，重新执行下载操作
            if (paymentErrorCode === 'PAYWALL_DOWNLOAD_COVER_LETTER') {
              downloadCoverLetter();
            } else if (paymentErrorCode === 'PAYWALL_DOWNLOAD_RESUME') {
              // 重新执行简历下载
              const currentData = generateResumeData();
              onGenerate(currentData);
            }
          }}
          featureDescription="Access all resume and cover letter features with a Premium Pass"
        />
      )}
    </div>
  );
}
