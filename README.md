# Hera AI Job Platform

An intelligent job search platform that aggregates and analyzes job listings from multiple sources including LinkedIn, Seek, Jora, and Adzuna.

## Features

- Multi-source job aggregation (LinkedIn, Seek, Jora, Adzuna)
- AI-powered job matching and analysis
- Real-time job search and filtering
- Detailed job insights and summaries
- Location-based job search
- **🆕 Intelligent multi-turn recommendations with automatic duplicate filtering** ([详情](./docs/MULTI_TURN_RECOMMENDATIONS.md))
- **🆕 ChatGPT Actions integration via MCP protocol**

## Screenshots

### 1. Profile Page
![Profile Screenshot](https://github.com/Shuangshuang007/Hera-ai-open-source/blob/main/docs/Heraai%20profile.png)
*Fill in your personal information, upload your resume, and set your job preferences to enable personalized job recommendations.*

### 2. Jobs Page
![Jobs Screenshot](https://github.com/Shuangshuang007/Hera-ai-open-source/blob/main/docs/Heraai%20jobs.png)
*View recommended jobs from multiple platforms, see match scores, and get detailed job insights. Easily send jobs to chat or view more details.*

### 3. Chatbot Assistant
![Chatbot Screenshot](https://github.com/Shuangshuang007/Hera-ai-open-source/blob/main/docs/heraai-chatbot.png)
*Interact with the Héra AI chatbot to ask questions about jobs, get career advice, and trigger job recommendations in real time.*

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Playwright for web scraping

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Shuangshuang007/heraai-open.git
cd heraai-open
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
# Add your environment variables here
```

## Usage

1. Start the main application:
```bash
npm run dev
```

2. Start the Seek crawler API (in a separate terminal):
```bash
cd seek-crawler-api
npm install
npm run start
```

The application will be available at http://localhost:3002

## 📚 Documentation

- **[Multi-Turn Recommendations Guide](./docs/MULTI_TURN_RECOMMENDATIONS.md)** - Learn how to implement intelligent, duplicate-free multi-turn job recommendations
- **[MCP Integration](./MCP_INTEGRATION_GUIDE.md)** - ChatGPT Actions integration guide
- **[AgentKit Tools](./heraai_rebuild_public_v1/src/lib/agentkit/)** - AI planning and execution framework

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is for educational purposes only. Please respect the terms of service of the job platforms being scraped.

## Dependency Versions

### Core Dependencies

The project uses the following core dependencies:

```json
{
  "dependencies": {
    "next": "15.2.4",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "@langchain/openai": "0.5.7",
    "openai": "4.95.1"
  }
}
```

### SEEK Crawler Dependencies (Australia Region Only)

If you're using this project in Australia, you'll need these additional dependencies to support SEEK job search functionality:

```json
{
  "dependencies": {
    "playwright": "1.52.0",
    "playwright-extra": "4.3.6",
    "playwright-extra-plugin-stealth": "0.0.1"
  }
}
```

Note: Users outside Australia don't need these crawler dependencies as the system will automatically use LinkedIn search only.

## Environment Variables Configuration

Create a `.env.local` file in the root directory with the following variables:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
DATABASE_URL=your_database_url_here

# API Configuration
PORT=3002  # Main application port
PORT=4000  # Job crawler service port (in seek-crawler-api directory)

# Other Configuration
NODE_ENV=development  # or production
```

## API Documentation

### Job Crawler Service (localhost:4000)

The job crawler service runs on port 4000 and provides the following endpoints:

1. Get Job Listings
```bash
GET http://localhost:4000/api/seek-jobs
```

Query Parameters:
- `jobTitle`: Job title to search for (default: software-engineer)
- `city`: City name (default: melbourne)
- `limit`: Maximum number of results to return (default: 25)

Example Request:
```bash
curl "http://localhost:4000/api/seek-jobs?jobTitle=Software%20Engineer&city=Sydney&limit=60"
```

Response Format:
```json
{
  "jobs": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "Job Location",
      "description": "Job Description",
      "fullDescription": "Full Job Description",
      "requirements": ["Requirement 1", "Requirement 2"],
      "url": "Job URL",
      "source": "Source",
      "platform": "seek",
      "summary": "AI-generated Job Summary",
      "detailedSummary": "AI-generated Detailed Analysis",
      "matchScore": 85,
      "matchAnalysis": "AI-generated Match Analysis"
    }
  ]
}
```

## Getting Required API Keys

1. OpenAI API Key:
   - Visit [OpenAI Platform](https://platform.openai.com/)
   - Register and log in to your account
   - Create a new API key in the API Keys section
   - Copy the generated key and set it as the `OPENAI_API_KEY` environment variable

2. Database URL:
   - Configure the connection URL based on your database type
   - Example format: `postgresql://username:password@localhost:5432/database_name`

## Important Notes

- Do not commit the `.env.local` file containing actual API keys to version control
- Add `.env.local` to your `.gitignore` file
- Use secure key management practices in production environments
- The main application and job crawler service need to be started separately on different ports (3002 and 4000)

## Verifying Configuration

After configuration, verify that environment variables are loaded correctly:

1. Start the main application:
```bash
npm run dev
```

2. Start the job crawler service (Australia region only):
```bash
cd seek-crawler-api
npm run dev
```

3. Test API endpoints:
```bash
# Test main application
curl http://localhost:3002/api/jobs

# Test job crawler service (Australia region only)
curl http://localhost:4000/api/seek-jobs
```

If you encounter an "Unauthorized" error, verify that your `OPENAI_API_KEY` is configured correctly.

## Testing

This project uses Jest for minimal unit testing.

To run tests:
```bash
npm test
```

You can add your own tests in the `__tests__` directory.

## Running Minimal Tests

### Test Case 1: Running the Local Development Server
1. Start the development server:
```bash
npm run dev
```
2. Access the main interface:
   - Open http://localhost:3002/profile to view your profile
   - Open http://localhost:3002/jobs to view job listings

### Test Case 2: Testing Job Recommendations
1. Navigate to the chat interface
2. Type "Refresh Jobs" to trigger a job recommendation
3. The system will:
   - Analyze your profile
   - Search for relevant jobs
   - Display matching opportunities

---

# JobFetch重构进程总结 (2025-06-29)

## 本日进度

本次重构已完成**第一步、第二步和第三步**，即：

### ✅ 1. 统一JobFetch服务层
- 新增 `src/services/jobFetchService.ts`
- 统一处理Hot Jobs和平台特定job的获取逻辑

### ✅ 2. 数据库服务层优化
- 新增 `src/services/jobDatabaseService.ts`
- 专门处理MongoDB数据库操作，优化数据转换和错误处理

### ✅ 3. 前端与API深度解耦与系统性重构
- 重构API路由结构，统一使用jobFetchService
- 优化mirror-jobs API，支持POST和GET两种方式
- 实现Hot Jobs和平台数据的智能分流

### ❌ 4. 缓存逻辑与Job List显示优化 (待完成)

**第四步尚未完成，明天需要处理以下任务：**

#### 4.1 缓存逻辑修复
- **问题**：通过Chatbot refresh功能调用的`fetchJobsWithProfile`函数不完整
- **现状**：24小时缓存逻辑在`fetchJobsOld`中完整，但refresh时调用的函数缺失完整实现
- **需要**：完善`fetchJobsWithProfile`函数，添加缓存检查和完整的职位获取逻辑

#### 4.2 Job List显示优化
- **目标**：在Job List中显示更多有用信息
- **计划显示字段**：
  - `employmentType` (全职/兼职/合同工等)
  - `workMode` (远程/混合/办公室等)
  - `coreSkills` (核心技能，从Job Description中提取)
  - `requirements` (职位要求，从Job Description中提取)
- **技术实现**：可能需要GPT在Job Description中进行信息提取和结构化

#### 4.3 数据流优化
- **当前问题**：refresh功能链路不完整
- **需要确认**：API调用链路和数据处理流程
- **优化目标**：确保refresh功能与正常搜索功能使用相同的完整逻辑

---

**注意：请勿将本日进度误认为全部完成，第四步的系统性修改和优化将在明天进行。**

## Creator's Note: Why I Built Héra AI

I'm Shuangshuang Wu — founder of Héra AI and a global investor by training.

Across the past decade, I've advised institutional funds, led cross-border M&A, and helped scale platforms across HR, education, and consumer tech. But what compels me now is something far more personal: giving jobseekers the tools they deserve.

I believe the future of jobseeking is conversational.

Héra AI is designed to act as your intelligent co-pilot — one that listens, understands your goals, and brings vivid, relevant opportunities straight to you. No more stale listings. No more blind searches. It answers your questions, refreshes your options in real time, and shows you what truly fits.

It is not a crawler.
It is not a bot.
It is not another automation script lost in a sea of noise.

It is:
- A system that recommends roles through live chat — not keyword filters.
- A system that parses resumes with context — not just fields.
- A system that scores and reasons — not just matches.
- A system that returns agency to the candidate.

I ask that this codebase not be used for scraping or misuse.
I trust that open-source is not only about access — but about intention.
I believe that when both sides of the market are empowered, better matches happen — faster, deeper, and with more meaning.

I come from a background in law and finance. Over the past two months, I've been learning to code from scratch — building this project line by line with Cursor. It's far from perfect, but it comes from a place of belief, urgency, and hope.

I share it now not because it's finished, but because it's a beginning.

Please be kind to its flaws. Feel free to connect, collaborate, or send any feedback — I'd love to hear from you.
- 💼 LinkedIn
- 🐦 Twitter / X
- 📬 Email: shuang@heraai.net.au

## Skill重构与JobList Match Point优化的思考（明日计划）

- 建议参考Laboro等产品的Skill结构，重新梳理Skill的提取与展示方式。
- Job Description字段实际与job title、公司、地点等信息高度重复，未必是最有价值的展示内容。
- **更重要的字段**：
  - `coreSkills`（核心技能，建议用GPT从JD中结构化提取）
  - `requirements`（职位要求，结构化提取）
  - `employmentType`（全职/兼职/合同工等）
  - `workmode`（远程/混合/办公室等）
  - `industry`（公司行业，自动判断即可，无需详细公司介绍）
- JobList的Match Point部分、summary和tag的设计应以这些结构化字段为核心，提升用户对职位的快速理解和筛选效率。
- 明天建议重点：
  1. 研究Laboro等产品的Skill和Tag设计，确定HeraAI的Skill/Tag结构
  2. 讨论JobList的Match Point、summary、tag的最优展示方式
  3. 决定Job Description是否保留，或仅作为后台分析字段
  4. 统一industry判断逻辑，简化公司介绍

**请明天重点review和讨论上述思路，决定最终的JobList和Skill重构方案。**
