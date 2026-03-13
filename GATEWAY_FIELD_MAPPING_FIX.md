# Gateway字段名映射修复

**问题**: GPTs Actions发送`location`字段，但MCP期望`city`字段，导致参数传递失败。

**根因**: 字段名不匹配
- GPTs可能发送: `query` / `location`
- MCP期望: `job_title` / `city`

---

## ✅ 修复内容

在`src/app/api/gateway/mcp/route.ts`中添加字段名映射（第123-132行）：

```typescript
// Step 1: Field name mapping - Map GPTs Actions field names to MCP expected field names
// This fixes the issue where GPTs sends 'query'/'location' but MCP expects 'job_title'/'city'
if (toolArguments.query && !toolArguments.job_title) {
  toolArguments.job_title = toolArguments.query;
  delete toolArguments.query;
  console.log('[Gateway] Field mapping: query → job_title');
}
if (toolArguments.location && !toolArguments.city) {
  toolArguments.city = toolArguments.location;
  delete toolArguments.location;
  console.log('[Gateway] Field mapping: location → city');
}
```

---

## 📋 修复逻辑

1. **检查字段名不匹配**:
   - 如果存在`query`但不存在`job_title` → 映射`query`到`job_title`
   - 如果存在`location`但不存在`city` → 映射`location`到`city`

2. **保留原有字段**:
   - 如果`job_title`/`city`已存在，不进行映射（避免覆盖）

3. **删除旧字段**:
   - 映射后删除`query`/`location`字段，避免混淆

---

## 🧪 测试验证

### 修复前
- ❌ `location` → MCP返回`"missing_params"`
- ❌ `query` → MCP返回`"missing_params"`

### 修复后（部署后）
- ✅ `location` → 映射为`city` → MCP正常处理
- ✅ `query` → 映射为`job_title` → MCP正常处理

---

## 📊 日志验证

修复后，Gateway日志会显示：
```
[Gateway] Field mapping: location → city
[Gateway] Field mapping: query → job_title
```

---

## 🚀 部署步骤

1. 提交代码到GitHub
2. 部署到生产环境
3. 验证修复：运行测试脚本或等待GPTs调用
4. 检查日志确认映射生效

---

**状态**: 修复代码已添加，等待部署验证。
