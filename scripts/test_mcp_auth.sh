#!/bin/bash

# Test MCP endpoint authentication
# This script tests the MCP endpoint directly without exposing the token

set -e

echo "=== Step 1: Testing MCP Endpoint Authentication ==="
echo ""

# Check if MCP_SHARED_SECRET is set
if [ -z "$MCP_SHARED_SECRET" ]; then
  echo "❌ MCP_SHARED_SECRET environment variable is not set"
  echo "Please set it first: export MCP_SHARED_SECRET='your_token_here'"
  exit 1
fi

# Show token info (without exposing full value)
TOKEN_LEN=${#MCP_SHARED_SECRET}
TOKEN_HEAD=${MCP_SHARED_SECRET:0:4}
TOKEN_TAIL=${MCP_SHARED_SECRET: -4}

echo "✅ MCP_SHARED_SECRET found:"
echo "   Length: $TOKEN_LEN"
echo "   Head: $TOKEN_HEAD"
echo "   Tail: $TOKEN_TAIL"
echo ""

# Test www.heraai.net.au
echo "Testing: https://www.heraai.net.au/api/mcp"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $MCP_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  https://www.heraai.net.au/api/mcp)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status Code: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS: MCP endpoint authentication works!"
  echo "Response preview:"
  echo "$BODY" | head -c 200
  echo "..."
else
  echo "❌ FAILED: MCP endpoint returned $HTTP_CODE"
  echo "Response:"
  echo "$BODY"
  echo ""
  echo "Possible causes:"
  echo "1. MCP_SHARED_SECRET in www.heraai.net.au deployment doesn't match"
  echo "2. Environment variable not set in Vercel deployment"
  echo "3. Deployment needs to be redeployed after env var change"
fi

echo ""
echo "=== Test Complete ==="
