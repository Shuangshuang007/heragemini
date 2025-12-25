#!/bin/bash

# Step 2: Test Gateway with curl (reproduce GPTs Actions call)
# This script tests the Gateway endpoint directly to verify parameter passing and response structure

set -e

echo "=== Gateway search_jobs Test (Step 2) ==="
echo ""
echo "This test reproduces GPTs Actions call to Gateway"
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

BASE_URL=${NEXT_PUBLIC_BASE_URL:-https://www.heraai.net.au}
GATEWAY_URL="${BASE_URL}/api/gateway/mcp"

echo "Gateway URL: ${GATEWAY_URL}"
echo ""

# Test 1: search_jobs with job_title and city (correct field names)
echo "📋 Test 1: search_jobs with job_title and city"
echo "Request:"
cat << 'EOF' | jq .
{
  "tool": "search_jobs",
  "arguments": {
    "job_title": "Software Engineer",
    "city": "Sydney",
    "limit": 10
  }
}
EOF

echo ""
echo "Response:"
curl -s -X POST "${GATEWAY_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_jobs",
    "arguments": {
      "job_title": "Software Engineer",
      "city": "Sydney",
      "limit": 10
    }
  }' | jq .

echo ""
echo "---"
echo ""

# Test 2: search_jobs with query instead of job_title (potential GPTs field name mismatch)
echo "📋 Test 2: search_jobs with 'query' instead of 'job_title' (potential mismatch)"
echo "Request:"
cat << 'EOF' | jq .
{
  "tool": "search_jobs",
  "arguments": {
    "query": "Software Engineer",
    "city": "Sydney"
  }
}
EOF

echo ""
echo "Response:"
curl -s -X POST "${GATEWAY_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_jobs",
    "arguments": {
      "query": "Software Engineer",
      "city": "Sydney"
    }
  }' | jq .

echo ""
echo "---"
echo ""

# Test 3: search_jobs with location instead of city (potential GPTs field name mismatch)
echo "📋 Test 3: search_jobs with 'location' instead of 'city' (potential mismatch)"
echo "Request:"
cat << 'EOF' | jq .
{
  "tool": "search_jobs",
  "arguments": {
    "job_title": "Software Engineer",
    "location": "Sydney"
  }
}
EOF

echo ""
echo "Response:"
curl -s -X POST "${GATEWAY_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_jobs",
    "arguments": {
      "job_title": "Software Engineer",
      "location": "Sydney"
    }
  }' | jq .

echo ""
echo "=== Test Complete ==="
echo ""
echo "📋 Analysis Checklist:"
echo "1. Check Gateway logs for: [Gateway] Tool call request (DEBUG)"
echo "   - argsKeys should include job_title/city or query/location"
echo "2. Check response structure:"
echo "   - Should have 'success', 'tool', 'result' fields"
echo "   - 'result' should contain jobs data"
echo "3. Compare with OpenAPI schema in openapi.json"

