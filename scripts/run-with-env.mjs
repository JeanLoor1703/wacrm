import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

// Load secure configuration without passing --env-file to worker execArgv.
// Next/Playwright create workers; Node rejects that flag in NODE_OPTIONS.
const [file, ...args] = process.argv.slice(2);
if (!file || !args.length) throw new Error('Usage: run-with-env.mjs ENV_FILE NODE_SCRIPT [ARGS]');
const child = spawn(process.execPath, args, {
  env: { ...process.env, ...parseEnv(readFileSync(file, 'utf8')) },
  stdio: 'inherit',
});
child.on('error', () => { console.error('Unable to start configured command.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
