import { z } from 'zod';

import {
  telemetryEnvironments,
  telemetryPlatforms,
  TELEMETRY_MAX_BATCH_SIZE,
  type AnyTelemetryEvent,
} from './contracts';
import type {
  TelemetryBatchResult,
  TelemetrySessionDescriptor,
  TrustedTelemetryContext,
} from './types';

const controlledIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

const sessionSchema = z.strictObject({
  session_id: z.uuid(),
  platform: z.enum(telemetryPlatforms),
  entry_route: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .refine((value) => !value.includes('?')),
  traffic_source: controlledIdentifier.nullable().optional(),
  cohort_id: controlledIdentifier.nullable().optional(),
});

const requestSchema = z.strictObject({
  session: sessionSchema,
  events: z.array(z.unknown()).min(1).max(TELEMETRY_MAX_BATCH_SIZE),
});

export type TelemetryIngestionRequest = {
  session: TelemetrySessionDescriptor;
  events: unknown[];
};

export interface TelemetryAuthGateway {
  verifyAccessToken(accessToken: string): Promise<string | null>;
}

export interface TelemetryDatabaseGateway {
  ingest(input: {
    authUserId: string;
    session: TelemetrySessionDescriptor;
    events: unknown[];
    trusted: TrustedTelemetryContext;
  }): Promise<TelemetryBatchResult>;
}

export class TelemetryRequestError extends Error {
  constructor(
    readonly code: 'unauthenticated' | 'invalid_request' | 'batch_too_large',
    readonly status: 400 | 401,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'TelemetryRequestError';
  }
}

export function parseTelemetryIngestionRequest(
  value: unknown,
): TelemetryIngestionRequest {
  if (
    value &&
    typeof value === 'object' &&
    'events' in value &&
    Array.isArray(value.events) &&
    value.events.length > TELEMETRY_MAX_BATCH_SIZE
  ) {
    throw new TelemetryRequestError(
      'batch_too_large',
      400,
      'Telemetry batches may contain at most 100 events.',
    );
  }

  const parsed = requestSchema.safeParse(value);

  if (!parsed.success) {
    throw new TelemetryRequestError(
      'invalid_request',
      400,
      'The telemetry request envelope is invalid.',
      { cause: parsed.error },
    );
  }

  return parsed.data;
}

export async function ingestTelemetryRequest(input: {
  accessToken: string | null;
  body: unknown;
  trusted: TrustedTelemetryContext;
  auth: TelemetryAuthGateway;
  database: TelemetryDatabaseGateway;
}): Promise<TelemetryBatchResult> {
  if (!input.accessToken) {
    throw new TelemetryRequestError(
      'unauthenticated',
      401,
      'Telemetry ingestion requires a Supabase access token.',
    );
  }

  const authUserId = await input.auth.verifyAccessToken(input.accessToken);

  if (!authUserId) {
    throw new TelemetryRequestError(
      'unauthenticated',
      401,
      'The Supabase access token is invalid.',
    );
  }

  const request = parseTelemetryIngestionRequest(input.body);

  return input.database.ingest({
    authUserId,
    session: request.session,
    events: request.events,
    trusted: input.trusted,
  });
}

const explicitEnvironmentSchema = z.enum(telemetryEnvironments);

export function readTrustedTelemetryContext(
  environment: NodeJS.ProcessEnv = process.env,
): TrustedTelemetryContext {
  const explicit = explicitEnvironmentSchema.safeParse(
    environment.ALTER_APP_ENVIRONMENT,
  );
  const vercelEnvironment = environment.VERCEL_ENV;
  const derivedEnvironment =
    vercelEnvironment === 'production'
      ? 'production'
      : vercelEnvironment === 'preview'
        ? 'preview'
        : 'local';

  return {
    environment: explicit.success ? explicit.data : derivedEnvironment,
    appVersion:
      environment.ALTER_APP_VERSION ??
      environment.VERCEL_GIT_COMMIT_SHA ??
      'local',
    previewNamespace:
      (explicit.success ? explicit.data : derivedEnvironment) === 'preview'
        ? (environment.VERCEL_DEPLOYMENT_ID ??
          environment.VERCEL_URL ??
          'preview')
        : null,
  };
}

export function asTelemetryEvents(events: unknown[]): AnyTelemetryEvent[] {
  return events as AnyTelemetryEvent[];
}
