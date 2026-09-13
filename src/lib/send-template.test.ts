import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { sendWhatsAppTemplate } from './whatsapp/send-template';

describe('sendWhatsAppTemplate', () => {
  let originalFetch: any;
  let originalToken: string | undefined;
  let originalPhoneId: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
    originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN; else process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    if (originalPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID; else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;
  });

  it('appelle le template password_recovery_link_dev avec le bon payload (environnement DEV)', async () => {
    let capturedBody: any = null;
    global.fetch = mock.fn(async (_url: string, options: any) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) };
    }) as any;

    const res = await sendWhatsAppTemplate('221770000000', 'password_recovery_link_dev', 'tokenDev123', 'fr');

    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedBody.template.name, 'password_recovery_link_dev');
    assert.strictEqual(capturedBody.template.components[0].parameters[0].text, 'tokenDev123');
  });

  it('appelle le template password_recovery_link avec le bon payload (bouton URL dynamique, paramètre minimal)', async () => {
    let capturedUrl: any = null;
    let capturedBody: any = null;
    global.fetch = mock.fn(async (url: string, options: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) };
    }) as any;

    const res = await sendWhatsAppTemplate('221770000000', 'password_recovery_link', 'abc123token', 'fr');

    assert.strictEqual(res.success, true);
    assert.match(capturedUrl, /graph\.facebook\.com\/v17\.0\/test-phone-id\/messages/);
    assert.strictEqual(capturedBody.to, '221770000000');
    assert.strictEqual(capturedBody.template.name, 'password_recovery_link');
    assert.strictEqual(capturedBody.template.language.code, 'fr');
    assert.strictEqual(capturedBody.template.components.length, 1);
    assert.strictEqual(capturedBody.template.components[0].sub_type, 'url');
    assert.strictEqual(capturedBody.template.components[0].parameters.length, 1);
    assert.strictEqual(capturedBody.template.components[0].parameters[0].text, 'abc123token', "Le bouton dynamique ne doit contenir que le token, rien d'autre");
  });

  it('erreur Meta (ex: template non approuvé) => gérée proprement, aucun throw', async () => {
    global.fetch = mock.fn(async () => ({
      ok: false,
      json: async () => ({ error: { message: 'Template not approved' } }),
    })) as any;

    const res = await sendWhatsAppTemplate('221770000000', 'password_recovery_link', 'abc123token', 'fr');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Template not approved');
  });

  it('erreur réseau => gérée proprement, aucun throw', async () => {
    global.fetch = mock.fn(async () => { throw new Error('network down'); }) as any;

    const res = await sendWhatsAppTemplate('221770000000', 'password_recovery_link', 'abc123token', 'fr');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Erreur réseau.');
  });

  it('secrets absents => échec explicite, aucun appel réseau', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    let fetchCalled = false;
    global.fetch = mock.fn(async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; }) as any;

    const res = await sendWhatsAppTemplate('221770000000', 'password_recovery_link', 'abc123token', 'fr');
    assert.strictEqual(res.success, false);
    assert.strictEqual(fetchCalled, false);
  });
});
