let worker: Worker | null = null;
let callbackMap = new Map<string, {resolve: Function, reject: Function}>();

export async function loadOpenCV(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!worker) {
    worker = new Worker(new URL('./cv.worker.ts', import.meta.url));
    worker.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      if (callbackMap.has(id)) {
        const { resolve, reject } = callbackMap.get(id)!;
        if (success) resolve(result);
        else reject(new Error(error));
        callbackMap.delete(id);
      }
    };
  }
}

function runInWorker(action: string, payload: any, transferable?: Transferable[]): Promise<any> {
  return new Promise(async (resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    await loadOpenCV();
    if (!worker) return reject(new Error('Worker not available'));

    const id = Math.random().toString(36).substring(7);
    callbackMap.set(id, { resolve, reject });
    worker.postMessage({ id, action, payload }, transferable || []);
  });
}

export async function detectDocumentCorners(canvas: HTMLCanvasElement): Promise<{x: number, y: number}[] | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // imageData.data.buffer is not transferred here to keep preview intact if needed,
  // but we can pass it via normal structured clone. It's small (800px).
  const corners = await runInWorker('detectDocumentCorners', { imageData });
  return corners;
}

export async function applyPerspectiveWarp(
  canvas: HTMLCanvasElement,
  normalizedCorners: {x: number, y: number}[]
): Promise<HTMLCanvasElement> {
  const width = canvas.width;
  const height = canvas.height;

  const realCorners = normalizedCorners.map(p => ({
    x: p.x * width,
    y: p.y * height
  }));

  const w1 = Math.hypot(realCorners[1].x - realCorners[0].x, realCorners[1].y - realCorners[0].y);
  const w2 = Math.hypot(realCorners[2].x - realCorners[3].x, realCorners[2].y - realCorners[3].y);
  const targetW = Math.max(w1, w2);

  const h1 = Math.hypot(realCorners[3].x - realCorners[0].x, realCorners[3].y - realCorners[0].y);
  const h2 = Math.hypot(realCorners[2].x - realCorners[1].x, realCorners[2].y - realCorners[1].y);
  const targetH = Math.max(h1, h2);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("No context");
  const imageData = ctx.getImageData(0, 0, width, height);

  // Transfer the buffer to avoid memory copies. The original canvas might break, but we're done with it.
  const resultImageData = await runInWorker('applyPerspectiveWarp', {
    imageData,
    corners: realCorners,
    targetW,
    targetH
  }, [imageData.data.buffer]);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d');
  outCtx?.putImageData(resultImageData, 0, 0);

  return outCanvas;
}

export function evaluatePhysicalReadability(canvas: HTMLCanvasElement): { isReadable: boolean, blurScore: number, brightness: number, reason?: string } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { isReadable: false, blurScore: 0, brightness: 0, reason: 'CANVAS_ERROR' };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let totalLuminance = 0;
  const gray = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalLuminance += luminance;
    gray[i / 4] = luminance;
  }

  const avgBrightness = totalLuminance / (canvas.width * canvas.height);

  if (avgBrightness < 30) return { isReadable: false, blurScore: 0, brightness: avgBrightness, reason: 'TOO_DARK' };
  if (avgBrightness > 230) return { isReadable: false, blurScore: 0, brightness: avgBrightness, reason: 'TOO_BRIGHT' };

  let mean = 0;
  let variance = 0;
  const width = canvas.width;
  const height = canvas.height;

  const laplacian = new Float32Array(width * height);
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val =
        -1 * gray[idx - width - 1] - 1 * gray[idx - width] - 1 * gray[idx - width + 1]
        -1 * gray[idx - 1]         + 8 * gray[idx]         - 1 * gray[idx + 1]
        -1 * gray[idx + width - 1] - 1 * gray[idx + width] - 1 * gray[idx + width + 1];
      laplacian[idx] = val;
      mean += val;
      count++;
    }
  }

  mean /= count;
  for (let i = 0; i < laplacian.length; i++) {
    if (laplacian[i] !== 0) {
      variance += Math.pow(laplacian[i] - mean, 2);
    }
  }
  variance /= count;

  if (variance < 50) return { isReadable: false, blurScore: variance, brightness: avgBrightness, reason: 'TOO_BLURRY' };

  return { isReadable: true, blurScore: variance, brightness: avgBrightness, reason: 'OK' };
}
