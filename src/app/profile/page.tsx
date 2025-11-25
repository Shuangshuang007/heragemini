'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Logo } from '@/components/Logo';
import { 
  COUNTRIES, 
  CITIES, 
  JOB_TITLES, 
  SENIORITY_LEVELS,
  JOB_TYPES,
  SALARY_PERIODS,
  YEARLY_SALARY_RANGES_AUD,
  YEARLY_SALARY_RANGES_RMB,
  type CountryCode,
  type Language,
} from '@/constants/profileData';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Trash2, Settings } from 'lucide-react';
import { AccountSettingIcon } from '@/components/AccountSettingIcon';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { cityOptionsMap, type CountryKey } from '@/constants/cities';
import { Controller } from 'react-hook-form';
import { StorageManager } from '@/utils/storage';
import { JobTitleSelector } from '@/components/JobTitleSelector';
import { fileToBase64 } from '@/utils/file';
import Link from 'next/link';
import ResumeUploadTip from '@/components/ResumeUploadTip';
import { useSession } from 'next-auth/react';
import { PaymentModal } from '@/components/PaymentModal';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  phone: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  jobTitle: z.array(z.string()).min(1, 'At least one job title is required'),
  seniority: z.string().min(1, 'Seniority is required'),
  openForRelocation: z.string().min(1, 'Please select relocation preference'),
  salaryPeriod: z.string().optional(),
  salaryRange: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  website: z.string().optional(),
  video: z.string().optional(),
  resume: z.custom<File | null>((val) => val instanceof File || val === null, {
    message: 'Please upload a valid resume file'
  }),
  avatar: z.custom<File | null>((val) => val instanceof File || val === null, {
    message: 'Please upload a valid image file'
  }).optional(),
  about: z.string().optional(),
  education: z.array(z.object({
    startDate: z.string(),
    endDate: z.string(),
    degree: z.string(),
    school: z.string(),
    field: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
  })).optional(),
  employment: z.array(z.object({
    startDate: z.string(),
    endDate: z.string(),
    company: z.string(),
    position: z.string(),
    description: z.string(),
    department: z.string().optional(),
    location: z.string().optional(),
    isPresent: z.boolean().optional(),
  })).optional(),
  skills: z.array(z.object({
    name: z.string()
  })).optional(),
  workingRightsAU: z.string().min(1, 'Australia Working Rights is required'),
  workingRightsOther: z.string().optional(),
  languages: z.array(z.object({
    language: z.string().min(1, 'Language is required'),
    level: z.enum(['Native', 'Fluent', 'Conversational', 'Basic'])
  })).optional(),
  careerPriorities: z.array(z.string()).optional(),
  // Lightweight Others: keep only kind/title/summary
  others: z.array(z.object({
    kind: z.enum(['volunteering','club','award','speaking','publication','competition','interest','custom']).optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
  })).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const translations = {
  en: {
    tabs: {
      profile: 'Profile',
      jobs: 'Jobs',
      applications: 'Applications',
    },
    sections: {
      resume: {
        title: 'Resume',
        upload: 'Upload Resume',
        dragDrop: 'or drag and drop',
        formats: 'PDF, DOC, DOCX formats',
        delete: 'Delete',
      },
      photo: {
        title: 'Photo',
        upload: 'Upload Photo',
        formats: 'PNG, JPG up to 10MB',
        delete: 'Delete',
      },
      basicInfo: {
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email',
        phone: 'Phone',
        country: 'Country',
        city: 'City',
      },
      jobPreference: {
        jobTitle: 'Job Title',
        seniority: 'Seniority',
        jobType: 'Job Type',
        salaryPeriod: 'Salary Period',
        salaryRange: 'Expected Salary',
        openForRelocation: 'Open for Relocation',
      },
      socialMedia: {
        title: 'Social Media',
        linkedin: 'LinkedIn',
        twitter: 'Twitter',
        website: 'Website',
        video: 'Video',
      },
      others: {
        title: 'Others',
        add: 'Add Section',
        kind: 'Type',
        titleField: 'Section Title',
        organization: 'Organization',
        role: 'Role',
        location: 'Location',
        startDate: 'Start Date',
        endDate: 'End Date',
        links: 'Links',
        linkLabel: 'Label',
        linkUrl: 'URL',
        summary: 'Summary (one per line)',
        showInResume: 'Show in Resume',
        showInProfile: 'Show in Profile'
      },
      additionalInfo: {
        skills: {
          title: 'Additional Skills',
          add: 'Add Skill',
        },
        employment: {
          title: 'Employment History',
          add: 'Add Employment',
          company: 'Company',
          position: 'Position',
          startDate: 'Start Date',
          endDate: 'End Date',
          description: 'Description',
        },
        education: {
          title: 'Education',
          add: 'Add Education',
          school: 'School',
          degree: 'Degree',
          field: 'Field of Study',
          startDate: 'Start Date',
          endDate: 'End Date',
        },
        certifications: {
          title: 'Certifications',
          add: 'Add Certification',
          name: 'Name',
          issuer: 'Issuer',
          issueDate: 'Issue Date',
          expiryDate: 'Expiry Date',
        },
      },
      skills: {
        title: 'Skills',
      },
    },
    buttons: {
      cancel: 'Cancel',
      save: 'Save Profile',
    },
  },
  zh: {
    tabs: {
      profile: '个人资料',
      jobs: '求职意向',
      applications: '申请记录',
    },
    sections: {
      resume: {
        title: '简历',
        upload: '上传简历',
        dragDrop: '或拖放文件',
        formats: 'PDF, DOC, DOCX 格式',
        delete: '删除',
      },
      photo: {
        title: '照片',
        upload: '上传照片',
        formats: 'PNG, JPG 格式，最大 10MB',
        delete: '删除',
      },
      basicInfo: {
        firstName: '名字',
        lastName: '姓氏',
        email: '邮箱',
        phone: '电话',
        country: '国家',
        city: '城市',
      },
      jobPreference: {
        jobTitle: '职位',
        seniority: '职级',
        jobType: '工作类型',
        salaryPeriod: '薪资周期',
        salaryRange: '期望薪资',
        openForRelocation: '是否接受调动',
      },
      socialMedia: {
        title: '社交媒体',
        linkedin: '领英',
        twitter: '推特',
        website: '个人网站',
        video: '视频介绍',
      },
      others: {
        title: '其他',
        add: '添加分区',
        kind: '类型',
        titleField: '小节标题',
        organization: '机构/团队',
        role: '角色',
        location: '地点',
        startDate: '开始日期',
        endDate: '结束日期',
        links: '链接',
        linkLabel: '名称',
        linkUrl: '链接地址',
        summary: '摘要（每行一条）',
        showInResume: '用于简历',
        showInProfile: '用于个人页'
      },
      additionalInfo: {
        skills: {
          title: '技能特长',
          add: '添加技能',
        },
        employment: {
          title: '工作经历',
          add: '添加工作经历',
          company: '公司',
          position: '职位',
          startDate: '开始日期',
          endDate: '结束日期',
          description: '工作描述',
        },
        education: {
          title: '教育经历',
          add: '添加教育经历',
          school: '学校',
          degree: '学位',
          field: '专业',
          startDate: '开始日期',
          endDate: '结束日期',
        },
        certifications: {
          title: '证书认证',
          add: '添加证书',
          name: '证书名称',
          issuer: '发证机构',
          issueDate: '发证日期',
          expiryDate: '有效期至',
        },
      },
      skills: {
        title: '技能特长',
      },
    },
    buttons: {
      cancel: '取消',
      save: '保存资料',
    },
  },
};

const countryOptions = [
  { label: { en: "Australia", zh: "澳大利亚" }, value: "Australia" },
  { label: { en: "China", zh: "中国" }, value: "China" }
] as const;

// 日期格式化函数
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // 处理 "Present"、"Now" 等当前时间表示
  const currentTimeWords = ['present', 'now', 'current', '至今', '现在', 'ongoing', 'till now', 'present.', 'present,', 'present;'];
  if (currentTimeWords.includes(dateStr.toLowerCase().trim())) {
    return 'Present';
  }
  
  // 处理 "November 2025" 格式
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const parts = dateStr.split(' ');
  if (parts.length === 2) {
    const monthIndex = monthNames.findIndex(m => m === parts[0].toLowerCase());
    if (monthIndex !== -1 && !isNaN(Number(parts[1]))) {
      const month = String(monthIndex + 1).padStart(2, '0');
      return `${parts[1]}-${month}`;
    }
  }
  
  // 处理 YYYY-MM 格式
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 处理 YYYY 格式 - 保持原样，不补全月份
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 处理 MM/YYYY 格式
  if (/^\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}`;
  }
  
  // 处理 YYYY/MM 格式
  if (/^\d{4}\/\d{1,2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}`;
  }
  
  // 如果无法解析，返回原始字符串而不是空字符串
  return dateStr;
};

// 添加城市名称标准化函数
const normalizeCity = (city: string) => {
  if (!city) return '';
  
  // 澳大利亚城市标准化映射
  const australianCityMap: Record<string, string> = {
    'melbourne': 'Melbourne',
    'sydney': 'Sydney', 
    'brisbane': 'Brisbane',
    'perth': 'Perth',
    'adelaide': 'Adelaide',
    'canberra': 'Canberra',
    'hobart': 'Hobart',
    'darwin': 'Darwin',
    'gold coast': 'Gold Coast',
    'newcastle': 'Newcastle',
    'wollongong': 'Wollongong',
    'geelong': 'Geelong',
    'townsville': 'Townsville',
    'cairns': 'Cairns',
    'toowoomba': 'Toowoomba',
    'ballarat': 'Ballarat',
    'bendigo': 'Bendigo',
    'albury': 'Albury',
    'launceston': 'Launceston',
    'rockhampton': 'Rockhampton',
    'mackay': 'Mackay',
    'bundaberg': 'Bundaberg',
    'coffs harbour': 'Coffs Harbour',
    'wagga wagga': 'Wagga Wagga',
    'hervey bay': 'Hervey Bay',
    'mildura': 'Mildura',
    'shepparton': 'Shepparton',
    'gladstone': 'Gladstone',
    'mount gambier': 'Mount Gambier',
    'whyalla': 'Whyalla',
    'port lincoln': 'Port Lincoln',
    'kalgoorlie': 'Kalgoorlie',
    'geraldton': 'Geraldton',
    'albany': 'Albany',
    'karratha': 'Karratha',
    'broome': 'Broome',
    'alice springs': 'Alice Springs',
    'katherine': 'Katherine',
    'tennant creek': 'Tennant Creek'
  };
  
  const normalizedCity = australianCityMap[city.toLowerCase()];
  if (normalizedCity) {
    return normalizedCity;
  }
  
  // 获取所有已知城市名称
  const knownCities = Object.values(cityOptionsMap).flat().map(c => c.value);
  // 查找匹配的城市（不区分大小写）
  const match = knownCities.find(c => c.toLowerCase() === city.toLowerCase());
  return match || city;
};

