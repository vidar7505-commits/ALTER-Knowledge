import { z } from 'zod';

export const ContinuationSessionSchema = z.strictObject({
  session_id: z.uuid(),
  session_number: z.int().positive(),
  is_return_session: z.boolean(),
  started_at: z.iso.datetime({ offset: true }),
});

export type ContinuationSession = z.infer<typeof ContinuationSessionSchema>;

export type ContinuationCandidate =
  | {
      type: 'active_challenge';
      destination: '/challenge';
      progressCount: number;
    }
  | {
      type: 'completed_challenge';
      destination: '/challenge';
      progressCount: 4;
    }
  | {
      type: 'wardrobe';
      destination: '/wardrobe';
      savedCount: number;
    };

export type ContinuationErrorCode =
  'transport_unavailable' | 'contract_invalid' | 'stale_session';

export class ContinuationError extends Error {
  constructor(
    readonly code: ContinuationErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ContinuationError';
  }
}

export type ContinuationState =
  | { status: 'resolving' }
  | { status: 'same_session' | 'no_continuation' | 'consumed' }
  | { status: 'ready'; candidate: ContinuationCandidate }
  | {
      status: 'recoverable_error' | 'contract_error';
      error: ContinuationError;
    }
  | { status: 'navigating'; candidate: ContinuationCandidate };
