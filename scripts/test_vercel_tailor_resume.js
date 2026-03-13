#!/usr/bin/env node

/**
 * 测试 Vercel 部署的 tailor_resume MCP 工具
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

// 从环境变量或命令行参数获取 URL
const VERCEL_URL = process.argv[2] || process.env.VERCEL_URL || 'https://hera-one.vercel.app';
const MCP_ENDPOINT = `${VERCEL_URL}/api/mcp-lite`;
const MCP_SECRET = process.env.MCP_SHARED_SECRET || '';

log(`\n🧪 Testing Vercel Deployed tailor_resume MCP Tool`, 'cyan');
log(`URL: ${MCP_ENDPOINT}`, 'blue');
log('=' .repeat(60), 'cyan');

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
`;

async function testTailorResume() {
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
    log('\n📤 Sending request to Vercel MCP endpoint...', 'blue');
    
    const url = new URL(MCP_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MCP_SECRET}`
      },
      timeout: 120000
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
    
    log('\n✅ Response received!', 'green');
    log('\n' + '='.repeat(60), 'cyan');
    log('📋 Response Content:', 'cyan');
    log('='.repeat(60), 'cyan');
    
    // 显示完整响应
    log('\n📄 Full Response:', 'blue');
    log('-'.repeat(60), 'blue');
    log(textContent.substring(0, 3000) + (textContent.length > 3000 ? '\n... (truncated)' : ''), 'reset');
    log('-'.repeat(60), 'blue');
    
    // 检查是否包含完整简历
    const hasCompleteResume = textContent.includes('## 📄 Complete Tailored Resume') || 
                               textContent.includes('Complete Tailored Resume') ||
                               textContent.includes('Employment History') ||
                               textContent.includes('Professional Summary');
    
    const hasSummary = textContent.includes('## 📊 Customization Summary') || 
                       textContent.includes('Customization Summary') ||
                       textContent.includes('Key Changes Made');
    
    log(`\n📊 Analysis:`, 'cyan');
    log(`   - Contains complete resume: ${hasCompleteResume ? '✅' : '❌'}`, hasCompleteResume ? 'green' : 'red');
    log(`   - Contains summary: ${hasSummary ? '✅' : '❌'}`, hasSummary ? 'green' : 'red');
    log(`   - Response length: ${textContent.length} characters`, textContent.length > 500 ? 'green' : 'yellow');

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






