import test from 'node:test';
import assert from 'node:assert';
import { GET, POST } from '../app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

test('WhatsApp Webhook GET', async (t) => {
  process.env.WHATSAPP_VERIFY_TOKEN = 'test_token';

  await t.test('Correct token and mode', async () => {
    const req = new NextRequest('http://localhost/api?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=12345');
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), '12345');
  });

  await t.test('Bad token', async () => {
    const req = new NextRequest('http://localhost/api?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123');
    const res = await GET(req);
    assert.strictEqual(res.status, 403);
  });

  await t.test('Bad mode', async () => {
    const req = new NextRequest('http://localhost/api?hub.mode=unsubscribe&hub.verify_token=test_token&hub.challenge=123');
    const res = await GET(req);
    assert.strictEqual(res.status, 403);
  });
});

test('WhatsApp Webhook POST', async (t) => {
  process.env.WHATSAPP_APP_SECRET = 'test_secret';

  const generateSignature = (body: string) => {
    return 'sha256=' + crypto.createHmac('sha256', 'test_secret').update(body).digest('hex');
  };

  await t.test('Valid signature', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: {
        'x-hub-signature-256': generateSignature(body)
      }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
  });

  await t.test('Invalid signature', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: {
        'x-hub-signature-256': 'sha256=invalidhash'
      }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
  });

  await t.test('Missing signature', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
  });

  await t.test('Malformed signature header', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: {
        'x-hub-signature-256': 'md5=something'
      }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
  });

  await t.test('Malformed JSON with valid signature', async () => {
    const body = '{"object": "whatsapp_business_account", badjson';
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: {
        'x-hub-signature-256': generateSignature(body)
      }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400); // Because we implemented it to return 400 for bad JSON
  });

  await t.test('Empty body with valid signature', async () => {
    const body = '';
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: {
        'x-hub-signature-256': generateSignature(body)
      }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400); // Empty body fails JSON parse
  });

  await t.test('Webhook status sent', async () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (msg: string) => logs.push(msg);

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: 'wamid.HBgL_SENT',
              status: 'sent'
            }]
          }
        }]
      }]
    });

    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: { 'x-hub-signature-256': generateSignature(body) }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    console.log = originalLog;
    assert.strictEqual(logs.length, 1);
    const parsedLog = JSON.parse(logs[0]);
    assert.strictEqual(parsedLog.status, 'sent');
    assert.strictEqual(parsedLog.messageIdMasked, 'wamid.HBgL_SENT...');
  });

  await t.test('Webhook status delivered', async () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (msg: string) => logs.push(msg);

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: 'wamid.HBgL_DELIVERED',
              status: 'delivered'
            }]
          }
        }]
      }]
    });

    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: { 'x-hub-signature-256': generateSignature(body) }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    console.log = originalLog;
    assert.strictEqual(logs.length, 1);
    const parsedLog = JSON.parse(logs[0]);
    assert.strictEqual(parsedLog.status, 'delivered');
  });

  await t.test('Webhook status failed with error code', async () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (msg: string) => logs.push(msg);

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: 'wamid.HBgL_FAILED_123',
              status: 'failed',
              errors: [{
                code: 131051,
                title: 'Message type is not supported',
                message: 'Message type is not supported'
              }]
            }]
          }
        }]
      }]
    });

    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body,
      headers: { 'x-hub-signature-256': generateSignature(body) }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    console.log = originalLog;
    assert.strictEqual(logs.length, 1);
    const parsedLog = JSON.parse(logs[0]);
    assert.strictEqual(parsedLog.status, 'failed');
    assert.strictEqual(parsedLog.errorCode, 131051);
    assert.strictEqual(parsedLog.errorTitle, 'Message type is not supported');
    assert.strictEqual(parsedLog.errorMessage, 'Message type is not supported');
  });
});