// Seniority推断函数
const inferSeniorityFromProfile = (employmentHistory: any[], jobTitles: string[]): string => {
  // 计算总工作经验年限
  const calculateTotalWorkExperience = (employmentHistory: any[]): number => {
    if (!employmentHistory || employmentHistory.length === 0) {
      return 0;
    }
    
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    
    employmentHistory.forEach(emp => {
      const startYear = parseInt(emp.startDate?.split('-')[0]) || 0;
      const endYear = emp.endDate === 'Present' ? currentYear : 
                     (parseInt(emp.endDate?.split('-')[0]) || currentYear);
      
      totalYears += (endYear - startYear);
    });
    
    return totalYears;
  };

  // 检查是否有管理职位
  const checkManagementRole = (jobTitles: string[]): boolean => {
    const managementKeywords = [
      'manager', 'director', 'vp', 'head of', 'chief', 'lead',
      'supervisor', 'team lead', 'project manager', 'product manager',
      'engineering manager', 'senior manager', 'associate director',
      'general manager', 'department head', 'division manager'
    ];
    
    return jobTitles.some(title => 
      managementKeywords.some(keyword => 
        title.toLowerCase().includes(keyword)
      )
    );
  };

  const totalYears = calculateTotalWorkExperience(employmentHistory);
  const hasManagementRole = checkManagementRole(jobTitles);
  
  // 基于年限和职位推断
  if (totalYears <= 3) {
    return 'entry';
  } else if (totalYears <= 7) {
    return 'mid';
  } else if (totalYears <= 10) {
    return 'senior';
  } else if (totalYears > 10) {
    // 10年以上 + 管理职位 = Executive
    if (hasManagementRole) {
      return 'executive';
    } else {
      return 'senior'; // 即使10年以上，没有管理经验仍为Senior
    }
  }
  
  // 默认推断
  return 'mid';
};

interface ParsedSkill {
  name: string;
}

