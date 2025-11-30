// ============================================
// HeraAI Gateway - Single Endpoint for GPT Actions
// ============================================
// This file provides a REST API wrapper around the MCP Server
// for ChatGPT GPTs Actions integration.
//
// Design: Single endpoint `/api/gateway/mcp`
// Input: { tool: string, arguments: object }
// Output: { tool: string, result: object }
//
// This Gateway does NOT modify any existing files.
// It internally calls /api/mcp (existing MCP Server).
// ============================================

import { NextRequest, NextResponse } from 'next/server';

// List of all available MCP tools
const AVAILABLE_TOOLS = [
  'job_alert',
  'recommend_jobs',
  'refine_recommendations',
  'search_jobs_by_company',
  'search_jobs',
  'build_search_links',
  'get_user_applications',
  'tailor_resume',
  'career_transition_advice',
  'career_path_explorer',
  'career_skill_gap_analysis'
] as const;

type ToolName = typeof AVAILABLE_TOOLS[number];

// Get base URL for MCP Server call
// Priority:
// 1. GATEWAY_MCP_SERVER_URL (explicit MCP server URL, can be public cloud)
// 2. NEXT_PUBLIC_BASE_URL (production URL)
// 3. VERCEL_URL (Vercel auto-provided)
// 4. Request origin (if Gateway and MCP are on same domain)
// 5. Fallback to localhost
function getBaseUrl(request?: NextRequest): string {
  // Priority 1: Explicit MCP server URL (allows pointing to public cloud MCP)
  if (process.env.GATEWAY_MCP_SERVER_URL) {
    return process.env.GATEWAY_MCP_SERVER_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Priority 2: Production base URL
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  
  // Priority 3: Vercel URL (auto-provided)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Priority 4: Use request origin if available (same domain)
  if (request) {
    const origin = request.headers.get('origin') || request.headers.get('host');
    if (origin && !origin.includes('localhost')) {
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      return `${protocol}://${origin.replace(/^https?:\/\//, '')}`;
    }
  }
  
  // Priority 5: Fallback to localhost
  return process.env.NEXT_PUBLIC_LOCAL_URL || 'http://localhost:3002';
}

// ============================================
// POST /api/gateway/mcp - Single Endpoint Handler
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json().catch(() => null);
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body. Expected JSON object with "tool" and "arguments" fields.',
          tool: null,
          result: null
        },
        { status: 400 }
      );
    }

    const { tool, arguments: args } = body;

    // Validate tool name
    if (!tool || typeof tool !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid "tool" field. Expected a string.',
          tool: null,
          result: null
        },
        { status: 400 }
      );
    }

    if (!AVAILABLE_TOOLS.includes(tool as ToolName)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown tool: "${tool}". Available tools: ${AVAILABLE_TOOLS.join(', ')}`,
          tool,
          result: null
        },
        { status: 400 }
      );
    }

    // Validate arguments (should be an object, but allow undefined/null)
    const toolArguments = args || {};

    console.log('[Gateway] Tool call request:', {
      tool,
      hasArguments: !!toolArguments,
      timestamp: new Date().toISOString()
    });

    // Call MCP Server (can be local or public cloud)
    const baseUrl = getBaseUrl(request);
    const mcpUrl = `${baseUrl}/api/mcp`;

    // Convert to JSON-RPC 2.0 format for MCP Server
    const mcpRequest = {
      jsonrpc: '2.0',
      id: `gateway-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: toolArguments
      }
    };

    console.log('[Gateway] Calling MCP Server:', {
      url: mcpUrl,
      baseUrl,
      tool,
      requestId: mcpRequest.id
    });

    // Make HTTP call to MCP Server
    // Note: If Gateway and MCP are on same server, use 127.0.0.1 instead of localhost
    const mcpFetchUrl = mcpUrl.replace('localhost', '127.0.0.1');
    
    const mcpResponse = await fetch(mcpFetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward Authorization header if present
        ...(request.headers.get('Authorization') && {
          'Authorization': request.headers.get('Authorization')!
        }),
        // Forward session headers if present
        ...(request.headers.get('x-session-id') && {
          'x-session-id': request.headers.get('x-session-id')!
        }),
        ...(request.headers.get('x-sessionid') && {
          'x-sessionid': request.headers.get('x-sessionid')!
        }),
        ...(request.headers.get('x-session') && {
          'x-session': request.headers.get('x-session')!
        })
      },
      body: JSON.stringify(mcpRequest)
    });

    // Parse MCP Server response
    const mcpResult = await mcpResponse.json().catch(() => ({
      error: {
        code: -32700,
        message: 'Failed to parse MCP Server response'
      }
    }));

    const elapsed = Date.now() - startTime;

    // Check if MCP Server returned an error
    if (mcpResult.error) {
      console.error('[Gateway] MCP Server error:', {
        tool,
        error: mcpResult.error,
        elapsed
      });

      return NextResponse.json(
        {
          success: false,
          tool,
          error: mcpResult.error.message || 'MCP Server error',
          errorCode: mcpResult.error.code,
          result: null
        },
        { 
          status: mcpResponse.status >= 400 ? mcpResponse.status : 500 
        }
      );
    }

    // Extract result from MCP Server response
    // MCP Server returns: { jsonrpc: "2.0", id: "...", result: { ... } }
    const mcpResponseResult = mcpResult.result || mcpResult;

    // Extract content from MCP result (if it has the standard MCP structure)
    let finalResult = mcpResponseResult;
    
    if (mcpResponseResult.content && Array.isArray(mcpResponseResult.content)) {
      // MCP standard format: { content: [{ type: "...", ... }] }
      // Extract the actual data from content array
      const firstContent = mcpResponseResult.content[0];
      if (firstContent?.data?.content) {
        finalResult = firstContent.data.content;
      } else if (firstContent?.data) {
        finalResult = firstContent.data;
      } else if (firstContent?.text) {
        // Text content
        finalResult = { text: firstContent.text, ...mcpResponseResult };
      } else {
        finalResult = mcpResponseResult.content;
      }
    }

    console.log('[Gateway] Tool call completed:', {
      tool,
      success: true,
      elapsed: `${elapsed}ms`,
      hasResult: !!finalResult
    });

    // Return REST API format
    return NextResponse.json(
      {
        success: true,
        tool,
        result: finalResult,
        meta: {
          elapsed: `${elapsed}ms`,
          mcpRequestId: mcpRequest.id
        }
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Forward MCP trace headers if present
          ...(mcpResponse.headers.get('X-MCP-Trace-Id') && {
            'X-MCP-Trace-Id': mcpResponse.headers.get('X-MCP-Trace-Id')!
          })
        }
      }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    
    console.error('[Gateway] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      elapsed: `${elapsed}ms`,
      errorName: error.name,
      errorCode: error.code
    });

    return NextResponse.json(
      {
        success: false,
        tool: null,
        error: error.message || 'Internal server error',
        errorDetails: {
          name: error.name,
          code: error.code,
          message: error.message
        },
        result: null,
        meta: {
          elapsed: `${elapsed}ms`
        }
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/gateway/mcp - Return OpenAPI Schema (Optional)
// ============================================
// This endpoint returns the OpenAPI schema for GPT Actions configuration

export async function GET(request: NextRequest) {
  // Return simple info or OpenAPI schema
  return NextResponse.json({
    name: 'HeraAI Gateway',
    version: '1.0.0',
    description: 'Single endpoint Gateway for ChatGPT GPTs Actions',
    endpoint: '/api/gateway/mcp',
    availableTools: AVAILABLE_TOOLS,
    openapiSchema: '/api/gateway/mcp/openapi'
  });
}

