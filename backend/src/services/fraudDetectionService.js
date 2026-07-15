const sharp = require('sharp');
const Document = require('../models/Document');
const User = require('../models/User');

/**
 * Perceptual hashing choice: sharp + a hand-rolled 64-bit average-hash
 * (8x8 grayscale, threshold at the mean, hex-encoded). sharp ships prebuilt
 * binaries (no native compilation), and aHash is deterministic: identical
 * source images always produce identical hashes, which is all the MVP's
 * exact-match duplicate detection needs. Near-duplicates (crops, heavy
 * re-encodes) may hash differently — acceptable for MVP; a Hamming-distance
 * threshold can be layered on later without schema changes.
 */
const computePerceptualHash = async (imageUrl) => {
  if (!imageUrl) return null;
  // OCR/hashing are image-only — PDFs are skipped gracefully.
  if (imageUrl.toLowerCase().split('?')[0].endsWith('.pdf')) return null;

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image (HTTP ${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const pixels = await sharp(buffer)
    .grayscale()
    .resize(8, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  const mean = pixels.reduce((sum, v) => sum + v, 0) / pixels.length;
  const bits = Array.from(pixels, (v) => (v > mean ? '1' : '0'));

  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).join(''), 2).toString(16);
  }
  return hex;
};

/**
 * Exact-hash lookup (MVP: equality, not fuzzy Hamming distance), excluding
 * the document being checked. Returns minimal fields for comparison.
 */
const findDuplicates = async (hash, excludeDocId) =>
  Document.find({ perceptualHash: hash, _id: { $ne: excludeDocId } }).select(
    'tenantId documentType'
  );

/**
 * SOFT HEURISTIC — deliberately unreliable and clearly labeled as such.
 * OCR output is noisy and many legitimate documents don't print the
 * holder's name in a machine-readable way. A "mismatch" here means only
 * "worth an admin's second look", never proof of fraud, and must never
 * auto-reject a document. Empty/missing text produces NO signal.
 */
const checkNameMismatch = (tenantFullName, extractedText) => {
  if (!tenantFullName || !extractedText || !extractedText.trim()) {
    return { mismatch: false };
  }

  const text = extractedText.toLowerCase();
  const nameParts = tenantFullName
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length >= 2); // skip initials — too noisy

  if (!nameParts.length) return { mismatch: false };

  const anyPartFound = nameParts.some((part) => text.includes(part));
  return { mismatch: !anyPartFound };
};

/**
 * Shared check engine used by both the manual endpoint and the automatic
 * post-OCR trigger. Computes/stores the hash, applies duplicate and
 * name-mismatch rules, appends human-readable notes to remarks (without
 * duplicating notes on re-runs), and saves. Returns a summary.
 */
const runChecksById = async (documentId) => {
  const document = await Document.findById(documentId).select('+perceptualHash');
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  const notes = [];

  let hash = document.perceptualHash;
  if (!hash && document.cloudinary?.url) {
    hash = await computePerceptualHash(document.cloudinary.url);
    if (hash) document.perceptualHash = hash;
  }

  if (hash) {
    const duplicates = await findDuplicates(hash, document._id);
    const crossTenant = duplicates.filter(
      (d) => d.tenantId.toString() !== document.tenantId.toString()
    );
    const sameTenant = duplicates.filter(
      (d) => d.tenantId.toString() === document.tenantId.toString()
    );

    if (crossTenant.length) {
      // Primary fraud signal: the same physical document image exists
      // under a different tenant's account.
      document.duplicateDetected = true;
      notes.push(
        'Cross-tenant duplicate: an identical document image has been uploaded by another tenant'
      );
    }
    if (sameTenant.length) {
      // Same tenant re-uploading is usually legitimate — never flag it.
      const sameType = sameTenant.some(
        (d) => d.documentType === document.documentType
      );
      notes.push(
        sameType
          ? 'Resubmission: this tenant previously uploaded the same image for this document type'
          : 'Note: this tenant previously uploaded the same image under a different document type'
      );
    }
  }

  const owner = await User.findById(document.tenantId);
  const { mismatch } = checkNameMismatch(
    owner?.fullName,
    document.extractedData?.rawText
  );
  if (mismatch) {
    document.fraudDetected = true;
    notes.push(
      "Possible mismatch: extracted document text does not appear to contain the tenant's name (soft heuristic — requires admin review, not proof of fraud)"
    );
  }

  for (const note of notes) {
    if (!document.remarks) {
      document.remarks = note;
    } else if (!document.remarks.includes(note)) {
      document.remarks += `; ${note}`;
    }
  }

  await document.save();

  return {
    duplicateDetected: document.duplicateDetected,
    fraudDetected: document.fraudDetected,
    notes,
  };
};

module.exports = {
  computePerceptualHash,
  findDuplicates,
  checkNameMismatch,
  runChecksById,
};
