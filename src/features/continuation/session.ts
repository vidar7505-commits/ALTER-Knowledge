import {
  getSessionCandidateId,
  rememberCanonicalSessionId,
  replaceSessionCandidateId,
} from '@/features/discover/storage';

export async function ensureCanonicalSession<T extends { session_id: string }>(
  ensure: (sessionId: string) => Promise<T>,
  isExpired: (error: unknown) => boolean,
): Promise<T> {
  try {
    const result = await ensure(getSessionCandidateId());
    rememberCanonicalSessionId(result.session_id);
    return result;
  } catch (error) {
    if (!isExpired(error)) throw error;
    const result = await ensure(replaceSessionCandidateId());
    rememberCanonicalSessionId(result.session_id);
    return result;
  }
}
