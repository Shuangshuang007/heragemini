# Hera AI ChatGPT App SDK - 用户体验说明

## 📱 当前App SDK架构

### 技术架构
- **协议**: MCP (Model Context Protocol) 
- **端点**: `https://heraai-rebuild-public-v1-kc4f.vercel.app/api/mcp`
- **认证**: Bearer Token (`MCP_SHARED_SECRET`)
- **工具数量**: 11个工具

### 集成方式
- **无独立UI**: 通过ChatGPT对话界面使用
- **自动工具调用**: ChatGPT根据用户意图自动选择合适的工具
- **对话式交互**: 用户通过自然语言与ChatGPT对话，ChatGPT在后台调用Hera AI的工具

---

## 🎯 用户体验流程

### 场景1: 简单职位搜索

**用户在ChatGPT中的对话：**
```
用户: "Find software engineer jobs in Melbourne"
```

**ChatGPT后台调用：**
```json
POST /api/mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_jobs",
    "arguments": {
      "job_title": "software engineer",
      "city": "Melbourne",
      "limit": 10
    }
  }
}
```

**ChatGPT向用户展示的结果：**
```
我找到了以下软件工程师职位（来自多个平台）：

1. **Senior Software Engineer** - TechCorp
   📍 Melbourne, VIC
   🔗 [查看职位](https://seek.com.au/job/...)
   ⭐ 匹配度: 85%
   📊 来源: SEEK

2. **Full Stack Developer** - StartupXYZ
   📍 Melbourne, VIC
   🔗 [查看职位](https://linkedin.com/jobs/...)
   ⭐ 匹配度: 78%
   📊 来源: LinkedIn

... (更多职位)
```

---

### 场景2: 个性化职位推荐

**用户在ChatGPT中的对话：**
```
用户: "I'm a data analyst with 3 years experience in Python and SQL. 
      Recommend jobs that match my background in Sydney."
```

**ChatGPT后台调用：**
```json
POST /api/mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "recommend_jobs",
    "arguments": {
      "user_profile": {
        "jobTitles": ["Data Analyst"],
        "skills": ["Python", "SQL"],
        "city": "Sydney",
        "seniority": "Mid"
      },
      "city": "Sydney",
      "limit": 10
    }
  }
}
```

**ChatGPT向用户展示的结果：**
```
基于您的背景，我为您推荐以下匹配度高的职位：

🎯 **高度匹配（90%+）**
1. **Senior Data Analyst** - AnalyticsCo
   📍 Sydney, NSW
   ✅ 技能匹配: Python, SQL, Tableau
   💰 薪资范围: $90k-$110k
   🔗 [查看职位](https://seek.com.au/job/...)

2. **Data Analyst - Business Intelligence** - FinanceCorp
   📍 Sydney, NSW
   ✅ 技能匹配: SQL, Python, Power BI
   💰 薪资范围: $85k-$100k
   🔗 [查看职位](https://linkedin.com/jobs/...)

... (更多推荐)
```

---

### 场景3: 简历定制

**用户在ChatGPT中的对话：**
```
用户: "I want to tailor my resume for this job:
      'Senior Software Engineer at Google in Sydney'
      
      [用户上传简历PDF或粘贴简历内容]
```

**ChatGPT后台调用：**
```json
POST /api/mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tailor_resume",
    "arguments": {
      "user_profile": {
        "skills": ["JavaScript", "React", "Node.js"],
        "employmentHistory": [...]
      },
      "resume_content": "...",
      "job_title": "Senior Software Engineer",
      "company": "Google",
      "customization_level": "comprehensive"
    }
  }
}
```

**ChatGPT向用户展示的结果：**
```
我已经为Google的Senior Software Engineer职位定制了您的简历：

📝 **优化建议：**

1. **技能突出**
   - 强调: React, Node.js, TypeScript（职位要求）
   - 添加: 大规模系统设计经验

2. **工作经历重写**
   - 原: "Developed web applications"
   - 优化: "Architected and developed scalable web applications 
            serving 100k+ users using React and Node.js"

3. **关键词匹配**
   - 添加: "distributed systems", "microservices", "cloud infrastructure"

[显示优化后的简历内容]
```

---

### 场景4: 职业转换建议

**用户在ChatGPT中的对话：**
```
用户: "I'm a software engineer with 5 years experience. 
      What careers can I transition to?"
```

