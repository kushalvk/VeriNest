const Property = require('../models/Property');

const MAX_ATTEMPTS = 5; // tax-bill uploads per property before support must step in
const LOW_OCR_CONFIDENCE = 40;
const MAX_BILL_BYTES = 5 * 1024 * 1024;
const ALLOWED_BILL_MIME = ['image/jpeg', 'image/png']; // tesseract.js can't read PDFs
const REVERIFY_ON_ADDRESS_CHANGE = true;
const TAX_BILL_OCR_LANG = process.env.TAX_BILL_OCR_LANG || 'eng';

const tokenize = (s) =>
    String(s || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

/**
 * % of the meaningful tokens in `needle` that appear in `haystack`.
 * Order-insensitive, so "Patel Kushal R" still matches "Kushal Patel".
 * Returns null when there is nothing to compare.
 */
const tokenCoverage = (needle, haystack) => {
    const needed = [...new Set(tokenize(needle).filter((t) => t.length >= 3))];
    if (!needed.length) return null;
    const hay = new Set(tokenize(haystack));
    const found = needed.filter((t) => hay.has(t)).length;
    return Math.round((found / needed.length) * 100);
};

/**
 * Indian financial year starts in April. A bill is "recent" when its start
 * year is the current FY or the one before. null = year could not be read.
 */
const isRecentBillYear = (billYear, now = new Date()) => {
    const m = String(billYear || '').match(/(20\d{2})/);
    if (!m) return null;
    const start = Number(m[1]);
    const currentFyStart =
        now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return start >= currentFyStart - 1 && start <= currentFyStart + 1;
};

const isDuplicateBill = async (propertyId, taxId) => {
    if (!taxId) return false;
    const hit = await Property.exists({
        _id: { $ne: propertyId },
        'verification.ocr.extracted.propertyTaxId': taxId,
    });
    return !!hit;
};

/**
 * Advisory signals shown to the admin next to the bill image.
 * Compares the landlord's name and the entered address against the whole OCR
 * text rather than trusting brittle field extraction.
 */
const buildAutoChecks = async ({ property, landlordName, ocr, now = new Date() }) => {
    const raw = ocr?.rawText || '';
    const addr = property.address || {};
    const addressText = [addr.addressLine, addr.city, addr.pincode]
        .filter(Boolean)
        .join(' ');

    return {
        ownerNameMatch: raw ? tokenCoverage(landlordName, raw) : null,
        addressMatch: raw ? tokenCoverage(addressText, raw) : null,
        billYearValid: isRecentBillYear(ocr?.extracted?.billYear, now),
        duplicateBill: await isDuplicateBill(property._id, ocr?.extracted?.propertyTaxId),
        lowOcrConfidence: !raw || (ocr?.confidence ?? 0) < LOW_OCR_CONFIDENCE,
    };
};

module.exports = {
    MAX_ATTEMPTS,
    MAX_BILL_BYTES,
    ALLOWED_BILL_MIME,
    REVERIFY_ON_ADDRESS_CHANGE,
    TAX_BILL_OCR_LANG,
    tokenCoverage,
    isRecentBillYear,
    isDuplicateBill,
    buildAutoChecks,
};