import test from 'node:test';
import assert from 'node:assert';
import { convertIfHeic, MAX_SOURCE_FILE_SIZE, MAX_FINAL_FILE_SIZE } from './heic-converter';

test('heic-converter', async (t) => {
  await t.test('constants should be set correctly', () => {
    assert.strictEqual(MAX_SOURCE_FILE_SIZE, 15 * 1024 * 1024);
    assert.strictEqual(MAX_FINAL_FILE_SIZE, 4 * 1024 * 1024);
  });

  // Note: we can't easily mock dynamic imports of 'heic-to' in native node:test without complicated setup,
  // but we can test the bypass mechanism for non-HEIC files
  await t.test('bypasses jpeg/png files', async () => {
    const file = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
    const result = await convertIfHeic(file);
    assert.strictEqual(result, file); // Should return exact same reference
  });
});
