import { ImageAnnotatorClient } from '@google-cloud/vision';

// Instanciation lazy du client pour éviter de crasher si les variables ne sont pas là au boot
let visionClient: ImageAnnotatorClient | null = null;
let isConfigured = false;

function getVisionClient(): ImageAnnotatorClient | null {
  if (visionClient) return visionClient;

  try {
    const b64 = process.env.GOOGLE_CREDENTIALS_B64;
    const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (b64) {
      const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
      visionClient = new ImageAnnotatorClient({
        credentials,
        apiEndpoint: 'eu-vision.googleapis.com',
      });
      isConfigured = true;
    } else if (clientEmail && privateKey && projectId) {
      visionClient = new ImageAnnotatorClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'), // handle newlines in env vars
        },
        projectId,
        apiEndpoint: 'eu-vision.googleapis.com',
      });
      isConfigured = true;
    } else {
      console.error("CRITICAL: Google Vision OCR missing credentials.");
      isConfigured = false;
    }
  } catch (error) {
    console.error("Google Vision OCR: Error initializing client", error);
    isConfigured = false;
  }

  return visionClient;
}

export interface ReadabilityResult {
  isReadable: boolean;
  wordCount: number;
  characterCount: number;
  averageConfidence: number | null;
  reason?: string;
  error?: boolean;
}

export async function evaluateDocumentReadability(buffer: Buffer, retryCount = 1): Promise<ReadabilityResult> {
  const client = getVisionClient();

  if (!isConfigured || !client) {
    return { isReadable: true, wordCount: 0, characterCount: 0, averageConfidence: null, reason: 'OCR_CONFIG_ERROR', error: true };
  }

  try {
    const [result] = await client.documentTextDetection(buffer);
    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.pages) {
      return { isReadable: false, wordCount: 0, characterCount: 0, averageConfidence: null, reason: 'NO_TEXT_DETECTED' };
    }

    let wordCount = 0;
    let characterCount = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const page of fullTextAnnotation.pages) {
      if (page.blocks) {
        for (const block of page.blocks) {
          if (block.paragraphs) {
            for (const paragraph of block.paragraphs) {
              if (paragraph.words) {
                for (const word of paragraph.words) {
                  wordCount++;
                  if (word.symbols) {
                    characterCount += word.symbols.length;
                  }
                  if (word.confidence) {
                    totalConfidence += word.confidence;
                    confidenceCount++;
                  }
                }
              }
            }
          }
        }
      }
    }

    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : null;

    const mode = process.env.OCR_MODE || 'OBSERVE';
    let isReadable = true;

    if (mode === 'ENFORCE') {
      const MIN_WORDS = 15;
      isReadable = wordCount >= MIN_WORDS;
    }

    return {
      isReadable,
      wordCount,
      characterCount,
      averageConfidence,
      reason: isReadable ? 'OK' : 'INSUFFICIENT_TEXT'
    };

  } catch (error) {
    // console.error intentionnellement réduit pour ne pas logguer les payloads sensibles
    console.error("Google Vision OCR Error (API failed).");
    if (retryCount > 0) {
      return evaluateDocumentReadability(buffer, retryCount - 1);
    }

    // Fail-open
    return { isReadable: true, wordCount: 0, characterCount: 0, averageConfidence: null, reason: 'OCR_UNAVAILABLE', error: true };
  }
}