**ChatGPT后台调用：**
```json
POST /api/mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "career_transition_advice",
    "arguments": {
      "current_job": "Software Engineer",
      "experience_years": 5,
      "skills": ["JavaScript", "Python", "React"]
    }
  }
}
```

**ChatGPT向用户展示的结果：**
```
基于您的软件工程师背景，以下是推荐的职业转换路径：

🎯 **高匹配度转换（相似度80%+）**

1. **Product Manager**
   - 转换难度: ⭐⭐ (中等)
   - 所需技能: 产品思维、沟通能力、技术背景
   - 预计准备时间: 6-12个月
   - 💡 您的优势: 技术理解深度

2. **Technical Product Manager**
   - 转换难度: ⭐ (容易)
   - 所需技能: 产品管理 + 技术背景
   - 预计准备时间: 3-6个月
   - 💡 您的优势: 已有技术基础

3. **Solutions Architect**
   - 转换难度: ⭐⭐ (中等)
   - 所需技能: 系统设计、架构思维
   - 预计准备时间: 6-12个月

🔜 **下一步**: 
想要查看这些职位的实际招聘信息吗？我可以为您搜索：
- "Product Manager jobs in Sydney"
- "Solutions Architect positions"

或者上传您的简历，我可以提供更精准的职位推荐。
```

---

### 场景5: 生成搜索链接

**用户在ChatGPT中的对话：**
```
用户: "Give me direct links to search for marketing manager jobs 
      in Brisbane on different job boards"
```

**ChatGPT后台调用：**
```json
POST /api/mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "build_search_links",
    "arguments": {
      "job_title": "marketing manager",
      "city": "Brisbane",
      "platforms": ["linkedin", "seek", "jora", "adzuna"]
    }
  }
}
```

**ChatGPT向用户展示的结果：**
```
以下是各平台的直接搜索链接：

🔗 **LinkedIn**
https://www.linkedin.com/jobs/search/?keywords=marketing%20manager&location=Brisbane

🔗 **SEEK**
https://www.seek.com.au/jobs?keywords=marketing%20manager&location=Brisbane

🔗 **Jora**
https://au.jora.com/jobs?q=marketing%20manager&l=Brisbane

🔗 **Adzuna**
https://www.adzuna.com.au/jobs/q-marketing-manager/l-Brisbane

点击链接即可在对应平台查看职位。
```

---

## 🎨 UI展示方式

### ChatGPT对话界面（用户看到的）

```
┌─────────────────────────────────────────┐
│  ChatGPT                                │
├─────────────────────────────────────────┤
│                                         │
│  用户: Find software engineer jobs      │
│       in Melbourne                      │
│                                         │
│  ChatGPT: [正在搜索...]                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📊 找到 15 个职位                │   │
│  │                                 │   │
│  │ 1. Senior Software Engineer     │   │
│  │    TechCorp                     │   │
│  │    📍 Melbourne, VIC           │   │
│  │    ⭐ 匹配度: 85%               │   │
│  │    🔗 [查看职位]                │   │
│  │                                 │   │
│  │ 2. Full Stack Developer        │   │
│  │    StartupXYZ                  │   │
│  │    📍 Melbourne, VIC           │   │
│  │    ⭐ 匹配度: 78%               │   │
│  │    🔗 [查看职位]                │   │
│  │                                 │   │
│  │ ... (更多职位)                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  用户: Show me more                     │
│                                         │
│  ChatGPT: [加载更多...]                 │
│                                         │
└─────────────────────────────────────────┘
```

### 关键特点

1. **无独立界面**: 所有功能通过ChatGPT对话完成
2. **自然语言交互**: 用户用日常语言提问，ChatGPT理解意图
3. **自动工具选择**: ChatGPT根据用户意图自动选择最合适的工具
4. **结构化展示**: ChatGPT会将工具返回的JSON数据格式化为易读的文本
5. **链接和操作**: 可以包含可点击的链接、按钮等交互元素

---

## 📋 11个工具及其使用场景

