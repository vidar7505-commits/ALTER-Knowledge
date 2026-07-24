import {
  TELEMETRY_EVENT_VERSION,
  type AnyTelemetryEvent,
  type TelemetryEventProperties,
} from './contracts';

export const telemetryFixtureNow = new Date('2026-07-24T12:00:00.000Z');

const productId = '30000000-0000-4000-8000-000000000001';
const operationId = '40000000-0000-4000-8000-000000000001';
const feedInstanceId = '50000000-0000-4000-8000-000000000001';
const challengeId = '60000000-0000-4000-8000-000000000001';

export const validEventProperties = {
  session_started: {
    session_number: 1,
    is_return_session: false,
    prior_session_ended_at: null,
    entry_route: '/discover',
  },
  app_state_restored: {
    restore_result: 'complete',
    restored_entities: ['wardrobe', 'challenge'],
    state_revision: 1,
  },
  app_state_restore_failed: {
    error_class: 'persistence',
    error_code: 'restore_failed',
    fallback_applied: true,
  },
  continuation_cue_viewed: {
    cue_type: 'continue_challenge',
    target_surface: 'challenge',
    challenge_progress_count: 2,
  },
  continuation_action_selected: {
    cue_type: 'continue_challenge',
    target_surface: 'challenge',
  },
  continuation_cue_dismissed: {
    cue_type: 'continue_challenge',
    persistence_scope: 'session',
  },
  onboarding_viewed: {
    onboarding_version: 'onboarding-style-v1',
    step_id: 'welcome',
    step_index: 1,
    total_steps: 3,
  },
  onboarding_step_viewed: {
    onboarding_version: 'onboarding-style-v1',
    step_id: 'style',
    step_index: 2,
  },
  onboarding_preference_selected: {
    onboarding_version: 'onboarding-style-v1',
    preference_id: 'minimal',
    preference_set_version: 'onboarding-style-v1',
  },
  onboarding_preference_removed: {
    onboarding_version: 'onboarding-style-v1',
    preference_id: 'minimal',
    preference_set_version: 'onboarding-style-v1',
  },
  onboarding_completed: {
    onboarding_version: 'onboarding-style-v1',
    selected_preference_ids: ['minimal'],
    preference_count: 1,
    completion_type: 'with_preferences',
    operation_id: operationId,
  },
  onboarding_skipped: {
    onboarding_version: 'onboarding-style-v1',
    step_id: 'welcome',
    selected_preference_count_before_skip: 0,
    operation_id: operationId,
  },
  onboarding_persistence_failed: {
    attempted_action: 'complete',
    operation_id: operationId,
    error_class: 'persistence',
    error_code: 'write_failed',
    retryable: true,
  },
  discover_viewed: {
    feed_instance_id: feedInstanceId,
    feed_order_version: 'baseline-v1',
    entry_reason: 'onboarding_complete',
  },
  feed_batch_requested: {
    feed_instance_id: feedInstanceId,
    batch_number: 1,
    cursor_hash: 'cursor-sha256',
    requested_count: 20,
  },
  feed_batch_loaded: {
    feed_instance_id: feedInstanceId,
    batch_number: 1,
    returned_count: 20,
    latency_ms: 100,
    is_terminal: false,
  },
  feed_batch_failed: {
    feed_instance_id: feedInstanceId,
    batch_number: 1,
    error_class: 'network',
    error_code: 'network_failed',
    retryable: true,
  },
  product_impression: {
    product_id: productId,
    product_category: 'top',
    feed_instance_id: feedInstanceId,
    feed_position: 1,
    feed_order_version: 'baseline-v1',
    visible_ratio: 0.5,
    visible_duration_ms: 1000,
    batch_number: 1,
    is_saved_at_impression: false,
  },
  feed_depth_reached: {
    feed_instance_id: feedInstanceId,
    depth_threshold: 5,
    max_qualified_position: 5,
    feed_order_version: 'baseline-v1',
  },
  feed_exhausted: {
    feed_instance_id: feedInstanceId,
    max_qualified_position: 20,
  },
  product_detail_opened: {
    product_id: productId,
    product_category: 'top',
    source_surface: 'discover',
    source_feed_position: 1,
    is_saved: false,
  },
  product_detail_closed: {
    product_id: productId,
    close_method: 'back',
    dwell_ms: 1000,
    resulting_saved_state: false,
  },
  product_detail_failed: {
    product_id: productId,
    error_class: 'not_found',
    error_code: 'product_missing',
    recovery_route: '/discover',
  },
  product_save_requested: {
    product_id: productId,
    source_surface: 'discover',
    prior_saved_state: false,
    operation_id: operationId,
  },
  product_saved: {
    product_id: productId,
    product_category: 'top',
    source_surface: 'discover',
    operation_id: operationId,
    saved_product_id: '70000000-0000-4000-8000-000000000001',
  },
  product_remove_requested: {
    product_id: productId,
    source_surface: 'wardrobe',
    prior_saved_state: true,
    operation_id: operationId,
    challenge_impact: 'none',
  },
  product_removed: {
    product_id: productId,
    source_surface: 'wardrobe',
    operation_id: operationId,
    challenge_resolution: 'none',
  },
  product_save_failed: {
    product_id: productId,
    attempted_action: 'save',
    operation_id: operationId,
    error_class: 'persistence',
    error_code: 'write_failed',
    retryable: true,
  },
  wardrobe_viewed: {
    saved_product_count: 1,
    entry_reason: 'navigation',
    is_return_session: false,
  },
  wardrobe_empty_viewed: {
    entry_reason: 'navigation',
  },
  challenge_viewed: {
    challenge_id: challengeId,
    challenge_version: 'challenge-evening-v1',
    challenge_state: 'in_progress',
    filled_slot_count: 1,
    required_slot_count: 4,
  },
  challenge_started: {
    challenge_id: challengeId,
    challenge_version: 'challenge-evening-v1',
    eligible_saved_count: 4,
    required_slot_count: 4,
    operation_id: operationId,
  },
  challenge_slot_opened: {
    challenge_id: challengeId,
    slot_id: 'top',
    eligible_item_count: 1,
    slot_state: 'empty',
  },
  challenge_item_selected: {
    challenge_id: challengeId,
    slot_id: 'top',
    product_id: productId,
    operation_id: operationId,
    replaced_product_id: null,
  },
  challenge_item_removed: {
    challenge_id: challengeId,
    slot_id: 'top',
    product_id: productId,
    operation_id: operationId,
    removal_reason: 'user_selected',
  },
  challenge_discovery_redirected: {
    challenge_id: challengeId,
    slot_id: 'top',
    required_category: 'top',
  },
  challenge_completion_attempted: {
    challenge_id: challengeId,
    valid_slot_count: 4,
    required_slot_count: 4,
    is_valid: true,
  },
  challenge_completed: {
    challenge_id: challengeId,
    challenge_version: 'challenge-evening-v1',
    completion_id: '80000000-0000-4000-8000-000000000001',
    selected_product_ids_by_slot: { top: productId },
    duration_since_start_ms: 1000,
    operation_id: operationId,
  },
  challenge_state_invalidated: {
    challenge_id: challengeId,
    prior_version: 'challenge-evening-v0',
    current_version: 'challenge-evening-v1',
    reason: 'version_changed',
    resolution: 'restart_required',
  },
  challenge_operation_failed: {
    challenge_id: challengeId,
    attempted_action: 'complete',
    operation_id: operationId,
    error_class: 'validation',
    error_code: 'invalid_slots',
    retryable: false,
  },
} satisfies TelemetryEventProperties;

export function validSessionStartedEvent(
  overrides: Partial<AnyTelemetryEvent> = {},
): AnyTelemetryEvent {
  return {
    event_id: '10000000-0000-4000-8000-000000000001',
    event_name: 'session_started',
    event_version: TELEMETRY_EVENT_VERSION,
    occurred_at: telemetryFixtureNow.toISOString(),
    session_id: '20000000-0000-4000-8000-000000000001',
    platform: 'web_mobile',
    surface: 'app_boot',
    source_surface: null,
    client_sequence: 0,
    properties: {
      session_number: 1,
      is_return_session: false,
      prior_session_ended_at: null,
      entry_route: '/discover',
    },
    context: {
      timezone_offset_minutes: 180,
      locale: 'tr-TR',
      viewport_width: 390,
      viewport_height: 844,
      network_state: 'online',
      experiment_assignments: {},
    },
    ...overrides,
  } as AnyTelemetryEvent;
}
