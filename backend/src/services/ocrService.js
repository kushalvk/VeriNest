const os = require('os');
const path = require('path');
const { createWorker } = require('tesseract.js');

const OCR_TIMEOUT_MS = parseInt(process.env.OCR_TIMEOUT_MS, 10) || 15000;

// Keep tesseract's downloaded language data out of the repo. On serverless
// (Vercel) the deployment bundle is read-only — /tmp is the only writable
// path, at the cost of re-downloading the language data on cold starts.
const CACHE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'tesseract')
  : path.join(__dirname, '../../node_modules/.cache/tesseract');

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`OCR timed out after ${ms}ms`)),
        ms
      );
      timer.unref();
    }),
  ]);

/**
 * Runs Tesseract OCR on an image URL. Resolves { rawText, confidence } or
 * throws (bad image, network failure, or timeout). OCR_TIMEOUT_MS is a
 * single deadline for the whole operation (worker startup + recognition),
 * and the worker is always terminated — including when the deadline fires
 * mid-flight — so nothing keeps running behind an answered request.
 */
const extractText = async (imageUrl) => {
  let worker = null;
  let finished = false;

  const run = async () => {
    const w = await createWorker('eng', 1, {
      cachePath: CACHE_PATH,
      // Without this, tesseract.js rethrows job failures as an async
      // uncaught exception AFTER rejecting the promise, killing the whole
      // process. The rejection alone is what callers handle.
      errorHandler: (err) => console.warn(`[ocr] worker error: ${err}`),
    });
    if (finished) {
      // Deadline already fired while the worker was starting up.
      w.terminate().catch(() => {});
      throw new Error('OCR timed out');
    }
    worker = w;
    const { data } = await w.recognize(imageUrl);
    return {
      rawText: (data.text || '').trim(),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };
  };

  try {
    return await withTimeout(run(), OCR_TIMEOUT_MS);
  } finally {
    finished = true;
    if (worker) worker.terminate().catch(() => {});
  }
};

/**
 * Best-effort field extraction from raw OCR text. Not guaranteed accurate —
 * the goal is to populate extractedData, not perfect parsing.
 */
const parseBasicFields = (rawText, documentType) => {
  const fields = {};
  const text = rawText || '';

  if (documentType === 'aadhaar') {
    // 12 digits, commonly printed as 4-4-4 groups
    const m = text.match(/\b(\d{4})\s?(\d{4})\s?(\d{4})\b/);
    if (m) fields.aadhaarNumber = m[1] + m[2] + m[3];
  }
  if (documentType === 'pan') {
    const m = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
    if (m) fields.panNumber = m[0];
  }
  // Dates (dd/mm/yyyy or dd-mm-yyyy) show up on most identity documents
  const date = text.match(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/);
  if (date) fields.dateFound = date[1];

  return fields;
};

module.exports = { extractText, parseBasicFields, OCR_TIMEOUT_MS };
