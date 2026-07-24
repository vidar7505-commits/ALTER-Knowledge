import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { TelemetryAuthGateway, TelemetryDatabaseGateway } from './server';
import type { TelemetryBatchResult } from './types';

const serverCredentialsSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const databaseResultSchema = z.object({
  results: z.array(
    z.object({
      index: z.int().min(0),
      event_id: z.uuid().nullable(),
      status: z.enum(['accepted', 'duplicate', 'quarantined', 'rejected']),
      error_codes: z.array(z.string()),
      received_at: z.iso.datetime({ offset: true }),
    }),
  ),
});

export function createSupabaseTelemetryGateways(
  environment: NodeJS.ProcessEnv = process.env,
): {
  auth: TelemetryAuthGateway;
  database: TelemetryDatabaseGateway;
} {
  const credentials = serverCredentialsSchema.parse(environment);
  const supabase = createClient(
    credentials.NEXT_PUBLIC_SUPABASE_URL,
    credentials.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  return createGatewaysForClient(supabase);
}

export function createGatewaysForClient(supabase: SupabaseClient): {
  auth: TelemetryAuthGateway;
  database: TelemetryDatabaseGateway;
} {
  return {
    auth: {
      async verifyAccessToken(accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        return error ? null : (data.user?.id ?? null);
      },
    },
    database: {
      async ingest(input): Promise<TelemetryBatchResult> {
        const { data, error } = await supabase.rpc('ingest_telemetry_batch', {
          p_auth_user_id: input.authUserId,
          p_session: input.session,
          p_events: input.events,
          p_environment: input.trusted.environment,
          p_app_version: input.trusted.appVersion,
          p_preview_namespace: input.trusted.previewNamespace,
        });

        if (error) {
          throw new Error('Trusted telemetry database ingestion failed.', {
            cause: error,
          });
        }

        return databaseResultSchema.parse(data) as TelemetryBatchResult;
      },
    },
  };
}
