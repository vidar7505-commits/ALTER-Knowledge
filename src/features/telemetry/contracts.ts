import { z } from 'zod';

export const TELEMETRY_RELEASE_ID = 'LR-001' as const;
export const TELEMETRY_EVENT_VERSION = 1 as const;
export const TELEMETRY_MAX_BATCH_SIZE = 100;
export const TELEMETRY_MAX_EVENT_BYTES = 16 * 1024;
export const TELEMETRY_FUTURE_WARNING_MS = 5 * 60 * 1000;
export const TELEMETRY_FUTURE_REJECTION_MS = 24 * 60 * 60 * 1000;
export const TELEMETRY_STALE_REJECTION_MS = 30 * 24 * 60 * 60 * 1000;

export const telemetrySurfaces = [
  'app_boot',
  'onboarding',
  'discover',
  'product_detail',
  'wardrobe',
  'challenge',
  'challenge_picker',
  'continuation',
  'error_recovery',
] as const;

export const telemetrySourceSurfaces = [
  'discover',
  'product_detail',
  'wardrobe',
  'challenge',
  'challenge_picker',
] as const;

export const telemetryPlatforms = [
  'web_mobile',
  'web_desktop',
  'ios',
  'android',
] as const;

export const telemetryErrorClasses = [
  'network',
  'timeout',
  'validation',
  'not_found',
  'permission',
  'conflict',
  'persistence',
  'schema',
  'identity',
  'unknown',
] as const;

export const telemetryEnvironments = [
  'local',
  'preview',
  'staging',
  'production',
] as const;

export const telemetryEventNames = [
  'session_started',
  'app_state_restored',
  'app_state_restore_failed',
  'continuation_cue_viewed',
  'continuation_action_selected',
  'continuation_cue_dismissed',
  'onboarding_viewed',
  'onboarding_step_viewed',
  'onboarding_preference_selected',
  'onboarding_preference_removed',
  'onboarding_completed',
  'onboarding_skipped',
  'onboarding_persistence_failed',
  'discover_viewed',
  'feed_batch_requested',
  'feed_batch_loaded',
  'feed_batch_failed',
  'product_impression',
  'feed_depth_reached',
  'feed_exhausted',
  'product_detail_opened',
  'product_detail_closed',
  'product_detail_failed',
  'product_save_requested',
  'product_saved',
  'product_remove_requested',
  'product_removed',
  'product_save_failed',
  'wardrobe_viewed',
  'wardrobe_empty_viewed',
  'challenge_viewed',
  'challenge_started',
  'challenge_slot_opened',
  'challenge_item_selected',
  'challenge_item_removed',
  'challenge_discovery_redirected',
  'challenge_completion_attempted',
  'challenge_completed',
  'challenge_state_invalidated',
  'challenge_operation_failed',
] as const;

export type TelemetryEventName = (typeof telemetryEventNames)[number];
export type TelemetrySurface = (typeof telemetrySurfaces)[number];
export type TelemetrySourceSurface = (typeof telemetrySourceSurfaces)[number];
export type TelemetryPlatform = (typeof telemetryPlatforms)[number];
export type TelemetryEnvironment = (typeof telemetryEnvironments)[number];

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const route = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) => !value.includes('?'), 'query strings are not allowed');
const nonNegativeInteger = z.int().min(0);
const positiveInteger = z.int().positive();
const nonNegativeNumber = z.number().min(0).finite();
const uuidOrNull = z.uuid().nullable();
const utcTimestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => value.endsWith('Z') || value.endsWith('+00:00'),
    'timestamp must use UTC',
  );
const errorClass = z.enum(telemetryErrorClasses);
const sourceSurface = z.enum(telemetrySourceSurfaces);
const surface = z.enum(telemetrySurfaces);

