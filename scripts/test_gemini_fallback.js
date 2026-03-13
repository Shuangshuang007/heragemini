#!/usr/bin/env node

/**
 * 测试 Gemini Fallback 机制
 * 验证当 OpenAI API 失败时，是否能正确 fallback 到 Gemini
 */

const https = require('https');
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

/**
 * 测试 OpenAI API（应该失败，因为账户被停用）
 */
async function testOpenAI() {
  return new Promise((resolve) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      resolve({ success: false, error: 'OPENAI_API_KEY not set' });
      return;
    }

    const postData = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "test" if you can read this.' }],
      max_tokens: 10
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({ success: true, data: response });
          } else {
            resolve({ success: false, error: response.error?.message || data, statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ success: false, error: data.substring(0, 200), statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => resolve({ success: false, error: error.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    req.write(postData);
    req.end();
  });
}

/**
 * 测试 Gemini API
 */
async function testGemini() {
  return new Promise((resolve) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      resolve({ success: false, error: 'GEMINI_API_KEY not set' });
      return;
    }

    const postData = JSON.stringify({
      model: 'gemini-2.0-flash-exp',
      messages: [{ role: 'user', content: 'Say "test" if you can read this.' }],
      max_tokens: 10
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: '/v1beta/openai/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({ success: true, data: response });
          } else {
            resolve({ success: false, error: response.error?.message || data, statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ success: false, error: data.substring(0, 200), statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => resolve({ success: false, error: error.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    req.write(postData);
    req.end();
  });
}

/**
 * 测试本地 API endpoint（测试实际的 fallback 机制）
 */
async function testLocalAPI() {
  return new Promise((resolve) => {
    const http = require('http');
    
    const postData = JSON.stringify({
      summary: 'Experienced software engineer with 5+ years in full-stack development. Led multiple projects using React, Node.js, and Python.'
    });

    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/boost-summary',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({ success: true, data: response });
          } else {
            resolve({ success: false, error: response.error || data, statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ success: false, error: data.substring(0, 200), statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve({ success: false, error: 'Server not running. Please start with: npm run dev', code: error.code });
      } else {
        resolve({ success: false, error: error.message, code: error.code });
      }
    });
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    req.write(postData);
    req.end();
  });
}

async function main() {
  log('\n🧪 Gemini Fallback 测试', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // 1. 测试 OpenAI API（应该失败）
  log('\n1️⃣  测试 OpenAI API（预期：失败，账户被停用）', 'yellow');
  const openaiResult = await testOpenAI();
  if (openaiResult.success) {
    log('   ⚠️  OpenAI API 仍然可用（这不应该发生）', 'yellow');
  } else {
    log(`   ✅ OpenAI API 失败（符合预期）`, 'green');
    log(`   错误: ${openaiResult.error}`, 'blue');
  }
  
  // 2. 测试 Gemini API（应该成功）
  log('\n2️⃣  测试 Gemini API（预期：成功）', 'yellow');
  const geminiResult = await testGemini();
  if (geminiResult.success) {
    log('   ✅ Gemini API 可用', 'green');
    const content = geminiResult.data?.choices?.[0]?.message?.content || 'N/A';
    log(`   响应: ${content.substring(0, 100)}`, 'blue');
  } else {
    log(`   ❌ Gemini API 失败`, 'red');
    log(`   错误: ${geminiResult.error}`, 'red');
    log(`   状态码: ${geminiResult.statusCode || 'N/A'}`, 'red');
  }
  
  // 3. 测试本地 API（测试实际的 fallback）
  log('\n3️⃣  测试本地 API Fallback（预期：自动切换到 Gemini）', 'yellow');
  log('   等待 3 秒让服务器启动...', 'blue');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const localResult = await testLocalAPI();
  if (localResult.success) {
    log('   ✅ 本地 API 调用成功（应该使用了 Gemini fallback）', 'green');
    const boostedSummary = localResult.data?.boostedSummary || 'N/A';
    log(`   响应长度: ${boostedSummary.length} 字符`, 'blue');
    log(`   响应预览: ${boostedSummary.substring(0, 150)}...`, 'blue');
  } else {
    log(`   ❌ 本地 API 调用失败`, 'red');
    log(`   错误: ${localResult.error}`, 'red');
    if (localResult.error.includes('Server not running')) {
      log('\n   💡 提示: 请确保开发服务器正在运行 (npm run dev)', 'yellow');
    }
  }
  
  // 总结
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 测试结果汇总', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\nOpenAI API: ${openaiResult.success ? '✅ 可用' : '❌ 失败（符合预期）'}`, openaiResult.success ? 'green' : 'yellow');
  log(`Gemini API: ${geminiResult.success ? '✅ 可用' : '❌ 失败'}`, geminiResult.success ? 'green' : 'red');
  log(`本地 API Fallback: ${localResult.success ? '✅ 成功' : '❌ 失败'}`, localResult.success ? 'green' : 'red');
  
  if (geminiResult.success && localResult.success) {
    log('\n🎉 Fallback 机制工作正常！', 'green');
    log('   即使 OpenAI 账户被停用，系统也能自动切换到 Gemini', 'green');
  } else if (!geminiResult.success) {
    log('\n⚠️  Gemini API 配置可能有问题，请检查 GEMINI_API_KEY', 'yellow');
  } else {
    log('\n⚠️  本地 API 测试失败，请检查服务器是否正常运行', 'yellow');
  }
  
  log('\n');
}

main().catch((error) => {
  log(`\n❌ 测试过程中发生错误: ${error.message}`, 'red');
  process.exit(1);
});

