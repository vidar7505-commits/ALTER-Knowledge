import { describe, expect, it } from 'vitest';

import {
  telemetryEventNames,
  telemetryEventRegistry,
  validateTelemetryEvent,
} from './contracts';
import {
  telemetryFixtureNow as now,
  validEventProperties,
  validSessionStartedEvent,
} from './test-fixtures';

describe('LR-001 telemetry contracts', () => {
  it('registers every canonical event exactly once at version 1', () => {
    expect(telemetryEventNames).toHaveLength(40);
    expect(Object.keys(telemetryEventRegistry)).toEqual([
      ...telemetryEventNames,
    ]);
    expect(
      Object.values(telemetryEventRegistry).every(
        (contract) => contract.version === 1,
      ),
    ).toBe(true);
  });

  it('accepts a valid canonical event', () => {
    const result = validateTelemetryEvent(validSessionStartedEvent(), now);
    expect(result).toMatchObject({ success: true, warnings: [] });
  });

  it('validates a conforming fixture for all 40 event-property contracts', () => {
    for (const [index, eventName] of telemetryEventNames.entries()) {
      const event = {
        ...validSessionStartedEvent({
          event_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        }),
        event_name: eventName,
        properties: validEventProperties[eventName],
      };

      expect(validateTelemetryEvent(event, now), eventName).toMatchObject({
        success: true,
      });
    }
  });

  it('rejects unknown names and unsupported versions deterministically', () => {
    expect(
      validateTelemetryEvent(
        {
          ...validSessionStartedEvent(),
          event_name: 'not_canonical',
        },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'unknown_event_name' }],
    });

    expect(
      validateTelemetryEvent(
        { ...validSessionStartedEvent(), event_version: 2 },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'unsupported_event_version' }],
    });
  });

  it('rejects missing properties, wrong types, and extra properties', () => {
    for (const properties of [
      {
        session_number: 1,
        is_return_session: false,
        prior_session_ended_at: null,
      },
      {
        session_number: 'one',
        is_return_session: false,
        prior_session_ended_at: null,
        entry_route: '/discover',
      },
      {
        session_number: 1,
        is_return_session: false,
        prior_session_ended_at: null,
        entry_route: '/discover',
        arbitrary: true,
      },
    ]) {
      expect(
        validateTelemetryEvent(
          { ...validSessionStartedEvent(), properties },
          now,
        ),
      ).toMatchObject({
        success: false,
        errors: [{ code: 'invalid_properties' }],
      });
    }
  });

  it('rejects trusted ownership fields and invalid envelope bounds', () => {
    expect(
      validateTelemetryEvent(
        {
          ...validSessionStartedEvent(),
          anonymous_user_id: '30000000-0000-4000-8000-000000000001',
          environment: 'production',
        },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [
        { code: 'forbidden_trusted_field' },
        { code: 'forbidden_trusted_field' },
      ],
    });

    expect(
      validateTelemetryEvent(
        { ...validSessionStartedEvent(), client_sequence: -1 },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'invalid_envelope' }],
    });

    expect(
      validateTelemetryEvent(
        { ...validSessionStartedEvent(), surface: 'checkout' },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'invalid_envelope' }],
    });
  });

  it('warns after five minutes and quarantines future or stale timestamps', () => {
    const warning = validateTelemetryEvent(
      {
        ...validSessionStartedEvent(),
        occurred_at: '2026-07-24T12:06:00.000Z',
      },
      now,
    );
    expect(warning).toMatchObject({
      success: true,
      warnings: ['timestamp_future_skew'],
    });

    expect(
      validateTelemetryEvent(
        {
          ...validSessionStartedEvent(),
          occurred_at: '2026-07-25T12:00:00.001Z',
        },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'timestamp_future' }],
    });

    expect(
      validateTelemetryEvent(
        {
          ...validSessionStartedEvent(),
          occurred_at: '2026-06-24T11:59:59.999Z',
        },
        now,
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'timestamp_stale' }],
    });
  });

  it('enforces impression visibility and duration bounds', () => {
    const impression = {
      ...validSessionStartedEvent(),
      event_name: 'product_impression',
      surface: 'discover',
      properties: {
        product_id: '30000000-0000-4000-8000-000000000001',
        product_category: 'top',
        feed_instance_id: '40000000-0000-4000-8000-000000000001',
        feed_position: 1,
        feed_order_version: 'baseline-v1',
        visible_ratio: 0.49,
        visible_duration_ms: 999,
        batch_number: 1,
        is_saved_at_impression: false,
      },
    };

    const result = validateTelemetryEvent(impression, now);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'invalid_properties' }),
        ]),
      );
    }
  });
});
