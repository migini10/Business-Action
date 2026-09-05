import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock WebSocket to avoid Supabase Realtime errors in Node 20
if (typeof global.WebSocket === 'undefined') {
  (global as any).WebSocket = class WebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

import { getDossierDocumentsBucket } from '@/lib/supabase';

describe('getDossierDocumentsBucket', () => {
  let savedBucket: string | undefined;

  beforeEach(() => {
    savedBucket = process.env.SUPABASE_STORAGE_BUCKET;
  });

  afterEach(() => {
    if (savedBucket === undefined) delete process.env.SUPABASE_STORAGE_BUCKET;
    else process.env.SUPABASE_STORAGE_BUCKET = savedBucket;
  });

  it('returns the configured dev bucket name', () => {
    process.env.SUPABASE_STORAGE_BUCKET = 'dossier_documents_dev';
    assert.strictEqual(getDossierDocumentsBucket(), 'dossier_documents_dev');
  });

  it('throws explicitly when the bucket env var is missing, never falling back to a default', () => {
    delete process.env.SUPABASE_STORAGE_BUCKET;
    assert.throws(() => getDossierDocumentsBucket(), /SUPABASE_STORAGE_BUCKET/);
  });
});
