export interface PersonalInfo {
  avatar?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  phoneCode: string;
  country: string;
  city: string;
  jobTitle: string;
  seniority: string;
  jobType: string;
  professionalHeadline?: string;
  shortBio?: string;
  // 工作偏好字段
  openForRelocation?: string;
  salaryPeriod?: string;
  salaryRange?: string;
  // 社交媒体字段
  linkedin?: string;
  twitter?: string;
  website?: string;
  video?: string;
  about?: string;
  // 工作权限字段（保留旧字段用于向后兼容）
  workingRightsAU?: string;
  workingRightsOther?: string;
  // 新字段（多国家支持）
  workingRights?: string;              // 选择的 Work Rights 选项（label）
  workingRightsStatus?: string;         // Work Rights 状态（status枚举值）
  workingRightsVisaType?: string;        // 签证类型（可选）
  // 其他国家的 Work Rights（数组）
  otherWorkingRights?: Array<{
    country: string;              // 国家名称
    workingRights: string;        // Work Rights label
    status?: string;              // Work Rights status（可选）
    visaType?: string;            // 签证类型（可选）
  }>;
  // 新增字段
  education?: Array<{
    startDate: string;
    endDate: string;
    degree: string;
    school: string;
    field?: string;
    location?: string;
  }>;
  employment?: Array<{
    startDate: string;
    endDate: string;
    company: string;
    position: string;
    description: string;
    department?: string;
    location?: string;
    isPresent?: boolean;
  }>;
  skills?: Array<{ name: string }>;
  languages?: Array<{
    language: string;
    level: 'Native' | 'Fluent' | 'Conversational' | 'Basic';
  }>;
  careerPriorities?: string[];
}

export interface SalaryInfo {
  amount: string;
  period: string;
  currency: 'AUD' | 'RMB';
}

export interface LocationPreferences {
  openToRemote: boolean;
  openToRelocation: boolean;
}

export interface SocialPresence {
  linkedin?: string;
  twitter?: string;
  website?: string;
  video?: string;
}

export interface AdditionalDetails {
  skills: string[];
  employmentHistory: EmploymentHistory[];
  education: Education[];
  certifications: Certification[];
}

export interface EmploymentHistory {
  id: string;
  companyName: string;
  position: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface ProfileFormData {
  personalInfo: PersonalInfo;
  salaryInfo: SalaryInfo;
  locationPreferences: LocationPreferences;
  socialPresence: SocialPresence;
  additionalDetails: AdditionalDetails;
  resume?: File;
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  jobTitles: string[];
  skills: string[];
  education: Education[];
  employmentHistory: EmploymentHistory[];
} 