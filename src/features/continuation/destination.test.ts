import { describe, expect, it, vi } from 'vitest';

import { MeaningfulDestinationService } from './destination';

describe('MeaningfulDestinationService', () => {
  it('accepts only a matching canonical response without ownership fields', async () => {
    const source = {
      record: vi.fn().mockResolvedValue({
        ok: true,
        operation_id: '80000000-0000-4000-8000-000000000001',
        state_revision: 2,
        data: {
          destination: 'discover',
          session_id: '30000000-0000-4000-8000-000000000001',
          recorded_at: '2026-07-30T10:00:00.000Z',
        },
      }),
    };
    const service = new MeaningfulDestinationService(source);
    const result = await service.record({
      sessionId: '30000000-0000-4000-8000-000000000001',
      destination: 'discover',
      operationId: '80000000-0000-4000-8000-000000000001',
    });
    expect(result.data.destination).toBe('discover');
    expect(JSON.stringify(source.record.mock.calls)).not.toMatch(
      /anonymous_user_id|auth_user_id|owner/i,
    );
  });

  it('rejects a mismatched replay contract', async () => {
    const service = new MeaningfulDestinationService({
      record: vi.fn().mockResolvedValue({
        ok: true,
        operation_id: '80000000-0000-4000-8000-000000000002',
        state_revision: 2,
        data: {
          destination: 'wardrobe',
          session_id: '30000000-0000-4000-8000-000000000001',
          recorded_at: '2026-07-30T10:00:00.000Z',
        },
      }),
    });
    await expect(
      service.record({
        sessionId: '30000000-0000-4000-8000-000000000001',
        destination: 'discover',
        operationId: '80000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toMatchObject({ code: 'contract_invalid' });
  });
});