const propertySchemas = {
  session_started: z.strictObject({
    session_number: positiveInteger,
    is_return_session: z.boolean(),
    prior_session_ended_at: utcTimestamp.nullable(),
    entry_route: route,
  }),
  app_state_restored: z.strictObject({
    restore_result: identifier,
    restored_entities: z.array(identifier).max(32),
    state_revision: nonNegativeInteger,
  }),
  app_state_restore_failed: z.strictObject({
    error_class: errorClass,
    error_code: identifier,
    fallback_applied: z.boolean(),
  }),
  continuation_cue_viewed: z.strictObject({
    cue_type: identifier,
    target_surface: surface,
    challenge_progress_count: nonNegativeInteger,
  }),
  continuation_action_selected: z.strictObject({
    cue_type: identifier,
    target_surface: surface,
  }),
  continuation_cue_dismissed: z.strictObject({
    cue_type: identifier,
    persistence_scope: identifier,
  }),
  onboarding_viewed: z.strictObject({
    onboarding_version: identifier,
    step_id: identifier,
    step_index: positiveInteger,
    total_steps: positiveInteger,
  }),
  onboarding_step_viewed: z.strictObject({
    onboarding_version: identifier,
    step_id: identifier,
    step_index: positiveInteger,
  }),
  onboarding_preference_selected: z.strictObject({
    onboarding_version: identifier,
    preference_id: identifier,
    preference_set_version: identifier,
  }),
  onboarding_preference_removed: z.strictObject({
    onboarding_version: identifier,
    preference_id: identifier,
    preference_set_version: identifier,
  }),
  onboarding_completed: z.strictObject({
    onboarding_version: identifier,
    selected_preference_ids: z.array(identifier).max(64),
    preference_count: nonNegativeInteger,
    completion_type: identifier,
    operation_id: z.uuid(),
  }),
  onboarding_skipped: z.strictObject({
    onboarding_version: identifier,
    step_id: identifier,
    selected_preference_count_before_skip: nonNegativeInteger,
    operation_id: z.uuid(),
  }),
  onboarding_persistence_failed: z.strictObject({
    attempted_action: identifier,
    operation_id: z.uuid(),
    error_class: errorClass,
    error_code: identifier,
    retryable: z.boolean(),
  }),
  discover_viewed: z.strictObject({
    feed_instance_id: z.uuid(),
    feed_order_version: identifier,
    entry_reason: identifier,
  }),
  feed_batch_requested: z.strictObject({
    feed_instance_id: z.uuid(),
    batch_number: positiveInteger,
    cursor_hash: identifier,
    requested_count: positiveInteger.max(100),
  }),
  feed_batch_loaded: z.strictObject({
    feed_instance_id: z.uuid(),
    batch_number: positiveInteger,
    returned_count: nonNegativeInteger.max(100),
    latency_ms: nonNegativeInteger,
    is_terminal: z.boolean(),
  }),
  feed_batch_failed: z.strictObject({
    feed_instance_id: z.uuid(),
    batch_number: positiveInteger,
    error_class: errorClass,
    error_code: identifier,
    retryable: z.boolean(),
  }),
  product_impression: z.strictObject({
    product_id: z.uuid(),
    product_category: identifier,
    feed_instance_id: z.uuid(),
    feed_position: positiveInteger,
    feed_order_version: identifier,
    visible_ratio: z.number().min(0.5).max(1).finite(),
    visible_duration_ms: z.int().min(1000),
    batch_number: positiveInteger,
    is_saved_at_impression: z.boolean(),
  }),
  feed_depth_reached: z.strictObject({
    feed_instance_id: z.uuid(),
    depth_threshold: z.union([
      z.literal(5),
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(50),
      z.literal(75),
      z.literal(100),
    ]),
    max_qualified_position: positiveInteger,
    feed_order_version: identifier,
  }),
  feed_exhausted: z.strictObject({
    feed_instance_id: z.uuid(),
    max_qualified_position: nonNegativeInteger,
  }),
  product_detail_opened: z.strictObject({
    product_id: z.uuid(),
    product_category: identifier,
    source_surface: sourceSurface.nullable(),
    source_feed_position: positiveInteger.nullable(),
    is_saved: z.boolean(),
  }),
  product_detail_closed: z.strictObject({
    product_id: z.uuid(),
    close_method: identifier,
    dwell_ms: nonNegativeInteger,
    resulting_saved_state: z.boolean(),
  }),
  product_detail_failed: z.strictObject({
    product_id: z.uuid(),
    error_class: errorClass,
    error_code: identifier,
    recovery_route: route,
  }),
  product_save_requested: z.strictObject({
    product_id: z.uuid(),
    source_surface: sourceSurface,
    prior_saved_state: z.literal(false),
    operation_id: z.uuid(),
  }),
  product_saved: z.strictObject({
    product_id: z.uuid(),
    product_category: identifier,
    source_surface: sourceSurface,
    operation_id: z.uuid(),
    saved_product_id: z.uuid(),
  }),
  product_remove_requested: z.strictObject({
    product_id: z.uuid(),
    source_surface: sourceSurface,
    prior_saved_state: z.literal(true),
    operation_id: z.uuid(),
    challenge_impact: identifier,
  }),
  product_removed: z.strictObject({
    product_id: z.uuid(),
    source_surface: sourceSurface,
    operation_id: z.uuid(),
    challenge_resolution: identifier,
  }),
  product_save_failed: z.strictObject({
    product_id: z.uuid(),
    attempted_action: identifier,
    operation_id: z.uuid(),
    error_class: errorClass,
    error_code: identifier,
    retryable: z.boolean(),
  }),
  wardrobe_viewed: z.strictObject({
    saved_product_count: nonNegativeInteger,
    entry_reason: identifier,
    is_return_session: z.boolean(),
  }),
  wardrobe_empty_viewed: z.strictObject({
    entry_reason: identifier,
  }),
  challenge_viewed: z.strictObject({
    challenge_id: z.uuid(),
    challenge_version: identifier,
    challenge_state: z.enum([
      'not_started',
      'in_progress',
      'ready_to_complete',
      'completed',
      'invalidated',
    ]),
    filled_slot_count: nonNegativeInteger,
    required_slot_count: positiveInteger,
  }),
  challenge_started: z.strictObject({
    challenge_id: z.uuid(),
    challenge_version: identifier,
    eligible_saved_count: nonNegativeInteger,
    required_slot_count: positiveInteger,
    operation_id: z.uuid(),
  }),
  challenge_slot_opened: z.strictObject({
    challenge_id: z.uuid(),
    slot_id: identifier,
    eligible_item_count: nonNegativeInteger,
    slot_state: identifier,
  }),
  challenge_item_selected: z.strictObject({
    challenge_id: z.uuid(),
    slot_id: identifier,
    product_id: z.uuid(),
    operation_id: z.uuid(),
    replaced_product_id: uuidOrNull,
  }),
  challenge_item_removed: z.strictObject({
    challenge_id: z.uuid(),
    slot_id: identifier,
    product_id: z.uuid(),
    operation_id: z.uuid(),
    removal_reason: identifier,
  }),
  challenge_discovery_redirected: z.strictObject({
    challenge_id: z.uuid(),
    slot_id: identifier,
    required_category: identifier,
  }),
  challenge_completion_attempted: z.strictObject({
    challenge_id: z.uuid(),
    valid_slot_count: nonNegativeInteger,
    required_slot_count: positiveInteger,
    is_valid: z.boolean(),
  }),
  challenge_completed: z.strictObject({
    challenge_id: z.uuid(),
    challenge_version: identifier,
    completion_id: z.uuid(),
    selected_product_ids_by_slot: z.record(identifier, z.uuid()),
    duration_since_start_ms: nonNegativeNumber,
    operation_id: z.uuid(),
  }),
  challenge_state_invalidated: z.strictObject({
    challenge_id: z.uuid(),
    prior_version: identifier,
    current_version: identifier,
    reason: identifier,
    resolution: identifier,
  }),
  challenge_operation_failed: z.strictObject({
    challenge_id: z.uuid(),
    attempted_action: identifier,
    operation_id: z.uuid(),
    error_class: errorClass,
    error_code: identifier,
    retryable: z.boolean(),
  }),
} satisfies Record<TelemetryEventName, z.ZodType>;

