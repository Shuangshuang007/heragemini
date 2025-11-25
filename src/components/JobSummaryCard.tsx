import React, { useRef } from 'react';
import type { Job } from '../types/job';
import { normalizeEmploymentType, parseWorkMode, formatSalaryWithBenefits, normalizeExperienceTag, isValidSalary } from '../utils/employmentUtils';
import { deduplicateJobTitle } from '../utils/titleDeduplicator';

interface JobSummaryCardProps {
  job: Job;
  language: 'en' | 'zh';
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: (job: Job, rect?: DOMRect, cardRef?: React.RefObject<HTMLDivElement> | undefined) => void;
  userProfile?: {
    jobTitles: string[];
    skills: string[];
    city: string;
    seniority: string;
    openToRelocate: boolean;
  };
  renderCustomActions?: () => React.ReactNode;
}

// 将第三人称转为第二人称
function toSecondPerson(text: string) {
  return text
    .replace(/\bThe candidate\b/g, 'You')
    .replace(/\bthe candidate\b/g, 'you')
    .replace(/\bTheir\b/g, 'Your')
    .replace(/\btheir\b/g, 'your')
    .replace(/\bThey have\b/g, 'You have')
    .replace(/\bthey have\b/g, 'you have')
    .replace(/\bTheir experience\b/g, 'Your experience')
    .replace(/\btheir experience\b/g, 'your experience');
}

const MatchSummary = ({ matchScore, matchAnalysis }: { matchScore: number | null, matchAnalysis: string | null }) => {
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Match Summary</h3>
        {matchScore !== null && (
          <div className="flex items-center">
            <span className="text-sm font-medium text-blue-700 mr-1">Match Score:</span>
            <span className="text-sm font-semibold text-blue-700">{matchScore}%</span>
          </div>
        )}
      </div>
      {matchAnalysis && (
        <p className="text-sm text-gray-600">{toSecondPerson(matchAnalysis)}</p>
      )}
    </div>
  );
};

// 高亮过滤函数
const isTrivial = (text: string) =>
  !text ||
  /^no special requirements?/i.test(text) ||
  /^no special requirements or benefits/i.test(text) ||
  /^none$/i.test(text) ||
  /^no requirements$/i.test(text) ||
  /^no special requirements beyond/i.test(text) ||
  /^no special requirements or unique benefits mentioned$/i.test(text) ||
  /^no unique benefits$/i.test(text) ||
  /^no special requirements mentioned$/i.test(text) ||
  /^no unique requirements$/i.test(text);

