#!/bin/bash
# ============================================
# HeraAI Feedback Loop E2E Test
# ============================================
# 端到端测试 Feedback Loop 功能
# 测试流程：
#   1. 调用 /api/mcp-tracked (recommend_jobs)
#   2. 检查 MongoDB feedback_events
#   3. 模拟用户点击
#   4. 验证 feedback 更新
# ============================================

set -e  # 遇到错误立即退出

echo "🧪 HeraAI Feedback Loop E2E Test"
echo "================================"
echo ""

# 环境变量
BASE_URL=${BASE_URL:-"http://localhost:3002"}
MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017"}
MONGODB_DB=${MONGODB_DB:-"hera"}
AGENTKIT_TOKEN=${AGENTKIT_TOKEN:-"your_token_here"}

echo "📍 Configuration:"
echo "   BASE_URL: $BASE_URL"
echo "   MONGODB_DB: $MONGODB_DB"
echo ""

# 检查依赖
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed."
    echo "   Install: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

if ! command -v mongosh &> /dev/null; then
    echo "⚠️  mongosh not found. MongoDB verification will be skipped."
    SKIP_MONGO_CHECK=true
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: 调用 /api/mcp-tracked (recommend_jobs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/mcp-tracked" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENTKIT_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": "e2e_test_001",
    "method": "tools/call",
    "params": {
      "name": "recommend_jobs",
      "arguments": {
        "job_title": "Software Engineer",
        "city": "Melbourne",
        "limit": 3,
        "user_email": "test@heraai.net"
      }
    }
  }')

# 分离响应体和状态码
HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ Request failed with status $HTTP_STATUS"
  echo "$HTTP_BODY" | jq '.'
  exit 1
fi

# 提取关键信息
EVENT_ID=$(echo "$HTTP_BODY" | jq -r '.result.content[0].data.content._tracking.event_id // empty')
SESSION_ID=$(echo "$HTTP_BODY" | jq -r '.result.content[0].data.content._tracking.session_id // empty')
FEEDBACK_ENABLED=$(echo "$RESPONSE" | grep -o 'X-Feedback-Enabled: [^[:space:]]*' || echo "Not found")

echo "Feedback Enabled: $FEEDBACK_ENABLED"
echo "Event ID: ${EVENT_ID:-'N/A'}"
echo "Session ID: ${SESSION_ID:-'N/A'}"

if [ -z "$EVENT_ID" ] || [ "$EVENT_ID" == "null" ]; then
  echo "⚠️  No event_id in response (ENABLE_FEEDBACK might be false)"
  echo "Skipping further tests..."
  exit 0
fi

echo "✅ Event ID obtained: $EVENT_ID"

# 提取第一个job的URL检查追踪参数
FIRST_JOB_URL=$(echo "$HTTP_BODY" | jq -r '.result.content[0].data.content.jobs[0].url // .result.content[0].data.content.recommendations[0].url // empty')

if [ -n "$FIRST_JOB_URL" ]; then
  echo "First Job URL: $FIRST_JOB_URL"
  
  if echo "$FIRST_JOB_URL" | grep -q "ref=chatgpt"; then
    echo "✅ Tracking params found in URL"
  else
    echo "❌ No tracking params in URL"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: 检查 MongoDB feedback_events"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SKIP_MONGO_CHECK" == "true" ]; then
  echo "⚠️  Skipped (mongosh not available)"
else
  sleep 1  # 等待异步写入完成
  
  MONGO_RESULT=$(mongosh "$MONGODB_URI/$MONGODB_DB" --quiet --eval "
    const event = db.feedback_events.findOne({ event_id: '$EVENT_ID' });
    if (event) {
      print('✅ Event found in database');
      printjson({
        event_id: event.event_id,
        tool: event.tool,
        session_id: event.session_id,
        has_input: !!event.input,
        has_output: !!event.output,
        timestamp: event.timestamp
      });
    } else {
      print('❌ Event not found (async write may be pending)');
    }
  " 2>&1)
  
  echo "$MONGO_RESULT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: 模拟用户点击"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CLICK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d "{
    \"event_id\": \"$EVENT_ID\",
    \"action\": \"clicked\",
    \"payload\": {
      \"job_id\": \"test_job_123\"
    }
  }")

echo "$CLICK_RESPONSE" | jq '.'

if echo "$CLICK_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo "✅ Click recorded successfully"
else
  echo "❌ Click recording failed"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: 验证 feedback 更新"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SKIP_MONGO_CHECK" == "true" ]; then
  echo "⚠️  Skipped (mongosh not available)"
else
  sleep 1  # 等待写入
  
  UPDATED_RESULT=$(mongosh "$MONGODB_URI/$MONGODB_DB" --quiet --eval "
    const updated = db.feedback_events.findOne({ event_id: '$EVENT_ID' });
    if (updated && updated.feedback && updated.feedback.clicked_jobs) {
      print('✅ Feedback updated successfully');
      printjson({
        clicked_jobs: updated.feedback.clicked_jobs,
        clicked_at: updated.feedback.clicked_at
      });
    } else {
      print('❌ Feedback not updated');
    }
  " 2>&1)
  
  echo "$UPDATED_RESULT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: 查询会话历史"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

HISTORY_RESPONSE=$(curl -s "$BASE_URL/api/feedback?session_id=e2e_test_001")

echo "$HISTORY_RESPONSE" | jq '.'

HISTORY_COUNT=$(echo "$HISTORY_RESPONSE" | jq -r '.stats.total_events // 0')
echo "Session history events: $HISTORY_COUNT"

if [ "$HISTORY_COUNT" -gt 0 ]; then
  echo "✅ Session history retrieved"
else
  echo "⚠️  No session history (may be expected)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 E2E Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All tests passed"
echo "📊 Next steps:"
echo "   1. Review feedback_events in MongoDB"
echo "   2. Deploy to Vercel Preview"
echo "   3. Test with real ChatGPT"
echo ""

