/// <reference lib="webworker" />

declare var cv: any;

let isReady = false;
let initPromise: Promise<void> | null = null;

// Initialize OpenCV
function initCV() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    try {
      importScripts('/lib/opencv/opencv.js');

      const checkCV = () => {
        if (typeof cv !== 'undefined' && cv.getBuildInformation) {
          isReady = true;
          resolve();
        } else if (typeof cv !== 'undefined' && cv.onRuntimeInitialized) {
          cv.onRuntimeInitialized = () => {
            isReady = true;
            resolve();
          };
        } else {
          setTimeout(checkCV, 50);
        }
      };

      checkCV();
    } catch (e) {
      reject(e);
    }
  });

  return initPromise;
}

initCV().catch(console.error);

self.onmessage = async (e: MessageEvent) => {
  const { action, payload, id } = e.data;

  try {
    await initCV();

    if (action === 'detectDocumentCorners') {
      const { imageData } = payload; // ImageData
      const result = doDetect(imageData);
      self.postMessage({ id, action, success: true, result });
    } else if (action === 'applyPerspectiveWarp') {
      const { imageData, corners, targetW, targetH } = payload;
      const resultImageData = doWarp(imageData, corners, targetW, targetH);
      // Transfer the buffer back
      self.postMessage({ id, action, success: true, result: resultImageData }, [resultImageData.data.buffer]);
    }
  } catch (error: any) {
    self.postMessage({ id, action, success: false, error: error.message || String(error) });
  }
};

function doDetect(imageData: ImageData) {
  let src = cv.matFromImageData(imageData);
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  let maxApprox = new cv.Mat();
  let corners = null;

  try {
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(src, src, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(src, src, 75, 200);

    cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let maxContourIndex = -1;

    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt);
      if (area > 1000) {
        let peri = cv.arcLength(cnt, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4 && area > maxArea) {
          maxArea = area;
          maxContourIndex = i;
          approx.copyTo(maxApprox);
        }
        approx.delete();
      }
      cnt.delete();
    }

    if (maxContourIndex !== -1) {
      corners = [];
      for (let i = 0; i < 4; i++) {
        corners.push({
          x: maxApprox.data32S[i * 2],
          y: maxApprox.data32S[i * 2 + 1]
        });
      }
    }
  } finally {
    src.delete();
    contours.delete();
    hierarchy.delete();
    maxApprox.delete();
  }

  return corners;
}

function doWarp(imageData: ImageData, realCorners: {x: number, y: number}[], targetW: number, targetH: number): ImageData {
  let src = cv.matFromImageData(imageData);
  let dst = new cv.Mat();
  let dsize = new cv.Size(targetW, targetH);

  let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    realCorners[0].x, realCorners[0].y,
    realCorners[1].x, realCorners[1].y,
    realCorners[2].x, realCorners[2].y,
    realCorners[3].x, realCorners[3].y
  ]);

  let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    targetW, 0,
    targetW, targetH,
    0, targetH
  ]);

  let M = cv.getPerspectiveTransform(srcTri, dstTri);

  try {
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const imgData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
    return imgData;
  } finally {
    src.delete();
    dst.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
  }
}
