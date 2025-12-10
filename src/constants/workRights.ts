// ============================================
// Working Rights Configuration
// ============================================
// 通用枚举（后端用，不要被文案绑死）
export type WorkingRightsStatus =
  | 'CITIZEN'
  | 'PR'
  | 'OPEN_WORK_VISA'          // 有开放工签 / 全职工作权
  | 'EMPLOYER_SPONSORED'      // 雇主担保/绑定雇主
  | 'STUDENT_LIMITED'         // 学签有限工时
  | 'DEPENDENT_WITH_WORK_RIGHTS'
  | 'NO_RIGHT'
  | 'OTHER';

export interface WorkingRightsOption {
  label: string;                    // 前端展示文案
  status: WorkingRightsStatus;
  supportsVisaType?: boolean;       // 是否展示"签证类型"输入/子下拉
  visaExamples?: string[];          // placeholder/tooltip 用
}

// 国家名称到国家代码的映射（因为country字段存的是完整名称）
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'Australia': 'AU',
  'United States': 'US',
  'Canada': 'CA',
  'United Kingdom': 'UK',
  'Singapore': 'SG',
  'France': 'FR',
  'Germany': 'DE',
  'Hong Kong': 'HK',
  'China': 'CN',
  'Taiwan': 'TW',
  'Japan': 'JP',
  'Malaysia': 'MY',
  'Philippines': 'PH',
  'India': 'IN',
  'Thailand': 'TH',
  'Turkey': 'TR',
  'Netherlands': 'NL',
  'Spain': 'ES',
  'Italy': 'IT',
  'Poland': 'PL',
  'Ireland': 'IE',
  'Brazil': 'BR',
  'Peru': 'PE',
  'Mexico': 'MX',
};

// ============================================
// 8个重点国家的详细配置
// ============================================

