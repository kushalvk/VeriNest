const Agreement = require('../models/Agreement');
const User = require('../models/User');
const Property = require('../models/Property');
const notificationModule = require('../services/notificationService');
const notificationService = notificationModule.notificationService || notificationModule;
const { syncRentalRecord } = require('../services/rentalRecordService');

const OPEN_STATUSES = ['active', 'end_requested'];

const notifySafely = async (payload) => {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error(`[cron] Notification creation failed: ${err.message}`);
  }
};

const autoEndAgreements = async () => {
  try {
    const now = new Date();

    const due = await Agreement.find({
      status: { $in: OPEN_STATUSES },
      endDate: { $lte: now },
      tenantSigned: true,
      landlordSigned: true,
    })
        .select('_id')
        .lean();

    let endedCount = 0;

    for (const { _id } of due) {
      // Atomic: only one writer wins if a user ends the agreement at the same moment.
      const agreement = await Agreement.findOneAndUpdate(
          { _id, status: { $in: OPEN_STATUSES } },
          { $set: { status: 'completed', endType: 'natural', endedAt: now } },
          { new: true }
      );
      if (!agreement) continue;
      await syncRentalRecord(agreement);

      // Close any still-pending early-end request (safe even if the array is missing).
      await Agreement.updateOne(
          { _id, 'endRequests.status': 'pending' },
          { $set: { 'endRequests.$[p].status': 'cancelled', 'endRequests.$[p].respondedAt': now } },
          { arrayFilters: [{ 'p.status': 'pending' }] }
      );

      endedCount += 1;

      const [tenant, landlord, property] = await Promise.all([
        User.findById(agreement.tenantId).select('fullName'),
        User.findById(agreement.landlordId).select('fullName'),
        Property.findById(agreement.propertyId).select('title'),
      ]);
      const propertyTitle = property?.title || 'your property';

      for (const recipient of [
        { id: agreement.tenantId, name: tenant?.fullName },
        { id: agreement.landlordId, name: landlord?.fullName },
      ]) {
        await notifySafely({
          receiverId: recipient.id,
          title: 'Rental agreement completed',
          message: `The rental agreement for "${propertyTitle}" has been completed because it reached its end date (${agreement.endDate.toLocaleDateString('en-IN')}). You can now rate the other party.`,
          type: 'email',
          event: 'agreement',
          emailTemplate: {
            templateName: 'agreementEnded',
            templateArgs: [recipient.name, propertyTitle, agreement._id.toString()],
          },
        });
      }
    }

    if (endedCount > 0) console.log(`[cron] Auto-completed ${endedCount} agreement(s)`);
  } catch (err) {
    console.error(`[cron] Auto-end agreements failed: ${err.message}`);
  }
};

module.exports = { autoEndAgreements };