// 超轻量标签选择：优先命中前面的规则，命不中就回退到 Results-oriented
const pickTag = (t: string = '') => {
  const s = t.toLowerCase();
  // 超轻量标签选择：统一为单数+连字符，覆盖常见简历关键词
  if (/(data|kpi|sql|metric|analytics|a\/b)/.test(s)) return 'Data-driven';
  if (/(detail|accuracy|precis|meticulous)/.test(s)) return 'Detail-oriented';
  if (/(customer|client|user|satisfaction|service)/.test(s)) return 'Customer-focused';
  if (/(strategy|roadmap|vision|gtm|plan)/.test(s)) return 'Strategic-minded';
  if (/(team|collaborat|stakeholder|cross-functional)/.test(s)) return 'Team-oriented';
  if (/(leader|manage|supervis|coach|mentor)/.test(s)) return 'Leadership-oriented';
  if (/(innov|creativ|idea|design|solution)/.test(s)) return 'Innovation-driven';
  if (/(result|impact|deliver|outcome|achieve)/.test(s)) return 'Result-oriented';
  if (/(adapt|flexib|fast-pace|change|resilien)/.test(s)) return 'Adaptable';
  if (/(communicat|present|write|speak|storytell)/.test(s)) return 'Strong-communicator';

  return 'Result-oriented'; // 兜底
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('profile');
  const [language, setLanguage] = useState<Language>('en');
  const [availableCities, setAvailableCities] = useState<typeof CITIES[CountryCode]>([]);
  const [salaryRanges, setSalaryRanges] = useState(YEARLY_SALARY_RANGES_AUD);
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [aiPreview, setAiPreview] = useState<{
    index: number;
    boostedSummary: string;
    isVisible: boolean;
  } | null>(null);
  const [loadingEducationIndex, setLoadingEducationIndex] = useState<number | null>(null);
  const [aiEducationPreview, setAiEducationPreview] = useState<{
    index: number;
    boostedSummary: string;
    isVisible: boolean;
  } | null>(null);
  
  // Boost Resume 状态管理 - 使用数组存储所有 AI 预览
  const [aiPreviewArray, setAiPreviewArray] = useState<Array<{
    index: number;
    boostedSummary: string;
    isVisible: boolean;
  }>>([]);
  const [aiPersonalSummaryPreview, setAiPersonalSummaryPreview] = useState<string>('');
  const [aiEducationPreviewArray, setAiEducationPreviewArray] = useState<Array<{
    index: number;
    boostedSummary: string;
    isVisible: boolean;
  }>>([]);
  const [isBoostResumeLoading, setIsBoostResumeLoading] = useState(false);
  const [boostResumeProgress, setBoostResumeProgress] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'pdf'>('pdf');
  
  // 使用Premium状态hook
  const premiumStatus = usePremiumStatus();


  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentErrorCode, setPaymentErrorCode] = useState<string>('');

  const { register, handleSubmit, formState: { errors }, setValue, watch, control, getValues } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      education: [],
      employment: [],
      jobTitle: [],
      skills: [],
    },
  });



  // 添加监听 jobTitle 和 city 变化的 useEffect
  useEffect(() => {
    const subscription = watch((value) => {
      // 获取当前的 userProfile
      const currentUserProfileStr = localStorage.getItem('userProfile');
      const currentUserProfile = currentUserProfileStr ? JSON.parse(currentUserProfileStr) : {};
      
      // 更新 userProfile
      const updatedUserProfile = {
        ...currentUserProfile,
        ...value,
        jobTitle: value.jobTitle || currentUserProfile.jobTitle,
        city: value.city || currentUserProfile.city
      };
      
      // 保存更新后的 userProfile
      localStorage.setItem('userProfile', JSON.stringify(updatedUserProfile));
      
      // 单独保存关键字段
      if (value.jobTitle && value.jobTitle.length > 0 && value.jobTitle[0]) {
        localStorage.setItem("jobTitle", value.jobTitle[0]);
        console.log('Saved jobTitle to localStorage:', value.jobTitle[0]);
      }
      // 只在 city 有值且与当前值不同时保存
      if (value.city && value.city !== currentUserProfile.city) {
        localStorage.setItem("city", value.city);
        console.log('Saved city to localStorage:', value.city);
      }
    });

    return () => subscription.unsubscribe?.();
  }, []);

  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
    control,
    name: 'education',
  });

  const { fields: employmentFields, append: appendEmployment, remove: removeEmployment } = useFieldArray({
    control,
    name: 'employment',
  });

  const { fields: skillFields, append: appendSkill, remove: removeSkill } = useFieldArray({
    control,
    name: "skills"
  });

  const { fields: languageFields, append: appendLanguage, remove: removeLanguage } = useFieldArray({
    control,
    name: "languages"
  });

  // Others (flexible sections)
  const { fields: othersFields, append: appendOther, remove: removeOther, move: moveOther } = useFieldArray({
    control,
    name: 'others',
  });

  const selectedCountry = watch('country');
  const resume = watch('resume');
  const salaryPeriod = watch('salaryPeriod');
  const t = translations[language];

  useEffect(() => {
    if (selectedCountry) {
      const countryCode = selectedCountry as CountryCode;
      setAvailableCities(CITIES[countryCode]);
      setSalaryRanges(countryCode === 'cn' ? YEARLY_SALARY_RANGES_RMB : YEARLY_SALARY_RANGES_AUD);
    }
  }, [selectedCountry]);

  // 在用户登录时，将邮箱保存到localStorage
  useEffect(() => {
    if (session?.user?.email) {
      // 将登录邮箱保存到localStorage
      localStorage.setItem('registeredEmail', session.user.email);
      console.log('Saved registeredEmail to localStorage:', session.user.email);
    }
  }, [session]);

  // 添加终端输出的函数
  const appendToTerminal = useCallback((message: string) => {
    setTerminalOutput(prev => [...prev, message]);
  }, []);

  // 通用的registeredEmail补充函数（为老用户）
  const ensureRegisteredEmail = useCallback(async (userEmail: string): Promise<string> => {
    try {
      // 先检查localStorage是否有registeredEmail
      let registeredEmail = localStorage.getItem('registeredEmail');
      
      if (!registeredEmail) {
        // 如果localStorage没有，尝试从session获取
        if (session?.user?.email) {
          registeredEmail = session.user.email;
          localStorage.setItem('registeredEmail', registeredEmail);
          console.log('Backfilled registeredEmail from session:', registeredEmail);
        } else {
          // 如果session也没有，使用当前email作为默认值
          registeredEmail = userEmail;
          localStorage.setItem('registeredEmail', registeredEmail);
          console.log('Backfilled registeredEmail with current email:', registeredEmail);
        }
        
        // 检查MongoDB中的Profile是否需要更新registeredEmail
        const profileResponse = await fetch(`/api/profile/get?email=${encodeURIComponent(userEmail)}`);
        const profileData = await profileResponse.json();
        
        if (profileData.success && profileData.profile && !profileData.profile.registeredEmail) {
          console.log('Updating MongoDB profile with registeredEmail for old user:', userEmail);
          
          // 更新MongoDB中的Profile
          const updateResponse = await fetch('/api/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              registeredEmail: registeredEmail,
              firstName: profileData.profile.firstName || '',
              lastName: profileData.profile.lastName || '',
              jobTitle: profileData.profile.jobTitle || '',
              location: profileData.profile.location || ''
            })
          });
          
          if (updateResponse.ok) {
            console.log('✓ Successfully backfilled registeredEmail in MongoDB');
            appendToTerminal('✓ Updated profile with registration email');
          } else {
            console.warn('⚠ Failed to backfill registeredEmail in MongoDB');
          }
        }
      }
      
      return registeredEmail;
    } catch (error) {
      console.error('Error ensuring registeredEmail:', error);
      // 返回当前email作为默认值
      return userEmail;
    }
  }, [session, appendToTerminal]);

  const handleResumeChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || isProcessing) return;
      
      // 检查文件类型
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      
      // 支持多种格式
      const supportedExtensions = [
        '.pdf', '.docx', '.txt', '.doc', '.pages', '.rtf', '.odt', '.wps', '.wpd', 
        '.abw', '.fodt', '.sxw', '.uot', '.xml', '.html', '.htm', '.mht', '.mhtml'
      ];
      
      const hasSupportedExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
      if (!hasSupportedExtension) {
        window.alert('Please upload a supported resume file format. Supported formats: PDF, DOCX, TXT, DOC, Pages, RTF, ODT, WPS, WPD, and more.');
        return;
      }

      setResumeFile(file);
      setIsParsingResume(true);
      setIsProcessing(true);
      appendToTerminal(`○ Processing resume: ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);

      appendToTerminal('○ Sending to server for parsing...');
      const startTime = Date.now();
      
      // 使用统一的简历解析API
      const apiEndpoint = '/api/parse-resume';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });
      const endTime = Date.now();
      appendToTerminal(`POST ${apiEndpoint} ${response.status} in ${endTime - startTime}ms`);

      const responseText = await response.text();
      let parsedData: any;
      
      try {
        parsedData = JSON.parse(responseText);

      if (!response.ok) {
          throw new Error(parsedData.error || 'Failed to parse resume');
        }
        
        appendToTerminal('✓ Resume parsed successfully');
        appendToTerminal('✓ Found data:');
        appendToTerminal(`  firstName: ${parsedData.firstName || 'N/A'}`);
        appendToTerminal(`  lastName: ${parsedData.lastName || 'N/A'}`);
        appendToTerminal(`  email: ${parsedData.email || 'N/A'}`);
        appendToTerminal(`  phone: ${parsedData.phone || 'N/A'}`);
        appendToTerminal(`  location: ${parsedData.city || 'N/A'}, ${parsedData.country || 'N/A'}`);
        appendToTerminal(`  skills: ${parsedData.skills?.length || 0} found`);
        appendToTerminal(`  education: ${parsedData.education?.length || 0} entries`);
        appendToTerminal(`  experience: ${parsedData.employmentHistory?.length || 0} entries`);
        
        // 清除现有数据
        setValue('education', []);
        setValue('employment', []);
        setValue('jobTitle', []);
        setValue('skills', []);
        appendToTerminal('○ Updating form fields...');

        // 处理基本字段
        const basicFields = ['firstName', 'lastName', 'email', 'phone'];
        for (const field of basicFields) {
          if (parsedData[field]) {
            setValue(field as keyof ProfileFormData, parsedData[field]);
            appendToTerminal(`✓ Set ${field}: ${parsedData[field]}`);
          }
        }

        // 处理地理位置
        if (parsedData.country && parsedData.country.trim() !== '') {
          setValue('country', parsedData.country);
          appendToTerminal(`✓ Set country: ${parsedData.country}`);
        } else {
          // 智能推断国家
          let inferredCountry = '';
          if (parsedData.phone && parsedData.phone.startsWith('+61')) {
            inferredCountry = 'Australia';
          } else if (parsedData.city) {
            const australianCities = [
              'Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Hobart', 'Darwin',
              'Gold Coast', 'Newcastle', 'Wollongong', 'Geelong', 'Townsville', 'Cairns', 'Toowoomba',
              'Ballarat', 'Bendigo', 'Albury', 'Launceston', 'Rockhampton', 'Mackay', 'Bundaberg',
              'Coffs Harbour', 'Wagga Wagga', 'Hervey Bay', 'Mildura', 'Shepparton', 'Gladstone',
              'Mount Gambier', 'Whyalla', 'Port Lincoln', 'Kalgoorlie', 'Geraldton', 'Albany',
              'Karratha', 'Broome', 'Alice Springs', 'Katherine', 'Tennant Creek'
            ];
            if (australianCities.some(city => parsedData.city.toLowerCase().includes(city.toLowerCase()))) {
              inferredCountry = 'Australia';
            }
          }
          
          if (inferredCountry) {
            setValue('country', inferredCountry);
            appendToTerminal(`✓ Inferred country: ${inferredCountry}`);
          }
        }
        
        if (parsedData.city) {
          const normalizedCity = normalizeCity(parsedData.city);
          setValue('city', normalizedCity);
          localStorage.setItem("city", normalizedCity);
          appendToTerminal(`✓ Set city: ${normalizedCity}`);
        }

        // 处理职位和技能
        if (parsedData.jobTitles?.length) {
          const jobTitles = parsedData.jobTitles.slice(0, 5);
          setValue('jobTitle', jobTitles);
          if (jobTitles && jobTitles.length > 0 && jobTitles[0]) {
            localStorage.setItem('jobTitle', jobTitles[0]); // 保存第一个职位作为主要职位
          }
          appendToTerminal(`✓ Set job titles: ${jobTitles.join(', ')}`);
        }
        if (parsedData.skills?.length) {
          const skills = parsedData.skills.slice(0, 5);
          const formattedSkills = skills.map((skill: string) => ({ name: skill }));
          setValue('skills', formattedSkills);
          // 保存原始技能数组
          localStorage.setItem('skills', JSON.stringify(skills));
          appendToTerminal(`✓ Set skills: ${skills.join(', ')}`);
        }

        // 处理教育经历
      if (parsedData.education?.length) {
          const educationToShow = parsedData.education;
          appendToTerminal(`○ Processing ${educationToShow.length} education entries...`);
          for (const edu of educationToShow) {
          appendEducation({
            school: edu.school || '',
            degree: edu.degree || '',
            field: edu.field || '',
            location: edu.location || '',
            startDate: edu.startYear || '',
              endDate: edu.endYear || '',
              summary: edu.summary || ''
          });
            appendToTerminal(`✓ Added education: ${edu.school} - ${edu.degree}`);
          }
      }

        // 处理seniority
        if (parsedData.seniority) {
          // 处理GPT可能返回显示文本的情况
          const seniorityValueMap: Record<string, string> = {
            'Entry Level': 'entry',
            'Mid Level': 'mid', 
            'Senior Level': 'senior',
            'Executive Level': 'executive',
            'entry': 'entry',
            'mid': 'mid',
            'senior': 'senior',
            'executive': 'executive'
          };
          
          const correctValue = seniorityValueMap[parsedData.seniority] || parsedData.seniority;
          setValue('seniority', correctValue);
          
          // 将seniority值转换为显示文本
          const seniorityDisplayMap: Record<string, string> = {
            'entry': 'Entry Level',
            'mid': 'Mid Level',
            'senior': 'Senior Level',
            'executive': 'Executive Level'
          };
          const displayText = seniorityDisplayMap[correctValue] || correctValue;
          appendToTerminal(`✓ Set seniority: ${displayText}`);
        } else if (parsedData.employmentHistory?.length > 0) {
          // 如果GPT没有推断出seniority，使用前端推断
          const inferredSeniority = inferSeniorityFromProfile(
            parsedData.employmentHistory,
            parsedData.jobTitles || []
          );
          setValue('seniority', inferredSeniority);
          // 将seniority值转换为显示文本
          const seniorityDisplayMap: Record<string, string> = {
            'entry': 'Entry Level',
            'mid': 'Mid Level',
            'senior': 'Senior Level',
            'executive': 'Executive Level'
          };
          const displayText = seniorityDisplayMap[inferredSeniority] || inferredSeniority;
          appendToTerminal(`✓ Inferred seniority: ${displayText}`);
        }

        // 处理工作权限
        if (parsedData.workingRights) {
          const workingRights = parsedData.workingRights;
          const australiaOptions = [
            'Australian Citizen',
            'Australian Permanent Resident', 
            'Temporary Work Visa (with full work rights)',
            'Student Visa (limited work rights)',
            'No work rights in Australia'
          ];
          
          if (australiaOptions.includes(workingRights)) {
            setValue('workingRightsAU', workingRights);
            appendToTerminal(`✓ Set Australia working rights: ${workingRights}`);
          } else {
            setValue('workingRightsOther', workingRights);
            appendToTerminal(`✓ Set other country working rights: ${workingRights}`);
          }
        }

        // 处理语言技能
        if (parsedData.languages?.length) {
          appendToTerminal(`○ Processing ${parsedData.languages.length} language entries...`);
          for (const lang of parsedData.languages) {
            appendLanguage({
              language: lang.language || '',
              level: lang.level || 'Conversational'
            });
            appendToTerminal(`✓ Added language: ${lang.language} - ${lang.level}`);
          }
        }

        // 处理工作经历
      if (parsedData.employmentHistory?.length) {
          const employmentToShow = parsedData.employmentHistory;
          appendToTerminal(`○ Processing ${employmentToShow.length} employment entries...`);
          
          // 获取简历上方的location作为默认值
          const defaultLocation = parsedData.city || '';
          
          for (const emp of employmentToShow) {
            const isPresent = emp.endDate === 'Present';
            // 直接使用原始日期，不强制格式化
            const startDate = emp.startDate || '';
            const endDate = isPresent ? 'Present' : (emp.endDate || '');
          appendEmployment({
            company: emp.company || '',
            position: emp.position || '',
            department: emp.department || '',
            location: emp.location || defaultLocation,
              startDate: startDate,
              endDate: endDate,
              description: emp.summary || '',
              isPresent: isPresent
            });
            appendToTerminal(`✓ Added employment: ${emp.company} - ${emp.position}${isPresent ? ' (Present)' : ''}`);
          }
        }

        // 将解析到的 hobbies 合并追加到 Others（若存在）
        if (Array.isArray(parsedData.hobbies) && parsedData.hobbies.length > 0) {
          const hobbyLine = parsedData.hobbies.join('; ');
          const prevOthers = (watch('others') as any[]) || [];
          setValue('others' as const, [...prevOthers, { title: 'Hobbies & Interests', summary: hobbyLine }]);
          appendToTerminal(`✓ Added hobbies to Others: ${hobbyLine}`);
        }

        // 将解析返回的其它 residual others 直接合并（如果后端已提供）
        if (Array.isArray(parsedData.others) && parsedData.others.length > 0) {
          const prevOthers = (watch('others') as any[]) || [];
          const mapped = parsedData.others.map((o: any) => ({
            title: o.title || '',
            summary: (o.summary || '').replace(/^•\s*/gm, '').split('\n').filter((l: string) => l.trim()).join('; '),
          }));
          setValue('others' as const, [...prevOthers, ...mapped]);
          appendToTerminal(`✓ Added ${mapped.length} additional sections to Others`);
        }

        appendToTerminal('✓ Resume data processed successfully');
        appendToTerminal('✓ Form ready for review');
        
        // 保存上传的Resume到MongoDB
        try {
          const userEmail = parsedData.email || watch('email');
          if (userEmail) {
            // 先转换文件为PDF
            appendToTerminal('○ Converting file to PDF...');
            const convertFormData = new FormData();
            convertFormData.append('file', file);
            
            const convertResponse = await fetch('/api/convert-file', {
              method: 'POST',
              body: convertFormData,
            });
            
            if (convertResponse.ok) {
              const convertResult = await convertResponse.json();
              appendToTerminal('✓ File converted successfully');
              
              const currentDate = new Date();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              const day = String(currentDate.getDate()).padStart(2, '0');
              const year = currentDate.getFullYear();
              
              // 生成智能文件名
              const firstName = parsedData.firstName || '';
              const lastName = parsedData.lastName || '';
              const smartFilename = `${firstName} ${lastName}_Resume_Original_v1_${year}${month}${day}`;
              
              // 保存到MongoDB
              const saveResponse = await fetch('/api/profile/save-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: userEmail,
                  resumeData: {
                    id: `upload_${Date.now()}`,
                    name: smartFilename,
                    pdfUrl: convertResult.pdfUrl, // 使用转换后的PDF URL
                    type: 'OriginalResume'
                  }
                })
              });
              
              if (saveResponse.ok) {
                appendToTerminal('✓ OriginalResume saved to MongoDB');
                appendToTerminal(`✓ PDF URL: ${convertResult.pdfUrl}`);
              } else {
                appendToTerminal('⚠ Failed to save OriginalResume to MongoDB');
              }
            } else {
              appendToTerminal('⚠ File conversion failed');
            }
          }
        } catch (uploadError) {
          appendToTerminal('⚠ Error saving OriginalResume to MongoDB');
          console.warn('Upload resume save error:', uploadError);
        }

    } catch (error) {
      console.error('Error parsing resume:', error);
        appendToTerminal('❌ Error: Failed to parse resume');
        appendToTerminal(`❌ Details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert(language === 'en' ? 'Failed to parse resume. Please try again or fill in manually.' : '简历解析失败，请重试或手动填写。');
      }
    } catch (error) {
      console.error('Error handling resume:', error);
      appendToTerminal('❌ Error: Failed to handle resume');
      appendToTerminal(`❌ Details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert(language === 'en' ? 'Failed to handle resume. Please try again later.' : '无法处理简历，请稍后再试。');
    } finally {
      setIsParsingResume(false);
      setIsProcessing(false);
    }
  }, [setValue, appendEducation, appendEmployment, language, appendSkill, appendToTerminal]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue('avatar', file as File);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
    setValue('resume', null);
  };

  const handleRemoveAvatar = () => {
    setValue('avatar', null);
    setAvatarPreview(undefined);
    const input = document.getElementById('avatar') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setValue('resume', file);
      setResumeFile(file);
    }
  };

  // Boost Summary with AI function
  const handleBoostSummary = async (index: number) => {
    let summary = '';
    if (index === -1) {
      // 个人总结
      summary = watch('about') || '';
    } else {
      // 工作经验总结
      summary = watch(`employment.${index}.description`) || '';
    }
    
    if (!summary) return;

    if (index === -1) {
      setLoadingIndex(-1); // 使用loadingIndex来统一处理loading状态
    } else {
      setLoadingIndex(index);
    }
    
    try {
      const response = await fetch('/api/boost-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary }),
      });
      const data = await response.json();

      if (data.boostedSummary) {
        if (index === -1) {
          // 个人总结
          setAiPersonalSummaryPreview(data.boostedSummary);
        } else {
          // 工作经验总结
          setAiPreviewArray(prev => {
            const existing = prev.find(item => item.index === index);
            if (existing) {
              return prev.map(item => 
                item.index === index 
                  ? { ...item, boostedSummary: data.boostedSummary, isVisible: true }
                  : item
              );
            } else {
              return [...prev, {
                index,
                boostedSummary: data.boostedSummary,
                isVisible: true
              }];
            }
          });
        }
      }
    } catch (err) {
      console.error('Boost error:', err);
    } finally {
        setLoadingIndex(null);
    }
  };

  const applyBoostedSummary = (index: number) => {
    const preview = aiPreviewArray.find(item => item.index === index);
    if (preview) {
      // 保存当前光标位置
      const element = document.querySelector(`[data-employment-index="${index}"]`) as HTMLElement;
      const selection = window.getSelection();
      let cursorPosition = 0;
      
      if (element && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorPosition = range.startOffset;
      }
      
      setValue(`employment.${index}.description`, preview.boostedSummary);
      setAiPreviewArray(prev => prev.filter(item => item.index !== index)); // 关闭预览框
      
      // 延迟恢复光标位置
      setTimeout(() => {
        const updatedElement = document.querySelector(`[data-employment-index="${index}"]`) as HTMLElement;
        if (updatedElement) {
          const range = document.createRange();
          const newSelection = window.getSelection();
          
          // 尝试将光标放在内容末尾
          range.selectNodeContents(updatedElement);
          range.collapse(false);
          newSelection?.removeAllRanges();
          newSelection?.addRange(range);
          updatedElement.focus();
        }
      }, 50);
    }
  };

  const discardBoostedSummary = (index: number) => {
    setAiPreviewArray(prev => prev.filter(item => item.index !== index)); // 关闭预览框
  };

  const applyBoostedPersonalSummary = () => {
    if (aiPersonalSummaryPreview) {
      setValue('about', aiPersonalSummaryPreview);
      setAiPersonalSummaryPreview('');
    }
  };

  const discardBoostedPersonalSummary = () => {
    setAiPersonalSummaryPreview('');
  };

  // Build resume data for Career Highlights API
  const buildResumeDataForHighlights = () => {
    const form = getValues();
    return {
      summary: form.about || '',
      employment: (form.employment || []).map((e: any) => ({
        company: e.company,
        position: e.position,
        department: e.department,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
      education: (form.education || []).map((ed: any) => ({
        school: ed.school,
        degree: ed.degree,
        field: ed.field,
        location: ed.location,
        startDate: ed.startDate,
        endDate: ed.endDate,
        summary: ed.summary,
      })),
      skills: form.skills || [],
      // awards: not currently part of the form schema; omit to avoid TS errors
    };
  };

  // Boost/Generate Career Highlights (single paragraph)
  const handleBoostHighlights = async () => {
    setLoadingIndex(-2);
    try {
      const resumeData = buildResumeDataForHighlights();
      const resp = await fetch('/api/boost-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          currentHighlights: watch('about') || '',
        }),
      });
      if (!resp.ok) throw new Error('Failed to generate highlights');
      const data = await resp.json();
      if (data.highlights) {
        setAiPersonalSummaryPreview(data.highlights);
      }
    } catch (e) {
      console.error('Boost highlights error:', e);
    } finally {
      setLoadingIndex(null);
    }
  };

  // Boost Education Summary with AI function
  const handleBoostEducationSummary = async (index: number) => {
    const summary = watch(`education.${index}.summary`);
    if (!summary) return;

    setLoadingEducationIndex(index);
    try {
      const response = await fetch('/api/boost-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary }),
      });
      const data = await response.json();

      if (data.boostedSummary) {
        // 显示预览框而不是直接替换
        setAiEducationPreviewArray(prev => {
          const existing = prev.find(item => item.index === index);
          if (existing) {
            return prev.map(item => 
              item.index === index 
                ? { ...item, boostedSummary: data.boostedSummary, isVisible: true }
                : item
            );
          } else {
            return [...prev, {
              index,
              boostedSummary: data.boostedSummary,
              isVisible: true
            }];
          }
        });
      }
    } catch (err) {
      console.error('Boost education error:', err);
    } finally {
      setLoadingEducationIndex(null);
    }
  };

  const applyBoostedEducationSummary = (index: number) => {
    const preview = aiEducationPreviewArray.find(item => item.index === index);
    if (preview) {
      // 保存当前光标位置
      const element = document.querySelector(`[data-education-index="${index}"]`) as HTMLElement;
      const selection = window.getSelection();
      let cursorPosition = 0;
      
      if (element && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorPosition = range.startOffset;
      }
      
      setValue(`education.${index}.summary`, preview.boostedSummary);
      setAiEducationPreviewArray(prev => prev.filter(item => item.index !== index)); // 关闭预览框
      
      // 延迟恢复光标位置
      setTimeout(() => {
        const updatedElement = document.querySelector(`[data-education-index="${index}"]`) as HTMLElement;
        if (updatedElement) {
          const range = document.createRange();
          const newSelection = window.getSelection();
          
          // 尝试将光标放在内容末尾
          range.selectNodeContents(updatedElement);
          range.collapse(false);
          newSelection?.removeAllRanges();
          newSelection?.addRange(range);
          updatedElement.focus();
        }
      }, 50);
    }
  };

  const discardBoostedEducationSummary = (index: number) => {
    setAiEducationPreviewArray(prev => prev.filter(item => item.index !== index)); // 关闭预览框
  };

  // Boost Resume 主函数
  const handleBoostResume = async () => {
    setIsBoostResumeLoading(true);
    setBoostResumeProgress('Starting Boost Resume...');
    appendToTerminal('⚡ Starting Boost Resume...');
    
    // 清空之前的预览状态
    setAiPreviewArray([]);
    setAiEducationPreviewArray([]);
    
    try {
      // 确保registeredEmail存在（为老用户补充）
      const formData = getValues();
      const userEmail = formData.email;
      if (userEmail) {
        appendToTerminal('○ Ensuring user profile is up to date...');
        await ensureRegisteredEmail(userEmail);
      }
      const employmentFields = watch('employment');
      const educationFields = watch('education');
      
      // 收集所有需要处理的条目
      const tasks: Array<{type: 'employment' | 'education', index: number, content: string}> = [];
      
      // 收集 employment summaries
      employmentFields?.forEach((emp, index) => {
        if (emp.description && emp.description.trim()) {
          tasks.push({
            type: 'employment',
            index,
            content: emp.description
          });
        }
      });
      
      // 收集 education summaries
      educationFields?.forEach((edu, index) => {
        if (edu.summary && edu.summary.trim()) {
          tasks.push({
            type: 'education',
            index,
            content: edu.summary
          });
        }
      });
      
      // 并行触发 Career Highlights 生成/改写（不改变原有 Experience/Education 流程）
      let highlightsSucceeded = false;
      const highlightsPromise = (async () => {
        try {
          appendToTerminal('○ Boosting career highlights...');
          const resumeData = buildResumeDataForHighlights();
          const resp = await fetch('/api/boost-highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resumeData,
              currentHighlights: watch('about') || '',
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.highlights) {
              setAiPersonalSummaryPreview(data.highlights); // 复用个人预览框
              appendToTerminal('✓ Career highlights boosted');
              highlightsSucceeded = true;
            }
          } else {
            appendToTerminal('❌ Failed to boost career highlights');
          }
        } catch (e) {
          appendToTerminal('❌ Error boosting career highlights');
        }
      })();

      if (tasks.length === 0) {
        setBoostResumeProgress('No content to boost. Please add some summaries first.');
        appendToTerminal('❌ No content to boost. Please add some summaries first.');
        await highlightsPromise; // 等待高亮处理结束
        return;
      }
      
      setBoostResumeProgress(`Found ${tasks.length} items to boost. Processing...`);
      appendToTerminal(`✓ Found ${tasks.length} items to boost. Processing...`);
      
      // 并行处理所有任务
      const promises = tasks.map(async (task, taskIndex) => {
        setBoostResumeProgress(`Boosting ${task.type} ${task.index + 1}/${tasks.length}...`);
        appendToTerminal(`○ Boosting ${task.type} ${task.index + 1}/${tasks.length}...`);
        
        try {
          const response = await fetch('/api/boost-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary: task.content,
              type: task.type
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to boost ${task.type} ${task.index + 1}`);
          }

          const data = await response.json();
          
          // 设置对应的预览状态 - 使用数组存储
          if (task.type === 'employment') {
            setAiPreviewArray(prev => {
              const existing = prev.find(item => item.index === task.index);
              if (existing) {
                return prev.map(item => 
                  item.index === task.index 
                    ? { ...item, boostedSummary: data.boostedSummary, isVisible: true }
                    : item
                );
              } else {
                return [...prev, {
                  index: task.index,
                  boostedSummary: data.boostedSummary,
                  isVisible: true
                }];
              }
            });
          } else {
            setAiEducationPreviewArray(prev => {
              const existing = prev.find(item => item.index === task.index);
              if (existing) {
                return prev.map(item => 
                  item.index === task.index 
                    ? { ...item, boostedSummary: data.boostedSummary, isVisible: true }
                    : item
                );
              } else {
                return [...prev, {
                  index: task.index,
                  boostedSummary: data.boostedSummary,
                  isVisible: true
                }];
              }
            });
          }
          
          appendToTerminal(`✓ Successfully boosted ${task.type} ${task.index + 1}`);
          return { success: true, task };
        } catch (error) {
          console.error(`Error boosting ${task.type} ${task.index + 1}:`, error);
          appendToTerminal(`❌ Failed to boost ${task.type} ${task.index + 1}: ${error}`);
          return { success: false, task, error };
        }
      });
      
      const results = await Promise.all(promises);
      await highlightsPromise; // 等待 Career Highlights 完成
      const successCount = results.filter(r => r.success).length;
      const totalCount = tasks.length + 1; // 包含 highlights
      const successTotal = successCount + (highlightsSucceeded ? 1 : 0);
      
      setBoostResumeProgress(`Completed! ${successTotal}/${totalCount} items boosted successfully.`);
      appendToTerminal(`✓ Boost Resume completed! ${successTotal}/${totalCount} items boosted successfully.`);
      
    } catch (error) {
      console.error('Boost Resume error:', error);
      setBoostResumeProgress('Error: Failed to boost resume. Please try again.');
      appendToTerminal(`❌ Boost Resume error: ${error}`);
    } finally {
      setIsBoostResumeLoading(false);
    }
  };

  // Generate Resume function
  const handleGenerateResume = async (format?: 'pdf' | 'docx') => {
    const targetFormat = format || selectedFormat;
    const formatText = targetFormat === 'pdf' ? 'PDF' : 'DOCX';
    
    // 前置拦截：检查订阅状态
    if (!premiumStatus.isPremiumToday) {
      setPaymentErrorCode('PAYWALL_GENERATE_RESUME');
      setShowPaymentModal(true);
      return;
    }
    
    try {
      setBoostResumeProgress(`Generating ${formatText} resume...`);
      appendToTerminal(`📄 Generating ${formatText} resume...`);
      
      // 获取当前表单数据
      const formData = getValues();
      
      // 自动保存Profile到MongoDB
      const userEmail = formData.email;
      if (userEmail) {
        appendToTerminal('○ Auto-saving profile to MongoDB...');
        try {
          // 确保registeredEmail存在（为老用户补充）
          const registeredEmail = await ensureRegisteredEmail(userEmail);
          const saveResponse = await fetch('/api/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              registeredEmail: registeredEmail,
              firstName: formData.firstName || '',
              lastName: formData.lastName || '',
              jobTitle: Array.isArray(formData.jobTitle) ? formData.jobTitle[0] || '' : formData.jobTitle || '',
              location: formData.city || ''
            })
          });
          
          if (saveResponse.ok) {
            appendToTerminal('✓ Profile auto-saved to MongoDB');
          } else {
            appendToTerminal('⚠ Failed to auto-save profile to MongoDB');
          }
        } catch (saveError) {
          appendToTerminal('⚠ Error auto-saving profile to MongoDB');
          console.warn('Auto-save error:', saveError);
        }
      }
      
      // 生成智能文件名
      const firstName = formData.firstName || '';
      const lastName = formData.lastName || '';
      const jobTitle = Array.isArray(formData.jobTitle) ? formData.jobTitle[0] || '' : formData.jobTitle || '';
      const currentDate = new Date();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = currentDate.getFullYear();
      
      // 清理jobTitle，移除特殊字符，保留空格
      const cleanJobTitle = jobTitle.replace(/[^a-zA-Z0-9\s]/g, '');
      
      const smartFilename = `${firstName} ${lastName}_Resume_${cleanJobTitle}_v1_${year}${month}${day}`;
      
      // 转换数据格式以匹配ResumePDF组件的要求
      const resumeData = {
        profile: {
          name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim(),
          email: formData.email || '',
          phone: formData.phone || '',
          location: formData.city ? `${formData.city}, ${formData.country || ''}` : formData.country || ''
        },
        linkedin: formData.linkedin || '',
        personalHighlights: formData.about ? 
          formData.about.split('\n')
            .filter((line: string) => line.trim())
            .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim()) : 
          ['Professional highlights and achievements'],
        experience: (formData.employment || []).map((job: any) => ({
          title: job.position || job.title || '',
          company: job.company || '',
          location: job.location || '',
          startDate: job.startDate || '',
          endDate: job.endDate || 'Present',
          description: job.description ? 
            job.description.split('\n')
              .filter((line: string) => line.trim())
              .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim()) : 
            ['Key responsibilities and achievements']
        })),
        education: (formData.education || []).map((edu: any) => ({
          degree: edu.degree || '',
          institution: edu.school || '',
          location: edu.location || '',
          startDate: edu.startDate || '',
          endDate: edu.endDate || '',
          description: edu.summary ? 
            edu.summary.split('\n')
              .filter((line: string) => line.trim())
              .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim()) : 
            ['Academic achievements and projects']
        })),
        skills: (formData.skills || []).map((skill: any) => skill.name || skill),
        languages: (formData.languages || []).map((lang: any) => {
          if (typeof lang === 'object' && lang.language && lang.level) {
            return `${lang.language} (${lang.level})`;
          } else if (typeof lang === 'object' && lang.language) {
            return lang.language;
          } else if (typeof lang === 'string') {
            return lang;
          } else {
            return 'Unknown Language';
          }
        }),
        workingRightsAU: formData.workingRightsAU || '',
        workingRightsOther: formData.workingRightsOther || '',
        // 添加智能文件名
        smartFilename: smartFilename
      };
      
      // 调用简历生成API
      const response = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData,
          settings: {
            documentSize: 'A4',
            fontSize: 10
          },
          format: targetFormat
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        
                  if (result.success) {
            // 构建完整的下载URL，包含email参数
            const userEmail = formData.email || watch('email');
            const fullDownloadUrl = userEmail 
              ? `${result.downloadUrl}?email=${encodeURIComponent(userEmail)}`
              : result.downloadUrl;
            
            // 在新窗口打开下载链接，避免覆盖当前页面
            const downloadWindow = window.open(fullDownloadUrl, '_blank');
            
            // 如果新窗口被阻止，则使用备用方法
            if (!downloadWindow) {
              // 备用方法：创建隐藏的下载链接
              const a = document.createElement('a');
              a.href = fullDownloadUrl;
              a.download = result.filename;
              a.target = '_blank';
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            
            setBoostResumeProgress(`${formatText} resume generated successfully!`);
            appendToTerminal(`✅ ${formatText} resume generated and downloaded successfully!`);
        } else {
          throw new Error(result.error || `Failed to generate ${formatText}`);
        }
      } else {
        throw new Error(`Failed to generate ${formatText}`);
      }
    } catch (error) {
      console.error(`${formatText} generation failed:`, error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setBoostResumeProgress(`Error: Failed to generate ${formatText}. Please try again.`);
      appendToTerminal(`❌ ${formatText} generation failed: ${error instanceof Error ? error.message : error}`);
    }
  };

  const onSubmit = async (formData: ProfileFormData) => {
    const avatar = formData.avatar;
    const avatarBase64 =
      avatar instanceof File
        ? await fileToBase64(avatar)
        : typeof avatar === 'string'
        ? avatar
        : undefined;
    
    // 确保包含所有字段
    const finalPayload = {
      ...formData,
      avatar: avatarBase64,
      phoneCode: '',
      jobType: '',
      jobTitle: formData.jobTitle[0] || '',
      // 工作偏好字段
      openForRelocation: formData.openForRelocation || '',
      salaryPeriod: formData.salaryPeriod || '',
      salaryRange: formData.salaryRange || '',
      // 社交媒体字段
      linkedin: formData.linkedin || '',
      twitter: formData.twitter || '',
      website: formData.website || '',
      video: formData.video || '',
      about: formData.about || '',
      // 工作权限字段
      workingRightsAU: formData.workingRightsAU || '',
      workingRightsOther: formData.workingRightsOther || '',
      // 确保这些字段被包含
      education: formData.education || [],
      employment: formData.employment || [],
      skills: formData.skills || [],
      languages: formData.languages || [],
      careerPriorities: formData.careerPriorities || [],
    };
    
    await StorageManager.saveProfile(finalPayload);
  };

  const renderBasicFields = useMemo(() => (
    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <Input
          label={<>{t.sections.basicInfo.firstName}<span className="text-red-500 ml-1">*</span></>}
          {...register('firstName')}
          error={errors.firstName?.message}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <Input
          label={<>{t.sections.basicInfo.lastName}<span className="text-red-500 ml-1">*</span></>}
          {...register('lastName')}
          error={errors.lastName?.message}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <Input
          label={<>{t.sections.basicInfo.email}<span className="text-red-500 ml-1">*</span></>}
          type="email"
          {...register('email')}
          error={errors.email?.message}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <Input
          label={t.sections.basicInfo.phone}
          type="tel"
          {...register('phone')}
          error={errors.phone?.message}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block text-sm font-medium text-muted-foreground">
          {t.sections.basicInfo.country}<span className="text-red-500 ml-1">*</span>
        </label>
        <Select
          {...register('country')}
          options={Object.keys(cityOptionsMap).map(country => ({
            value: country,
            label: {
              en: country,
              zh:
                country === 'Australia' ? '澳大利亚'
                : country === 'China' ? '中国'
                : country === 'Hong Kong' ? '香港'
                : country === 'Singapore' ? '新加坡'
                : country === 'Taiwan' ? '台湾'
                : country === 'United States' ? '美国'
                : country === 'Japan' ? '日本'
                : country
            }
          }))}
          language={language}
          required
          error={errors.country?.message}
          onChange={(e) => {
            setValue('country', e.target.value);
            setValue('city', ''); // 重置城市
          }}
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block text-sm font-medium text-muted-foreground dark:text-gray-300">
          {language === 'zh' ? '城市' : 'City'}<span className="text-red-500 ml-1">*</span>
        </label>
        <Controller
          name="city"
          control={control}
          render={({ field }) => {
            const country = watch("country");
            const cityOptions = country ? cityOptionsMap[country as CountryKey] || [] : [];
            return (
              <Select
                key={`city-select-${country || 'no-country'}`} // 添加 key 确保国家切换时组件重新渲染
                options={cityOptions}
                value={field.value || ''}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                  const cityValue = event.target.value;
                  field.onChange(cityValue);
                  localStorage.setItem("city", cityValue);
                  // 更新 userProfile 中的城市
                  const currentUserProfileStr = localStorage.getItem('userProfile');
                  const currentUserProfile = currentUserProfileStr ? JSON.parse(currentUserProfileStr) : {};
                  const updatedUserProfile = {
                    ...currentUserProfile,
                    city: cityValue
                  };
                  localStorage.setItem('userProfile', JSON.stringify(updatedUserProfile));
                }}
                language={language}
                disabled={!country}
              />
            );
          }}
        />
        {errors.city && (
          <p className="text-sm text-red-600">{errors.city.message}</p>
        )}
      </div>
    </div>
  ), [register, errors, t, language, watch, control, selectedCountry, setValue]);

  const renderSocialFields = useMemo(() => (
    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <Input
          label={t.sections.socialMedia.linkedin}
          {...register('linkedin')}
          error={errors.linkedin?.message}
        />
      </div>
      <div className="sm:col-span-3">
        <Input
          label={t.sections.socialMedia.twitter}
          {...register('twitter')}
          error={errors.twitter?.message}
        />
      </div>
      <div className="sm:col-span-3">
        <Input
          label={t.sections.socialMedia.website}
          {...register('website')}
          error={errors.website?.message}
        />
      </div>
      <div className="sm:col-span-3">
        <Input
          label={t.sections.socialMedia.video}
          {...register('video')}
          error={errors.video?.message}
        />
      </div>
    </div>
  ), [register, errors, t]);

  // 页面初始化时自动填充 profile
  useEffect(() => {
    const userState = StorageManager.getUserState();
    if (userState && userState.profile) {
      const profile = userState.profile;
      
      // 设置基本字段
      Object.keys(profile).forEach((key) => {
        let value = (profile as any)[key];
        if (["jobTitle", "skills", "careerPriorities"].includes(key)) {
          value = Array.isArray(value) ? value : value ? [value] : [];
        }
        setValue(key as keyof ProfileFormData, value);
      });
      
      // 特别处理education和employment字段
      if (profile.education && Array.isArray(profile.education)) {
        setValue('education', profile.education);
      }
      if (profile.employment && Array.isArray(profile.employment)) {
        setValue('employment', profile.employment);
      }
      if (profile.skills && Array.isArray(profile.skills)) {
        setValue('skills', profile.skills);
      }
      if (profile.languages && Array.isArray(profile.languages)) {
        setValue('languages', profile.languages);
      }
      if (profile.careerPriorities && Array.isArray(profile.careerPriorities)) {
        setValue('careerPriorities', profile.careerPriorities);
      }
    }
  }, []);

  // 自动检测并创建Profile记录（为老用户）
  useEffect(() => {
    const autoCreateProfile = async () => {
      try {
        // 从localStorage获取用户邮箱
        const userProfileStr = localStorage.getItem('userProfile');
        const userProfile = userProfileStr ? JSON.parse(userProfileStr) : {};
        const userEmail = userProfile.email || watch('email');
        
        if (userEmail) {
          console.log('Checking profile for user:', userEmail);
          
          // 检查是否已有Profile
          const response = await fetch(`/api/profile/get?email=${encodeURIComponent(userEmail)}`);
          const data = await response.json();
          
          if (!data.success || !data.profile) {
            console.log('Auto-creating profile for existing user:', userEmail);
            
            // 自动创建基础Profile
            const registeredEmail = await ensureRegisteredEmail(userEmail);
            const createResponse = await fetch('/api/profile/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                registeredEmail: registeredEmail,
                firstName: userProfile.firstName || '',
                lastName: userProfile.lastName || '',
                jobTitle: userProfile.jobTitle || '',
                location: userProfile.city || userProfile.location || ''
              })
            });
            
            if (createResponse.ok) {
              console.log('Profile auto-created successfully for:', userEmail);
            } else {
              console.warn('Failed to auto-create profile for:', userEmail);
            }
          } else {
            console.log('Profile already exists for:', userEmail);
          }
        }
      } catch (error) {
        console.warn('Failed to auto-create profile:', error);
      }
    };
    
    // 延迟执行，确保页面完全加载
    const timer = setTimeout(autoCreateProfile, 1000);
    return () => clearTimeout(timer);
  }, [watch]);

  // 表单内容变动时自动保存 profile
  useEffect(() => {
    const subscription = watch((value) => {
      StorageManager.saveProfile({
        avatar: typeof value.avatar === 'string' ? value.avatar : avatarPreview || '',
        firstName: value.firstName || '',
        lastName: value.lastName || '',
        email: value.email || '',
        phone: value.phone || '',
        phoneCode: '',
        country: value.country || '',
        city: value.city || '',
        jobTitle: Array.isArray(value.jobTitle) ? value.jobTitle[0] || '' : (value.jobTitle || ''),
        seniority: value.seniority || '',
        jobType: '',
        // 工作偏好字段
        openForRelocation: value.openForRelocation || '',
        salaryPeriod: value.salaryPeriod || '',
        salaryRange: value.salaryRange || '',
        // 社交媒体字段
        linkedin: value.linkedin || '',
        twitter: value.twitter || '',
        website: value.website || '',
        video: value.video || '',
        about: value.about || '',
        // 工作权限字段
        workingRightsAU: value.workingRightsAU || '',
        workingRightsOther: value.workingRightsOther || '',
        // 新增字段
        education: value.education?.filter((edu): edu is { startDate: string; endDate: string; degree: string; school: string; field?: string; location?: string } => 
          edu !== undefined && 
          typeof edu.startDate === 'string' && 
          typeof edu.endDate === 'string' && 
          typeof edu.degree === 'string' && 
          typeof edu.school === 'string'
        ) || [],
        employment: value.employment?.filter((emp): emp is { startDate: string; endDate: string; company: string; position: string; description: string; department?: string; location?: string; isPresent?: boolean } =>
          emp !== undefined &&
          typeof emp.startDate === 'string' &&
          typeof emp.endDate === 'string' &&
          typeof emp.company === 'string' &&
          typeof emp.position === 'string' &&
          typeof emp.description === 'string'
        ) || [],
        skills: value.skills?.filter((skill): skill is { name: string } =>
          skill !== undefined && typeof skill.name === 'string'
        ) || [],
        languages: value.languages?.filter((lang): lang is { language: string; level: "Native" | "Fluent" | "Conversational" | "Basic" } =>
          lang !== undefined &&
          typeof lang.language === 'string' &&
          (lang.level === "Native" || lang.level === "Fluent" || lang.level === "Conversational" || lang.level === "Basic")
        ) || [],
        careerPriorities: (value.careerPriorities || []).filter((item): item is string => typeof item === 'string'),
      });
    });
          return () => subscription.unsubscribe?.();
    }, [watch, avatarPreview]);

    // 监听subscription状态变化，支付成功后自动滚动到底部
    useEffect(() => {
      if (premiumStatus.isPremiumToday) {
        // 如果用户刚变成Premium状态，自动滚动到底部
        setTimeout(() => {
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
          });
        }, 500);
      }
    }, [premiumStatus.isPremiumToday]);

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white fixed top-0 left-0 w-full z-50 shadow-sm h-[56px]">
        <nav className="flex justify-between items-center px-6 h-[56px]">
          <div className="flex space-x-6">
            <Logo />
            <div className="hidden md:flex space-x-6">
              <Link href="/profile" className="border-b-2 border-blue-500 h-[56px] flex items-center text-[18px] font-medium text-blue-600">
                Profile
              </Link>
              <Link href="/jobs" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Jobs
              </Link>
              <Link href="/applications" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Applications
              </Link>
              <Link href="/resources" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Resources
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <AccountSettingIcon 
              isPremium={premiumStatus.isPremium} 
              className="ml-8"
              expiresAt={premiumStatus.expiresAt}
              expiresAtAEST={premiumStatus.expiresAtAEST}
            />
            {/* 语言栏暂时注释掉 - 这一版本不上线中文
            <select
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-9"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
            */}
          </div>
        </nav>
      </div>

      {/* 响应式左右布局容器 */}
      <div className="mt-16 flex flex-col lg:flex-row w-full max-w-[1440px] mx-auto px-4 lg:px-6 gap-4">
        {/* 左侧 Profile 表单 */}
        <div className="flex-1 lg:flex-[1.4] min-w-0">
          <div className="bg-white">
            <div className="py-8 px-8 sm:px-10 lg:px-12">
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="relative"> {/* resume上传区域外层加relative定位 */}
                      <ResumeUploadTip language={language} />
                      <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          <div className="text-center">
                            <label
                              htmlFor="resume-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>Upload Resume<span className="text-red-500 ml-1">*</span></span>
                              <input
                                id="resume-upload"
                                type="file"
                                className="sr-only"
                                accept=".pdf,.doc,.docx,.txt,.pages"
                                onChange={handleResumeChange}
                              />
                            </label>
                            <p className="text-xs text-gray-500 mt-2">Accepted Formats: PDF, DOCX, TXT</p>
                          </div>
                          {isParsingResume && (
                            <p className="text-sm text-blue-600 mt-2">Parsing resume...</p>
                          )}
                          {resumeFile && (
                            <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm text-gray-500">{resumeFile.name}</span>
                              <button
                                type="button"
                                onClick={handleRemoveResume}
                                className="text-sm text-red-500 hover:text-red-700"
                              >
                                {language === 'en' ? 'Remove' : '删除'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        {avatarPreview ? (
                          <div className="relative w-24 h-24 mx-auto">
                            <img
                              src={avatarPreview}
                              alt="Avatar preview"
                              className="rounded-full object-cover w-full h-full"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveAvatar}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <label
                              htmlFor="avatar"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>{t.sections.photo.upload}</span>
                              <input
                                id="avatar"
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={handleAvatarChange}
                              />
                            </label>
                            <p className="text-xs text-gray-500 mt-2">Accepted Formats: PNG, JPG · Max Size: 10MB</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {language === 'zh' ? '基本信息' : 'BASIC INFORMATION'}
                      </h3>
                      {renderBasicFields}
                  </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-6">
                    <JobTitleSelector
                      value={watch('jobTitle')?.[0] || ''}
                      onChange={(value) => setValue('jobTitle', value ? [value] : [])}
                      language={language}
                      error={errors.jobTitle?.message}
                      required
                      label={t.sections.jobPreference.jobTitle}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Select
                      label={t.sections.jobPreference.seniority}
                      options={SENIORITY_LEVELS.map(opt => ({
                        ...opt,
                        label: {
                          en: opt.label.en === 'Senior' ? 'Senior Level' : opt.label.en === 'Executive' ? 'Executive Level' : opt.label.en,
                          zh: opt.label.zh // 保持中文不变
                        }
                      }))}
                      {...register('seniority')}
                      error={errors.seniority?.message}
                      required
                      language={language}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Select
                      label={t.sections.jobPreference.openForRelocation}
                      options={[
                        { value: 'yes', label: { en: 'Yes', zh: '是' } },
                        { value: 'no', label: { en: 'No', zh: '否' } },
                      ]}
                      {...register('openForRelocation')}
                      error={errors.openForRelocation?.message}
                      required
                      language={language}
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      {language === 'en' ? 'Expected Salary' : '期望薪资'}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        options={SALARY_PERIODS}
                        {...register('salaryPeriod')}
                        error={errors.salaryPeriod?.message}
                        required
                        language={language}
                      />
                      {watch('salaryPeriod') === 'per_year' ? (
                        <Select
                          options={salaryRanges}
                          {...register('salaryRange')}
                          error={errors.salaryRange?.message}
                          required
                          language={language}
                        />
                      ) : (
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">
                              {selectedCountry === 'cn' ? '¥' : '$'}
                            </span>
                          </div>
                          <input
                            type="number"
                            className={cn(
                              'block w-full h-10 px-3 py-2 text-sm rounded-md pl-7 pr-12',
                              'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
                              errors.salaryRange && 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            )}
                            placeholder={language === 'en' ? 'Enter Amount' : '请输入金额'}
                            {...register('salaryRange')}
                          />
                          {watch('salaryPeriod') === 'per_year' && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">
                                {selectedCountry === 'cn' ? 'RMB' : 'AUD'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {errors.salaryRange && (
                      <p className="mt-1 text-sm text-red-500">{String(errors.salaryRange.message)}</p>
                    )}
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      {language === 'en' ? 'Career Highlights' : '职业亮点'}
                    </label>
                    <div
                      contentEditable
                      className="mt-1 block w-full px-3 py-2 text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 whitespace-pre-wrap"
                      onInput={(e) => {
                        const content = e.currentTarget.textContent || '';
                        setValue('about', content);
                        // 自动调整高度
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                      }}
                      onBlur={(e) => {
                        const content = e.currentTarget.textContent || '';
                        setValue('about', content);
                      }}
                      suppressContentEditableWarning={true}
                      ref={(el) => {
                        if (el && el.textContent !== (watch('about') || '')) {
                          el.textContent = watch('about') || '';
                          // 设置初始高度
                          el.style.height = 'auto';
                          el.style.height = el.scrollHeight + 'px';
                        }
                      }}
                    />
                    {/* Career Highlights: Generate/Rewrite with AI */}
                    <div className="flex space-x-2 mt-1">
                      {watch('about') && (watch('about') || '').trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-red-500 hover:text-red-700"
                          onClick={() => setValue('about', '')}
                          disabled={isProcessing}
                        >
                          {language === 'en' ? 'Remove' : '删除'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-blue-500 hover:text-blue-700"
                        onClick={() => handleBoostHighlights()}
                        disabled={loadingIndex === -2}
                      >
                        {loadingIndex === -2 ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          (watch('about') && (watch('about') || '').trim()) ? 'Rewrite with AI' : 'Generate with AI'
                        )}
                      </Button>
                    </div>
                    
                    {/* AI Preview Box for Personal Summary */}
                    <div className="min-h-[0px] transition-all duration-300 ease-in-out">
                    {aiPersonalSummaryPreview && (
                        <div className="mt-2 p-3 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg">
                        <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                            {aiPersonalSummaryPreview}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span 
                              className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-700"
                              style={{
                                clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%, 10% 50%)',
                                backgroundColor: '#dbeafe',
                                paddingLeft: '18px',
                                paddingRight: '16px'
                              }}
                            >
                              {pickTag(aiPersonalSummaryPreview)}
                            </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => applyBoostedPersonalSummary()}
                              className="h-8 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                              <span>+</span>
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => discardBoostedPersonalSummary()}
                              className="h-8 px-3 bg-white text-blue-600 text-sm font-medium rounded-md border border-blue-300 hover:bg-blue-50 transition-colors"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">EXPERIENCE<span className="text-red-500">*</span></h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                                              onClick={() => appendEmployment({ startDate: '', endDate: '', company: '', position: '', department: '', location: '', description: '', isPresent: false })}
                    >
                      + {t.sections.additionalInfo.employment.add}
                    </Button>
                  </div>
                  {employmentFields.map((field, index) => (
                    <div key={field.id} className="mb-4 p-4 border rounded-lg">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                          label={t.sections.additionalInfo.employment.company}
                          {...register(`employment.${index}.company`)}
                          error={errors.employment?.[index]?.company?.message}
                        />
                        <Input
                          label={t.sections.additionalInfo.employment.position}
                          {...register(`employment.${index}.position`)}
                          error={errors.employment?.[index]?.position?.message}
                        />
                        <Input
                          label="Department"
                          {...register(`employment.${index}.department`)}
                          error={errors.employment?.[index]?.department?.message}
                        />
                        <Input
                          label="Location"
                          {...register(`employment.${index}.location`)}
                          error={errors.employment?.[index]?.location?.message}
                        />
                            <Input
                              label={t.sections.additionalInfo.employment.startDate}
                              value={watch(`employment.${index}.startDate`) || ''}
                              onChange={(e) => setValue(`employment.${index}.startDate`, e.target.value)}
                              placeholder="YYYY or YYYY-MM"
                              error={errors.employment?.[index]?.startDate?.message}
                            />
                            {index === 0 ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  label={t.sections.additionalInfo.employment.endDate}
                                  value={watch(`employment.${index}.endDate`) || ''}
                                  onChange={(e) => setValue(`employment.${index}.endDate`, e.target.value)}
                                  placeholder="YYYY or YYYY-MM"
                                  error={errors.employment?.[index]?.endDate?.message}
                                  disabled={watch(`employment.${index}.isPresent`)}
                                />
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id={`present-${index}`}
                                    checked={watch(`employment.${index}.isPresent`) || false}
                                    onChange={(e) => {
                                      setValue(`employment.${index}.isPresent`, e.target.checked);
                                      if (e.target.checked) {
                                        setValue(`employment.${index}.endDate`, '');
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label htmlFor={`present-${index}`} className="ml-2 text-sm text-muted-foreground">
                                    Present
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <Input
                                label={t.sections.additionalInfo.employment.endDate}
                                value={watch(`employment.${index}.endDate`) || ''}
                                onChange={(e) => setValue(`employment.${index}.endDate`, e.target.value)}
                                placeholder="YYYY or YYYY-MM"
                                error={errors.employment?.[index]?.endDate?.message}
                              />
                            )}
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-muted-foreground">Summary</label>
                              <div
                                contentEditable
                                data-employment-index={index}
                                className="mt-1 block w-full px-3 py-2 text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 whitespace-pre-wrap"
                                onInput={(e) => {
                                  const content = e.currentTarget.textContent || '';
                                  setValue(`employment.${index}.description`, content);
                                }}
                                onBlur={(e) => {
                                  const content = e.currentTarget.textContent || '';
                                  setValue(`employment.${index}.description`, content);
                                }}
                                suppressContentEditableWarning={true}
                                ref={(el) => {
                                  if (el && el.textContent !== (watch(`employment.${index}.description`) || '')) {
                                    el.textContent = watch(`employment.${index}.description`) || '';
                                  }
                                }}
                              />
                              {errors.employment?.[index]?.description?.message && (
                                <p className="mt-1 text-sm text-red-600">{errors.employment[index].description?.message}</p>
                              )}
                            </div>
                      </div>
                      <div className="flex space-x-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                          className="h-8 px-3 text-red-500 hover:text-red-700"
                        onClick={() => removeEmployment(index)}
                      >
                        {language === 'en' ? 'Remove' : '删除'}
                      </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-blue-500 hover:text-blue-700"
                          onClick={() => handleBoostSummary(index)}
                          disabled={loadingIndex === index}
                        >
                          {loadingIndex === index ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            '⚡ Improve with AI'
                          )}
                        </Button>
                      </div>
                      
                      {/* AI Preview Box - Moved below buttons */}
                      <div className="min-h-[0px] transition-all duration-300 ease-in-out">
                        {aiPreviewArray.find(item => item.index === index && item.isVisible) && (
                          <div className="mt-2 p-3 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg">
                            <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                {aiPreviewArray.find(item => item.index === index)?.boostedSummary}
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span 
                              className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-700"
                              style={{
                                clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%, 10% 50%)',
                                backgroundColor: '#dbeafe',
                                paddingLeft: '18px',
                                paddingRight: '16px'
                              }}
                            >
                              {pickTag(aiPreviewArray.find(item => item.index === index)?.boostedSummary)}
                            </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => applyBoostedSummary(index)}
                                  className="h-8 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                  <span>+</span>
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => discardBoostedSummary(index)}
                                  className="h-8 px-3 bg-white text-blue-600 text-sm font-medium rounded-md border border-blue-300 hover:bg-blue-50 transition-colors"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">EDUCATION<span className="text-red-500">*</span></h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                      onClick={() => appendEducation({ startDate: '', endDate: '', degree: '', school: '', field: '', location: '', summary: '' })}
                    >
                      + {t.sections.additionalInfo.education.add}
                    </Button>
                  </div>
                  {educationFields.map((field, index) => (
                    <div key={field.id} className="mb-4 p-4 border rounded-lg">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                          label={t.sections.additionalInfo.education.school}
                          {...register(`education.${index}.school`)}
                          error={errors.education?.[index]?.school?.message}
                        />
                        <Input
                          label={t.sections.additionalInfo.education.degree}
                          {...register(`education.${index}.degree`)}
                          error={errors.education?.[index]?.degree?.message}
                        />
                        <Input
                          label="Field"
                          {...register(`education.${index}.field`)}
                          error={errors.education?.[index]?.field?.message}
                        />
                        <Input
                          label="Location"
                          {...register(`education.${index}.location`)}
                          error={errors.education?.[index]?.location?.message}
                        />
                            <Input
                              label={t.sections.additionalInfo.education.startDate}
                              value={field.startDate || ''}
                              onChange={(e) => setValue(`education.${index}.startDate`, e.target.value)}
                              placeholder="YYYY or YYYY-MM"
                              error={errors.education?.[index]?.startDate?.message}
                            />
                                                        <Input
                              label={t.sections.additionalInfo.education.endDate}
                              value={field.endDate || ''}
                              onChange={(e) => setValue(`education.${index}.endDate`, e.target.value)}
                              placeholder="YYYY or YYYY-MM"
                              error={errors.education?.[index]?.endDate?.message}
                            />
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-muted-foreground">Summary</label>
                              <div
                                contentEditable
                                data-education-index={index}
                                className="mt-1 block w-full px-3 py-2 text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 whitespace-pre-wrap"
                                onInput={(e) => {
                                  const content = e.currentTarget.textContent || '';
                                  setValue(`education.${index}.summary`, content);
                                }}
                                onBlur={(e) => {
                                  const content = e.currentTarget.textContent || '';
                                  setValue(`education.${index}.summary`, content);
                                }}
                                suppressContentEditableWarning={true}
                                ref={(el) => {
                                  if (el && el.textContent !== (watch(`education.${index}.summary`) || '')) {
                                    el.textContent = watch(`education.${index}.summary`) || '';
                                  }
                                }}
                              />
                              {errors.education?.[index]?.summary?.message && (
                                <p className="mt-1 text-sm text-red-600">{errors.education[index].summary?.message}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2 mt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-red-500 hover:text-red-700"
                              onClick={() => removeEducation(index)}
                            >
                              {language === 'en' ? 'Remove' : '删除'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-blue-500 hover:text-blue-700"
                              onClick={() => handleBoostEducationSummary(index)}
                              disabled={loadingEducationIndex === index}
                            >
                              {loadingEducationIndex === index ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing...
                                </>
                              ) : (
                                '⚡ Improve with AI'
                              )}
                            </Button>
                          </div>
                          
                          {/* AI Preview Box for Education Summary */}
                          <div className="min-h-[0px] transition-all duration-300 ease-in-out">
                            {aiEducationPreviewArray.find(item => item.index === index && item.isVisible) && (
                              <div className="mt-2 p-3 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg">
                                <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                    {aiEducationPreviewArray.find(item => item.index === index)?.boostedSummary}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span 
                              className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-700"
                              style={{
                                clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%, 10% 50%)',
                                backgroundColor: '#dbeafe',
                                paddingLeft: '18px',
                                paddingRight: '16px'
                              }}
                            >
                              {pickTag(aiEducationPreviewArray.find(item => item.index === index)?.boostedSummary)}
                            </span>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => applyBoostedEducationSummary(index)}
                                      className="h-8 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                      <span>+</span>
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => discardBoostedEducationSummary(index)}
                                      className="h-8 px-3 bg-white text-blue-600 text-sm font-medium rounded-md border border-blue-300 hover:bg-blue-50 transition-colors"
                                    >
                                      Skip
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                    </div>
                  ))}
                </div>

                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">ADDITIONAL INFORMATION</h3>
                      <label className="block text-lg font-semibold text-gray-900">
                        Career Priorities (1 - 3 options) <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          'Company Reputation',
                          'Higher Compensation',
                          'Location',
                          'Work-Life Balance',
                          'Hybrid Work (2+ Days Remote)',
                          'Clear Promotion Pathways',
                          'Company Values',
                          'Industry Fit',
                          'Functional Fit',
                          'Culture Fit'
                        ].map((priority) => (
                          <button
                            key={priority}
                            type="button"
                            onClick={() => {
                              const currentPriorities = watch('careerPriorities') || [];
                              if (currentPriorities.includes(priority)) {
                                setValue(
                                  'careerPriorities',
                                  currentPriorities.filter((p: string) => p !== priority)
                                );
                              } else if (currentPriorities.length < 3) {
                                setValue('careerPriorities', [...currentPriorities, priority]);
                              } else {
                                alert('You can select up to 3 priorities only.');
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              (watch('careerPriorities') || []).includes(priority)
                                ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                                : 'bg-gray-100 text-gray-800 border-2 border-gray-200'
                            }`}
                          >
                            {priority}
                          </button>
                        ))}
              </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Working Rights</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="w-full">
                          <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Australia Working Rights<span className="text-red-500 ml-1">*</span>
                          </label>
                          <select
                            {...register('workingRightsAU')}
                            className={`w-full h-10 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              errors.workingRightsAU ? 'border-red-500' : 'border-gray-300'
                            }`}
                            required
                          >
                            <option value="" style={{ color: '#6b7280' }}>Please select</option>
                            <option value="Australian Citizen">Australian Citizen</option>
                            <option value="Australian Permanent Resident">Australian Permanent Resident</option>
                            <option value="Temporary Work Visa (with full work rights)">Temporary Work Visa (with full work rights)</option>
                            <option value="Student Visa (limited work rights)">Student Visa (limited work rights)</option>
                            <option value="No work rights in Australia">No work rights in Australia</option>
                          </select>
                          {errors.workingRightsAU && <p className="mt-1 text-sm text-red-500">{errors.workingRightsAU.message}</p>}
                        </div>
                        <Input
                          label="Other Country Working Rights"
                          {...register('workingRightsOther')}
                          error={errors.workingRightsOther?.message}
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Languages</h3>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                          onClick={() => appendLanguage({ language: '', level: 'Conversational' })}
                        >
                          + Add Language
                        </Button>
                      </div>
                      {languageFields.map((field, index) => (
                        <div key={field.id} className="mb-4 p-4 border rounded-lg">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                              label="Language"
                              {...register(`languages.${index}.language`)}
                              error={errors.languages?.[index]?.language?.message}
                            />
                            <div className="w-full">
                              <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Level
                              </label>
                              <select
                                {...register(`languages.${index}.level`)}
                                className={`w-full h-10 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  errors.languages?.[index]?.level ? 'border-red-500' : 'border-gray-300'
                                }`}
                              >
                                <option value="Native">Native</option>
                                <option value="Fluent">Fluent</option>
                                <option value="Conversational">Conversational</option>
                                <option value="Basic">Basic</option>
                              </select>
                              {errors.languages?.[index]?.level && <p className="mt-1 text-sm text-red-500">{errors.languages[index].level?.message}</p>}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-8 px-3 text-red-500 hover:text-red-700"
                            onClick={() => removeLanguage(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 mb-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{t.sections.additionalInfo.skills.title}</h3>
                        {(skillFields?.length || 0) < 10 && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                            onClick={() => appendSkill({ name: '' })}
                          >
                            + Add Skill
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {skillFields.map((field, index) => (
                          <div key={field.id} className="flex items-start gap-2">
                            <div className="flex-1">
                              <Input
                                {...register(`skills.${index}.name`)}
                                error={errors.skills?.[index]?.name?.message}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSkill(index)}
                              className="mt-2 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.sections.socialMedia.title}</h3>
                      {renderSocialFields}
                    </div>

                    {/* Others */}
                    <div className="mt-6">
                      <div className="mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{t.sections.others.title}</h3>
                      </div>
                      <div className="flex flex-col gap-2 mb-4">
                        <div className="flex gap-2 flex-wrap justify-end">
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700" onClick={() => appendOther({ kind: 'volunteering', title: 'Community & Volunteering', summary: '' })}>+ Add Volunteer</Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700" onClick={() => appendOther({ kind: 'club', title: 'Clubs', summary: '' })}>+ Add Club</Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700" onClick={() => appendOther({ kind: 'publication', title: 'Publications', summary: '' })}>+ Add Publication</Button>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700" onClick={() => appendOther({ kind: 'interest', title: 'Interests', summary: '' })}>+ Add Interest</Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-sm font-normal text-gray-500 hover:text-gray-700" onClick={() => appendOther({ kind: 'custom', title: 'Other', summary: '' })}>+ Add Custom</Button>
                        </div>
                      </div>

                      {othersFields.map((field, idx) => (
                        <div key={field.id} className="mb-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <Input
                                placeholder={t.sections.others.summary}
                                value={(watch(`others.${idx}.summary` as const) as string) || ''}
                                onChange={(e) => setValue(`others.${idx}.summary` as const, e.target.value)}
                              />
                            </div>
                            <button type="button" onClick={() => removeOther(idx)} className="text-red-600 hover:text-red-700 mt-2">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-4 mt-8">
                    <Button
                      type="submit"
                      variant="outline"
                      className="h-10 px-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                    >
                      {language === 'en' ? 'Save' : '保存'}
                    </Button>
                    <div className="relative">
                      <div className="absolute -top-4 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                        AI Enhanced
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBoostResume}
                        disabled={isBoostResumeLoading}
                        className="h-10 px-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isBoostResumeLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {boostResumeProgress || 'Boosting...'}
                          </>
                        ) : (
                          'Boost Resume'
                        )}
                      </Button>
                    </div>
                                         <div className="relative">
                       <div className="absolute -top-4 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                         ATS-friendly
                       </div>
                       <Button
                         type="button"
                         variant="outline"
                         onClick={() => handleGenerateResume('pdf')}
                         className="h-10 px-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                       >
                         Download Resume
                       </Button>
                     </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          // 保存Profile到MongoDB
                          const formData = getValues();
                          const userEmail = formData.email;
                          
                          if (userEmail) {
                            console.log('Saving profile to MongoDB for:', userEmail);
                            
                            // 确保registeredEmail存在（为老用户补充）
                            const registeredEmail = await ensureRegisteredEmail(userEmail);
                            console.log('Using registeredEmail:', registeredEmail);
                            
                            // Next-Jobs功能现在免费使用，不需要检查订阅状态
                            // 注释掉付费检查逻辑
                            /*
                            // 检查订阅状态
                            try {
                              const subscriptionResponse = await fetch(`/api/subscription/status?email=${userEmail}`);
                              if (subscriptionResponse.ok) {
                                const subscriptionData = await subscriptionResponse.json();
                                
                                // 如果不是Premium用户，显示付费弹窗
                                if (!subscriptionData.isPremiumToday) {
                                  setPaymentErrorCode('PAYWALL_NEXT_JOBS');
                                  setShowPaymentModal(true);
                                  return;
                                }
                              }
                            } catch (error) {
                              console.error('Error checking subscription:', error);
                              // 如果检查失败，允许继续（避免阻塞用户体验）
                            }
                            */
                            
                            const saveResponse = await fetch('/api/profile/save', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                email: userEmail,
                                registeredEmail: registeredEmail,
                                firstName: formData.firstName || '',
                                lastName: formData.lastName || '',
                                jobTitle: Array.isArray(formData.jobTitle) ? formData.jobTitle[0] || '' : formData.jobTitle || '',
                                location: formData.city || ''
                              })
                            });
                            
                            if (saveResponse.ok) {
                              console.log('Profile saved to MongoDB successfully');
                              appendToTerminal('✓ Profile saved to MongoDB successfully');
                            } else {
                              console.warn('Failed to save profile to MongoDB');
                              appendToTerminal('⚠ Failed to save profile to MongoDB');
                            }
                          }
                          
                          // 跳转到Jobs页面
                          router.push('/jobs?fromProfile=true');
                        } catch (error) {
                          console.error('Error saving profile:', error);
                          appendToTerminal(`❌ Error saving profile: ${error}`);
                          // 即使保存失败也跳转，不影响用户体验
                          router.push('/jobs?fromProfile=true');
                        }
                      }}
                      className="h-10 px-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                    >
                      {language === 'en' ? 'Search Jobs' : '搜索职位'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 text-right mt-2">
                    <span className="text-red-500">*</span> Required fields
                  </p>
            </form>
          )}
            </div>
          </div>
        </div>

        {/* 右侧 Hera Computer */}
        <aside className="hidden lg:block lg:flex-[0.6] max-w-[420px] shrink-0">
          <div className="sticky top-0 p-4 pt-2 bg-white z-10">
            <h2 className="text-base font-semibold text-gray-700 mb-2">Héra Computer</h2>
            <div 
              className="font-mono text-sm leading-[20px] whitespace-pre-wrap bg-white rounded-lg p-4 border border-gray-200 h-[calc(100vh-120px)] overflow-y-auto w-full max-w-full"
              style={{
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: '12px',
                lineHeight: '20px',
                backgroundColor: '#ffffff',
                color: '#374151'
              }}
            >
              {terminalOutput.map((line, index) => {
                // 处理编译消息的颜色
                if (line.startsWith('○ Compiling')) {
                  return (
                    <div key={index} className="text-gray-500">
                      {line}
                    </div>
                  );
                }
                // 处理编译完成消息的颜色
                if (line.startsWith('✓ Compiled') || line.startsWith('✓')) {
                  return (
                    <div key={index} className="text-green-600">
                      {line}
                    </div>
                  );
                }
                // 处理错误消息的颜色
                if (line.startsWith('❌')) {
                  return (
                    <div key={index} className="text-red-600">
                      {line}
                    </div>
                  );
                }
                // 处理进行中消息的颜色
                if (line.startsWith('○')) {
                  return (
                    <div key={index} className="text-gray-500">
                      {line}
                    </div>
                  );
                }
                // 处理 API 调用和 JSON 数据
                if (line.includes('API called with:') || line.includes('Raw response:')) {
                  const [prefix, data] = line.split(/:\s(.+)/);
                  return (
                    <div key={index}>
                      <span className="text-gray-600">{prefix}:</span>
                      <pre className="text-gray-800 ml-2 whitespace-pre-wrap">{data}</pre>
                    </div>
                  );
                }
                // 处理 HTTP 请求日志
                if (line.match(/^(GET|POST|PUT|DELETE)/)) {
                  const parts = line.split(' ');
                  return (
                    <div key={index}>
                      <span className="text-blue-600">{parts[0]}</span>
                      <span className="text-gray-600"> {parts.slice(1).join(' ')}</span>
                    </div>
                  );
                }
                // 默认样式
                return (
                  <div key={index} className="text-gray-600">
                    {line}
                  </div>
                );
              })}
              {(isParsingResume || isProcessing) && (
                <div className="animate-pulse text-gray-600">$ _</div>
              )}
            </div>
          </div>
        </aside>
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => setShowPaymentModal(false)}
          email={session?.user?.email || ''}
          errorCode={paymentErrorCode}
          postPaymentAction={() => {
            // 支付成功后，重新执行Generate Resume
            if (selectedFormat) {
              handleGenerateResume(selectedFormat);
            }
          }}
          featureDescription="Access all resume and cover letter features with a Premium Pass"
        />
      )}
    </div>
  );
}
