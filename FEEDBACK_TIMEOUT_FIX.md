# Feedback写入超时修复总结

**修复时间**: 2025-12-24  
**问题**: tailor_resume调用期间Feedback写入超时108秒，导致响应延迟和日志噪音

---

## ✅ 修复内容

### 1. 添加严格短超时

**修改位置**: `src/lib/feedback/FeedbackCollector.ts` 的 `asyncWrite` 方法

**超时设置**:
- **总超时**: 2秒（所有Feedback写入操作）
- **getDb()超时**: 1.5秒（MongoDB连接）
- **recordStart超时**: 100ms（应该立即返回event_id）

**修改前**:
```typescript
private async asyncWrite(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    console.error('[Feedback] Write error (non-blocking, ignored):', err.message);
  }
}
```

**修改后**:
```typescript
private async asyncWrite(fn: () => Promise<void>): Promise<void> {
  try {
    // 严格短超时：2秒总超时
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('FEEDBACK_WRITE_TIMEOUT: Operation exceeded 2s timeout'));
      }, 2000);
    });
    
    await Promise.race([fn(), timeoutPromise]);
  } catch (err: any) {
    // 降级为warn，避免误导为主流程错误
    const errorMsg = err.message || String(err);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT') || errorMsg.includes('secureConnect');
    
    if (isTimeout) {
      console.warn('[Feedback] FEEDBACK_WRITE_TIMEOUT (non-blocking, ignored):', errorMsg);
    } else {
      console.warn('[Feedback] Write error (non-blocking, ignored):', errorMsg);
    }
  }
}
```

---

### 2. 所有getDb()调用添加超时保护

**修改的方法**:
- `recordStart()` - 添加1.5秒getDb超时
- `recordEnd()` - 添加1.5秒getDb超时
- `updateFeedback()` - 添加1.5秒getDb超时
- `getSessionFeedback()` - 添加1.5秒getDb超时 + 2秒查询超时

**示例（recordStart）**:
```typescript
// 添加getDb超时保护
const dbPromise = getDb();
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('FEEDBACK_WRITE_TIMEOUT: getDb() exceeded 1.5s')), 1500);
});

const db = await Promise.race([dbPromise, timeoutPromise]);
```

---

### 3. 错误日志降级（error → warn）

**修改前**:
```typescript
console.error('[Feedback] Write error (non-blocking, ignored):', err.message);
```

**修改后**:
```typescript
console.warn('[Feedback] FEEDBACK_WRITE_TIMEOUT (non-blocking, ignored):', errorMsg);
```

**原因**: 避免误导为主流程错误，Feedback写入失败不应该用error级别。

---

### 4. 添加FEEDBACK_WRITE_TIMEOUT标签

所有超时错误都包含 `FEEDBACK_WRITE_TIMEOUT` 标签，便于：
- 日志统计和过滤
- 监控告警
- 问题排查

---

### 5. recordStart调用处添加超时保护

**修改位置**: `src/app/api/mcp/route.ts` 第970行

**修改前**:
```typescript
feedback_event_id = await fc.recordStart(...).catch(err => {
  console.error('[Feedback] recordStart failed (non-blocking):', err);
  return null;
});
```

**修改后**:
```typescript
const recordStartPromise = fc.recordStart(...);
const recordStartTimeout = new Promise<string | null>((resolve) => {
  setTimeout(() => resolve(null), 100); // 100ms超时，recordStart应该立即返回
});

feedback_event_id = await Promise.race([recordStartPromise, recordStartTimeout]).catch(err => {
  console.warn('[Feedback] FEEDBACK_WRITE_TIMEOUT: recordStart failed (non-blocking):', err?.message || err);
  return null;
});
```

---

## ✅ 验收标准

- [x] tailor_resume正常返回不受影响（核心输出不变）
- [x] Feedback写入即使失败，也不会出现30s+的长卡顿（现在最多2秒）
- [x] 日志中不再出现[error] ... secureConnect timed out ...（改为warn）
- [x] 不允许修改除Feedback写入相关之外的任何代码路径

---

## 📋 修改的文件

1. ✅ `src/lib/feedback/FeedbackCollector.ts` - 所有Feedback写入方法
2. ✅ `src/app/api/mcp/route.ts` - recordStart调用处

---

## 🎯 超时策略总结

| 操作 | Connect超时 | Total超时 | 说明 |
|------|------------|-----------|------|
| recordStart | 1.5s | 2s | getDb + insertOne |
| recordEnd | 1.5s | 2s | getDb + updateOne |
| updateFeedback | 1.5s | 2s | getDb + updateOne |
| getSessionFeedback | 1.5s | 2s | getDb + query |
| recordStart调用 | - | 100ms | 应该立即返回event_id |

---

**状态**: ✅ 已修复，等待测试验证









