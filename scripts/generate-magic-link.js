#!/usr/bin/env node
/**
 * 生成 Manus → Hera 免登链接（验收用）
 *
 * 用法：node scripts/generate-magic-link.js <用户邮箱>
 * 示例：node scripts/generate-magic-link.js test@example.com
 *
 * 会打印一条链接。你把这条链接发给对方，对方在浏览器里打开，
 * 就会自动登录 Hera 并进入「我的投递」页，无需输入密码。
 * 链接 15 分钟内有效。
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const secret = process.env.MANUS_MAGIC_LINK_SECRET;
const email = process.argv[2]?.trim();

if (!secret) {
  console.error('错误：请先在 .env.local 中配置 MANUS_MAGIC_LINK_SECRET');
  process.exit(1);
}
if (!email) {
  console.error('用法：node scripts/generate-magic-link.js <用户邮箱>');
  console.error('示例：node scripts/generate-magic-link.js test@example.com');
  process.exit(1);
}

function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signManusToken(email) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 15 * 60; // 15 分钟
  const payload = { email, exp, iat: now };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(message).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${message}.${sigB64}`;
}

const jwt = signManusToken(email);
const baseUrl = (process.env.HERA_DOMAIN || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
const magicLinkUrl = `${baseUrl}/applications?manus_token=${encodeURIComponent(jwt)}`;

console.log('');
console.log('--- 免登链接（15 分钟内有效）---');
console.log(magicLinkUrl);
console.log('');
console.log('操作说明：');
console.log('  1. 把上面整行链接复制下来');
console.log('  2. 发给要登录的用户（微信/邮件/Manus 里发都行）');
console.log('  3. 对方在浏览器里打开该链接');
console.log('  4. 会自动登录并进入 Hera「我的投递」页，无需输入密码');
console.log('');