// 专有名词白名单
const PROPER_NOUNS = [
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Microsoft 365', 'Office 365', 'SAP', 'ERP', 'CRM', 'HR', 'HRIS', 'HRMS', 'API', 'REST', 'GraphQL', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'DB2', 'DynamoDB', 'S3', 'EC2', 'Lambda', 'Docker', 'Kubernetes', 'K8s', 'Jenkins', 'Git', 'GitHub', 'GitLab', 'Bitbucket', 'CI/CD', 'DevOps', 'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence', 'Figma', 'Sketch', 'Photoshop', 'Illustrator', 'XD', 'HTML', 'CSS', 'SCSS', 'SASS', 'LESS', 'JavaScript', 'TypeScript', 'Node.js', 'React', 'React Native', 'Vue', 'Angular', 'Next.js', 'Nuxt.js', 'Express', 'Flask', 'Django', 'Spring', '.NET', 'C#', 'C++', 'C', 'Java', 'Python', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Objective-C', 'R', 'MATLAB', 'VBA', 'PowerShell', 'Bash', 'Shell', 'Linux', 'Unix', 'Windows', 'macOS', 'iOS', 'Android', 'Flutter', 'Firebase', 'Tableau', 'Power BI', 'Looker', 'Snowflake', 'Salesforce', 'HubSpot', 'Shopify', 'WordPress', 'WooCommerce', 'Magento', 'BigCommerce',
  // 新增常见缩写和专有名词
  'UI', 'UX', 'AI', 'PR', 'ML', 'DL', 'NLP', 'CV', 'SaaS', 'PaaS', 'IaaS', 'API', 'SDK', 'IDE', 'CDN', 'SEO', 'SEM', 'BI', 'ETL', 'NoSQL', 'RPA', 'IoT', 'AR', 'VR', 'MR', 'XR', 'OCR', 'JWT', 'JWTs', 'JWT Token', 'JWT Tokens', 'JWT Auth', 'JWT Authentication', 'JWT Authorization', 'JWT Bearer', 'JWT Secret', 'JWT Key', 'JWT Keys', 'JWT Algorithm', 'JWT Algorithms', 'JWT Header', 'JWT Headers', 'JWT Payload', 'JWT Payloads', 'JWT Claim', 'JWT Claims', 'JWT Exp', 'JWT Expires', 'JWT Expiry', 'JWT Expiration', 'JWT Issuer', 'JWT Audience', 'JWT Subject', 'JWT Not Before', 'JWT Issued At', 'JWT JWT', 'JWT JWTs', 'JWT JWT Token', 'JWT JWT Tokens', 'JWT JWT Auth', 'JWT JWT Authentication', 'JWT JWT Authorization', 'JWT JWT Bearer', 'JWT JWT Secret', 'JWT JWT Key', 'JWT JWT Keys', 'JWT JWT Algorithm', 'JWT JWT Algorithms', 'JWT JWT Header', 'JWT JWT Headers', 'JWT JWT Payload', 'JWT JWT Payloads', 'JWT JWT Claim', 'JWT JWT Claims', 'JWT JWT Exp', 'JWT JWT Expires', 'JWT JWT Expiry', 'JWT JWT Expiration', 'JWT JWT Issuer', 'JWT JWT Audience', 'JWT JWT Subject', 'JWT JWT Not Before', 'JWT JWT Issued At', 'JWT JWT JWT', 'JWT JWT JWTs', 'JWT JWT JWT Token', 'JWT JWT JWT Tokens', 'JWT JWT JWT Auth', 'JWT JWT JWT Authentication', 'JWT JWT JWT Authorization', 'JWT JWT JWT Bearer', 'JWT JWT JWT Secret', 'JWT JWT JWT Key', 'JWT JWT JWT Keys', 'JWT JWT JWT Algorithm', 'JWT JWT JWT Algorithms', 'JWT JWT JWT Header', 'JWT JWT JWT Headers', 'JWT JWT JWT Payload', 'JWT JWT JWT Payloads', 'JWT JWT JWT Claim', 'JWT JWT JWT Claims', 'JWT JWT JWT Exp', 'JWT JWT JWT Expires', 'JWT JWT JWT Expiry', 'JWT JWT JWT Expiration', 'JWT JWT JWT Issuer', 'JWT JWT JWT Audience', 'JWT JWT JWT Subject', 'JWT JWT JWT Not Before', 'JWT JWT JWT Issued At', 'JWT JWT JWT JWT', 'JWT JWT JWT JWTs', 'JWT JWT JWT JWT Token', 'JWT JWT JWT JWT Tokens', 'JWT JWT JWT JWT Auth', 'JWT JWT JWT JWT Authentication', 'JWT JWT JWT JWT Authorization', 'JWT JWT JWT JWT Bearer', 'JWT JWT JWT JWT Secret', 'JWT JWT JWT JWT Key', 'JWT JWT JWT JWT Keys', 'JWT JWT JWT JWT Algorithm', 'JWT JWT JWT JWT Algorithms', 'JWT JWT JWT JWT Header', 'JWT JWT JWT JWT Headers', 'JWT JWT JWT JWT Payload', 'JWT JWT JWT JWT Payloads', 'JWT JWT JWT JWT Claim', 'JWT JWT JWT JWT Claims', 'JWT JWT JWT JWT Exp', 'JWT JWT JWT JWT Expires', 'JWT JWT JWT JWT Expiry', 'JWT JWT JWT JWT Expiration', 'JWT JWT JWT JWT Issuer', 'JWT JWT JWT JWT Audience', 'JWT JWT JWT JWT Subject', 'JWT JWT JWT JWT Not Before', 'JWT JWT JWT JWT Issued At',
  // 用户新增专有名词
  'SDLC', 'COE', 'AB testing', 'NDIS',
  // 财务相关专有名词
  'CPA', 'CFA', 'CA', 'ACCA', 'CIMA', 'CMA', 'CGA', 'CIA', 'CISA', 'CISSP', 'PMP', 'PRINCE2', 'ITIL', 'Six Sigma', 'Lean', 'Agile', 'Scrum', 'Kanban', 'SAFe', 'TOGAF', 'COBIT', 'ISO 27001', 'ISO 9001', 'GDPR', 'SOX', 'IFRS', 'GAAP', 'ASIC', 'APRA', 'ATO', 'ASX', 'ASIC', 'FASB', 'IASB', 'XBRL', 'ERP', 'SAP', 'Oracle', 'QuickBooks', 'Xero', 'MYOB', 'Reckon', 'Intuit', 'BlackLine', 'Workiva', 'NetSuite', 'Salesforce', 'HubSpot', 'Tableau', 'Power BI', 'Qlik', 'Alteryx', 'KNIME', 'R', 'Python', 'SQL', 'VBA', 'Excel', 'Access', 'Word', 'PowerPoint', 'Outlook', 'Teams', 'SharePoint', 'OneDrive', 'Office 365', 'Microsoft 365', 'Google Workspace', 'G Suite', 'Slack', 'Zoom', 'Webex', 'Teams', 'Skype', 'Trello', 'Asana', 'Monday.com', 'Notion', 'Airtable', 'Smartsheet', 'Jira', 'Confluence', 'Bitbucket', 'GitHub', 'GitLab', 'Azure DevOps', 'Jenkins', 'Bamboo', 'CircleCI', 'Travis CI', 'GitLab CI', 'GitHub Actions', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Google Cloud', 'IBM Cloud', 'Oracle Cloud', 'Salesforce Cloud', 'SAP Cloud', 'Workday', 'SuccessFactors', 'BambooHR', 'ADP', 'Paychex', 'Gusto', 'Rippling', 'Justworks', 'TriNet', 'Insperity', 'Paylocity', 'Paycom', 'Paycor', 'Namely', 'Zenefits', 'Gusto', 'Rippling', 'Justworks', 'TriNet', 'Insperity', 'Paylocity', 'Paycom', 'Paycor', 'Namely', 'Zenefits'
];

