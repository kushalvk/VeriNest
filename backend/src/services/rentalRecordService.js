const Agreement = require('../models/Agreement');
const Property = require('../models/Property');
const RentalHistory = require('../models/RentalHistory');

const OPEN_STATUSES = ['active', 'end_requested'];
const ENDED_STATUSES = ['completed', 'terminated'];
const TRACKED_STATUSES = [...OPEN_STATUSES, ...ENDED_STATUSES];

const moveOutDateOf = (agreement) =>
    agreement.endType === 'natural' && agreement.endDate
        ? agreement.endDate
        : agreement.endedAt || new Date();

/**
 * Idempotent. Makes sure a rental record exists for an agreement and,
 * when the agreement has ended, completes it (moveOutDate) and relists the property.
 * Never throws, so ending an agreement can't fail because of it.
 */
const syncRentalRecord = async (agreement) => {
    if (!agreement || !TRACKED_STATUSES.includes(agreement.status)) return false;

    // 1) create if missing
    try {
        await RentalHistory.updateOne(
            { agreementId: agreement._id },
            {
                $setOnInsert: {
                    tenantId: agreement.tenantId,
                    landlordId: agreement.landlordId,
                    propertyId: agreement.propertyId,
                    moveInDate: agreement.startDate,
                    rentAmount: agreement.monthlyRent,
                    ...(agreement.deposit != null ? { securityDeposit: agreement.deposit } : {}),
                    paymentStatus: 'clear',
                },
            },
            { upsert: true }
        );
    } catch (err) {
        // A concurrent upsert race is fine only if the record now exists.
        const exists = err.code === 11000 && (await RentalHistory.exists({ agreementId: agreement._id }));
        if (!exists) {
            console.error(
                `[rental-record] Create failed for ${agreement.agreementNumber || agreement._id}: ${err.message}`
            );
            return false;
        }
    }

    if (!ENDED_STATUSES.includes(agreement.status)) return true;

    // 2) complete the record + relist the property
    try {
        await RentalHistory.updateOne(
            { agreementId: agreement._id, moveOutDate: { $exists: false } },
            { $set: { moveOutDate: moveOutDateOf(agreement) } }
        );
        await RentalHistory.updateOne(
            { agreementId: agreement._id, moveOutDate: null },
            { $set: { moveOutDate: moveOutDateOf(agreement) } }
        );

        const stillOccupied = await Agreement.exists({
            propertyId: agreement.propertyId,
            _id: { $ne: agreement._id },
            status: { $in: OPEN_STATUSES },
        });
        if (!stillOccupied) {
            await Property.updateOne(
                { _id: agreement.propertyId, status: 'occupied' },
                { $set: { status: 'available' } }
            );
        }
    } catch (err) {
        console.error(`[rental-record] Completion failed for ${agreement._id}: ${err.message}`);
    }
    return true;
};

/** Creates any missing records for the user's agreements (fixes old data). */
const backfillRecordsForUser = async (userId) => {
    try {
        const agreements = await Agreement.find({
            status: { $in: TRACKED_STATUSES },
            $or: [{ tenantId: userId }, { landlordId: userId }],
        }).lean();
        if (agreements.length === 0) return;

        const existing = await RentalHistory.find({
            agreementId: { $in: agreements.map((a) => a._id) },
        })
            .select('agreementId moveOutDate')
            .lean();
        const byAgreement = new Map(existing.map((r) => [String(r.agreementId), r]));

        let fixed = 0;
        for (const a of agreements) {
            const rec = byAgreement.get(String(a._id));
            const ended = ENDED_STATUSES.includes(a.status);
            if (!rec || (ended && !rec.moveOutDate)) {
                if (await syncRentalRecord(a)) fixed += 1;
            }
        }
        if (fixed > 0) console.log(`[rental-record] Backfilled ${fixed} record(s) for user ${userId}`);
    } catch (err) {
        console.error(`[rental-record] Backfill failed: ${err.message}`);
    }
};

module.exports = { syncRentalRecord, backfillRecordsForUser, ENDED_STATUSES };