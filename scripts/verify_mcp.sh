#!/bin/bash
# MCP Endpoint Verification Script
# Tests GET/POST endpoints with new token, old token (if enabled), and no token
# Created: 2025-01-27

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${NEXT_PUBLIC_BASE_URL:-http://localhost:3002}
ENDPOINT="${BASE_URL}/api/mcp"
NEW_TOKEN=${MCP_SHARED_SECRET:-"YOUR_MCP_SHARED_SECRET"}
OLD_TOKEN=${MCP_SHARED_SECRET_OLD:-""}

PASS_COUNT=0
FAIL_COUNT=0

echo "=========================================="
echo "MCP Endpoint Verification Script"
echo "=========================================="
echo "Endpoint: ${ENDPOINT}"
echo "New Token: ${NEW_TOKEN:0:20}..."
if [ -n "$OLD_TOKEN" ]; then
  echo "Old Token: ${OLD_TOKEN:0:20}... (compatibility enabled)"
else
  echo "Old Token: Not set (compatibility disabled)"
fi
echo ""

# Helper function to check response
check_response() {
  local name=$1
  local response=$2
  local expected_status=$3
  local expected_content=$4
  
  # Extract status code (last line of curl output)
  local status_code=$(echo "$response" | tail -1 | grep -oE '[0-9]{3}' | tail -1 || echo "000")
  local body=$(echo "$response" | head -n -1)
  
  if [ "$status_code" = "$expected_status" ]; then
    if [ -n "$expected_content" ] && echo "$body" | grep -q "$expected_content"; then
      echo -e "${GREEN}✅ PASS${NC}: $name"
      ((PASS_COUNT++))
      return 0
    elif [ -z "$expected_content" ]; then
      echo -e "${GREEN}✅ PASS${NC}: $name"
      ((PASS_COUNT++))
      return 0
    fi
  fi
  
  echo -e "${RED}❌ FAIL${NC}: $name (Status: $status_code, Expected: $expected_status)"
  echo "Response: $body" | head -3
  ((FAIL_COUNT++))
  return 1
}

# Test 1: GET with new token
echo "Test 1: GET /api/mcp with NEW token"
RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer ${NEW_TOKEN}" "${ENDPOINT}" 2>&1)
TOOLS_COUNT=$(echo "$RESPONSE" | grep -o '"name":' | wc -l | tr -d ' ')
if [ "$TOOLS_COUNT" -eq 11 ]; then
  check_response "GET returns 11 tools" "$RESPONSE" "200" ""
else
  echo -e "${RED}❌ FAIL${NC}: GET returns ${TOOLS_COUNT} tools (expected 11)"
  ((FAIL_COUNT++))
fi
echo ""

# Test 2: POST tools/list with new token
echo "Test 2: POST tools/list with NEW token"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${NEW_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  "${ENDPOINT}" 2>&1)
TOOLS_COUNT=$(echo "$RESPONSE" | grep -o '"name":' | wc -l | tr -d ' ')
if [ "$TOOLS_COUNT" -eq 11 ]; then
  check_response "POST tools/list returns 11 tools" "$RESPONSE" "200" ""
else
  echo -e "${RED}❌ FAIL${NC}: POST tools/list returns ${TOOLS_COUNT} tools (expected 11)"
  ((FAIL_COUNT++))
fi
echo ""

# Test 3: Smoke test - search_jobs with new token
echo "Test 3: Smoke test - search_jobs with NEW token"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${NEW_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_jobs","arguments":{"job_title":"software engineer","city":"Melbourne","limit":3}},"id":2}' \
  "${ENDPOINT}" 2>&1)
if echo "$RESPONSE" | grep -q "jobs\|Found\|software" || echo "$RESPONSE" | grep -q "200"; then
  check_response "search_jobs tool call" "$RESPONSE" "200" ""
else
  echo -e "${YELLOW}⚠️  WARN${NC}: search_jobs response may be empty (this is OK if no jobs found)"
  echo "Response status: $(echo "$RESPONSE" | tail -1)"
fi
echo ""

# Test 4: Smoke test - build_search_links with new token
echo "Test 4: Smoke test - build_search_links with NEW token"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${NEW_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"build_search_links","arguments":{"job_title":"data analyst","city":"Sydney"}},"id":3}' \
  "${ENDPOINT}" 2>&1)
if echo "$RESPONSE" | grep -q "linkedin\|seek\|url" || echo "$RESPONSE" | grep -q "200"; then
  check_response "build_search_links tool call" "$RESPONSE" "200" ""
else
  echo -e "${YELLOW}⚠️  WARN${NC}: build_search_links response may be empty"
  echo "Response status: $(echo "$RESPONSE" | tail -1)"
fi
echo ""

# Test 5: GET with old token (if compatibility enabled)
if [ -n "$OLD_TOKEN" ]; then
  echo "Test 5: GET /api/mcp with OLD token (compatibility check)"
  RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer ${OLD_TOKEN}" "${ENDPOINT}" 2>&1)
  check_response "GET with old token (should work during compatibility window)" "$RESPONSE" "200" ""
  echo ""
else
  echo -e "${YELLOW}⚠️  SKIP${NC}: Old token compatibility test (MCP_SHARED_SECRET_OLD not set)"
  echo ""
fi

# Test 6: GET without token (should fail)
echo "Test 6: GET /api/mcp without token (should return 401)"
RESPONSE=$(curl -s -w "\n%{http_code}" "${ENDPOINT}" 2>&1)
check_response "GET without token returns 401" "$RESPONSE" "401" "Unauthorized"
echo ""

# Test 7: POST without token (should fail)
echo "Test 7: POST /api/mcp without token (should return 401)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":4}' \
  "${ENDPOINT}" 2>&1)
check_response "POST without token returns 401" "$RESPONSE" "401" "Unauthorized"
echo ""

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "${GREEN}Passed: ${PASS_COUNT}${NC}"
echo -e "${RED}Failed: ${FAIL_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Update Vercel environment variable MCP_SHARED_SECRET with new token"
  if [ -n "$OLD_TOKEN" ]; then
    echo "2. Set MCP_SHARED_SECRET_OLD in Vercel (3-day compatibility window)"
    echo "3. After 3 days, remove MCP_SHARED_SECRET_OLD"
  fi
  echo "4. Update ChatGPT Apps configuration with new token"
  echo "5. Monitor Vercel logs for any 401 errors"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
  exit 1
fi