export type TelemetryEventProperties = {
  [Name in TelemetryEventName]: z.infer<(typeof propertySchemas)[Name]>;
};

export const telemetryEventRegistry = Object.freeze(
  Object.fromEntries(
    telemetryEventNames.map((eventName) => [
      eventName,
      {
        version: TELEMETRY_EVENT_VERSION,
        properties: propertySchemas[eventName],
      },
    ]),
  ) as {
    [Name in TelemetryEventName]: {
      readonly version: typeof TELEMETRY_EVENT_VERSION;
      readonly properties: (typeof propertySchemas)[Name];
    };
  },
);

export const telemetryContextSchema = z.strictObject({
  timezone_offset_minutes: z.int().min(-840).max(840),
  locale: z
    .string()
    .min(2)
    .max(35)
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  viewport_width: z.int().positive().max(16384).optional(),
  viewport_height: z.int().positive().max(16384).optional(),
  network_state: z.enum(['online', 'offline', 'unknown']).nullable().optional(),
  traffic_source: identifier.nullable().optional(),
  cohort_id: identifier.nullable().optional(),
  experiment_assignments: z
    .record(z.string(), z.never())
    .refine((value) => Object.keys(value).length === 0),
});

export type TelemetryContext = z.infer<typeof telemetryContextSchema>;

