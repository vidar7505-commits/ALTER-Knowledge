import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

import { OnboardingService, type OnboardingDataSource } from './service';
import { OnboardingError } from './types';

type SupabaseError = { code?: string; message: string };

function mapMutationError(error: SupabaseError): OnboardingError {
  if (error.code === '22023' || error.code === '23514') {
    return new OnboardingError(
      'operation_conflict',
      false,
      'This retry no longer matches the original request.',
      { cause: error },
    );
  }
  return new OnboardingError(
    'mutation_unavailable',
    true,
    'We couldn’t save your choices.',
    { cause: error },
  );
}

export class SupabaseOnboardingDataSource implements OnboardingDataSource {
  constructor(private readonly client: SupabaseClient) {}

  async readState(): Promise<unknown> {
    const { data, error } = await this.client
      .from('onboarding_states')
      .select(
        'status,onboarding_version,preference_set_version,preference_ids,completion_operation_id,skip_operation_id,state_revision',
      )
      .maybeSingle();
    if (error) {
      throw new OnboardingError(
        'query_unavailable',
        true,
        'We couldn’t restore your onboarding yet.',
        { cause: error },
      );
    }
    return data;
  }

  async readPreferences(): Promise<unknown> {
    const { data, error } = await this.client
      .from('onboarding_preferences')
      .select(
        'definition_version,preference_id,preference_group,label,description,display_order,max_selections,asset_id,is_active',
      )
      .eq('definition_version', 'onboarding-style-v1')
      .eq('is_active', true)
      .order('preference_group')
      .order('display_order');
    if (error) {
      throw new OnboardingError(
        'query_unavailable',
        true,
        'We couldn’t load the current style choices.',
        { cause: error },
      );
    }
    return data;
  }

  async complete(input: {
    operationId: string;
    onboardingVersion: string;
    preferenceSetVersion: string | null;
    preferenceIds: string[];
  }): Promise<unknown> {
    const { data, error } = await this.client.rpc('complete_onboarding', {
      operation_id: input.operationId,
      onboarding_version: input.onboardingVersion,
      preference_set_version: input.preferenceSetVersion,
      preference_ids: input.preferenceIds,
    });
    if (error) throw mapMutationError(error);
    return data;
  }

  async skip(input: {
    operationId: string;
    onboardingVersion: string;
  }): Promise<unknown> {
    const { data, error } = await this.client.rpc('skip_onboarding', {
      operation_id: input.operationId,
      onboarding_version: input.onboardingVersion,
    });
    if (error) throw mapMutationError(error);
    return data;
  }
}

export function createBrowserOnboardingService() {
  if (typeof window === 'undefined') {
    return new OnboardingService({
      readState: async () => {
        throw new OnboardingError(
          'query_unavailable',
          true,
          'We couldn’t restore your onboarding yet.',
        );
      },
      readPreferences: async () => [],
      complete: async () => {
        throw new OnboardingError(
          'mutation_unavailable',
          true,
          'We couldn’t save your choices.',
        );
      },
      skip: async () => {
        throw new OnboardingError(
          'mutation_unavailable',
          true,
          'We couldn’t save your choices.',
        );
      },
    });
  }
  browserService ??= new OnboardingService(
    new SupabaseOnboardingDataSource(getBrowserSupabaseClient()),
  );
  return browserService;
}

let browserService: OnboardingService | undefined;
