// EmploymentType 标准化函数
export function normalizeEmploymentType(type: string): string {
  if (!type) return 'Full Time';
  
  // 1. 清理和标准化输入
  const cleaned = type.toLowerCase()
    .replace(/[-_\s]+/g, ' ')  // 统一分隔符为空格
    .trim();
  
  // 2. 关键词匹配
  if (cleaned.includes('full')) return 'Full Time';
  if (cleaned.includes('part')) return 'Part Time';
  if (cleaned.includes('casual')) return 'Casual';
  if (cleaned.includes('contract')) return 'Contract';
  if (cleaned.includes('intern')) return 'Internship';
  if (cleaned.includes('temp')) return 'Contract';
  
  // 3. 如果都不匹配，保持原格式但首字母大写
  return toTitleCase(type);
}

// 单位和super全称统一
export function normalizeSalaryUnit(salary: string): string {
  let s = salary;
  s = s.replace(/per\s*hour|\/h|\/hr|\/hour/gi, 'ph');
  s = s.replace(/per\s*year|per\s*annum|\/y|\/yr|\/year|annum/gi, 'py');
  s = s.replace(/per\s*month|\/m|\/mo|\/month/gi, 'pm');
  s = s.replace(/per\s*week|\/w|\/wk|\/week/gi, 'pw');
  s = s.replace(/per\s*day|\/d|\/day/gi, 'pd');
  s = s.replace(/superannuation|superannucation/gi, 'super');
  return s;
}

// WorkMode 解析函数，支持百分比办公
export function parseWorkMode(workMode: string, jobDescription: string): string {
  if (workMode) return toTitleCase(workMode);
  const desc = jobDescription?.toLowerCase() || '';
  // 百分比办公
  const percentMatch = desc.match(/(\d+)%\s*(working in the office|onsite|in office)/i);
  if (percentMatch) return `${percentMatch[1]}% Onsite`;
  // 通用模式匹配
  const patterns = [
    { regex: /(\d+)\s*days?\s*(?:in\s*)?(?:the\s*)?(?:office|onsite)/i, format: (match: any) => `${match[1]}d Onsite` },
    { regex: /at\s*least\s*(\d+)\s*days?\s*(?:in\s*)?(?:the\s*)?(?:office|onsite)/i, format: (match: any) => `+${match[1]} Onsite` },
    { regex: /hybrid/i, format: () => 'Hybrid' },
    { regex: /remote|work\s*from\s*home/i, format: () => 'Fully Remote' },
    { regex: /onsite|in\s*office/i, format: () => 'Onsite' }
  ];
  for (const pattern of patterns) {
    const match = desc.match(pattern.regex);
    if (match) {
      return toTitleCase(pattern.format(match));
    }
  }
  return '';
}

// 格式化金额数字（如120000 -> 120,000）
export function formatSalaryNumber(salary: string): string {
  return salary.replace(/\d{4,}/g, (num) => Number(num).toLocaleString('en-US'));
}

// 检查 salary 是否有效（过滤掉 "not specified", "not available" 等，但保留 "negotiable" 和 "competitive"）
export function isValidSalary(salary?: string | null): boolean {
  if (!salary) return false;
  const trimmedSalary = salary.trim();
  if (!trimmedSalary) return false;
  
  const lowerSalary = trimmedSalary.toLowerCase();
  
  // 如果包含数字或货币符号，认为是有效的（即使包含 "negotiable" 或 "competitive"）
  const hasNumberOrCurrency = /\d|\$|€|£|¥|aud|usd|eur|gbp|rmb|yuan/i.test(trimmedSalary);
  if (hasNumberOrCurrency) {
    return true; // 包含数字或货币符号，肯定是有效的
  }
  
  // 只过滤明确表示"未指定"或"不可用"的值（不包含数字的情况）
  const invalidPatterns = [
    'not specified',
    'not available',
    'n/a',
    'na',
    'tbd',
    'to be determined',
    'upon request',
    'contact for details',
    '保密',
    '面议',
    'salary not specified',
    'salary not available',
    'unspecified',
    'unavailable'
  ];
  
  // 检查是否完全匹配无效模式
  const normalized = lowerSalary.replace(/\s+/g, ' ').trim();
  const isInvalid = invalidPatterns.some(pattern => {
    return normalized === pattern || normalized === `salary ${pattern}`;
  });
  
  // 如果不是无效模式，则认为是有效的（包括 "negotiable", "competitive" 等）
  return !isInvalid;
}