export type TelemetryEventEnvelope<Name extends TelemetryEventName> = {
  event_id: string;
  event_name: Name;
  event_version: typeof TELEMETRY_EVENT_VERSION;
  occurred_at: string;
  session_id: string;
  platform: TelemetryPlatform;
  surface: TelemetrySurface;
  source_surface?: TelemetrySourceSurface | null;
  client_sequence: number;
  properties: TelemetryEventProperties[Name];
  context: TelemetryContext;
};

export type AnyTelemetryEvent = {
  [Name in TelemetryEventName]: TelemetryEventEnvelope<Name>;
}[TelemetryEventName];

export type TelemetryCapture<Name extends TelemetryEventName> = {
  event_name: Name;
  surface: TelemetrySurface;
  source_surface?: TelemetrySourceSurface | null;
  properties: TelemetryEventProperties[Name];
};

export type AnyTelemetryCapture = {
  [Name in TelemetryEventName]: TelemetryCapture<Name>;
}[TelemetryEventName];

export const forbiddenTelemetryFields = [
  'anonymous_user_id',
  'user_id',
  'received_at',
  'release_id',
  'app_version',
  'environment',
  'is_test',
  'preview_namespace',
  'validation_status',
  'validation_errors',
  'inserted_at',
] as const;

const allowedEnvelopeFields = new Set([
  'event_id',
  'event_name',
  'event_version',
  'occurred_at',
  'session_id',
  'platform',
  'surface',
  'source_surface',
  'client_sequence',
  'properties',
  'context',
]);

const envelopeSchema = z.strictObject({
  event_id: z.uuid(),
  event_name: z.enum(telemetryEventNames),
  event_version: z.int().positive(),
  occurred_at: utcTimestamp,
  session_id: z.uuid(),
  platform: z.enum(telemetryPlatforms),
  surface,
  source_surface: sourceSurface.nullable().optional(),
  client_sequence: nonNegativeInteger,
  properties: z.unknown(),
  context: telemetryContextSchema,
});

export type TelemetryValidationErrorCode =
  | 'event_not_object'
  | 'forbidden_trusted_field'
  | 'unexpected_envelope_field'
  | 'invalid_envelope'
  | 'unknown_event_name'
  | 'unsupported_event_version'
  | 'invalid_properties'
  | 'payload_too_large'
  | 'timestamp_future'
  | 'timestamp_stale';

export type TelemetryValidationError = {
  code: TelemetryValidationErrorCode;
  path?: string;
  message: string;
};

