#!/usr/bin/env node

/**
 * OpenAI API Status Checker
 * 快速验证所有 OpenAI API Keys 是否仍然有效
 * 
 * 使用方法:
 *   node scripts/test_openai_api_status.js
 */

// 加载环境变量
const fs = require('fs');
const path = require('path');

// 尝试加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // 移除引号
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

const https = require('https');

// 从环境变量读取所有可能的 API keys
const API_KEYS = {
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  'TAILOR_RESUME_API_KEY': process.env.TAILOR_RESUME_API_KEY,
  'GENERATE_COVER_LETTER_OPENAI_API_KEY': process.env.GENERATE_COVER_LETTER_OPENAI_API_KEY,
  'BOOST_SUMMARY_OPENAI_API_KEY': process.env.BOOST_SUMMARY_OPENAI_API_KEY,
  'JOB_PLAN_OPENAI_API_KEY': process.env.JOB_PLAN_OPENAI_API_KEY,
  'OPENAI_API_KEY_Parse_Resume': process.env.OPENAI_API_KEY_Parse_Resume,
};

// 颜色输出
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
 * 测试单个 API Key
 */
async function testApiKey(keyName, apiKey) {
  if (!apiKey) {
    return {
      keyName,
      status: 'not_set',
      message: '未设置',
      error: null
    };
  }

  // 只显示前8个字符和后4个字符，中间用...代替
  const maskedKey = apiKey.length > 12 
    ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    : '***';

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Say "API test successful" if you can read this.'
        }
      ],
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
      timeout: 10000 // 10秒超时
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            resolve({
              keyName,
              maskedKey,
              status: 'active',
              message: '✅ API Key 有效',
              statusCode: res.statusCode,
              model: response.model,
              usage: response.usage
            });
          } else if (res.statusCode === 401) {
            resolve({
              keyName,
              maskedKey,
              status: 'unauthorized',
              message: '❌ API Key 无效或已撤销',
              statusCode: res.statusCode,
              error: response.error?.message || 'Unauthorized'
            });
          } else if (res.statusCode === 429) {
            resolve({
              keyName,
              maskedKey,
              status: 'rate_limit',
              message: '⚠️ 速率限制（但API Key可能有效）',
              statusCode: res.statusCode,
              error: response.error?.message || 'Rate limit exceeded'
            });
          } else {
            resolve({
              keyName,
              maskedKey,
              status: 'error',
              message: `❌ 错误: ${res.statusCode}`,
              statusCode: res.statusCode,
              error: response.error?.message || data.substring(0, 200)
            });
          }
        } catch (e) {
          resolve({
            keyName,
            maskedKey,
            status: 'parse_error',
            message: '❌ 响应解析失败',
            statusCode: res.statusCode,
            error: data.substring(0, 200)
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        keyName,
        maskedKey,
        status: 'network_error',
        message: '❌ 网络错误',
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        keyName,
        maskedKey,
        status: 'timeout',
        message: '❌ 请求超时',
        error: 'Request timeout'
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 主函数
 */
async function main() {
  log('\n🔍 OpenAI API Key 状态检查', 'cyan');
  log('=' .repeat(60), 'cyan');
  log('正在测试所有配置的 API Keys...\n', 'blue');

  const results = [];
  const startTime = Date.now();

  // 测试所有 API Keys
  for (const [keyName, apiKey] of Object.entries(API_KEYS)) {
    log(`测试 ${keyName}...`, 'yellow');
    const result = await testApiKey(keyName, apiKey);
    results.push(result);
    
    // 立即显示结果
    if (result.status === 'active') {
      log(`  ${result.message} (${result.maskedKey})`, 'green');
    } else if (result.status === 'not_set') {
      log(`  ⚪ ${result.message}`, 'blue');
    } else {
      log(`  ${result.message}`, 'red');
      if (result.error) {
        log(`    错误详情: ${result.error}`, 'red');
      }
    }
    log('');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // 汇总报告
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 测试结果汇总', 'cyan');
  log('='.repeat(60), 'cyan');

  const activeKeys = results.filter(r => r.status === 'active');
  const inactiveKeys = results.filter(r => r.status !== 'active' && r.status !== 'not_set');
  const notSetKeys = results.filter(r => r.status === 'not_set');

  log(`\n✅ 有效的 API Keys: ${activeKeys.length}`, 'green');
  activeKeys.forEach(r => {
    log(`   - ${r.keyName} (${r.maskedKey})`, 'green');
  });

  if (inactiveKeys.length > 0) {
    log(`\n❌ 无效或错误的 API Keys: ${inactiveKeys.length}`, 'red');
    inactiveKeys.forEach(r => {
      log(`   - ${r.keyName} (${r.maskedKey})`, 'red');
      log(`     状态: ${r.message}`, 'red');
      if (r.error) {
        log(`     错误: ${r.error}`, 'red');
      }
    });
  }

  if (notSetKeys.length > 0) {
    log(`\n⚪ 未设置的 API Keys: ${notSetKeys.length}`, 'blue');
    notSetKeys.forEach(r => {
      log(`   - ${r.keyName}`, 'blue');
    });
  }

  log(`\n⏱️  测试耗时: ${duration}秒`, 'cyan');

  // 紧急建议
  log('\n' + '='.repeat(60), 'yellow');
  log('⚠️  紧急建议', 'yellow');
  log('='.repeat(60), 'yellow');

  if (activeKeys.length === 0 && inactiveKeys.length > 0) {
    log('\n🚨 所有 API Keys 都已失效！', 'red');
    log('   1. 立即检查 OpenAI 账户状态', 'red');
    log('   2. 联系 OpenAI 支持: support@openai.com', 'red');
    log('   3. 检查账户是否被暂停或封禁', 'red');
    log('   4. 考虑创建新的 API Keys（如果账户恢复）', 'red');
  } else if (inactiveKeys.length > 0) {
    log('\n⚠️  部分 API Keys 失效', 'yellow');
    log('   1. 检查失效的 API Keys 是否仍在代码中使用', 'yellow');
    log('   2. 如果账户被暂停，所有 API Keys 都会失效', 'yellow');
    log('   3. 需要联系 OpenAI 支持恢复账户', 'yellow');
  } else if (activeKeys.length > 0) {
    log('\n✅ 至少有一个 API Key 仍然有效', 'green');
    log('   建议检查账户状态，确认是否所有功能正常', 'green');
  }

  log('\n');

  // 返回退出码
  process.exit(activeKeys.length === 0 && inactiveKeys.length > 0 ? 1 : 0);
}

// 运行测试
main().catch((error) => {
  log(`\n❌ 测试过程中发生错误: ${error.message}`, 'red');
  process.exit(1);
});

