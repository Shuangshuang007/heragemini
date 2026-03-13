#!/bin/bash
# Verify GET /api/mcp structure - checks code directly without server
# Created: 2025-01-27

echo "Verifying GET /api/mcp structure..."
echo "=================================="

ROUTE_FILE="src/app/api/mcp/route.ts"

if [ ! -f "${ROUTE_FILE}" ]; then
    echo "❌ FAIL: Route file not found: ${ROUTE_FILE}"
    exit 1
fi

echo "Checking file: ${ROUTE_FILE}"
echo ""

# Extract GET method tools section
GET_TOOLS_SECTION=$(sed -n '/export async function GET/,/^}$/p' "${ROUTE_FILE}" | sed -n '/tools: \[/,/\]/p')

# Count tool names in GET method
TOOLS_COUNT=$(echo "${GET_TOOLS_SECTION}" | grep -c '"name":' || echo "0")

echo "Found ${TOOLS_COUNT} tools in GET method"
echo ""

# Check for required tools
REQUIRED_TOOLS=(
    "job_alert"
    "refine_recommendations"
    "recommend_jobs"
    "tailor_resume"
    "search_jobs"
    "search_jobs_by_company"
    "build_search_links"
    "get_user_applications"
    "career_transition_advice"
    "career_path_explorer"
    "career_skill_gap_analysis"
)

MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if echo "${GET_TOOLS_SECTION}" | grep -q "\"name\": '${tool}'" || echo "${GET_TOOLS_SECTION}" | grep -q "\"name\": \"${tool}\""; then
        echo "✅ Found: ${tool}"
    else
        echo "❌ Missing: ${tool}"
        MISSING_TOOLS+=("${tool}")
    fi
done

echo ""
echo "=================================="

if [ "${TOOLS_COUNT}" -eq 11 ] && [ ${#MISSING_TOOLS[@]} -eq 0 ]; then
    echo "✅ PASS: GET method has 11 tools, all required tools present"
    echo ""
    echo "Verification completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    exit 0
else
    echo "❌ FAIL:"
    echo "  - Tools count: ${TOOLS_COUNT} (expected 11)"
    if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
        echo "  - Missing tools: ${MISSING_TOOLS[*]}"
    fi
    exit 1
fi

