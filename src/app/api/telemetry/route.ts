import { NextResponse } from 'next/server';

import {
  ingestTelemetryRequest,
  readTrustedTelemetryContext,
  TelemetryRequestError,
} from '@/features/telemetry/server';
import { createSupabaseTelemetryGateways } from '@/features/telemetry/supabase-server';
import {
  TELEMETRY_MAX_BATCH_SIZE,
  TELEMETRY_MAX_EVENT_BYTES,
} from '@/features/telemetry/contracts';

export const runtime = 'nodejs';

const MAX_REQUEST_BYTES =
  TELEMETRY_MAX_BATCH_SIZE * TELEMETRY_MAX_EVENT_BYTES + 64 * 1024;

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);

  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 413 });
  }

  let body: unknown;

  try {
    const text = await request.text();

    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 413 });
    }

    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const gateways = createSupabaseTelemetryGateways();
    const result = await ingestTelemetryRequest({
      accessToken: bearerToken(request),
      body,
      trusted: readTrustedTelemetryContext(),
      auth: gateways.auth,
      database: gateways.database,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof TelemetryRequestError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    return NextResponse.json(
      { error: 'database_unavailable' },
      { status: 503 },
    );
  }
}
