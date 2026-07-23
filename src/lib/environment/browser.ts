import { browserEnvironmentSchema } from '@/lib/validation/environment';

export type BrowserEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

export class BrowserEnvironmentError extends Error {
  readonly code = 'configuration_missing';

  constructor() {
    super(
      'Anonymous identity requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
    this.name = 'BrowserEnvironmentError';
  }
}

export function readBrowserEnvironment(
  environment: {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  } = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): BrowserEnvironment {
  const result = browserEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new BrowserEnvironmentError();
  }

  return result.data;
}
