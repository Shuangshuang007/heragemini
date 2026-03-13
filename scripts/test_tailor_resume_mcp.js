#!/usr/bin/env node

/**
 * 测试 tailor_resume MCP 工具
 * 验证：
 * 1. 返回格式是否正确（先完整简历，后总结）
 * 2. 返回内容是否完整（不是摘要）
 * 3. max_tokens 是否足够
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
const MCP_ENDPOINT = `${BASE_URL}/api/mcp-lite`;

// 示例简历数据
const sampleResume = {
  profile: {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+61 400 123 456",
    location: "Sydney, NSW"
  },
  summary: "Experienced software engineer with 5+ years in full-stack development",
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Tech Corp",
      location: "Sydney, NSW",
      startDate: "2020-01",
      endDate: "Present",
      description: "Led development of microservices architecture",
      bullets: [
        "Developed and maintained RESTful APIs using Node.js and Express",
        "Implemented CI/CD pipelines reducing deployment time by 50%",
        "Mentored junior developers and conducted code reviews"
      ]
    },
    {
      title: "Software Developer",
      company: "StartupXYZ",
      location: "Melbourne, VIC",
      startDate: "2018-06",
      endDate: "2019-12",
      description: "Full-stack development using React and Node.js",
      bullets: [
        "Built responsive web applications using React",
        "Collaborated with cross-functional teams",
        "Optimized database queries improving performance by 30%"
      ]
    }
  ],
  education: [
    {
      degree: "Bachelor of Computer Science",
      institution: "University of Sydney",
      startDate: "2014",
      endDate: "2018"
    }
  ],
  skills: ["JavaScript", "Node.js", "React", "Python", "AWS", "Docker"]
};

// 示例职位描述
const sampleJobDescription = `
Software Engineer Position

We are looking for an experienced Software Engineer to join our team. 
The ideal candidate should have:
- 5+ years of experience in software development
- Strong experience with JavaScript, Node.js, and React
- Experience with cloud platforms (AWS preferred)
- Experience with microservices architecture
- Strong problem-solving skills
- Excellent communication skills

Responsibilities:
- Design and develop scalable web applications
- Collaborate with cross-functional teams
- Write clean, maintainable code
- Participate in code reviews
- Mentor junior developers
`;

async function testTailorResume() {
  log('\n🧪 Testing tailor_resume MCP Tool', 'cyan');
  log('=' .repeat(60), 'cyan');

  const requestBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "tailor_resume",
      arguments: {
        user_profile: {
          name: sampleResume.profile.name,
          email: sampleResume.profile.email,
          skills: sampleResume.skills,
          employmentHistory: sampleResume.experience.map(exp => ({
            position: exp.title,
            company: exp.company,
            startDate: exp.startDate,
            endDate: exp.endDate,
            description: exp.description,
            bullets: exp.bullets
          }))
        },
        resume_content: JSON.stringify(sampleResume),
        job_description: sampleJobDescription,
        job_title: "Software Engineer",
        company: "Tech Company",
        customization_level: "moderate",
        user_email: "test@example.com"
      }
    }
  };

  try {
    log('\n📤 Sending request to MCP endpoint...', 'blue');
    log(`URL: ${MCP_ENDPOINT}`, 'blue');
    
    const url = new URL(MCP_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MCP_SHARED_SECRET || process.env.MCP_SECRET_KEY || 'test-key'}`
      },
      timeout: 120000 // 2 minutes timeout
    };

    const response = await new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(JSON.stringify(requestBody));
      req.end();
    });

    log(`\n📥 Response Status: ${response.statusCode}`, response.statusCode === 200 ? 'green' : 'red');

    if (response.statusCode !== 200) {
      log(`Response Body: ${response.body}`, 'red');
      return;
    }

    const result = JSON.parse(response.body);
    
    if (result.error) {
      log(`\n❌ Error: ${JSON.stringify(result.error, null, 2)}`, 'red');
      return;
    }

    if (!result.result || !result.result.content) {
      log(`\n❌ Invalid response structure`, 'red');
      log(`Response: ${JSON.stringify(result, null, 2)}`, 'yellow');
      return;
    }

    const textContent = result.result.content[0]?.text || '';
    
    // 检查是否有错误
    if (result.result.isError || textContent.includes('Failed to')) {
      log('\n⚠️  Response contains error:', 'yellow');
      log(textContent, 'yellow');
      log('\nFull response:', 'yellow');
      log(JSON.stringify(result, null, 2), 'yellow');
      return;
    }
    
    log('\n✅ Response received successfully!', 'green');
    log('\n' + '='.repeat(60), 'cyan');
    log('📋 Response Analysis:', 'cyan');
    log('='.repeat(60), 'cyan');

    // 检查1: 格式是否正确（先完整简历，后总结）
    const hasCompleteResume = textContent.includes('## 📄 Complete Tailored Resume');
    const hasSummary = textContent.includes('## 📊 Customization Summary');
    const resumeIndex = textContent.indexOf('## 📄 Complete Tailored Resume');
    const summaryIndex = textContent.indexOf('## 📊 Customization Summary');
    
    log(`\n1️⃣ Format Check:`, 'blue');
    log(`   - Has "Complete Tailored Resume" section: ${hasCompleteResume ? '✅' : '❌'}`, hasCompleteResume ? 'green' : 'red');
    log(`   - Has "Customization Summary" section: ${hasSummary ? '✅' : '❌'}`, hasSummary ? 'green' : 'red');
    
    if (hasCompleteResume && hasSummary) {
      if (resumeIndex < summaryIndex) {
        log(`   - Resume appears BEFORE summary: ✅`, 'green');
      } else {
        log(`   - Resume appears AFTER summary: ❌ (Should be before)`, 'red');
      }
    }

    // 检查2: 内容是否完整（不是摘要）
    const resumeSection = textContent.substring(resumeIndex, summaryIndex > 0 ? summaryIndex : textContent.length);
    const hasProfile = resumeSection.includes(sampleResume.profile.name) || resumeSection.includes('**');
    const hasExperience = resumeSection.includes('Employment History') || resumeSection.includes('Experience');
    const hasSkills = resumeSection.includes('Skills') || resumeSection.includes(sampleResume.skills[0]);
    
    log(`\n2️⃣ Content Completeness Check:`, 'blue');
    log(`   - Contains profile information: ${hasProfile ? '✅' : '❌'}`, hasProfile ? 'green' : 'red');
    log(`   - Contains experience section: ${hasExperience ? '✅' : '❌'}`, hasExperience ? 'green' : 'red');
    log(`   - Contains skills section: ${hasSkills ? '✅' : '❌'}`, hasSkills ? 'green' : 'red');
    
    // 检查3: 内容长度（确保不是摘要）
    const resumeContentLength = resumeSection.length;
    log(`\n3️⃣ Content Length Check:`, 'blue');
    log(`   - Resume section length: ${resumeContentLength} characters`, resumeContentLength > 500 ? 'green' : 'yellow');
    
    if (resumeContentLength < 200) {
      log(`   - ⚠️  Warning: Resume content seems too short (might be summary only)`, 'yellow');
    } else if (resumeContentLength > 500) {
      log(`   - ✅ Resume content appears complete`, 'green');
    }

    // 显示部分内容预览
    log(`\n📄 Response Preview (first 1000 chars):`, 'blue');
    log('-'.repeat(60), 'blue');
    log(textContent.substring(0, 1000) + (textContent.length > 1000 ? '...' : ''), 'reset');
    log('-'.repeat(60), 'blue');

    // 总结
    log(`\n📊 Test Summary:`, 'cyan');
    const allChecksPassed = hasCompleteResume && hasSummary && resumeIndex < summaryIndex && hasProfile && hasExperience && resumeContentLength > 500;
    
    if (allChecksPassed) {
      log(`✅ All checks passed! Tailor resume is working correctly.`, 'green');
    } else {
      log(`⚠️  Some checks failed. Please review the output above.`, 'yellow');
    }

  } catch (error) {
    log(`\n❌ Test failed with error:`, 'red');
    log(error.message, 'red');
    if (error.stack) {
      log(error.stack, 'red');
    }
  }
}

// 运行测试
testTailorResume().then(() => {
  log('\n✅ Test completed', 'green');
  process.exit(0);
}).catch((error) => {
  log(`\n❌ Test failed: ${error.message}`, 'red');
  process.exit(1);
});

