#!/bin/bash

# Test script for /api/mcp-lite endpoint

BASE_URL="http://localhost:3000"
MCP_TOKEN="${MCP_SHARED_SECRET:-test-token}"

echo "=========================================="
echo "Testing /api/mcp-lite endpoint"
echo "=========================================="
echo ""

# Test 1: GET /api/mcp-lite
echo "📋 Test 1: GET /api/mcp-lite"
echo "Expected: 4 tools, Cache-Control: no-store"
echo "---"
RESPONSE=$(curl -s -i -H "Authorization: Bearer $MCP_TOKEN" "$BASE_URL/api/mcp-lite")
echo "$RESPONSE" | head -20
echo ""

# Extract tools count
TOOLS_COUNT=$(echo "$RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
CACHE_CONTROL=$(echo "$RESPONSE" | grep -i "cache-control" || echo "NOT FOUND")

echo "✅ Tools count: $TOOLS_COUNT (expected: 4)"
echo "✅ Cache-Control: $CACHE_CONTROL"
echo ""

# Test 2: POST tools/list
echo "📋 Test 2: POST /api/mcp-lite (tools/list)"
echo "Expected: 4 tool definitions"
echo "---"
RESPONSE2=$(curl -s -X POST \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  "$BASE_URL/api/mcp-lite")

TOOLS_COUNT2=$(echo "$RESPONSE2" | grep -o '"name"' | wc -l | tr -d ' ')
echo "$RESPONSE2" | jq '.result.tools[]?.name' 2>/dev/null || echo "$RESPONSE2"
echo ""
echo "✅ Tools count: $TOOLS_COUNT2 (expected: 4)"
echo ""

# Test 3: POST tools/call - Allowed tool (search_jobs)
echo "📋 Test 3: POST /api/mcp-lite (tools/call - search_jobs)"
echo "Expected: Success (200 OK)"
echo "---"
RESPONSE3=$(curl -s -X POST \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_jobs","arguments":{"job_title":"Software Engineer","city":"Sydney"}}}' \
  "$BASE_URL/api/mcp-lite")

echo "$RESPONSE3" | jq '.error // .result' 2>/dev/null || echo "$RESPONSE3" | head -10
echo ""

# Test 4: POST tools/call - Disallowed tool (job_alert)
echo "📋 Test 4: POST /api/mcp-lite (tools/call - job_alert)"
echo "Expected: Error with code -32601"
echo "---"
RESPONSE4=$(curl -s -X POST \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"job_alert","arguments":{"session_id":"test"}}}' \
  "$BASE_URL/api/mcp-lite")

echo "$RESPONSE4" | jq '.error' 2>/dev/null || echo "$RESPONSE4"
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="







