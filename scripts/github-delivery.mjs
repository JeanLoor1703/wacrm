import { spawnSync } from 'node:child_process';

// Exact repository scope. Credentials stay in memory and are never logged.
const repo = 'JeanLoor1703/wacrm';
const credentials = spawnSync('git', ['credential', 'fill'], {
  input: `protocol=https\nhost=github.com\npath=${repo}.git\n\n`,
  encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
});
const token = credentials.stdout?.split('\n').find((line) => line.startsWith('password='))?.slice(9).trim();
if (credentials.status || !token) throw new Error('No authenticated repository credential available.');
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path.split('?')[0]} returned ${response.status}.`);
  return response.status === 204 ? null : response.json();
}
const [action, id] = process.argv.slice(2);
if (action === 'pr') {
  const existing = await api('pulls?state=open&head=JeanLoor1703:codex/creacom-opportunities&base=main');
  const pr = existing[0] || await api('pulls', 'POST', {
    title: 'Fase 1: modelo comercial CREACOM, oportunidades y métricas',
    head: 'codex/creacom-opportunities', base: 'main',
    body: 'Implementa expansión compatible del modelo comercial, formulario progresivo de obras, cierres con motivo, métricas RPC bajo RLS y pruebas SQL/Chromium aisladas. La activación del embudo oficial queda condicionada al despliegue y verificación final. No modifica otros proyectos ni integra servicios de fases posteriores.',
  });
  console.log(JSON.stringify({ number: pr.number, url: pr.html_url, sha: pr.head.sha }));
} else if (action === 'checks') {
  const pr = await api(`pulls/${Number(id)}`);
  const runs = await api(`actions/runs?head_sha=${pr.head.sha}&per_page=20`);
  console.log(JSON.stringify({ sha: pr.head.sha, mergeable: pr.mergeable, runs: runs.workflow_runs.map((r) => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url })) }));
} else if (action === 'jobs') {
  const data = await api(`actions/runs/${Number(id)}/jobs`);
  console.log(JSON.stringify(data.jobs.map((j) => ({ id: j.id, name: j.name, status: j.status, conclusion: j.conclusion, steps: j.steps.map((s) => ({ name: s.name, conclusion: s.conclusion })) }))));
} else {
  throw new Error('Supported actions: pr, checks PR_NUMBER, jobs RUN_ID.');
}