export type TelemetryValidationResult =
  | {
      success: true;
      event: AnyTelemetryEvent;
      warnings: Array<'timestamp_future_skew'>;
    }
  | {
      success: false;
      errors: TelemetryValidationError[];
    };

function eventByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function validateTelemetryEvent(
  value: unknown,
  now = new Date(),
): TelemetryValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      success: false,
      errors: [
        {
          code: 'event_not_object',
          message: 'Telemetry items must be JSON objects.',
        },
      ],
    };
  }

  const record = value as Record<string, unknown>;
  const forbidden = forbiddenTelemetryFields.filter((field) => field in record);

  if (forbidden.length > 0) {
    return {
      success: false,
      errors: forbidden.map((field) => ({
        code: 'forbidden_trusted_field',
        path: field,
        message: `${field} is server-owned.`,
      })),
    };
  }

  const unexpected = Object.keys(record).filter(
    (field) => !allowedEnvelopeFields.has(field),
  );

  if (unexpected.length > 0) {
    return {
      success: false,
      errors: unexpected.map((field) => ({
        code: 'unexpected_envelope_field',
        path: field,
        message: `${field} is not an allowed telemetry field.`,
      })),
    };
  }

  if (eventByteLength(value) > TELEMETRY_MAX_EVENT_BYTES) {
    return {
      success: false,
      errors: [
        {
          code: 'payload_too_large',
          message: 'Telemetry items may not exceed 16 KB.',
        },
      ],
    };
  }

  if (
    typeof record.event_name !== 'string' ||
    !telemetryEventNames.includes(record.event_name as TelemetryEventName)
  ) {
    return {
      success: false,
      errors: [
        {
          code: 'unknown_event_name',
          path: 'event_name',
          message: 'The event name is not in the LR-001 registry.',
        },
      ],
    };
  }

  if (record.event_version !== TELEMETRY_EVENT_VERSION) {
    return {
      success: false,
      errors: [
        {
          code: 'unsupported_event_version',
          path: 'event_version',
          message: 'Only event version 1 is supported for LR-001.',
        },
      ],
    };
  }

  const envelope = envelopeSchema.safeParse(value);

  if (!envelope.success) {
    return {
      success: false,
      errors: envelope.error.issues.map((issue) => ({
        code: 'invalid_envelope',
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const occurredAt = new Date(envelope.data.occurred_at);
  const delta = occurredAt.getTime() - now.getTime();
  const age = now.getTime() - occurredAt.getTime();

  if (delta > TELEMETRY_FUTURE_REJECTION_MS) {
    return {
      success: false,
      errors: [
        {
          code: 'timestamp_future',
          path: 'occurred_at',
          message: 'The event timestamp is more than 24 hours in the future.',
        },
      ],
    };
  }

  if (age > TELEMETRY_STALE_REJECTION_MS) {
    return {
      success: false,
      errors: [
        {
          code: 'timestamp_stale',
          path: 'occurred_at',
          message: 'Events older than 30 days require a future replay policy.',
        },
      ],
    };
  }

  if (
    envelope.data.platform.startsWith('web_') &&
    (!envelope.data.context.viewport_width ||
      !envelope.data.context.viewport_height)
  ) {
    return {
      success: false,
      errors: [
        {
          code: 'invalid_envelope',
          path: 'context',
          message: 'Web telemetry requires viewport width and height.',
        },
      ],
    };
  }

  const eventName = envelope.data.event_name;
  const properties = propertySchemas[eventName].safeParse(
    envelope.data.properties,
  );

  if (!properties.success) {
    return {
      success: false,
      errors: properties.error.issues.map((issue) => ({
        code: 'invalid_properties',
        path: ['properties', ...issue.path].join('.'),
        message: issue.message,
      })),
    };
  }

  return {
    success: true,
    event: {
      ...envelope.data,
      properties: properties.data,
    } as AnyTelemetryEvent,
    warnings:
      delta > TELEMETRY_FUTURE_WARNING_MS ? ['timestamp_future_skew'] : [],
  };
}
