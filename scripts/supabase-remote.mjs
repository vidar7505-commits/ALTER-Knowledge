import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const SUPPORTED_ACTIONS = new Set(['status', 'dry-run', 'push']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

export class RemoteGuardError extends Error {}

export function projectReferenceHash(projectReference) {
  return createHash('sha256').update(projectReference).digest('hex');
}

export function parseRemoteArguments(argv) {
  const [action, ...tokens] = argv;
  const options = {};

  if (!SUPPORTED_ACTIONS.has(action)) {
    throw new RemoteGuardError(
      'Choose one remote action: status, dry-run, or push.',
    );
  }

  for (let index = 0; index < tokens.length; index += 2) {
    const option = tokens[index];
    const value = tokens[index + 1];

    if (
      ![
        '--environment',
        '--project-ref',
        '--project-ref-sha256',
        '--confirm',
      ].includes(option) ||
      value === undefined
    ) {
      throw new RemoteGuardError('Remote guard arguments are incomplete.');
    }

    if (Object.hasOwn(options, option)) {
      throw new RemoteGuardError(
        'Remote guard arguments must not be repeated.',
      );
    }

    options[option] = value.trim();
  }

  return { action, options };
}

export function validateRemoteIntent({
  action,
  options,
  linkedProjectReference,
}) {
  const environment = options['--environment'];

  if (!environment) {
    throw new RemoteGuardError('An explicit environment is required.');
  }

  if (environment.toLowerCase() === 'production') {
    throw new RemoteGuardError('Production remote operations are prohibited.');
  }

  if (environment !== 'development') {
    throw new RemoteGuardError(
      'Only the development environment is permitted by this guard.',
    );
  }

  const suppliedProjectReference = options['--project-ref'];
  const suppliedHash = options['--project-ref-sha256'];

  if (Boolean(suppliedProjectReference) === Boolean(suppliedHash)) {
    throw new RemoteGuardError(
      'Supply exactly one runtime project reference or expected SHA-256 hash.',
    );
  }

  if (suppliedHash && !HASH_PATTERN.test(suppliedHash)) {
    throw new RemoteGuardError(
      'The expected project reference hash must be a lowercase SHA-256 value.',
    );
  }

  if (!linkedProjectReference) {
    throw new RemoteGuardError(
      'Cloud linkage is missing. Link the development project in a trusted terminal first.',
    );
  }

  const linkedHash = projectReferenceHash(linkedProjectReference.trim());
  const expectedHash = suppliedProjectReference
    ? projectReferenceHash(suppliedProjectReference)
    : suppliedHash;

  if (linkedHash !== expectedHash) {
    throw new RemoteGuardError(
      'The runtime target does not match the linked development project.',
    );
  }

  if (action === 'push' && options['--confirm'] !== 'development') {
    throw new RemoteGuardError(
      'Remote push requires the exact confirmation: --confirm development.',
    );
  }
}

export function commandForAction(action) {
  if (action === 'status') {
    return ['migration', 'list', '--linked'];
  }

  if (action === 'dry-run') {
    return ['db', 'push', '--dry-run', '--linked'];
  }

  return ['db', 'push', '--linked'];
}

function readLinkedProjectReference(cwd) {
  try {
    return readFileSync(
      resolve(cwd, 'supabase/.temp/project-ref'),
      'utf8',
    ).trim();
  } catch {
    return '';
  }
}

function runRepositorySupabase(args) {
  const supabaseCli = fileURLToPath(
    new URL('../node_modules/supabase/dist/supabase.js', import.meta.url),
  );
  const result = spawnSync(process.execPath, [supabaseCli, ...args], {
    stdio: 'inherit',
  });

  if (result.error) {
    throw new RemoteGuardError(
      'The repository-local Supabase CLI could not be started.',
    );
  }

  return result.status ?? 1;
}

export function runRemoteGuard({
  argv,
  cwd = process.cwd(),
  linkedProjectReference = readLinkedProjectReference(cwd),
  runCli = runRepositorySupabase,
  logger = console,
}) {
  const parsed = parseRemoteArguments(argv);
  validateRemoteIntent({ ...parsed, linkedProjectReference });

  logger.warn(
    'Target verified as the linked development project. Linked resets are destructive and intentionally unavailable.',
  );

  if (parsed.action === 'push') {
    logger.warn(
      'Applying committed migrations to hosted development. Seed data is excluded.',
    );
  }

  return runCli(commandForAction(parsed.action));
}

const isDirectInvocation =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectInvocation) {
  try {
    process.exitCode = runRemoteGuard({ argv: process.argv.slice(2) });
  } catch (error) {
    const message =
      error instanceof RemoteGuardError
        ? error.message
        : 'The remote guard failed safely.';
    console.error(message);
    process.exitCode = 1;
  }
}
