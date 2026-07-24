import { z } from 'zod';

import { telemetryEventNames, TELEMETRY_MAX_BATCH_SIZE } from './contracts';
import {
  TelemetryError,
  type TelemetryBatchResult,
  type TelemetryErrorCode,
  type TelemetryTransport,
  type TelemetryTransportRequest,
} from './types';

const itemResultSchema = z.strictObject({
  index: z
    .int()
    .min(0)
    .max(TELEMETRY_MAX_BATCH_SIZE - 1),
  event_id: z.uuid().nullable(),
  status: z.enum(['accepted', 'duplicate', 'quarantined', 'rejected']),
  error_codes: z.array(z.string()),
  received_at: z.iso.datetime({ offset: true }),
});

const responseSchema = z.strictObject({
  results: z.array(itemResultSchema).max(TELEMETRY_MAX_BATCH_SIZE),
});

export type TelemetryAccessTokenProvider = () => Promise<string | null>;

export function createFetchTelemetryTransport(options: {
  getAccessToken: TelemetryAccessTokenProvider;
  endpoint?: string;
  fetch?: typeof globalThis.fetch;
}): TelemetryTransport {
  const endpoint = options.endpoint ?? '/api/telemetry';
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  return {
    async send(
      request: TelemetryTransportRequest,
    ): Promise<TelemetryBatchResult> {
      const accessToken = await options.getAccessToken();

      if (!accessToken) {
        throw new TelemetryError(
          'unauthenticated',
          false,
          'Telemetry requires an authenticated anonymous session.',
        );
      }

      const response = await fetchImplementation(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        keepalive: true,
      });

      let body: unknown;

      try {
        body = await response.json();
      } catch (error) {
        throw new TelemetryError(
          'response_contract_invalid',
          response.status >= 500,
          'Telemetry ingestion returned a non-JSON response.',
          { cause: error },
        );
      }

      if (!response.ok) {
        const errorCode =
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
            ? (body.error as TelemetryErrorCode)
            : 'transport_unavailable';

        throw new TelemetryError(
          errorCode,
          response.status >= 500 || response.status === 429,
          `Telemetry ingestion failed with status ${response.status}.`,
        );
      }

      const parsed = responseSchema.safeParse(body);

      if (!parsed.success) {
        throw new TelemetryError(
          'response_contract_invalid',
          false,
          'Telemetry ingestion returned an invalid result contract.',
          { cause: parsed.error },
        );
      }

      return {
        results: parsed.data.results.map((item) => ({
          ...item,
          error_codes: item.error_codes as TelemetryErrorCode[],
        })),
      };
    },
  };
}

export const registeredTelemetryEventCount = telemetryEventNames.length;
