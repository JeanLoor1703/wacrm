import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const project = 'prj_3pcWY9KBmPs834by01QtPbCV6QVE';
const team = 'team_dsoLg46FlNHrhu3eoaZyzge4';
const linked = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (linked.projectId !== project || linked.orgId !== team) throw new Error('Wrong Vercel project.');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
function api(path, method = 'GET', body) {
  const temporary = body ? mkdtempSync(resolve(tmpdir(), 'creacom-vercel-')) : null;
  const input = temporary ? resolve(temporary, 'request.json') : null;
  if (input) writeFileSync(input, JSON.stringify(body), { mode: 0o600 });
  const result = spawnSync(process.execPath, [npx, '--yes', 'vercel@50.32.4', 'api', `${path}?teamId=${team}`, '--method', method, '--raw', ...(input ? ['--input', input] : [])], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (temporary) rmSync(temporary, { recursive: true, force: true });
  if (result.status) {
    let detail = result.stderr?.split('\n').find((line) => /^Error:/.test(line)) || 'response withheld';
    for (const item of (Array.isArray(body) ? body : [])) detail = detail.replaceAll(item.value, '[REDACTED]');
    throw new Error(`Vercel ${method} failed (${result.status}): ${detail.slice(0, 250)}`);
  }
  try { return JSON.parse(result.stdout); } catch { throw new Error('Vercel returned invalid JSON; response withheld.'); }
}
const p = api(`/v9/projects/${project}`);
if (p.id !== project || p.name !== 'sistema-ventas-creacom-hormigonera') throw new Error('Project identity mismatch.');
const envs = api(`/v9/projects/${project}/env`).envs;
const action = process.argv[2];
if (action === 'inspect') {
  console.log(JSON.stringify({ id: p.id, name: p.name, nodeVersion: p.nodeVersion, link: p.link ? { type: p.link.type, repo: p.link.repo, org: p.link.org, productionBranch: p.link.productionBranch } : null, previewKeys: envs.filter((e) => e.target?.includes('preview')).map((e) => ({ key: e.key, branch: e.gitBranch })) }));
} else if (action === 'configure') {
  const source = parseEnv(readFileSync('.vercel/.env.production.local', 'utf8'));
  if (new URL(source.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'bqehnefuivaojiegapei.supabase.co') throw new Error('Wrong Supabase source.');
  // Phase 1 uses user-scoped clients/RLS. NEVER copy production service-role,
  // Meta or encryption secrets into Preview; later integrations are out of scope.
  const safe = { NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY, ENCRYPTION_KEY: randomBytes(32).toString('hex') };
  const keys = Object.keys(safe);
  const additions = keys.filter((key) => !envs.some((e) => e.key === key && e.target?.includes('preview'))).map((key) => {
    if (!safe[key]) throw new Error(`Missing required configuration: ${key}`);
    return { key, value: safe[key] };
  });
  if (additions.length) {
    for (const item of additions) {
      const payload = { ...item, type: 'encrypted', target: ['preview'], gitBranch: 'codex/creacom-opportunities', comment: 'CREACOM Phase 1 user-scoped QA Preview. No production administrative/provider secrets.' };
      const result = api(`/v10/projects/${project}/env`, 'POST', payload);
      if (result.failed?.length) throw new Error(`Preview key ${item.key} failed; value withheld.`);
    }
  }
  console.log(JSON.stringify({ project: p.name, configuredPreviewKeys: additions.map((e) => e.key), productionAdministrativeSecretsCopied: false, productionChanged: false }));
} else throw new Error('Supported actions: inspect, configure.');
