const mongoose = require('mongoose');
const Agreement = require('../models/Agreement');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalHistory = require('../models/RentalHistory');
const { syncRentalRecord } = require('../services/rentalRecordService');

// Works whether the service exports the object directly or as { notificationService }
const notificationModule = require('../services/notificationService');
const notificationService = notificationModule.notificationService || notificationModule;

const ENDED_STATUSES = ['completed', 'terminated'];

// ---------- helpers ----------

const notifySafely = async (payload) => {
  try {
    await notificationService.createNotification(payload);
  } catch (err) {
    console.error(`[agreements] Notification creation failed: ${err.message}`);
  }
};

// Works for both ObjectId and populated documents
const idOf = (v) => String(v && v._id ? v._id : v);

const loadAgreementForParty = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ error: 'Agreement not found' });
    return {};
  }
  const agreement = await Agreement.findById(id);
  if (!agreement) {
    res.status(404).json({ error: 'Agreement not found' });
    return {};
  }
  const role = agreement.getRoleOf(req.user.id);
  if (!role) {
    res.status(403).json({ error: 'Forbidden: you are not a party to this agreement' });
    return {};
  }
  return { agreement, role };
};

const getPropertyTitle = async (propertyId) => {
  const property = await Property.findById(propertyId).select('title');
  return property?.title || 'your property';
};

const notifyAgreementEnded = async (agreement, reason) => {
  const [tenant, landlord, propertyTitle] = await Promise.all([
    User.findById(agreement.tenantId).select('fullName'),
    User.findById(agreement.landlordId).select('fullName'),
    getPropertyTitle(agreement.propertyId),
  ]);

  const recipients = [
    { id: agreement.tenantId, name: tenant?.fullName },
    { id: agreement.landlordId, name: landlord?.fullName },
  ];

  for (const recipient of recipients) {
    await notifySafely({
      receiverId: recipient.id,
      title: 'Rental agreement ended',
      message: `The rental agreement for "${propertyTitle}" has ended.${
          reason ? ` Reason: "${reason}".` : ''
      } You can now rate the other party from Rental history.`,
      type: 'email',
      event: 'agreement',
      emailTemplate: {
        templateName: 'agreementEnded',
        templateArgs: [recipient.name, propertyTitle, agreement._id.toString()],
      },
    });
  }
};

// ---------- GET /api/agreements/mine/lifecycle ----------

