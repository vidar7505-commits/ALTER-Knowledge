import type {
  AnyTelemetryEvent,
  TelemetryEnvironment,
  TelemetryPlatform,
} from './contracts';

export type TelemetryItemStatus =
  'accepted' | 'duplicate' | 'quarantined' | 'rejected';

export type TelemetryErrorCode =
  | 'unauthenticated'
  | 'invalid_request'
  | 'batch_too_large'
  | 'queue_full'
  | 'transport_unavailable'
  | 'response_contract_invalid'
  | 'event_not_object'
  | 'forbidden_trusted_field'
  | 'unexpected_envelope_field'
  | 'invalid_envelope'
  | 'unknown_event_name'
  | 'unsupported_event_version'
  | 'invalid_properties'
  | 'payload_too_large'
  | 'timestamp_future'
  | 'timestamp_future_skew'
  | 'timestamp_stale'
  | 'session_not_found'
  | 'session_owner_mismatch'
  | 'session_context_conflict'
  | 'event_id_conflict'
  | 'database_unavailable';

export type TelemetryItemResult = {
  index: number;
  event_id: string | null;
  status: TelemetryItemStatus;
  error_codes: TelemetryErrorCode[];
  received_at: string;
};

export type TelemetryBatchResult = {
  results: TelemetryItemResult[];
};

export type TelemetrySessionDescriptor = {
  session_id: string;
  platform: TelemetryPlatform;
  entry_route: string;
  traffic_source?: string | null;
  cohort_id?: string | null;
};

export type TelemetryTransportRequest = {
  session: TelemetrySessionDescriptor;
  events: AnyTelemetryEvent[];
};

export interface TelemetryTransport {
  send(request: TelemetryTransportRequest): Promise<TelemetryBatchResult>;
}

export type TrustedTelemetryContext = {
  environment: TelemetryEnvironment;
  appVersion: string;
  previewNamespace: string | null;
};

export class TelemetryError extends Error {
  constructor(
    readonly code: TelemetryErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'TelemetryError';
  }
}
