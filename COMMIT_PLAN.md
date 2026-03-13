# 今天需要提交到GitHub的文件

**日期**: 2025-12-24

---

## ✅ 必须提交的文件（核心功能）

### 1. 代码文件（2个）

1. **`src/app/api/gateway/mcp/route.ts`**
   - Gateway 401鉴权失败修复
   - Gateway现在永远只使用自己的MCP_SHARED_SECRET（方案A）
   - 忽略上游Authorization header（避免安全风险）

2. **`src/app/privacy/page.tsx`**
   - 隐私政策完善（P1.2）
   - 添加了详细的数据保留期限
   - 添加了数据删除方式说明
   - 添加了第三方数据来源说明（ATS vs 职位平台）
   - 添加了信息安全措施说明

---

## ✅ 应该提交的文件（重要文档）

3. **`README.md`**
   - 添加了"Third-Party Data Sources"章节
   - 更新了Disclaimer，明确说明不爬取职位平台
   - 用户可见，需要提交

4. **`MCP_TOOLS_REVIEW_PACKET.md`**
   - ChatGPT应用商店提交需要的审核包（P1.1）
   - 包含11个工具的完整metadata
   - 审核人员会查看，必须提交

5. **`CHATGPT_APPS_INTEGRATION_GUIDE.md`**
   - 更新了应用详细描述
   - 添加了数据来源说明
   - 提交ChatGPT应用商店时需要

---

## ❌ 不需要提交的文件

### 内部文档（不提交）
- `P1_2_*.md` - 隐私政策总结文档（内部）
- `P1_3_*.md` - 第三方合规总结文档（内部）
- `GATEWAY_401_*.md` - Gateway排查文档（内部）
- `GPT_SUGGESTIONS_SUMMARY.md` - GPT建议总结（内部）
- `APP_SDK_USER_EXPERIENCE.md` - 用户体验说明（内部）
- `CHATGPT_APP_STORE_SUBMISSION_CHECKLIST.md` - 内部检查清单

### 测试脚本（不提交）
- `scripts/test_*.js` - 测试脚本
- `scripts/test_*.sh` - 测试脚本
- `scripts/verify_*.js` - 验证脚本

---

## ❓ 需要确认的文件

### `package-lock.json`
- 如果只是依赖版本更新（dev: true等），可以提交
- 如果有实际依赖变更，需要提交
- 建议检查diff后决定

---

## 📋 提交命令

```bash
# 添加核心代码文件
git add src/app/api/gateway/mcp/route.ts
git add src/app/privacy/page.tsx

# 添加重要文档
git add README.md
git add MCP_TOOLS_REVIEW_PACKET.md
git add CHATGPT_APPS_INTEGRATION_GUIDE.md

# 检查package-lock.json后决定是否添加
# git add package-lock.json

# 提交
git commit -m "feat: Gateway 401 fix and privacy policy updates

- Fix Gateway authentication: always use own MCP_SHARED_SECRET (ignore upstream Authorization)
- Update privacy policy: add data retention, deletion process, third-party data sources
- Add MCP tools review packet for ChatGPT App Store submission
- Update README with third-party data sources clarification
- Update ChatGPT Apps integration guide with data sources info"
```

---

**状态**: ✅ 准备提交
