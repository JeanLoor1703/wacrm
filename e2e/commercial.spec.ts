import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const email = process.env.E2E_EMAIL,
  password = process.env.E2E_PASSWORD;
const pipelineId = process.env.E2E_PIPELINE_ID,
  accountId = process.env.E2E_ACCOUNT_ID;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/correo/i).fill(email!);
  await page.getByLabel(/^contraseña/i).fill(password!);
  await page.getByRole('button', { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test('isolated commercial workflow, persistence and responsive form', async ({
  page,
}) => {
  if (!email || !password || !pipelineId || !accountId || !url || !anon)
    throw new Error(
      'E2E requires isolated QA configuration; never skip the smoke check.'
    );
  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await db.auth.signInWithPassword({ email, password });
  expect(auth.error).toBeNull();
  const profile = await db
    .from('profiles')
    .select('account_id,full_name')
    .eq('user_id', auth.data.user!.id)
    .single();
  expect(profile.data).toEqual({
    account_id: accountId,
    full_name: 'DEMO QA CREACOM',
  });
  const pipeline = await db
    .from('pipelines')
    .select('is_demo,model_key')
    .eq('id', pipelineId)
    .single();
  expect(pipeline.data).toEqual({ is_demo: true, model_key: 'creacom' });
  const run = `QA ${Date.now()}`,
    ids: string[] = [];
  let contactId: string | undefined;
  try {
    await login(page);
    console.log('smoke:login');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto('/contacts');
    await page
      .getByRole('button', { name: 'Agregar cliente', exact: true })
      .click();
    let sheet = page.getByRole('dialog');
    await sheet.locator('#cf-name').fill(run);
    await sheet
      .locator('#cf-phone')
      .fill(`+59399${String(Date.now()).slice(-7)}`);
    await sheet.locator('#cf-phone').blur();
    const createContact = sheet.getByRole('button', { name: /crear/i });
    await expect(createContact).toBeEnabled();
    await createContact.click();
    await expect(sheet).not.toBeVisible();
    console.log('smoke:contact-created');
    const contact = await db
      .from('contacts')
      .select('id')
      .eq('name', run)
      .single();
    expect(contact.error).toBeNull();
    contactId = contact.data!.id;
    await page
      .getByPlaceholder(/buscar/i)
      .first()
      .fill(run);
    await page.getByText(run, { exact: true }).first().click();
    sheet = page.getByRole('dialog');
    await sheet.locator('input').first().fill(`${run} editado`);
    await sheet
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await page.goto(`/pipelines?pipeline=${pipelineId}`);
    await expect(
      page.getByText('DEMO QA CREACOM', { exact: true }).first()
    ).toBeVisible();
    const stages = await db
      .from('pipeline_stages')
      .select('id,semantic_key')
      .eq('pipeline_id', pipelineId);
    const stage = (key: string) =>
      stages.data!.find((s) => s.semantic_key === key)!.id;
    for (const [index, title] of [`${run} Losa`, `${run} Galpón`].entries()) {
      await page
        .getByRole('button', { name: 'Nueva oportunidad', exact: true })
        .click();
      sheet = page.getByRole('dialog');
      await sheet
        .getByLabel('Cliente *', { exact: true })
        .selectOption(contactId!);
      await sheet
        .getByLabel('Obra / referencia *', { exact: true })
        .fill(title);
      await sheet
        .getByLabel('Ubicación de la obra', { exact: true })
        .fill('Quevedo');
      await sheet.getByRole('tab', { name: 'Hormigón', exact: true }).click();
      await sheet
        .getByLabel('Volumen estimado (m³)', { exact: true })
        .fill(index ? '60' : '25.125');
      await sheet
        .getByLabel('Resistencia', { exact: true })
        .selectOption('H-240');
      await sheet
        .getByLabel('Fundición / entrega prevista', { exact: true })
        .fill('2026-10-10');
      await sheet
        .getByLabel('Necesita bomba', { exact: true })
        .selectOption('yes');
      await sheet
        .getByLabel('Acceso para mixer', { exact: true })
        .selectOption('no');
      await sheet
        .getByRole('tab', { name: 'Información comercial', exact: true })
        .click();
      await expect(
        sheet.getByLabel('Obra / referencia *', { exact: true })
      ).toHaveValue(title);
      await sheet
        .getByRole('button', { name: 'Crear oportunidad', exact: true })
        .click();
      await expect(sheet).not.toBeVisible();
      console.log(`smoke:deal-created:${index}`);
      const work = await db
        .from('deals')
        .select('id')
        .eq('title', title)
        .single();
      expect(work.error).toBeNull();
      ids.push(work.data!.id);
    }
    const openWork = async (index: number) => {
      await page.goto(`/pipelines?pipeline=${pipelineId}&deal=${ids[index]}`);
      sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('tab', { name: 'Venta', exact: true }).click();
    };
    await openWork(0);
    await sheet
      .getByLabel('Etapa *', { exact: true })
      .selectOption(stage('negotiation'));
    await sheet.getByLabel('Valor estimado', { exact: true }).fill('1500');
    await sheet
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    await expect(sheet).not.toBeVisible();
    console.log('smoke:negotiation');
    await page.reload();
    sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('tab', { name: 'Venta', exact: true }).click();
    await expect(sheet.getByLabel('Etapa *', { exact: true })).toHaveValue(
      stage('negotiation')
    );
    await sheet
      .getByRole('button', { name: 'No concretado', exact: true })
      .click();
    await sheet
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    await expect(sheet.getByRole('alert')).toContainText('motivo');
    await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(
      (await db.from('deals').select('stage_id').eq('id', ids[0]).single()).data
        ?.stage_id
    ).toBe(stage('negotiation'));
    await openWork(0);
    console.log('smoke:reopened');
    await sheet
      .getByRole('button', { name: 'No concretado', exact: true })
      .click();
    const reasons = await db
      .from('deal_loss_reasons')
      .select('id,code')
      .eq('account_id', accountId);
    await sheet
      .getByLabel('Motivo de no concretado *', { exact: true })
      .selectOption(reasons.data!.find((r) => r.code === 'other')!.id);
    await sheet
      .getByLabel('Explicación del motivo *', { exact: true })
      .fill('Obra ficticia de control QA');
    await sheet
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    await expect(sheet).not.toBeVisible();
    console.log('smoke:lost');
    const persisted = await db
      .from('deals')
      .select('*')
      .eq('id', ids[0])
      .single();
    expect(persisted.data?.status).toBe('lost');
    expect(persisted.data?.estimated_volume_m3).toBe(25.125);
    expect(persisted.data?.loss_reason_detail).toBe(
      'Obra ficticia de control QA'
    );
    await openWork(1);
    await sheet.getByRole('button', { name: 'Ganado', exact: true }).click();
    await sheet
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    await expect(sheet).not.toBeVisible();
    console.log('smoke:won');
    expect(
      (await db.from('deals').select('status').eq('id', ids[1]).single()).data
        ?.status
    ).toBe('won');
    await page.goto('/contacts');
    console.log('smoke:contacts');
    await page
      .getByPlaceholder(/buscar/i)
      .first()
      .fill(`${run} editado`);
    console.log('smoke:contact-search');
    await page.getByText(`${run} editado`, { exact: true }).first().click();
    console.log('smoke:contact-open');
    const opportunitiesTab = page.getByRole('tab', { name: /Oportunidades/ });
    await opportunitiesTab.evaluate((element) => (element as HTMLElement).click());
    console.log('smoke:contact-opportunities');
    const workLink = page.getByRole('link', { name: `${run} Losa`, exact: true });
    await workLink.evaluate((element) => (element as HTMLElement).click());
    console.log('smoke:contact-deal-link');
    sheet = page.getByRole('dialog');
    await expect(
      sheet.getByLabel('Obra / referencia *', { exact: true })
    ).toHaveValue(`${run} Losa`);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const save = sheet.getByRole('button', {
        name: 'Guardar cambios',
        exact: true,
      });
      await expect(save).toBeVisible();
      const box = await save.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await sheet.getByRole('tab', { name: 'Hormigón', exact: true }).click();
      await expect(
        sheet.getByLabel('Resistencia', { exact: true })
      ).toHaveValue('H-240');
      await page.keyboard.press('Tab');
      await expect(sheet.locator(':focus')).toHaveCount(1);
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole('button', { name: /DEMO QA CREACOM/ })
      .last()
      .click();
    await page
      .getByRole('menuitem', { name: 'Cerrar sesión', exact: true })
      .click();
    await expect(page).toHaveURL(/login/);
    await login(page);
    expect(
      (await db.from('deals').select('id').eq('contact_id', contactId)).data
        ?.length
    ).toBe(2);
  } finally {
    if (ids.length)
      await db.from('deals').delete().eq('account_id', accountId).in('id', ids);
    if (contactId)
      await db
        .from('contacts')
        .delete()
        .eq('account_id', accountId)
        .eq('id', contactId);
    await db.auth.signOut();
  }
});