export function formatSalaryWithBenefits(salary: string): string {
  if (!salary) return '';
  let s = salary;

  // 1. 去除冗余描述
  s = s.replace(/for the right candidate.*$/i, '')
       .replace(/for the right person.*$/i, '')
       .replace(/for the right c[+]?idate.*$/i, '')
       .replace(/for suitable candidate.*$/i, '')
       .replace(/for the right fit.*$/i, '')
       .replace(/for the right.*$/i, '')
       .trim();

  // superannuation/superannucation 统一为 super
  s = s.replace(/superannuation|superannucation/gi, 'super');

  // 2. 单位标准化（全部转为py/pm/pd/ph）
  s = s.replace(/per\s*annum|p\.a\.|pa|p\/a|per\s*year|\/y|\/yr|\/year|annum/gi, 'py');
  s = s.replace(/per\s*month|p\.m\.|pm|p\/m|\/mo|\/month/gi, 'pm');
  s = s.replace(/per\s*day|p\.d\.|pd|p\/d|\/day/gi, 'pd');
  s = s.replace(/per\s*hour|p\.h\.|ph|p\/h|\/hr|\/hour/gi, 'ph');

  // 3. 仅数字时智能推断单位
  const numMatch = s.match(/\$?([\d,]+)(?![\d,])/);
  if (numMatch && !/py|pm|pd|ph/i.test(s)) {
    const num = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (num < 100) s += ' ph';
    else if (num < 2000 && num > 500) s += ' pd';
    else if (num < 30000 && num > 2000) s += ' pm';
    else if (num >= 30000) s += ' py';
  }

  // 4. 数字格式化
  s = s.replace(/\d{4,}/g, (num) => Number(num).toLocaleString('en-US'));

  // 5. 福利词保留
  s = s.replace(/(superannuation|super|bonus|commission|allowance|package|overtime|incentive|benefits)/gi, (match) => match.toLowerCase());

  // 6. 分隔符标准化
  s = s.replace(/\s*(\+|plus|additional|and)\s*/gi, ' + ');
  s = s.replace(/\s*\+\s*\+\s*/g, ' + ').replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/\s*\+$/, '').trim();

  // 7. 截断50字符
  if (s.length > 50) s = s.slice(0, 50) + '...';

  // 8. 只保留第一个单词首字母大写，其余全部小写（单位和super等专有词除外）
  const words = s.split(' ');
  if (words.length > 0) {
    s = [words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase(), ...words.slice(1).map(w => {
      // 保留单位和super等专有词原样
      if (/^(py|pm|pd|ph|super|bonus|commission|allowance|package|overtime|incentive|benefits)$/i.test(w)) {
        return w;
      }
      return w.toLowerCase();
    })].join(' ');
  }

  return s;
}

// 规范经验标签显示逻辑
export function normalizeExperienceTag(
  text: string | null | undefined
): string | null {
  // 早期返回：处理 null/undefined/空字符串
  if (!text || typeof text !== 'string') return null;
  
  // 匹配 1-2位数字 + 可选+ + y/years
  const match = text.match(/(\d{1,2})\s*(\+)?\s*(y|years)/i);
  if (match) {
    const years = parseInt(match[1], 10);
    // 合理上限判断：超过40年视为无效经验字段
    if (years > 40) return null;
    if (years > 15) return '+15y experience';
    return `+${years}y experience`;
  }
  // 匹配有 experience 但无具体年限
  if (/experience/i.test(text)) {
    return 'Experience required';
  }
  return null;
}

// Title Case 工具函数
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
} 