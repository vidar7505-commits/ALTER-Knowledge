import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

import {
  DestinationError,
  MeaningfulDestinationService,
  type DestinationDataSource,
  type MeaningfulDestination,
} from './destination';

type DatabaseError = { code?: string; message: string };

function mapError(error: DatabaseError) {
  const message = error.message.toLowerCase();
  if (error.code === '22023' && message.includes('session')) {
    return new DestinationError(
      'stale_session',
      true,
      'The active session changed before the destination was recorded.',
      { cause: error },
    );
  }
  if (error.code === '22023' && message.includes('operation')) {
    return new DestinationError(
      'operation_conflict',
      false,
      'The destination request conflicts with an earlier operation.',
      { cause: error },
    );
  }
  return new DestinationError(
    'transport_unavailable',
    true,
    'The destination could not be recorded.',
    { cause: error },
  );
}

export class SupabaseDestinationDataSource implements DestinationDataSource {
  constructor(private readonly client: SupabaseClient) {}

  async record(input: {
    sessionId: string;
    destination: MeaningfulDestination;
    operationId: string;
  }) {
    const { data, error } = await this.client.rpc(
      'record_meaningful_destination',
      {
        p_session_id: input.sessionId,
        p_destination: input.destination,
        p_operation_id: input.operationId,
      },
    );
    if (error) throw mapError(error);
    return data;
  }
}

let browserService: MeaningfulDestinationService | undefined;

export function createBrowserMeaningfulDestinationService() {
  browserService ??= new MeaningfulDestinationService(
    new SupabaseDestinationDataSource(getBrowserSupabaseClient()),
  );
  return browserService;
}
