#!/bin/bash

# AgentKit v2 快速测试设置脚本
echo "🚀 AgentKit v2 快速测试设置"
echo "=============================="

# 1. 检查服务器是否运行
BASE_URL="http://localhost:3002"
echo "📍 检查服务器状态: $BASE_URL"

if ! curl -s "$BASE_URL" > /dev/null; then
    echo "❌ 服务器未运行！请先启动开发服务器："
    echo "   npm run dev"
    exit 1
fi
echo "✅ 服务器正在运行"

# 2. 设置测试环境变量（仅本次会话）
export FEATURE_AGENTKIT_V2=true
export AGENTKIT_TOKEN="test_token_123"
echo "✅ 设置了测试环境变量"

# 3. 测试 v2 端点（无需认证，因为AGENTKIT_TOKEN未在服务器中配置）
echo ""
echo "🧪 测试 AgentKit v2 Plan 端点..."

PLAN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agentkit-v2/plan",
    "params": {
      "userId": "test_user",
      "intent": {
        "primary": "find_jobs",
        "readiness": "ready",
        "blockers": [],
        "confidence": 0.9
      }
    },
    "id": 1
  }')

echo "Plan 响应："
echo "$PLAN_RESPONSE" | jq '.' 2>/dev/null || echo "$PLAN_RESPONSE"

# 检查是否有错误
ERROR_MSG=$(echo "$PLAN_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
if [ -n "$ERROR_MSG" ]; then
    echo ""
    echo "⚠️  可能的错误: $ERROR_MSG"
    if [[ "$ERROR_MSG" == *"disabled"* ]]; then
        echo "💡 解决方案: 在服务器环境中设置 FEATURE_AGENTKIT_V2=true"
    elif [[ "$ERROR_MSG" == *"Unauthorized"* ]]; then
        echo "💡 解决方案: 在服务器环境中设置正确的 AGENTKIT_TOKEN"
    fi
fi

echo ""
echo "🎯 下一步操作："
echo "1. 如果要部署到生产环境，需要在部署平台设置环境变量"
echo "2. 如果要集成ChatGPT App，需要修改工具定义使用 agentkit-v2/plan 和 agentkit-v2/execute"
echo "3. 运行完整测试: ./scripts/agentkit/smoke_v2.sh"
