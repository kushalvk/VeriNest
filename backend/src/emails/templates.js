/**
 * One function per lifecycle event, each returning { subject, html, text }.
 * html uses the shared branded shell; text is a genuinely readable
 * plain-text equivalent for clients that don't render HTML.
 *
 * Security invariant: emails only ever link BACK to the platform. No raw
 * document URLs, access tokens, or identity numbers may appear here.
 */
const { renderBase, ctaButton, escapeHtml, BRAND_NAME } = require('./baseTemplate');

// Read at call time (not module load) so dotenv ordering never matters.
const frontendUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const link = (path) => `${frontendUrl()}${path}`;

// Escaped greeting-safe name with a fallback for missing lookups.
const name = (value) =>
  escapeHtml(typeof value === 'string' && value.trim() ? value.trim() : 'there');
const plainName = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : 'there';

const paragraph = (html) => `<p style="margin:0 0 16px;">${html}</p>`;
const heading = (text) =>
  `<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1e293b;">${text}</h1>`;

const textFooter = `\n\n— ${BRAND_NAME}\nThis is an automated message; please do not reply.`;

const applicationSubmitted = (landlordName, tenantName, propertyTitle) => {
  const url = link('/received-applications');
  return {
    subject: 'New Application Received',
    html: renderBase(
      heading('New application received') +
        paragraph(`Hi ${name(landlordName)},`) +
        paragraph(
          `<strong>${name(tenantName)}</strong> has applied for your property ` +
            `<strong>${escapeHtml(propertyTitle)}</strong>. You can review their ` +
            `application and respond from your dashboard.`
        ) +
        ctaButton('View Application', url)
    ),
    text:
      `Hi ${plainName(landlordName)},\n\n` +
      `${plainName(tenantName)} has applied for your property "${propertyTitle}". ` +
      `You can review their application and respond from your dashboard.\n\n` +
      `View the application: ${url}` +
      textFooter,
  };
};

const applicationAccepted = (tenantName, propertyTitle) => {
  const url = link('/my-applications');
  return {
    subject: 'Your Application Was Accepted 🎉',
    html: renderBase(
      heading('Congratulations — you were accepted! 🎉') +
        paragraph(`Hi ${name(tenantName)},`) +
        paragraph(
          `Great news: your application for <strong>${escapeHtml(propertyTitle)}</strong> ` +
            `has been <strong>accepted</strong> by the landlord.`
        ) +
        paragraph(
          `Next steps: the landlord may request access to your verification documents ` +
            `and will prepare a rental agreement for you to sign. Keep an eye on your dashboard.`
        ) +
        ctaButton('View My Applications', url)
    ),
    text:
      `Hi ${plainName(tenantName)},\n\n` +
      `Great news: your application for "${propertyTitle}" has been accepted by the landlord.\n\n` +
      `Next steps: the landlord may request access to your verification documents and will ` +
      `prepare a rental agreement for you to sign. Keep an eye on your dashboard.\n\n` +
      `View your applications: ${url}` +
      textFooter,
  };
};

const applicationRejected = (tenantName, propertyTitle) => {
  const url = link('/properties');
  return {
    subject: 'Update on Your Application',
    html: renderBase(
      heading('Update on your application') +
        paragraph(`Hi ${name(tenantName)},`) +
        paragraph(
          `The landlord has decided not to move forward with your application for ` +
            `<strong>${escapeHtml(propertyTitle)}</strong> at this time.`
        ) +
        paragraph(
          `This happens for many reasons and often has nothing to do with your profile. ` +
            `New properties are listed regularly — your next home may already be waiting.`
        ) +
        ctaButton('Browse Properties', url)
    ),
    text:
      `Hi ${plainName(tenantName)},\n\n` +
      `The landlord has decided not to move forward with your application for ` +
      `"${propertyTitle}" at this time.\n\n` +
      `This happens for many reasons and often has nothing to do with your profile. ` +
      `New properties are listed regularly — your next home may already be waiting.\n\n` +
      `Browse properties: ${url}` +
      textFooter,
  };
};

const documentVerified = (tenantName, documentType) => {
  const url = link('/documents');
  return {
    subject: 'Document Verified ✅',
    html: renderBase(
      heading('Document verified ✅') +
        paragraph(`Hi ${name(tenantName)},`) +
        paragraph(
          `Your <strong>${escapeHtml(documentType)}</strong> document has been reviewed ` +
            `and <strong>verified</strong>. Verified documents strengthen your profile ` +
            `and improve your trust score with landlords.`
        ) +
        ctaButton('View My Documents', url)
    ),
    text:
      `Hi ${plainName(tenantName)},\n\n` +
      `Your ${documentType} document has been reviewed and verified. Verified documents ` +
      `strengthen your profile and improve your trust score with landlords.\n\n` +
      `View your documents: ${url}` +
      textFooter,
  };
};

