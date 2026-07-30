import { z } from 'zod';

export const MeaningfulDestinationSchema = z.enum([
  'discover',
  'wardrobe',
  'challenge',
]);
export type MeaningfulDestination = z.infer<typeof MeaningfulDestinationSchema>;

const DestinationEnvelopeSchema = z.strictObject({
  ok: z.literal(true),
  operation_id: z.uuid(),
  state_revision: z.int().nonnegative(),
  data: z.strictObject({
    destination: MeaningfulDestinationSchema,
    session_id: z.uuid(),
    recorded_at: z.iso.datetime({ offset: true }),
  }),
});

export type DestinationErrorCode =
  | 'stale_session'
  | 'operation_conflict'
  | 'contract_invalid'
  | 'transport_unavailable';

export class DestinationError extends Error {
  constructor(
    readonly code: DestinationErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DestinationError';
  }
}

export interface DestinationDataSource {
  record(input: {
    sessionId: string;
    destination: MeaningfulDestination;
    operationId: string;
  }): Promise<unknown>;
}

export class MeaningfulDestinationService {
  constructor(private readonly source: DestinationDataSource) {}

  async record(input: {
    sessionId: string;
    destination: MeaningfulDestination;
    operationId: string;
  }) {
    const parsed = DestinationEnvelopeSchema.safeParse(
      await this.source.record(input),
    );
    if (
      !parsed.success ||
      parsed.data.operation_id !== input.operationId ||
      parsed.data.data.session_id !== input.sessionId ||
      parsed.data.data.destination !== input.destination
    ) {
      throw new DestinationError(
        'contract_invalid',
        false,
        'The destination response is not compatible with this build.',
        { cause: parsed.success ? undefined : parsed.error },
      );
    }
    return parsed.data;
  }
}
