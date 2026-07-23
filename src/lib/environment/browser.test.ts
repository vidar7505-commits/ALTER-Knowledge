import { describe, expect, it } from 'vitest';

import { BrowserEnvironmentError, readBrowserEnvironment } from './browser';

describe('readBrowserEnvironment', () => {
  it('requires only browser-safe Supabase public configuration', () => {
    expect(
      readBrowserEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-public-key',
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-public-key',
    });
  });

  it('fails clearly when public configuration is absent', () => {
    expect(() => readBrowserEnvironment({})).toThrow(BrowserEnvironmentError);
  });
});
