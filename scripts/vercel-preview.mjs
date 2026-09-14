import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const project = 'prj_3pcWY9KBmPs834by01QtPbCV6QVE';
const team = 'team_dsoLg46FlNHrhu3eoaZyzge4';
const linked = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (linked.projectId !== project || linked.orgId !== team) throw new Error('Wrong Vercel project.');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
function api(path, method = 'GET', body) {
  const result = spawnSync(process.execPath, [npx, '--yes', 'vercel@50.32.4', 'api', `${path}?teamId=${team}`, '--method', method, '--raw', ...(body ? ['--input', '-'] : [])], {
    input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status) throw new Error(`Vercel ${method} failed (${result.status}); response withheld to protect configuration.`);
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
    return { key, value: safe[key], type: 'encrypted', target: ['preview'], gitBranch: 'codex/creacom-opportunities', comment: 'CREACOM Phase 1 user-scoped QA Preview. No production administrative/provider secrets.' };
  });
  if (additions.length) {
    const result = api(`/v10/projects/${project}/env`, 'POST', additions);
    if (result.failed?.length) throw new Error('Some Preview variables failed; values withheld.');
  }
  console.log(JSON.stringify({ project: p.name, configuredPreviewKeys: additions.map((e) => e.key), productionChanged: false }));
} else throw new Error('Supported actions: inspect, configure.');
