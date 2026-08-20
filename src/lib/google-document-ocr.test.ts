import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import { evaluateDocumentReadability } from './google-document-ocr';
import * as vision from '@google-cloud/vision';

describe('Google Document OCR', () => {
  const originalDetect = vision.ImageAnnotatorClient.prototype.documentTextDetection;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GOOGLE_CREDENTIALS_B64: Buffer.from(JSON.stringify({ client_email: 'test@test.com', private_key: 'test' })).toString('base64'), OCR_MODE: 'ENFORCE' };
  });

  afterEach(() => {
    vision.ImageAnnotatorClient.prototype.documentTextDetection = originalDetect;
    process.env = originalEnv;
  });

  test('should return OCR_CONFIG_ERROR if credentials are not configured', async () => {
    process.env = { ...originalEnv }; // No credentials
    const result = await evaluateDocumentReadability(Buffer.from('fake'));

    assert.strictEqual(result.error, true);
    assert.strictEqual(result.isReadable, true); // FAIL-OPEN
    assert.strictEqual(result.reason, 'OCR_CONFIG_ERROR');
  });

  test('should return OCR_UNAVAILABLE if google client throws (e.g. 5xx/Timeout)', async () => {
    vision.ImageAnnotatorClient.prototype.documentTextDetection = async () => {
      throw new Error('500 Internal Server Error');
    };

    const result = await evaluateDocumentReadability(Buffer.from('fake'), 0); // Disable retry for test

    assert.strictEqual(result.error, true);
    assert.strictEqual(result.isReadable, true); // FAIL-OPEN
    assert.strictEqual(result.reason, 'OCR_UNAVAILABLE');
  });

  test('should reject if words < 15 in ENFORCE mode', async () => {
    vision.ImageAnnotatorClient.prototype.documentTextDetection = async () => {
      return [{
        fullTextAnnotation: {
          pages: [{
            blocks: [{
              paragraphs: [{
                words: [
                  { symbols: [{ text: 'a' }], confidence: 0.9 },
                  { symbols: [{ text: 'b' }], confidence: 0.8 },
                  { symbols: [{ text: 'c' }], confidence: 0.7 }
                ]
              }]
            }]
          }]
        }
      }] as any;
    };

    const result = await evaluateDocumentReadability(Buffer.from('fake'));

    assert.strictEqual(result.isReadable, false);
    assert.strictEqual(result.wordCount, 3);
    assert.strictEqual(result.characterCount, 3);
    assert.strictEqual(Math.round(result.averageConfidence! * 100) / 100, 0.8);
    assert.strictEqual(result.reason, 'INSUFFICIENT_TEXT');
  });

  test('should accept if words >= 15 in ENFORCE mode', async () => {
    vision.ImageAnnotatorClient.prototype.documentTextDetection = async () => {
      return [{
        fullTextAnnotation: {
          pages: [{
            blocks: [{
              paragraphs: [{
                words: new Array(20).fill({ symbols: [{ text: 'x' }], confidence: 0.95 })
              }]
            }]
          }]
        }
      }] as any;
    };

    const result = await evaluateDocumentReadability(Buffer.from('fake'));

    assert.strictEqual(result.isReadable, true);
    assert.strictEqual(result.wordCount, 20);
    assert.strictEqual(result.characterCount, 20);
    assert.strictEqual(Math.round(result.averageConfidence! * 100) / 100, 0.95);
    assert.strictEqual(result.reason, 'OK');
  });

  test('should always accept in OBSERVE mode', async () => {
    process.env.OCR_MODE = 'OBSERVE';
    vision.ImageAnnotatorClient.prototype.documentTextDetection = async () => {
      return [{
        fullTextAnnotation: {
          pages: [{
            blocks: [{
              paragraphs: [{
                words: [
                  { symbols: [{ text: 'a' }], confidence: 0.9 }
                ]
              }]
            }]
          }]
        }
      }] as any;
    };

    const result = await evaluateDocumentReadability(Buffer.from('fake'));

    assert.strictEqual(result.isReadable, true); // OBSERVE mode does not reject
    assert.strictEqual(result.wordCount, 1);
    assert.strictEqual(result.characterCount, 1);
    assert.strictEqual(result.reason, 'OK');
  });
});
