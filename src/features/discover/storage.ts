import { z } from 'zod';

const STORAGE_KEY = 'alter:discover:restoration:v1';
const SESSION_KEY = 'alter:telemetry:session-id';

const RestorationSchema = z.strictObject({
  feedInstanceId: z.uuid(),
  feedOrderVersion: z.literal('lr001-catalog-order-v1'),
  requestCursors: z.array(z.string().nullable()).max(100),
  anchorProductId: z.uuid().nullable(),
  anchorPosition: z.int().positive().nullable(),
  scrollY: z.number().min(0).finite(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type DiscoverRestoration = z.infer<typeof RestorationSchema>;

export function getSessionCandidateId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing && z.uuid().safeParse(existing).success) return existing;
  const created = globalThis.crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export function readDiscoverRestoration(): DiscoverRestoration | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = RestorationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeDiscoverRestoration(
  value: Omit<DiscoverRestoration, 'updatedAt'>,
) {
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...value, updatedAt: new Date().toISOString() }),
  );
}

export function clearDiscoverRestoration() {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
