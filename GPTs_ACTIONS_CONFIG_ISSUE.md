# GPTs Actions 配置问题分析

**问题**: GPTs Actions没有发送`arguments`参数

**根因**: GPTs Actions的OpenAPI配置可能有问题

---

## 📋 问题确认

从Gateway日志看到：
```
argsKeys: '[]'  // 空数组，说明Gateway根本没有收到任何参数
hasJobTitle: false
hasQuery: false
hasCity: false
hasLocation: false
```

**结论**: GPTs Actions根本没有发送`arguments`参数，或者发送的是空对象`{}`

---

## 🔍 可能的原因

### 1. OpenAPI Schema配置问题
GPTs Actions的OpenAPI schema中，`arguments`字段可能：
- 没有设置为`required: true`
- 没有正确的`properties`定义
- `additionalProperties`设置不正确

### 2. GPTs Actions调用方式问题
GPTs可能：
- 没有正确解析用户输入
- 没有将参数填充到`arguments`对象中
- 发送了空对象`{}`

### 3. Schema定义不匹配
GPTs Actions的schema定义可能与实际需要的参数不匹配

---

## 🔧 解决方案

### Step 1: 检查GPTs Actions的OpenAPI配置

确保`/api/gateway/mcp`的OpenAPI schema中：

1. **Request Body Schema**:
```json
{
  "type": "object",
  "required": ["tool", "arguments"],  // ✅ arguments应该是required
  "properties": {
    "tool": { ... },
    "arguments": {
      "type": "object",
      "description": "Tool-specific arguments",
      "additionalProperties": true  // ✅ 允许任意字段
    }
  }
}
```

2. **search_jobs的arguments示例**:
```json
{
  "tool": "search_jobs",
  "arguments": {
    "job_title": "Software Engineer",  // ✅ 明确字段名
    "city": "Sydney"
  }
}
```

### Step 2: 检查GPTs Actions的Action配置

在ChatGPT GPTs编辑器中：
1. 检查Action的`arguments`字段是否设置为required
2. 检查Action的schema是否包含`job_title`和`city`字段
3. 检查Action的描述是否明确说明需要这些参数

### Step 3: 添加更明确的Schema定义

可以在OpenAPI schema中添加更详细的`arguments`定义：

```json
{
  "arguments": {
    "type": "object",
    "properties": {
      "job_title": {
        "type": "string",
        "description": "Job title to search for (e.g., 'Software Engineer')"
      },
      "city": {
        "type": "string",
        "description": "City name for job location (e.g., 'Sydney')"
      }
    },
    "required": ["job_title", "city"],
    "additionalProperties": true
  }
}
```

---

## 📋 验证步骤

1. **检查GPTs Actions的OpenAPI配置**
   - 确认`arguments`字段存在
   - 确认`arguments`是`required`
   - 确认schema定义正确

2. **测试GPTs Actions调用**
   - 在ChatGPT中测试search_jobs功能
   - 检查是否发送了`arguments`参数
   - 检查参数内容是否正确

3. **检查Gateway日志**
   - 确认`argsKeys`不为空
   - 确认参数被正确接收

---

## 🎯 当前状态

- ✅ Gateway修复代码已部署（字段名映射）
- ❌ GPTs Actions没有发送参数（配置问题）
- ⏳ 需要修复GPTs Actions的OpenAPI配置

---

**下一步**: 检查并修复GPTs Actions的OpenAPI配置，确保`arguments`字段被正确发送。
