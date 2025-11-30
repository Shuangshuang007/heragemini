// ============================================
// OpenAPI Schema Route - Provides OpenAPI JSON for GPT Actions
// ============================================
// This route serves the OpenAPI schema JSON
// for ChatGPT GPTs Actions configuration
// ============================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Read OpenAPI schema from the JSON file
const openApiSchemaPath = path.join(process.cwd(), 'src/app/api/gateway/mcp/openapi.json');

export async function GET() {
  try {
    // Read the JSON file
    const openApiSchema = JSON.parse(
      fs.readFileSync(openApiSchemaPath, 'utf-8')
    );

    return NextResponse.json(openApiSchema, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error: any) {
    console.error('[Gateway] Failed to load OpenAPI schema:', error);
    return NextResponse.json(
      {
        error: 'Failed to load OpenAPI schema',
        message: error.message
      },
      { status: 500 }
    );
  }
}