const documentRejected = (tenantName, documentType, remarks) => {
  const url = link('/documents');
  const remarksHtml = remarks
    ? `<p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:3px solid #ef4444;color:#7f1d1d;">` +
      `<strong>Reviewer remarks:</strong> ${escapeHtml(remarks)}</p>`
    : '';
  return {
    subject: 'Document Needs Attention',
    html: renderBase(
      heading('Your document needs attention') +
        paragraph(`Hi ${name(tenantName)},`) +
        paragraph(
          `Your <strong>${escapeHtml(documentType)}</strong> document could not be verified ` +
            `as submitted.`
        ) +
        remarksHtml +
        paragraph(
          `Please upload a clearer or corrected copy — once re-submitted, our team will ` +
            `review it again promptly.`
        ) +
        ctaButton('Re-upload Document', url)
    ),
    text:
      `Hi ${plainName(tenantName)},\n\n` +
      `Your ${documentType} document could not be verified as submitted.` +
      (remarks ? `\n\nReviewer remarks: ${remarks}` : '') +
      `\n\nPlease upload a clearer or corrected copy — once re-submitted, our team will ` +
      `review it again promptly.\n\n` +
      `Re-upload here: ${url}` +
      textFooter,
  };
};

const verificationRequestReceived = (tenantName, landlordName, propertyTitle) => {
  const url = link('/verification-requests');
  return {
    subject: 'Document Access Requested',
    html: renderBase(
      heading('A landlord requested document access') +
        paragraph(`Hi ${name(tenantName)},`) +
        paragraph(
          `<strong>${name(landlordName)}</strong> has requested access to your verification ` +
            `documents for <strong>${escapeHtml(propertyTitle)}</strong>.`
        ) +
        paragraph(
          `You stay in control: nothing is shared until you approve the request, and access ` +
            `is time-limited.`
        ) +
        ctaButton('Review Request', url)
    ),
    text:
      `Hi ${plainName(tenantName)},\n\n` +
      `${plainName(landlordName)} has requested access to your verification documents for ` +
      `"${propertyTitle}".\n\n` +
      `You stay in control: nothing is shared until you approve the request, and access is ` +
      `time-limited.\n\n` +
      `Review the request: ${url}` +
      textFooter,
  };
};

const verificationRequestApproved = (landlordName) => {
  const url = link('/received-applications');
  return {
    subject: 'Tenant Approved Document Access',
    html: renderBase(
      heading('Document access approved') +
        paragraph(`Hi ${name(landlordName)},`) +
        paragraph(
          `The tenant has <strong>approved</strong> your document verification request. ` +
            `For security, the access link is only available inside the platform — ` +
            `log in to view the documents.`
        ) +
        ctaButton(`Open ${BRAND_NAME}`, url)
    ),
    text:
      `Hi ${plainName(landlordName)},\n\n` +
      `The tenant has approved your document verification request. For security, the ` +
      `access link is only available inside the platform — log in to view the documents.\n\n` +
      `Open ${BRAND_NAME}: ${url}` +
      textFooter,
  };
};

const agreementCreated = (recipientName, propertyTitle, agreementId) => {
  const url = link(`/agreements/${agreementId}`);
  return {
    subject: 'Rental Agreement Ready for Signature',
    html: renderBase(
      heading('Your rental agreement is ready') +
        paragraph(`Hi ${name(recipientName)},`) +
        paragraph(
          `The rental agreement for <strong>${escapeHtml(propertyTitle)}</strong> has been ` +
            `prepared and is awaiting your signature. Review the terms and sign digitally ` +
            `from the agreement page.`
        ) +
        ctaButton('Review & Sign Agreement', url)
    ),
    text:
      `Hi ${plainName(recipientName)},\n\n` +
      `The rental agreement for "${propertyTitle}" has been prepared and is awaiting your ` +
      `signature. Review the terms and sign digitally from the agreement page.\n\n` +
      `Review and sign: ${url}` +
      textFooter,
  };
};

const agreementFullySigned = (recipientName, propertyTitle, agreementId) => {
  const url = link(`/agreements/${agreementId}`);
  return {
    subject: 'Agreement Fully Signed — Rental Active',
    html: renderBase(
      heading('The agreement is fully signed 🎉') +
        paragraph(`Hi ${name(recipientName)},`) +
        paragraph(
          `Both parties have signed the rental agreement for ` +
            `<strong>${escapeHtml(propertyTitle)}</strong> — the rental is now ` +
            `<strong>active</strong>. A copy of the signed agreement is available on the platform.`
        ) +
        ctaButton('View Signed Agreement', url)
    ),
    text:
      `Hi ${plainName(recipientName)},\n\n` +
      `Both parties have signed the rental agreement for "${propertyTitle}" — the rental ` +
      `is now active. A copy of the signed agreement is available on the platform.\n\n` +
      `View the signed agreement: ${url}` +
      textFooter,
  };
};

const ratingReceived = (recipientName) => {
  const url = link('/rental-history');
  return {
    subject: "You've Received a New Rating",
    html: renderBase(
      heading('You have a new rating') +
        paragraph(`Hi ${name(recipientName)},`) +
        paragraph(
          `A rating has been submitted for you on a completed rental. ` +
            `Ratings appear on your rental history and help build your reputation on the platform.`
        ) +
        ctaButton('View Rental History', url)
    ),
    text:
      `Hi ${plainName(recipientName)},\n\n` +
      `A rating has been submitted for you on a completed rental. Ratings appear on your ` +
      `rental history and help build your reputation on the platform.\n\n` +
      `View your rental history: ${url}` +
      textFooter,
  };
};

module.exports = {
  applicationSubmitted,
  applicationAccepted,
  applicationRejected,
  documentVerified,
  documentRejected,
  verificationRequestReceived,
  verificationRequestApproved,
  agreementCreated,
  agreementFullySigned,
  ratingReceived,
};
