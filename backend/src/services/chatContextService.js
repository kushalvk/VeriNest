const TenantProfile = require('../models/TenantProfile');
const Document = require('../models/Document');
const Application = require('../models/Application');
const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const RentalHistory = require('../models/RentalHistory');

/**
 * Builds the scoped data snapshot that becomes the ONLY context the AI
 * assistant ever sees. Security model:
 *  - every query filters by the requesting user's id AT THE QUERY LEVEL —
 *    no post-filtering of broader result sets;
 *  - sensitive values (Aadhaar/PAN/passport numbers, document URLs, OCR
 *    extractedData, other users' PII) are never selected in the first
 *    place, so no prompt instruction is ever the safety boundary.
 */
const buildUserContext = async (userId, role) => {
  if (role === 'tenant') {
    const [profile, documents, applications, rentals] = await Promise.all([
      TenantProfile.findOne({ userId }).select(
        // identity numbers deliberately excluded
        'occupation companyName designation employmentType monthlySalary policeVerificationStatus trustScore trustReason currentAddress.city permanentAddress.city'
      ),
      Document.find({ tenantId: userId }).select(
        'documentType verificationStatus ocrStatus -_id'
      ),
      Application.find({ tenantId: userId })
        .select('status appliedAt propertyId -_id')
        .populate('propertyId', 'title rent address.city -_id'),
      RentalHistory.find({ tenantId: userId }).select(
        'moveInDate moveOutDate rentAmount tenantRating landlordRating paymentStatus -_id'
      ),
    ]);

    return {
      role: 'tenant',
      profile: profile
        ? {
            occupation: profile.occupation,
            companyName: profile.companyName,
            designation: profile.designation,
            employmentType: profile.employmentType,
            monthlySalary: profile.monthlySalary,
            currentCity: profile.currentAddress?.city,
            permanentCity: profile.permanentAddress?.city,
            policeVerificationStatus: profile.policeVerificationStatus,
            trustScore: profile.trustScore,
            trustScoreReasons: profile.trustReason,
          }
        : null,
      documents: documents.map((d) => ({
        documentType: d.documentType,
        verificationStatus: d.verificationStatus,
        ocrStatus: d.ocrStatus,
      })),
      applications: applications.map((a) => ({
        status: a.status,
        appliedAt: a.appliedAt,
        property: a.propertyId
          ? { title: a.propertyId.title, rent: a.propertyId.rent, city: a.propertyId.address?.city }
          : null,
      })),
      rentalHistory: rentals.map((r) => ({
        moveInDate: r.moveInDate,
        moveOutDate: r.moveOutDate,
        rentAmount: r.rentAmount,
        ratingReceivedFromLandlord: r.tenantRating,
        ratingGivenToLandlord: r.landlordRating,
        paymentStatus: r.paymentStatus,
      })),
    };
  }

  if (role === 'landlord') {
    const [properties, applications, agreements] = await Promise.all([
      Property.find({ landlordId: userId }).select('title status rent address.city'),
      Application.find({ landlordId: userId }).select('status propertyId -_id'),
      Agreement.find({ landlordId: userId }).select(
        'agreementNumber status startDate endDate monthlyRent tenantSigned landlordSigned -_id'
      ),
    ]);

    const applicationsByProperty = {};
    const statusBreakdown = { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
    for (const a of applications) {
      statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
      const key = a.propertyId?.toString() || 'unknown';
      applicationsByProperty[key] = (applicationsByProperty[key] || 0) + 1;
    }

    return {
      role: 'landlord',
      properties: properties.map((p) => ({
        title: p.title,
        status: p.status,
        rent: p.rent,
        city: p.address?.city,
        applicationsReceived: applicationsByProperty[p._id.toString()] || 0,
      })),
      applicationsReceived: {
        total: applications.length,
        byStatus: statusBreakdown,
      },
      agreements: agreements.map((g) => ({
        agreementNumber: g.agreementNumber,
        status: g.status,
        startDate: g.startDate,
        endDate: g.endDate,
        monthlyRent: g.monthlyRent,
        tenantSigned: g.tenantSigned,
        landlordSigned: g.landlordSigned,
      })),
    };
  }

  // admins get no data snapshot for now — the assistant is a user-facing
  // helper, not an admin analytics tool
  return { role, note: 'No personal data snapshot is available for this role.' };
};

module.exports = { buildUserContext };