const getPrimaryLocation = (location: Job['location']): string => {
  if (Array.isArray(location)) {
    return location[0] || '';
  }
  return location || '';
};

function formatTag(tag: string) {
  if (!tag) return '';
  // 精确匹配白名单（区分大小写）
  if (PROPER_NOUNS.includes(tag.trim())) return tag.trim();
  // 不区分大小写匹配，返回白名单标准写法
  const found = PROPER_NOUNS.find(pn => pn.toLowerCase() === tag.trim().toLowerCase());
  if (found) return found;
  // 其余保持原有格式（如Full Time等）
  const words = tag.split(' ');
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase(), ...words.slice(1).map(w => w.toLowerCase())].join(' ');
}

// 过滤函数：只保留3词以内且不包含软性描述的Tag
function filterKeyRequirements(rawTags: string[]): string[] {
  return rawTags.filter(tag =>
    tag.trim().split(/\s+/).length <= 3 &&
    !/deliver|excellent|ability to|passion|customer service|strong/i.test(tag)
  );
}

// 计算距离今天的天数（支持 week/month 自动换算）
function getDaysAgo(dateStr?: string): number | null {
  if (!dateStr) return null;
  // 兼容 "27d ago"、"27 days ago"、"Posted 27 days ago"
  const dayMatch = dateStr.match(/(\d+)\s*d(?:ays)?\s*ago/i);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  // 兼容 "3 weeks ago"、"3w ago"
  const weekMatch = dateStr.match(/(\d+)\s*w(?:eeks?)?\s*ago/i);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
  // 兼容 "2 months ago"、"2m ago"，直接视为 Expiring soon
  const monthMatch = dateStr.match(/(\d+)\s*m(?:onths?)?\s*ago/i);
  if (monthMatch) return 1000; // 只要是月，直接超大天数
  // 兼容 "14h ago"、"14 hours ago"、"Posted 14h ago"、"Posted 14 hours ago"
  const hourMatch = dateStr.match(/(\d+)\s*h(?:ours?)?\s*ago/i) || dateStr.match(/(\d+)\s*hour(?:s)?\s*ago/i);
  if (hourMatch) return 0; // 小于1天都视为0天
  // 标准日期格式
  const parsed = Date.parse(dateStr.replace(/\./g, '-').replace(/\//g, '-'));
  if (!isNaN(parsed)) {
    const now = new Date();
    const diff = now.getTime() - parsed;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  return null;
}

export function JobSummaryCard({ 
  job, 
  language, 
  isSelected, 
  onSelect, 
  onViewDetails,
  userProfile,
  cardId,
  renderCustomActions
}: JobSummaryCardProps & { cardId?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  // 只保留四类Tag，按顺序：Employment Type、WorkMode、Experience、Skills/Requirements（2-3个）
  const employmentTypeTag = job.employmentType ? formatTag(normalizeEmploymentType(job.employmentType)) : null;
  const workModeTag = parseWorkMode(job.workMode || '', job.description || '')
    ? formatTag(parseWorkMode(job.workMode || '', job.description || ''))
    : null;
  // 经验tag：优先使用结构化字段，其次回退旧tags
  const legacyExperienceTag = (job.tags || []).find(tag =>
    /experience|graduate|entry level|senior|junior|mid-level|middle level|lead/i.test(tag)
  );
  const formattedExperienceTag = job.experienceTag
    ? (() => {
        const normalized = normalizeExperienceTag(job.experienceTag);
        return normalized ? formatTag(normalized) : null;
      })()
    : legacyExperienceTag
      ? (() => {
          const normalized = normalizeExperienceTag(legacyExperienceTag);
          return normalized ? formatTag(normalized) : null;
        })()
      : null;
  // 技能/要求Tag（优先用结构化skills/keyRequirements，最多2-3个）
  let skillTags: string[] = [];
  if (job.skillsMustHave && job.skillsMustHave.length > 0) {
    skillTags = job.skillsMustHave.slice(0, 3).map(formatTag);
  } else if (job.keyRequirements && job.keyRequirements.length > 0) {
    skillTags = job.keyRequirements.slice(0, 3).map(formatTag);
  } else if ((job.skills && job.skills.length > 0) || (job.requirements && job.requirements.length > 0)) {
    const rawTags = [
      ...(job.skills || []),
      ...(job.requirements || [])
    ];
    skillTags = filterKeyRequirements(rawTags).slice(0, 3).map(formatTag);
  }

  // 组装Tag顺序：EmploymentType -> WorkMode(可选) -> Experience(如有) -> Skills
  const tagOrder = [employmentTypeTag];
  if (workModeTag) {
    tagOrder.push(workModeTag);
    if (formattedExperienceTag) tagOrder.push(formattedExperienceTag);
  } else if (formattedExperienceTag) {
    tagOrder.push(formattedExperienceTag);
  }
  tagOrder.push(...skillTags);

  // 过滤掉空、null、'Not specified'等无效Tag
  const filteredTagOrder = tagOrder.filter(tag => tag && tag.toLowerCase() !== 'not specified');

  return (
    <div 
      className={`p-3 hover:bg-gray-50 cursor-pointer ${
        isSelected ? 'bg-blue-50' : ''
      }`}
      id={cardId}
      ref={cardRef}
      onClick={() => onViewDetails(job, undefined, cardRef)}
    >
      <div className="flex items-start">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
        />
        <div className="ml-3 flex-1">
          {/* 职位标题和公司 */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{deduplicateJobTitle(job.title)}</h3>
              <p className="text-sm text-gray-600">{job.company}</p>
            </div>
            {job.platform === 'CorporateDirect' || job.platform === 'PublicSector' ? (
              <span 
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 relative"
                style={{
                  clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%, 10% 50%)',
                  backgroundColor: '#dbeafe',
                  paddingLeft: '18px',
                  paddingRight: '16px'
                }}
              >
                {job.platform === 'CorporateDirect' ? 'Corporate Direct' : 'Public Sector'}
              </span>
            ) : null}
          </div>
          
          {/* 位置和薪资信息 */}
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
            <span>{getPrimaryLocation(job.location)}</span>
            {(() => {
              const isValid = isValidSalary(job.salary);
              if (process.env.NODE_ENV === 'development' && job.salary) {
                console.log('[JobSummaryCard] Salary check:', {
                  raw: job.salary,
                  isValid,
                  formatted: isValid && job.salary ? formatSalaryWithBenefits(job.salary) : 'N/A'
                });
              }
              return isValid && job.salary ? <span>• {formatSalaryWithBenefits(job.salary)}</span> : null;
            })()}
            {job.postedDate && (
              (() => {
                const daysAgo = getDaysAgo(job.postedDate);
                // 2天以内显示 New arrival
                if (daysAgo !== null && daysAgo <= 2) {
                  return <span>• {language === 'zh' ? '最新职位' : 'New arrival'}</span>;
                } else if (daysAgo !== null && daysAgo >= 21) {
                  return <span style={{ color: '#C40233', fontWeight: 600 }}>• {language === 'zh' ? '即将过期' : 'Expiring soon'}</span>;
                } else if (daysAgo !== null && daysAgo > 2) {
                  return <span>• {language === 'zh' ? `发布于${daysAgo}天前` : `Posted ${daysAgo}d ago`}</span>;
                } else {
                  // 兜底：原始字符串
                  return <span>• {language === 'zh' ? '发布于' : 'Posted'} {job.postedDate}</span>;
                }
              })()
            )}
          </div>
          
          {/* 职位类型和标签 */}
          <div className="flex flex-wrap gap-2 mt-2">
            {filteredTagOrder.map((tag, index) => (
              <span
                key={`tag-${index}`}
                className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
              >
                {tag}
              </span>
            ))}
          </div>
          
          {/* 匹配分析 */}
          {job.matchScore && (
            <div className="mt-3">
              <div className="flex items-end mb-2">
                <span className="text-sm font-semibold text-blue-700 mr-2">
                {language === 'zh' ? '匹配分数' : 'Match Score'}: {job.matchScore}
                </span>
                {job.subScores && (
                  <span className="text-sm text-gray-600 ml-6">
                    Experience: {job.subScores.experience} &nbsp; Industry: {job.subScores.industry} &nbsp; Skills: {job.subScores.skills}
                  </span>
                )}
              </div>
              {(job.matchHighlights && job.matchHighlights.length > 0) || (job.summary && job.summary.trim()) ? (
                <div className="text-sm text-gray-600 space-y-1">
                  {job.matchHighlights && job.matchHighlights.length > 0 && job.matchHighlights.map((highlight, index) => {
                    if (isTrivial(highlight)) return null;
                    return (
                      <div key={index} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{highlight.replace(/[。.]$/g, '').trim()}</span>
                      </div>
                    );
                  })}
                  {/* 第四点：listSummary（来自 jobMatch API） */}
                  {job.summary && job.summary.trim() && (
                    <div className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{job.summary.replace(/[。.]$/g, '').trim()}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
          
          {/* 申请按钮 */}
          <div className="mt-1 flex justify-end space-x-2">
            {renderCustomActions ? (
              renderCustomActions()
            ) : (
              <>
                <button
                  type="button"
                  className="text-xs font-semibold bg-gray-100 text-blue-700 hover:bg-gray-200 rounded px-3 py-1 transition-colors duration-150 shadow-sm"
                  style={{ height: '28px', lineHeight: '18px' }}
                  onClick={e => {
                    e.stopPropagation();
                    if (window && window.dispatchEvent) {
                      window.dispatchEvent(new CustomEvent('send-job-to-chat', {
                        detail: {
                          title: job.title,
                          company: job.company,
                          whoWeAre: job.detailedSummary?.split('\n\n')[0] || '',
                          whoWeAreLookingFor: job.detailedSummary?.split('\n\n')[1] || '',
                          matchScore: job.matchScore,
                          matchAnalysis: job.matchAnalysis || '',
                          url: job.url || '',
                        }
                      }));
                    }
                  }}
                >
                  {language === 'zh' ? '发送到聊天' : 'Chat Job'}
                </button>
                {job.url && (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-gray-100 text-blue-700 hover:bg-gray-200 rounded px-3 py-1 transition-colors duration-150 shadow-sm"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={e => {
                      e.stopPropagation();
                      window.open(job.url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {language === 'zh' ? '申请' : 'Apply'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 