#!/bin/bash

# AgentKit v2 Smoke Test Script
# 一键测试 plan→execute→打印执行摘要

set -e

BASE_URL="http://localhost:3002"
AGENTKIT_TOKEN=${AGENTKIT_TOKEN:-"test_token_123"}
FEATURE_FLAG=${FEATURE_AGENTKIT_V2:-"true"}

echo "🚀 AgentKit v2 Smoke Test"
echo "=========================="
echo "Base URL: $BASE_URL"
echo "Token: ${AGENTKIT_TOKEN:0:10}..."
echo "Feature Flag: $FEATURE_FLAG"
echo ""

# 测试1: 规划阶段
echo "📋 Step 1: Testing AgentKit v2 Plan"
PLAN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENTKIT_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agentkit-v2/plan",
    "params": {
      "userId": "smoke_test_user",
      "intent": {
        "primary": "find_jobs",
        "readiness": "ready",
        "blockers": [],
        "confidence": 0.9
      }
    },
    "id": 1
  }')

echo "Plan Response:"
echo "$PLAN_RESPONSE" | jq '.' 2>/dev/null || echo "$PLAN_RESPONSE"
echo ""

# 提取plan数据
PLAN_DATA=$(echo "$PLAN_RESPONSE" | jq -r '.result.content[0].data.content.plan // empty' 2>/dev/null)

if [ -z "$PLAN_DATA" ] || [ "$PLAN_DATA" = "null" ]; then
  echo "❌ Plan test failed - no plan generated"
  exit 1
fi

echo "✅ Plan generated successfully"
echo ""

# 测试2: 执行阶段
echo "⚡ Step 2: Testing AgentKit v2 Execute"
EXEC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENTKIT_TOKEN" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"agentkit-v2/execute\",
    \"params\": {
      \"plan\": $PLAN_DATA,
      \"allowTools\": [\"searchJobs\", \"rankRecommend\"]
    },
    \"id\": 2
  }")

echo "Execute Response:"
echo "$EXEC_RESPONSE" | jq '.' 2>/dev/null || echo "$EXEC_RESPONSE"
echo ""

# 测试3: 执行摘要
echo "📊 Step 3: Execution Summary"
EXECUTIONS=$(echo "$EXEC_RESPONSE" | jq -r '.result.content[0].data.content.executions // []' 2>/dev/null)

if [ -z "$EXECUTIONS" ] || [ "$EXECUTIONS" = "null" ]; then
  echo "❌ Execute test failed - no executions returned"
  exit 1
fi

# 统计执行结果
TOTAL_STEPS=$(echo "$EXECUTIONS" | jq 'length')
SUCCESS_STEPS=$(echo "$EXECUTIONS" | jq '[.[] | select(.status == "success")] | length')
FAILED_STEPS=$(echo "$EXECUTIONS" | jq '[.[] | select(.status == "error")] | length')
SKIPPED_STEPS=$(echo "$EXECUTIONS" | jq '[.[] | select(.status == "skipped")] | length')

echo "Execution Summary:"
echo "  Total Steps: $TOTAL_STEPS"
echo "  Successful: $SUCCESS_STEPS"
echo "  Failed: $FAILED_STEPS"
echo "  Skipped: $SKIPPED_STEPS"

# 计算成功率
if [ "$TOTAL_STEPS" -gt 0 ]; then
  SUCCESS_RATE=$(( (SUCCESS_STEPS * 100) / TOTAL_STEPS ))
  echo "  Success Rate: ${SUCCESS_RATE}%"
  
  if [ "$SUCCESS_RATE" -ge 80 ]; then
    echo "✅ Smoke test PASSED - Success rate: ${SUCCESS_RATE}%"
    exit 0
  else
    echo "❌ Smoke test FAILED - Success rate too low: ${SUCCESS_RATE}%"
    exit 1
  fi
else
  echo "❌ Smoke test FAILED - No steps executed"
  exit 1
fi
