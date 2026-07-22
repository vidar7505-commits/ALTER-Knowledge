import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { projectReferenceHash, runRemoteGuard } from './supabase-remote.mjs';

const projectReference = 'exampledevelopmentref';

function guardedRun(extraArguments = [], overrides = {}) {
  const runCli = vi.fn(() => 0);
  const logger = { warn: vi.fn() };
  const result = runRemoteGuard({
    argv: [
      'dry-run',
      '--environment',
      'development',
      '--project-ref',
      projectReference,
      ...extraArguments,
    ],
    linkedProjectReference: projectReference,
    runCli,
    logger,
    ...overrides,
  });

  return { logger, result, runCli };
}

describe('Supabase remote safety guard', () => {
  it('rejects an empty environment', () => {
    expect(() =>
      runRemoteGuard({
        argv: [
          'dry-run',
          '--environment',
          '',
          '--project-ref',
          projectReference,
        ],
        linkedProjectReference: projectReference,
      }),
    ).toThrow('An explicit environment is required.');
  });

  it('rejects production', () => {
    expect(() =>
      runRemoteGuard({
        argv: [
          'dry-run',
          '--environment',
          'production',
          '--project-ref',
          projectReference,
        ],
        linkedProjectReference: projectReference,
      }),
    ).toThrow('Production remote operations are prohibited.');
  });

  it('accepts development and uses the official dry-run command', () => {
    const { result, runCli } = guardedRun();

    expect(result).toBe(0);
    expect(runCli).toHaveBeenCalledWith([
      'db',
      'push',
      '--dry-run',
      '--linked',
    ]);
  });

  it('accepts a runtime expected project reference hash', () => {
    const runCli = vi.fn(() => 0);

    runRemoteGuard({
      argv: [
        'status',
        '--environment',
        'development',
        '--project-ref-sha256',
        projectReferenceHash(projectReference),
      ],
      linkedProjectReference: projectReference,
      runCli,
      logger: { warn: vi.fn() },
    });

    expect(runCli).toHaveBeenCalledWith(['migration', 'list', '--linked']);
  });

  it('rejects a push without the exact development confirmation', () => {
    expect(() =>
      runRemoteGuard({
        argv: [
          'push',
          '--environment',
          'development',
          '--project-ref',
          projectReference,
        ],
        linkedProjectReference: projectReference,
      }),
    ).toThrow(
      'Remote push requires the exact confirmation: --confirm development.',
    );
  });

  it('does not print the project reference', () => {
    const { logger } = guardedRun();
    const output = logger.warn.mock.calls.flat().join(' ');

    expect(output).not.toContain(projectReference);
  });

  it('does not expose destructive linked reset through package scripts', () => {
    const packagePath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    const normalScripts = Object.values(packageJson.scripts).join(' ');

    expect(normalScripts).not.toContain('db reset --linked');
    expect(normalScripts).not.toContain('--include-seed');
  });
});
