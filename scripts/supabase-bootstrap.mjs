import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const command = process.execPath;
const supabaseCli = fileURLToPath(
  new URL('../node_modules/supabase/dist/supabase.js', import.meta.url),
);

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (result.error) {
    return { ok: false, detail: result.error.message };
  }

  return {
    ok: result.status === 0,
    detail: options.capture
      ? `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
      : '',
  };
}

const dockerVersion = run('docker', ['--version'], { capture: true });
if (!dockerVersion.ok) {
  console.error(`Docker is unavailable: ${dockerVersion.detail}`);
  console.error(
    'Install and start Docker Desktop, then run: npm run supabase:bootstrap',
  );
  process.exit(1);
}

const dockerInfo = run('docker', ['info'], { capture: true });
if (!dockerInfo.ok) {
  console.error('Docker is installed but its engine is not reachable.');
  console.error('Start Docker Desktop, then run: npm run supabase:bootstrap');
  process.exit(1);
}

const cliVersion = run(command, [supabaseCli, '--version'], {
  capture: true,
});
if (!cliVersion.ok) {
  console.error(
    `The repository-local Supabase CLI is unavailable: ${cliVersion.detail}`,
  );
  console.error('Run npm install, then retry: npm run supabase:bootstrap');
  process.exit(1);
}

console.log(`Docker: ${dockerVersion.detail}`);
console.log(`Supabase CLI: ${cliVersion.detail}`);

const start = run(command, [supabaseCli, 'start']);
if (!start.ok) {
  console.error('Supabase failed to start. Review the CLI output above.');
  process.exit(1);
}

const status = run(command, [supabaseCli, 'status']);
if (!status.ok) {
  console.error('Supabase status failed. Review the CLI output above.');
  process.exit(1);
}
console.log('Copy .env.example to .env.local and replace its placeholders');
console.log('with the local credentials printed by supabase:status.');
