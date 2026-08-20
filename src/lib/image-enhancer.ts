import sharp from 'sharp';

const CLAHE_LIGHT = { width: 100, height: 100, maxSlope: 2 };
const CLAHE_DOCUMENT = { width: 100, height: 100, maxSlope: 4 };

export async function enhanceImageBuffer(
  buffer: Buffer,
  brightness: number = 1.0,
  contrast: number = 1.0,
  sharpness: number = 0,
  mode: 'Auto' | 'Clair' | 'Noir & Blanc' = 'Auto',
  isPreview: boolean = false
): Promise<Buffer> {
  // Bornage par sécurité côté backend
  const safeBrightness = Math.max(0.85, Math.min(1.25, brightness));
  const safeContrast = Math.max(0.85, Math.min(1.30, contrast));
  const safeSharpness = Math.max(0, Math.min(2.0, sharpness));

  const applyPipeline = () => {
    let pipeline = sharp(buffer);

    // 1. Grayscale si Noir & Blanc
    if (mode === 'Noir & Blanc') {
      pipeline = pipeline.grayscale();
    }

    // 2. CLAHE selon le mode
    if (mode === 'Auto') {
      pipeline = pipeline.clahe(CLAHE_LIGHT);
    } else {
      pipeline = pipeline.clahe(CLAHE_DOCUMENT);
    }

    // 3. Luminosité (Brightness via modulate)
    if (safeBrightness !== 1.0) {
      pipeline = pipeline.modulate({ brightness: safeBrightness });
    }

    // 4. Contraste (Contrast via linear)
    if (safeContrast !== 1.0) {
      const a = safeContrast;
      const b = 128 * (1 - a);
      pipeline = pipeline.linear(a, b);
    }

    // 5. Netteté (Sharpness via unsharp mask)
    if (safeSharpness > 0) {
      pipeline = pipeline.sharpen({ sigma: safeSharpness });
    }

    return pipeline;
  };

  if (isPreview) {
    return applyPipeline()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } else {
    let quality = 90;
    let finalBuffer = await applyPipeline().jpeg({ quality }).toBuffer();

    while (finalBuffer.length > 4194304 && quality > 60) {
      quality -= 10;
      finalBuffer = await applyPipeline().jpeg({ quality }).toBuffer();
    }

    // Si toujours > 4MB, réduire la résolution
    if (finalBuffer.length > 4194304) {
      finalBuffer = await applyPipeline()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
    }
    return finalBuffer;
  }
}
