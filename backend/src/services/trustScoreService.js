const mongoose = require('mongoose');
const TenantProfile = require('../models/TenantProfile');
const Document = require('../models/Document');
const TrustScoreHistory = require('../models/TrustScoreHistory');

const POINTS_PER_VERIFIED_DOC = 15;
const MAX_COUNTED_DOC_TYPES = 3;
const POINTS_POLICE_VERIFIED = 15;
const POINTS_ADDRESSES_COMPLETE = 10;
const POINTS_SALARY = 10;
const POINTS_PER_RATING_STAR_ABOVE_3 = 2;
const MAX_RATING_POINTS = 10;

/**
 * Pure rule-based scoring — no DB access, fully deterministic, so it can be
 * unit-tested with plain objects. Only rules that actually contributed
 * appear in reasons.
 *
 * @param {object|null} profile          TenantProfile (or null if none yet)
 * @param {Array} verifiedDocuments      Documents with verificationStatus "verified"
 * @param {Array|null} rentalHistory     Reserved for post-MVP; ignored when null/empty
 */
const computeTrustScore = (profile, verifiedDocuments = [], rentalHistory = null) => {
  let score = 0;
  const reasons = [];

  // Distinct verified document types, capped
  const distinctTypes = [
    ...new Set(
      (verifiedDocuments || [])
        .filter((d) => d && d.verificationStatus === 'verified' && d.documentType)
        .map((d) => d.documentType)
    ),
  ];
  for (const type of distinctTypes.slice(0, MAX_COUNTED_DOC_TYPES)) {
    score += POINTS_PER_VERIFIED_DOC;
    reasons.push(`Verified ${type.replace(/_/g, ' ')} document (+${POINTS_PER_VERIFIED_DOC})`);
  }

  if (profile?.policeVerificationStatus === 'verified') {
    score += POINTS_POLICE_VERIFIED;
    reasons.push(`Police verification completed (+${POINTS_POLICE_VERIFIED})`);
  }

  if (profile?.currentAddress?.city && profile?.permanentAddress?.city) {
    score += POINTS_ADDRESSES_COMPLETE;
    reasons.push(`Profile addresses complete (+${POINTS_ADDRESSES_COMPLETE})`);
  }

  if (typeof profile?.monthlySalary === 'number' && profile.monthlySalary > 0) {
    score += POINTS_SALARY;
    reasons.push(`Employment salary information provided (+${POINTS_SALARY})`);
  }

  // Rental history ratings: average of landlord-given ratings (tenantRating).
  // +2 per full star above 3 (avg 4 → +2, avg 5 → +4), capped at +10.
  // Skipped entirely when no rated rental history exists.
  if (Array.isArray(rentalHistory) && rentalHistory.length > 0) {
    const ratings = rentalHistory
      .map((r) => r?.tenantRating)
      .filter((v) => typeof v === 'number' && v >= 1 && v <= 5);
    if (ratings.length > 0) {
      const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
      const bonus = Math.min(
        MAX_RATING_POINTS,
        Math.max(0, Math.floor(avg - 3) * POINTS_PER_RATING_STAR_ABOVE_3)
      );
      if (bonus > 0) {
        score += bonus;
        reasons.push(`Positive rental history rating (+${bonus})`);
      }
    }
  }

  return { score: Math.min(100, Math.max(0, score)), reasons };
};

/**
 * Fetches the inputs and runs the pure calculation. No DB writes.
 */
const calculateTrustScore = async (tenantId) => {
  const [profile, verifiedDocuments] = await Promise.all([
    TenantProfile.findOne({ userId: tenantId }),
    Document.find({ tenantId, verificationStatus: 'verified' }),
  ]);

  // Rental history: model doesn't exist yet (post-MVP) — look it up
  // defensively instead of importing a module that isn't there.
  let rentalHistory = null;
  try {
    const RentalHistory = mongoose.models.RentalHistory;
    if (RentalHistory) {
      rentalHistory = await RentalHistory.find({ tenantId });
    }
  } catch (err) {
    console.warn(`[trust-score] Rental history lookup skipped: ${err.message}`);
  }

  return computeTrustScore(profile, verifiedDocuments, rentalHistory);
};

/**
 * Recalculates and persists: updates TenantProfile (when one exists) and
 * always appends a TrustScoreHistory record. Used by both the admin HTTP
 * endpoint (generatedBy "Admin") and internal triggers ("System").
 */
const recalculateAndPersist = async (tenantId, generatedBy = 'System') => {
  const { score, reasons } = await calculateTrustScore(tenantId);

  const profile = await TenantProfile.findOneAndUpdate(
    { userId: tenantId },
    { trustScore: score, trustReason: reasons },
    { new: true }
  );

  await TrustScoreHistory.create({ tenantId, score, reasons, generatedBy });

  return { score, reasons, profileUpdated: Boolean(profile) };
};

module.exports = { computeTrustScore, calculateTrustScore, recalculateAndPersist };