| 工具名称 | 用户意图示例 | ChatGPT调用时机 |
|---------|------------|----------------|
| `search_jobs` | "Find jobs", "Search for positions" | 简单职位搜索 |
| `recommend_jobs` | "Recommend jobs for me", "Match my profile" | 个性化推荐 |
| `refine_recommendations` | "Show me more", "I like #2" | 基于反馈优化 |
| `search_jobs_by_company` | "Jobs at Google", "Microsoft positions" | 按公司搜索 |
| `build_search_links` | "Give me links", "Direct search URLs" | 生成平台链接 |
| `get_user_applications` | "My applications", "Application history" | 查看申请历史 |
| `tailor_resume` | "Tailor resume", "Customize for this job" | 简历定制 |
| `career_transition_advice` | "Career change", "What can I transition to" | 职业转换建议 |
| `career_path_explorer` | "Show all career paths", "Explore options" | 职业路径探索 |
| `career_skill_gap_analysis` | "Skill gap", "What skills do I need" | 技能差距分析 |
| `job_alert` | "New jobs since last check", "Job alerts" | 职位提醒（按需） |

---

## 🔄 完整对话示例

### 示例：完整的求职流程

```
用户: "I'm looking for a new job as a data analyst in Sydney"

ChatGPT: [调用 recommend_jobs]
"基于您的需求，我为您推荐以下数据分析师职位：
1. Senior Data Analyst - AnalyticsCo
2. Data Analyst - FinanceCorp
..."

用户: "I like the first one. Can you tailor my resume for it?"

ChatGPT: [调用 tailor_resume]
"我已经为AnalyticsCo的Senior Data Analyst职位定制了您的简历。
主要优化：
1. 强调Python和SQL技能
2. 突出数据分析项目经验
..."

用户: "Show me more similar jobs"

ChatGPT: [调用 refine_recommendations]
"基于您对第一个职位的偏好，我为您推荐更多相似职位：
1. Data Analyst - TechStartup
2. Business Intelligence Analyst - CorpCo
..."

用户: "What's the skill gap between my current role and Product Manager?"

ChatGPT: [调用 career_skill_gap_analysis]
"从数据分析师到产品经理的技能差距分析：
✅ 已有技能: 数据分析、SQL、Python
📚 需要学习: 产品管理、用户研究、项目管理
⏱️ 预计准备时间: 6-12个月
..."

用户: "Give me links to search Product Manager jobs"

ChatGPT: [调用 build_search_links]
"以下是各平台的Product Manager职位搜索链接：
🔗 LinkedIn: ...
🔗 SEEK: ...
..."
```

---

## 🎯 提交到App Store后的体验

### 用户发现应用
1. 用户在ChatGPT中搜索"job search"或"career advice"
2. ChatGPT推荐"Hera AI"应用
3. 用户点击"使用Hera AI"

### 首次使用
1. ChatGPT自动调用`GET /api/mcp`获取工具列表
2. 用户开始对话，ChatGPT根据意图调用相应工具
3. 结果以对话形式展示给用户

### 持续使用
- 用户可以在同一对话中多次使用不同工具
- ChatGPT会记住上下文，提供连贯的体验
- 用户可以上传简历、提供反馈等

---

## 📊 技术实现细节

### 工具调用流程

```
用户输入
  ↓
ChatGPT理解意图
  ↓
选择Hera AI工具（如 recommend_jobs）
  ↓
POST /api/mcp
  {
    "method": "tools/call",
    "params": {
      "name": "recommend_jobs",
      "arguments": {...}
    }
  }
  ↓
Hera AI处理请求
  ↓
返回JSON结果
  ↓
ChatGPT格式化展示给用户
```

### 响应格式

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "找到15个职位..."
      }
    ],
    "meta": {
      "total": 15,
      "source": "multi_source",
      "returned_job_ids": ["id1", "id2", ...]
    }
  }
}
```

---

## ✅ 总结

### 当前App SDK特点
- ✅ **无独立UI**: 完全通过ChatGPT对话界面使用
- ✅ **11个工具**: 覆盖职位搜索、推荐、简历、职业规划等
- ✅ **智能路由**: ChatGPT自动选择最合适的工具
- ✅ **自然语言**: 用户用日常语言交互，无需学习API

### 提交后的用户体验
- 🎯 **发现**: 通过ChatGPT应用商店或推荐发现
- 💬 **使用**: 在ChatGPT对话中自然使用
- 🔄 **交互**: 多轮对话，上下文连贯
- 📱 **展示**: ChatGPT格式化展示结果

### 优势
1. **零学习成本**: 用户只需会聊天
2. **智能推荐**: ChatGPT理解意图，自动选择工具
3. **多工具协同**: 可以在一次对话中使用多个工具
4. **上下文记忆**: ChatGPT记住之前的对话内容

---

**最后更新**: 2025-12-24  
**状态**: 已实现，准备提交审核 ✅










