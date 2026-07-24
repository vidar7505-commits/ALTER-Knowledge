import { validateTelemetryEvent, type AnyTelemetryEvent } from './contracts';
import type {
  TelemetryBatchResult,
  TelemetryErrorCode,
  TelemetrySessionDescriptor,
  TrustedTelemetryContext,
} from './types';
import type { TelemetryDatabaseGateway } from './server';

type StoredEvent = {
  event: AnyTelemetryEvent;
  fingerprint: string;
  anonymousUserId: string;
  receivedAt: string;
  environment: TrustedTelemetryContext['environment'];
  appVersion: string;
};

export class InMemoryTelemetryDatabase implements TelemetryDatabaseGateway {
  readonly acceptedEvents = new Map<string, StoredEvent>();
  readonly quarantined: Array<{
    rawPayload: unknown;
    errorCodes: TelemetryErrorCode[];
  }> = [];

  private readonly sessions = new Map<
    string,
    { authUserId: string; descriptor: TelemetrySessionDescriptor }
  >();

  constructor(
    private readonly options: {
      clock?: () => Date;
      identityForAuthUser?: (authUserId: string) => string;
    } = {},
  ) {}

  async ingest(input: {
    authUserId: string;
    session: TelemetrySessionDescriptor;
    events: unknown[];
    trusted: TrustedTelemetryContext;
  }): Promise<TelemetryBatchResult> {
    const receivedAt = (
      this.options.clock ?? (() => new Date())
    )().toISOString();
    const existingSession = this.sessions.get(input.session.session_id);
    const sessionOwnerMismatch =
      existingSession && existingSession.authUserId !== input.authUserId;
    const sessionContextConflict =
      existingSession &&
      (existingSession.descriptor.platform !== input.session.platform ||
        existingSession.descriptor.entry_route !== input.session.entry_route);

    if (!existingSession) {
      this.sessions.set(input.session.session_id, {
        authUserId: input.authUserId,
        descriptor: input.session,
      });
    }

    return {
      results: input.events.map((rawEvent, index) => {
        const eventId =
          rawEvent &&
          typeof rawEvent === 'object' &&
          'event_id' in rawEvent &&
          typeof rawEvent.event_id === 'string'
            ? rawEvent.event_id
            : null;

        if (sessionOwnerMismatch || sessionContextConflict) {
          const code: TelemetryErrorCode = sessionOwnerMismatch
            ? 'session_owner_mismatch'
            : 'session_context_conflict';
          this.quarantined.push({
            rawPayload: rawEvent,
            errorCodes: [code],
          });
          return {
            index,
            event_id: eventId,
            status: 'rejected' as const,
            error_codes: [code],
            received_at: receivedAt,
          };
        }

        const validation = validateTelemetryEvent(
          rawEvent,
          new Date(receivedAt),
        );

        if (!validation.success) {
          const errorCodes = validation.errors.map(
            (error) => error.code as TelemetryErrorCode,
          );
          this.quarantined.push({
            rawPayload: rawEvent,
            errorCodes,
          });
          return {
            index,
            event_id: eventId,
            status: validation.errors.some(
              (error) => error.code === 'forbidden_trusted_field',
            )
              ? ('rejected' as const)
              : ('quarantined' as const),
            error_codes: errorCodes,
            received_at: receivedAt,
          };
        }

        if (validation.event.session_id !== input.session.session_id) {
          const errorCodes: TelemetryErrorCode[] = ['session_not_found'];
          this.quarantined.push({
            rawPayload: rawEvent,
            errorCodes,
          });
          return {
            index,
            event_id: validation.event.event_id,
            status: 'rejected' as const,
            error_codes: errorCodes,
            received_at: receivedAt,
          };
        }

        const fingerprint = JSON.stringify(validation.event);
        const existingEvent = this.acceptedEvents.get(
          validation.event.event_id,
        );

        if (existingEvent) {
          if (
            existingEvent.fingerprint === fingerprint &&
            existingEvent.anonymousUserId ===
              this.resolveIdentity(input.authUserId)
          ) {
            return {
              index,
              event_id: validation.event.event_id,
              status: 'duplicate' as const,
              error_codes: [],
              received_at: existingEvent.receivedAt,
            };
          }

          const errorCodes: TelemetryErrorCode[] = ['event_id_conflict'];
          this.quarantined.push({
            rawPayload: rawEvent,
            errorCodes,
          });
          return {
            index,
            event_id: validation.event.event_id,
            status: 'rejected' as const,
            error_codes: errorCodes,
            received_at: receivedAt,
          };
        }

        this.acceptedEvents.set(validation.event.event_id, {
          event: validation.event,
          fingerprint,
          anonymousUserId: this.resolveIdentity(input.authUserId),
          receivedAt,
          environment: input.trusted.environment,
          appVersion: input.trusted.appVersion,
        });

        return {
          index,
          event_id: validation.event.event_id,
          status: 'accepted' as const,
          error_codes: validation.warnings,
          received_at: receivedAt,
        };
      }),
    };
  }

  private resolveIdentity(authUserId: string): string {
    return this.options.identityForAuthUser?.(authUserId) ?? authUserId;
  }
}
