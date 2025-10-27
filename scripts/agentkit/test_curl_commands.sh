#!/bin/bash
# AgentKit V2 测试脚本

BASE_URL="http://localhost:3002"

echo "🚀 AgentKit V2 Integration Test"
echo "================================"

# 检查服务是否运行
echo "检查服务状态..."
if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "✅ 服务正在运行"
else
    echo "❌ 服务未运行，请先启动: npm run dev"
    exit 1
fi

echo ""
echo "📋 测试 1: agentkit-v2/plan"
echo "------------------------"

PLAN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "agentkit-v2/plan",
    "params": {
      "userId": "test_user",
      "intent": {
        "primary": "find_jobs",
        "readiness": "needs_resume",
        "blockers": ["resume_missing"],
        "confidence": 0.8
      }
    }
  }')

echo "响应:"
echo "$PLAN_RESPONSE" | jq '.' 2>/dev/null || echo "$PLAN_RESPONSE"

echo ""
echo "📋 测试 2: agentkit-v2/execute (使用示例计划)"
echo "----------------------------------------"

# 使用示例计划数据
EXECUTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "agentkit-v2/execute",
    "params": {
      "plan": {
        "id": "test_plan_123",
        "userId": "test_user",
        "intent": {
          "primary": "find_jobs",
          "readiness": "needs_resume",
          "blockers": ["resume_missing"],
          "confidence": 0.8
        },
        "steps": [
          {
            "id": "s1",
            "tool": "parseResume",
            "args": {"autoParse": true},
            "priority": 1
          },
          {
            "id": "s2", 
            "tool": "searchJobs",
            "args": {"limit": 10},
            "priority": 2
          },
          {
            "id": "s3",
            "tool": "rankRecommend", 
            "args": {"algorithm": "skill_match"},
            "priority": 3
          }
        ],
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
        "version": "v1.0.0"
      },
      "allowTools": ["searchJobs"]
    }
  }')

echo "响应:"
echo "$EXECUTE_RESPONSE" | jq '.' 2>/dev/null || echo "$EXECUTE_RESPONSE"

echo ""
echo "🎯 验证要点:"
echo "- 测试1应该返回包含plan对象的响应"
echo "- 测试2中只有searchJobs应该执行成功，其他工具被跳过"
echo "- 响应格式应该符合JSON-RPC 2.0规范"