const AU_OPTIONS: WorkingRightsOption[] = [
  { label: 'Australian Citizen', status: 'CITIZEN' },
  { label: 'Australian Permanent Resident', status: 'PR' },
  {
    label: 'Temporary Visa – Full Work Rights (e.g. 482 / 485)',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['482', '485', '408', '600 (Business)']
  },
  {
    label: 'Student Visa – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true,
    visaExamples: ['Student 500']
  },
  {
    label: 'Partner / Dependent Visa – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true,
    visaExamples: ['Partner 820/801', '309/100', 'Dependent 500']
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const US_OPTIONS: WorkingRightsOption[] = [
  { label: 'US Citizen', status: 'CITIZEN' },
  { label: 'US Permanent Resident (Green Card)', status: 'PR' },
  {
    label: 'Work Visa – Employer Sponsored',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['H1B', 'E3', 'O1', 'L1', 'TN']
  },
  {
    label: 'Student Visa – Limited Work Rights (F1 / J1)',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true,
    visaExamples: ['F1 - CPT', 'F1 - OPT', 'F1 - STEM OPT', 'J1']
  },
  {
    label: 'Dependent Visa – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true,
    visaExamples: ['H4 EAD', 'L2 EAD']
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const CA_OPTIONS: WorkingRightsOption[] = [
  { label: 'Canadian Citizen', status: 'CITIZEN' },
  { label: 'Permanent Resident of Canada', status: 'PR' },
  {
    label: 'Open Work Permit – Full Work Rights',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['Post-Graduation Work Permit (PGWP)', 'Open Work Permit']
  },
  {
    label: 'Employer-specific Work Permit',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['LMIA-based Work Permit', 'Intra-company Transfer']
  },
  {
    label: 'Student Visa – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true,
    visaExamples: ['Study Permit with Work Authorization']
  },
  {
    label: 'Spousal / Dependent with Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true,
    visaExamples: ['Spousal Open Work Permit']
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const UK_OPTIONS: WorkingRightsOption[] = [
  { label: 'UK Citizen', status: 'CITIZEN' },
  { label: 'Permanent Resident / Indefinite Leave to Remain', status: 'PR' },
  {
    label: 'Work Visa – Full Work Rights (Not Employer-tied)',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['Global Talent Visa', 'High Potential Individual']
  },
  {
    label: 'Skilled Worker or Employer-sponsored Work Visa',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['Skilled Worker Visa', 'Health and Care Worker']
  },
  {
    label: 'Student Visa – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true,
    visaExamples: ['Student Route']
  },
  {
    label: 'Dependent / Partner Visa – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true,
    visaExamples: ['Spouse / Partner Visa']
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const SG_OPTIONS: WorkingRightsOption[] = [
  { label: 'Singapore Citizen', status: 'CITIZEN' },
  { label: 'Singapore Permanent Resident', status: 'PR' },
  {
    label: 'Employment Pass / S Pass / Other Work Pass',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['Employment Pass (EP)', 'S Pass', 'Tech.Pass']
  },
  {
    label: 'Open Work Rights (e.g. LOC / One Pass)',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['Overseas Networks & Expertise Pass', 'Letter of Consent']
  },
  {
    label: 'Student Pass – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true,
    visaExamples: ['Student Pass']
  },
  {
    label: 'Dependent / Long-Term Visit Pass – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true,
    visaExamples: ['DP with LOC']
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const FR_OPTIONS: WorkingRightsOption[] = [
  { label: 'French Citizen', status: 'CITIZEN' },
  { label: 'Permanent Resident / Long-term Residence Permit', status: 'PR' },
  {
    label: 'Work Permit – Full Work Rights',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['Carte de séjour salarié', 'Passeport Talent']
  },
  {
    label: 'Employer-sponsored Work Permit',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['Salarié', 'Passeport Talent - Salarié qualifié']
  },
  {
    label: 'Student Residence Permit – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true
  },
  {
    label: 'Family / Dependent Residence Permit – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const DE_OPTIONS: WorkingRightsOption[] = [
  { label: 'German Citizen', status: 'CITIZEN' },
  { label: 'Permanent Resident / Niederlassungserlaubnis', status: 'PR' },
  {
    label: 'Work Permit / EU Blue Card – Full Work Rights',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['EU Blue Card', 'Niederlassungserlaubnis with work']
  },
  {
    label: 'Employer-specific Work Permit',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['Aufenthaltserlaubnis mit Arbeitserlaubnis']
  },
  {
    label: 'Student Residence Permit – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true
  },
  {
    label: 'Family / Dependent Residence Permit – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

const HK_OPTIONS: WorkingRightsOption[] = [
  { label: 'Hong Kong Permanent Resident / Right of Abode', status: 'CITIZEN' },
  { label: 'Hong Kong Resident with Full Work Rights', status: 'PR' },
  {
    label: 'IANG / Employment / Other Work Visa – Full Work Rights',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['IANG', 'General Employment Policy (GEP)']
  },
  {
    label: 'Employer-sponsored Employment Visa',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['GEP with specific employer']
  },
  {
    label: 'Student Visa – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true
  },
  {
    label: 'Dependent Visa – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  { label: 'Other (Please Specify)', status: 'OTHER', supportsVisaType: true }
];

// ============================================
// 其他国家的统一模板
// ============================================

const DEFAULT_OPTIONS: WorkingRightsOption[] = [
  { label: 'Citizen / National of this Country', status: 'CITIZEN' },
  { label: 'Permanent Resident / Long-term Residence', status: 'PR' },
  {
    label: 'Work Visa / Permit – Full Work Rights',
    status: 'OPEN_WORK_VISA',
    supportsVisaType: true,
    visaExamples: ['Open work permit', 'General work visa']
  },
  {
    label: 'Employer-sponsored Work Visa / Permit',
    status: 'EMPLOYER_SPONSORED',
    supportsVisaType: true,
    visaExamples: ['Work Permit', 'Employment Visa', 'Work Authorization']
  },
  {
    label: 'Student Visa / Permit – Limited Work Rights',
    status: 'STUDENT_LIMITED',
    supportsVisaType: true,
    visaExamples: ['Student Permit', 'Study Visa', 'Student Authorization']
  },
  {
    label: 'Dependent / Family Visa – With Work Rights',
    status: 'DEPENDENT_WITH_WORK_RIGHTS',
    supportsVisaType: true,
    visaExamples: ['Dependent Permit', 'Family Visa', 'Spousal Work Permit']
  },
  { label: 'No Current Work Rights / Require Sponsorship', status: 'NO_RIGHT' },
  {
    label: 'Other (Please Specify)',
    status: 'OTHER',
    supportsVisaType: true,
    visaExamples: ['Work Permit', 'Visa Type']
  }
];

// ============================================
// 汇总配置
// ============================================

const WORKING_RIGHTS_BY_CODE: Record<string, WorkingRightsOption[]> = {
  'AU': AU_OPTIONS,
  'US': US_OPTIONS,
  'CA': CA_OPTIONS,
  'UK': UK_OPTIONS,
  'SG': SG_OPTIONS,
  'FR': FR_OPTIONS,
  'DE': DE_OPTIONS,
  'HK': HK_OPTIONS,
  // 其他都用标准模板
  'CN': DEFAULT_OPTIONS,
  'TW': DEFAULT_OPTIONS,
  'JP': DEFAULT_OPTIONS,
  'MY': DEFAULT_OPTIONS,
  'PH': DEFAULT_OPTIONS,
  'IN': DEFAULT_OPTIONS,
  'TH': DEFAULT_OPTIONS,
  'TR': DEFAULT_OPTIONS,
  'NL': DEFAULT_OPTIONS,
  'ES': DEFAULT_OPTIONS,
  'IT': DEFAULT_OPTIONS,
  'PL': DEFAULT_OPTIONS,
  'IE': DEFAULT_OPTIONS,
  'BR': DEFAULT_OPTIONS,
  'PE': DEFAULT_OPTIONS,
  'MX': DEFAULT_OPTIONS,
};

// ============================================
// 工具函数
// ============================================

/**
 * 根据国家名称获取 Work Rights 选项
 * @param countryName 国家名称（如 "Australia", "United States"）
 * @returns Work Rights 选项数组
 */
export function getWorkingRightsOptions(countryName: string): WorkingRightsOption[] {
  if (!countryName) {
    return [];
  }
  const countryCode = COUNTRY_NAME_TO_CODE[countryName];
  if (!countryCode) {
    return DEFAULT_OPTIONS; // 未知国家用默认模板
  }
  return WORKING_RIGHTS_BY_CODE[countryCode] || DEFAULT_OPTIONS;
}

/**
 * 根据国家名称获取国家代码
 * @param countryName 国家名称
 * @returns 国家代码或 undefined
 */
export function getCountryCode(countryName: string): string | undefined {
  return COUNTRY_NAME_TO_CODE[countryName];
}

/**
 * 根据 Work Rights label 获取对应的 status
 * @param countryName 国家名称
 * @param label Work Rights label
 * @returns status 或 undefined
 */
export function getWorkingRightsStatus(countryName: string, label: string): WorkingRightsStatus | undefined {
  const options = getWorkingRightsOptions(countryName);
  const option = options.find(opt => opt.label === label);
  return option?.status;
}
