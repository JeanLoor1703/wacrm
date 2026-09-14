import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// Generated credentials/configuration are ignored, never printed or committed.
const hosted = process.argv.includes('--hosted'),
  local = process.argv.includes('--local');
if (hosted === local) throw new Error('Select --local or --hosted explicitly.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.API_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.ANON_KEY;
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
if (!url || !anon || !service)
  throw new Error('Missing secure Supabase configuration.');
if (hosted && new URL(url).hostname !== 'bqehnefuivaojiegapei.supabase.co')
  throw new Error('Wrong hosted project.');
if (local && !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Local fixtures cannot target a hosted database.');
const db = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = hosted
  ? 'demo.qa.creacom@example.com'
  : 'demo.qa.creacom@local.test';
const password =
  process.env.E2E_PASSWORD || randomBytes(24).toString('base64url');
const { data: created, error: createError } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'DEMO QA CREACOM' },
});
let user = created?.user;
if (createError) {
  for (let page = 1; page <= 100 && !user; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw new Error('Cannot inspect QA user.');
    user = data.users.find((u) => u.email === email);
    if (data.users.length < 100) break;
  }
  if (!user) throw new Error('Cannot provision QA user.');
  if (!process.env.E2E_PASSWORD)
    throw new Error(
      'QA already exists: load its password securely; do not rotate credentials.'
    );
}
const { data: profile, error: profileError } = await db
  .from('profiles')
  .select('account_id,account_role')
  .eq('user_id', user.id)
  .single();
if (profileError || !profile?.account_id || profile.account_role !== 'owner')
  throw new Error('Invalid isolated QA profile.');
const accountId = profile.account_id;
const { data: account, error: accountError } = await db
  .from('accounts')
  .select('owner_user_id,name')
  .eq('id', accountId)
  .single();
if (
  accountError ||
  account.owner_user_id !== user.id ||
  account.name !== 'DEMO QA CREACOM'
)
  throw new Error('Refusing to edit an unexpected account.');
const stages = [
  ['new', 'Nuevo'],
  ['qualifying', 'Calificando'],
  ['ready_to_quote', 'Listo para cotizar'],
  ['quote_sent', 'Cotización enviada'],
  ['negotiation', 'Negociación'],
  ['won', 'Ganado'],
  ['not_converted', 'No concretado'],
];
const { data: existing, error: existingError } = await db
  .from('pipelines')
  .select('*')
  .eq('account_id', accountId)
  .eq('name', 'DEMO QA CREACOM')
  .maybeSingle();
if (existingError) throw new Error('Unexpected QA pipelines.');
let pipeline = existing;
if (pipeline && (pipeline.model_key !== 'creacom' || !pipeline.is_demo))
  throw new Error('QA pipeline is not DEMO.');
if (!pipeline) {
  const { data, error } = await db
    .from('pipelines')
    .insert({
      user_id: user.id,
      account_id: accountId,
      name: 'DEMO QA CREACOM',
      model_key: 'creacom',
      is_demo: true,
    })
    .select()
    .single();
  if (error) throw new Error('Cannot create QA pipeline.');
  pipeline = data;
  const result = await db
    .from('pipeline_stages')
    .insert(
      stages.map(([semantic_key, name], position) => ({
        pipeline_id: pipeline.id,
        semantic_key,
        name,
        position,
        color: '#ED3237',
      }))
    );
  if (result.error) throw new Error('Cannot create QA stages.');
}
const names = [
  ['price', 'Precio'],
  ['no_response', 'No respondió'],
  ['competitor', 'Eligió competencia'],
  ['postponed', 'Obra aplazada'],
  ['budget', 'Sin presupuesto'],
  ['conditions', 'No cumple condiciones'],
  ['other', 'Otro'],
];
const { error } = await db.from('deal_loss_reasons').upsert(
  names.map(([code, name]) => ({
    account_id: accountId,
    code,
    name,
    requires_detail: code === 'other',
  })),
  { onConflict: 'account_id,code', ignoreDuplicates: true }
);
if (error) throw new Error('Cannot seed QA reasons.');
const env = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  E2E_EMAIL: email,
  E2E_PASSWORD: password,
  E2E_ACCOUNT_ID: accountId,
  E2E_PIPELINE_ID: pipeline.id,
};
writeFileSync(
  '.env.e2e.local',
  Object.entries(env)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n') + '\n',
  { mode: 0o600 }
);
console.log(
  'Isolated DEMO QA CREACOM ready. Credentials saved only in ignored configuration.'
);
