#!/bin/bash
# Test script to verify GET /api/mcp returns 11 tools
# Created: 2025-01-27

echo "Testing GET /api/mcp endpoint..."
echo "=================================="

# Get the base URL from environment or use default
BASE_URL=${NEXT_PUBLIC_BASE_URL:-http://localhost:3002}
ENDPOINT="${BASE_URL}/api/mcp"

echo "Testing endpoint: ${ENDPOINT}"
echo ""

# Make GET request and extract tools count
RESPONSE=$(curl -s "${ENDPOINT}")
TOOLS_COUNT=$(echo "${RESPONSE}" | grep -o '"name":' | wc -l | tr -d ' ')

echo "Response:"
echo "${RESPONSE}" | head -20
echo ""
echo "=================================="
echo "Tools count: ${TOOLS_COUNT}"

# Check if we got 11 tools
if [ "${TOOLS_COUNT}" -eq 11 ]; then
    echo "✅ PASS: GET endpoint returns 11 tools"
    
    # Check for specific tools
    if echo "${RESPONSE}" | grep -q "job_alert"; then
        echo "✅ PASS: job_alert tool found"
    else
        echo "❌ FAIL: job_alert tool NOT found"
    fi
    
    if echo "${RESPONSE}" | grep -q "refine_recommendations"; then
        echo "✅ PASS: refine_recommendations tool found"
    else
        echo "❌ FAIL: refine_recommendations tool NOT found"
    fi
else
    echo "❌ FAIL: Expected 11 tools, got ${TOOLS_COUNT}"
    exit 1
fi

echo ""
echo "Test completed at: $(date '+%Y-%m-%d %H:%M:%S')"

