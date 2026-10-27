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
 *
 * `lang` defaults to 'eng'. Pass e.g. 'eng+guj' for Gujarati bills (slower:
 * downloads extra language data on first use).
 */
const extractText = async (imageUrl, lang = 'eng') => {
  let worker = null;
  let finished = false;

  const run = async () => {
    const w = await createWorker(lang, 1, {
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

/**
 * Best-effort extraction for Indian municipal house/property tax bills.
 * Layouts differ per municipality, so every field is optional. The admin
 * always reviews the original image — these only pre-fill the review screen
 * and feed the advisory auto-checks.
 */
const parseTaxBillFields = (rawText) => {
  const text = (rawText || '').replace(/\r/g, '');
  const fields = {};

  const pick = (re) => {
    const m = text.match(re);
    return m && m[1] ? m[1].trim() : undefined;
  };

  const propertyTaxId = pick(
      /(?:property|assessment|tenement|house|unit)\s*(?:tax\s*)?(?:no|number|id|code)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/-]{3,24})/i
  );
  if (propertyTaxId) fields.propertyTaxId = propertyTaxId.toUpperCase();

  const ownerName = pick(
      /(?:name\s+of\s+(?:the\s+)?(?:owner|assessee)|owner(?:'s)?\s*name|owner|assessee)\s*[:\-]\s*([^\n]{3,60})/i
  );
  if (ownerName) fields.ownerName = ownerName.replace(/[^A-Za-z .]/g, '').trim();

  // Financial year like 2025-26 / 2025-2026
  const fy = text.match(/\b(20\d{2})\s*[-–/]\s*(\d{2,4})\b/);
  if (fy) {
    fields.billYear = `${fy[1]}-${fy[2]}`;
  } else {
    const y = pick(/(?:financial\s*year|fy|year)\s*[:\-]?\s*(20\d{2})/i);
    if (y) fields.billYear = y;
  }

  const amount = pick(
      /(?:total|net|amount\s*(?:payable|due|paid)?|payable)\s*(?:tax\s*)?(?:₹|rs\.?|inr)?\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (amount) fields.amount = amount;

  return fields;
};

module.exports = {
  extractText,
  parseBasicFields,
  parseTaxBillFields,
  OCR_TIMEOUT_MS,
};