const listMyAgreementsLifecycle = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const userId = String(req.user.id);

    const filter = { $or: [{ tenantId: userId }, { landlordId: userId }] };
    if (req.query.status) {
      filter.status = { $in: String(req.query.status).split(',') };
    }

    const [agreements, total] = await Promise.all([
      Agreement.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('propertyId', 'title address.city')
          .populate('tenantId', 'fullName ratingAvg')
          .populate('landlordId', 'fullName ratingAvg')
          .lean(),
      Agreement.countDocuments(filter),
    ]);

    // "Rated" comes from the rental record, the same rating that feeds the trust score
    const endedIds = agreements.filter((a) => ENDED_STATUSES.includes(a.status)).map((a) => a._id);
    const records = endedIds.length
        ? await RentalHistory.find({ agreementId: { $in: endedIds } })
            .select('agreementId tenantRating landlordRating')
            .lean()
        : [];
    const recordByAgreement = new Map(records.map((r) => [String(r.agreementId), r]));

    const now = new Date();

    const enriched = agreements.map((a) => {
      const myRole = idOf(a.tenantId) === userId ? 'tenant' : 'landlord';
      const counterparty = myRole === 'tenant' ? a.landlordId : a.tenantId;

      const pending = (a.endRequests || []).find((r) => r.status === 'pending') || null;
      const iAmRequester = !!pending && pending.requestedByRole === myRole;
      const requesterUser = pending
          ? pending.requestedByRole === 'tenant'
              ? a.tenantId
              : a.landlordId
          : null;

      const isEnded = ENDED_STATUSES.includes(a.status);
      const record = recordByAgreement.get(String(a._id));
      // tenant rates the landlord (landlordRating); landlord rates the tenant (tenantRating)
      const myRating = record ? (myRole === 'tenant' ? record.landlordRating : record.tenantRating) : null;
      const iRated = myRating != null;
      const isPastEndDate = now >= new Date(a.endDate);

      return {
        _id: a._id,
        agreementNumber: a.agreementNumber,
        status: a.status,
        myRole,
        property: a.propertyId || null,
        counterparty: counterparty
            ? { _id: counterparty._id, fullName: counterparty.fullName, ratingAvg: counterparty.ratingAvg }
            : null,

        startDate: a.startDate,
        endDate: a.endDate,
        monthlyRent: a.monthlyRent,
        deposit: a.deposit,

        tenantSigned: a.tenantSigned,
        landlordSigned: a.landlordSigned,
        signedAt: a.signedAt,

        endRequests: {
          hasPending: !!pending,
          requestedByRole: pending?.requestedByRole || null,
          requester: requesterUser
              ? { _id: requesterUser._id, fullName: requesterUser.fullName }
              : null,
          status: pending?.status || null,
          reason: pending?.reason || null,
          requestedAt: pending?.requestedAt || null,
        },

        // Action flags for the UI
        canInitiateEnd: a.status === 'active' && a.tenantSigned && a.landlordSigned,
        isEarlyEnd: !isPastEndDate,
        canRespondEndRequest: a.status === 'end_requested' && !!pending && !iAmRequester,
        canCancelEndRequest: a.status === 'end_requested' && !!pending && iAmRequester,
        canRate: isEnded && !iRated,
        iRated,
        myRating,

        endedAt: a.endedAt,
        endType: a.endType,
      };
    });

    return res.status(200).json({
      agreements: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------- PATCH /api/agreements/:id/end ----------
// After endDate: ends immediately. Before endDate: creates an end request.

const initiateEndRequest = async (req, res, next) => {
  try {
    const { agreement, role } = await loadAgreementForParty(req, res);
    if (!agreement) return;

    const reason = String(req.body?.reason || '').trim();

    if (agreement.status === 'end_requested') {
      return res.status(409).json({ error: 'An end request is already pending for this agreement' });
    }
    if (agreement.status !== 'active') {
      return res.status(400).json({ error: 'Agreement is not active' });
    }
    if (!agreement.tenantSigned || !agreement.landlordSigned) {
      return res.status(400).json({ error: 'Both parties must sign the agreement before ending it' });
    }
    if (agreement.pendingEndRequest) {
      return res.status(409).json({ error: 'An end request is already pending for this agreement' });
    }

    // Natural end: end date reached, no approval needed
    if (new Date() >= agreement.endDate) {
      agreement.finalize('natural');
      await agreement.save();
      await syncRentalRecord(agreement); // creates/completes the rental history record
      await notifyAgreementEnded(agreement, reason);

      return res.status(200).json({
        agreement,
        outcome: 'completed',
        message: 'Agreement completed. You can now rate the other party from Rental history.',
      });
    }

    // Early end: needs the other party's approval
    if (reason.length < 5) {
      return res.status(400).json({ error: 'A reason (min 5 characters) is required to end the agreement early' });
    }

    agreement.endRequests.push({
      requestedBy: req.user.id,
      requestedByRole: role,
      reason,
    });
    agreement.status = 'end_requested';
    await agreement.save();

    const otherUserId = role === 'tenant' ? agreement.landlordId : agreement.tenantId;
    const propertyTitle = await getPropertyTitle(agreement.propertyId);

    await notifySafely({
      receiverId: otherUserId,
      title: 'End request for rental agreement',
      message: `The ${role} has requested to end the rental agreement for "${propertyTitle}" before the end date. Reason: "${reason}". Please approve or reject the request.`,
      type: 'email',
      event: 'agreement',
      emailTemplate: {
        templateName: 'agreementEndRequested',
        templateArgs: [agreement.agreementNumber, role, reason],
      },
    });

    return res.status(200).json({
      agreement,
      outcome: 'end_requested',
      message: 'End request sent. The other party must approve or reject.',
    });
  } catch (err) {
    return next(err);
  }
};

// ---------- PATCH /api/agreements/:id/end/respond ----------

const respondToEndRequest = async (req, res, next) => {
  try {
    const { action, note } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(422).json({ error: 'Invalid action. Use "approve" or "reject".' });
    }

    const { agreement, role } = await loadAgreementForParty(req, res);
    if (!agreement) return;

    // Pending request raised by the OTHER party
    const pendingRequest = agreement.endRequests.find(
        (r) => r.status === 'pending' && r.requestedByRole !== role
    );
    if (!pendingRequest || agreement.status !== 'end_requested') {
      return res.status(404).json({ error: 'No pending end request found for you to respond to' });
    }

    pendingRequest.respondedAt = new Date();
    if (note) pendingRequest.responseNote = String(note).trim().slice(0, 300);

    if (action === 'approve') {
      pendingRequest.status = 'approved';
      agreement.finalize('early_approved');
      await agreement.save();
      await syncRentalRecord(agreement); // creates/completes the rental history record
      await notifyAgreementEnded(agreement, pendingRequest.reason);

      return res.status(200).json({
        agreement,
        endRequest: pendingRequest,
        message: 'End request approved. Agreement is now terminated.',
      });
    }

    // reject
    pendingRequest.status = 'rejected';
    agreement.status = 'active';
    await agreement.save();

    return res.status(200).json({
      agreement,
      endRequest: pendingRequest,
      message: 'End request rejected. Agreement remains active.',
    });
  } catch (err) {
    return next(err);
  }
};

// ---------- PATCH /api/agreements/:id/cancel-end-request ----------

const cancelEndRequest = async (req, res, next) => {
  try {
    const { agreement } = await loadAgreementForParty(req, res);
    if (!agreement) return;

    const pendingRequest = agreement.endRequests.find(
        (r) => r.status === 'pending' && idOf(r.requestedBy) === String(req.user.id)
    );
    if (!pendingRequest || agreement.status !== 'end_requested') {
      return res.status(404).json({ error: 'No pending end request found for you to cancel' });
    }

    pendingRequest.status = 'cancelled';
    pendingRequest.respondedAt = new Date();
    agreement.status = 'active';
    await agreement.save();

    return res.status(200).json({
      agreement,
      message: 'End request cancelled. Agreement remains active.',
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listMyAgreementsLifecycle,
  initiateEndRequest,
  respondToEndRequest,
  cancelEndRequest,
};