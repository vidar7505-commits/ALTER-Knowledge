import {
  TELEMETRY_EVENT_VERSION,
  TELEMETRY_MAX_BATCH_SIZE,
  type AnyTelemetryCapture,
  type AnyTelemetryEvent,
  type TelemetryCapture,
  type TelemetryContext,
  type TelemetryEventName,
  validateTelemetryEvent,
} from './contracts';
import {
  TelemetryError,
  type TelemetryBatchResult,
  type TelemetryItemResult,
  type TelemetrySessionDescriptor,
  type TelemetryTransport,
} from './types';

export type TelemetryServiceOptions = {
  session: TelemetrySessionDescriptor;
  context: () => TelemetryContext;
  transport: TelemetryTransport;
  clock?: () => Date;
  createEventId?: () => string;
  initialClientSequence?: number;
  persistence?: TelemetryQueuePersistence;
};

export interface TelemetryQueuePersistence {
  read(): Promise<AnyTelemetryEvent[]>;
  write(events: AnyTelemetryEvent[]): Promise<void>;
}

export interface TelemetryService {
  capture<Name extends TelemetryEventName>(
    event: TelemetryCapture<Name>,
  ): Promise<TelemetryItemResult>;
  captureBatch(events: AnyTelemetryCapture[]): Promise<TelemetryBatchResult>;
  flush(): Promise<TelemetryBatchResult>;
  dispose(): void;
}

export class BufferedTelemetryService implements TelemetryService {
  private readonly queue: AnyTelemetryEvent[] = [];
  private readonly clock: () => Date;
  private readonly createEventId: () => string;
  private clientSequence: number;
  private pendingFlush: Promise<TelemetryBatchResult> | null = null;
  private disposed = false;
  private restored = false;
  private restorePromise: Promise<void> | null = null;

  constructor(private readonly options: TelemetryServiceOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.createEventId =
      options.createEventId ?? (() => globalThis.crypto.randomUUID());
    this.clientSequence = options.initialClientSequence ?? 0;
  }

  async capture<Name extends TelemetryEventName>(
    capture: TelemetryCapture<Name>,
  ): Promise<TelemetryItemResult> {
    await this.restore();
    const [event] = this.enqueue([capture as AnyTelemetryCapture]);
    await this.persist();
    const result = await this.flush();
    const item = result.results.find(
      (candidate) => candidate.event_id === event.event_id,
    );

    if (!item) {
      throw new TelemetryError(
        'response_contract_invalid',
        false,
        'Telemetry ingestion did not return the captured event.',
      );
    }

    return item;
  }

  async captureBatch(
    captures: AnyTelemetryCapture[],
  ): Promise<TelemetryBatchResult> {
    await this.restore();
    const events = this.enqueue(captures);
    await this.persist();
    const ids = new Set(events.map((event) => event.event_id));
    const result = await this.flush();

    return {
      results: result.results.filter(
        (item) => item.event_id !== null && ids.has(item.event_id),
      ),
    };
  }

  async flush(): Promise<TelemetryBatchResult> {
    await this.restore();
    if (this.disposed) {
      throw new TelemetryError(
        'transport_unavailable',
        false,
        'The telemetry service has been disposed.',
      );
    }

    if (this.pendingFlush) {
      return await this.pendingFlush;
    }

    if (this.queue.length === 0) {
      return { results: [] };
    }

    const batch = this.queue.slice(0, TELEMETRY_MAX_BATCH_SIZE);
    this.pendingFlush = this.options.transport
      .send({
        session: this.options.session,
        events: batch,
      })
      .then((result) => {
        if (
          result.results.length !== batch.length ||
          result.results.some(
            (item, index) =>
              item.index !== index || item.event_id !== batch[index]?.event_id,
          )
        ) {
          throw new TelemetryError(
            'response_contract_invalid',
            false,
            'Telemetry ingestion returned an invalid ordered result.',
          );
        }

        this.queue.splice(0, batch.length);
        void this.persist();
        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof TelemetryError) {
          throw error;
        }

        throw new TelemetryError(
          'transport_unavailable',
          true,
          'Telemetry delivery failed and remains buffered for retry.',
          { cause: error },
        );
      })
      .finally(() => {
        this.pendingFlush = null;
      });

    return await this.pendingFlush;
  }

  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
  }

  private enqueue(captures: AnyTelemetryCapture[]): AnyTelemetryEvent[] {
    if (this.disposed) {
      throw new TelemetryError(
        'transport_unavailable',
        false,
        'The telemetry service has been disposed.',
      );
    }

    if (
      captures.length > TELEMETRY_MAX_BATCH_SIZE ||
      this.queue.length + captures.length > TELEMETRY_MAX_BATCH_SIZE
    ) {
      throw new TelemetryError(
        'queue_full',
        false,
        'The bounded telemetry queue may contain at most 100 events.',
      );
    }

    const events = captures.map((capture) => this.buildEvent(capture));
    this.queue.push(...events);
    return events;
  }

  private buildEvent(capture: AnyTelemetryCapture): AnyTelemetryEvent {
    const event = {
      event_id: this.createEventId(),
      event_name: capture.event_name,
      event_version: TELEMETRY_EVENT_VERSION,
      occurred_at: this.clock().toISOString(),
      session_id: this.options.session.session_id,
      platform: this.options.session.platform,
      surface: capture.surface,
      source_surface: capture.source_surface,
      client_sequence: this.clientSequence,
      properties: capture.properties,
      context: this.options.context(),
    } as AnyTelemetryEvent;

    const validation = validateTelemetryEvent(event, this.clock());

    if (!validation.success) {
      throw new TelemetryError(
        'invalid_request',
        false,
        validation.errors.map((error) => error.message).join(' '),
      );
    }

    this.clientSequence += 1;
    return validation.event;
  }

  private restore() {
    if (this.restored || !this.options.persistence) return Promise.resolve();
    this.restorePromise ??= this.options.persistence
      .read()
      .then((events) => {
        const existing = new Set(this.queue.map((event) => event.event_id));
        const restored = events.filter(
          (event) =>
            event.session_id === this.options.session.session_id &&
            !existing.has(event.event_id),
        );
        this.queue.unshift(
          ...restored.slice(
            0,
            Math.max(0, TELEMETRY_MAX_BATCH_SIZE - this.queue.length),
          ),
        );
        this.clientSequence = Math.max(
          this.clientSequence,
          ...restored.map((event) => event.client_sequence + 1),
        );
        this.restored = true;
      })
      .catch(() => {
        this.restored = true;
      });
    return this.restorePromise;
  }

  private persist() {
    return (
      this.options.persistence?.write([...this.queue]) ?? Promise.resolve()
    );
  }
}
