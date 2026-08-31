/**
 * Single branded HTML shell shared by every platform email.
 *
 * Inline CSS only: Gmail/Outlook strip <style> blocks and never load
 * external stylesheets, and table layout is the only thing that renders
 * consistently across email clients. Body content is injected into the
 * white card; user-supplied values must be escaped with escapeHtml()
 * BEFORE being interpolated into any HTML.
 */
const BRAND_NAME = 'VeriNest';
const FONT_STACK =
  "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ACCENT = '#4f46e5'; // indigo-600, matches the frontend
const TEXT_DARK = '#1e293b'; // slate-800
const TEXT_MUTED = '#94a3b8'; // slate-400
const PAGE_BG = '#f1f5f9'; // slate-100

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

/** Bulletproof-enough CTA button (table-based, inline styles). */
const ctaButton = (label, url) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:6px;background-color:${ACCENT};">
      <a href="${escapeHtml(url)}" target="_blank"
         style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;

/** Wraps pre-escaped body HTML in the branded header/card/footer shell. */
const renderBase = (bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${ACCENT};border-radius:8px 8px 0 0;padding:20px 32px;">
              <span style="font-family:${FONT_STACK};font-size:17px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ffffff;">
                ${BRAND_NAME}
              </span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 8px 8px;padding:32px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${TEXT_DARK};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;text-align:center;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
              This is an automated message from ${BRAND_NAME} — please do not reply to this email.<br />
              &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const adminAccountBlocked = ({ fullName, message }) => {
    return renderBase(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_DARK};">
      Your account has been blocked
    </h1>

    <p style="margin:0 0 16px;">
      Hi ${escapeHtml(fullName)},
    </p>

    <p style="margin:0 0 16px;">
      Your VeriNest account has been blocked by an administrator.
      You will not be able to sign in while the account remains blocked.
    </p>

    ${
        message
            ? `
          <div style="
            margin:20px 0;
            padding:16px;
            border-left:4px solid #f59e0b;
            background-color:#fff7ed;
          ">
            <strong>Message from the administrator</strong>
            <p style="margin:8px 0 0;">
              ${escapeHtml(message)}
            </p>
          </div>
        `
            : ''
    }

    <p style="margin:0;">
      If you believe this was done in error, please contact VeriNest support.
    </p>
  `);
};


const adminAccountUnblocked = ({ fullName, message }) => {
    return renderBase(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_DARK};">
      Your account has been restored
    </h1>

    <p style="margin:0 0 16px;">
      Hi ${escapeHtml(fullName)},
    </p>

    <p style="margin:0 0 16px;">
      Your VeriNest account has been restored by an administrator.
      You can sign in and continue using the platform.
    </p>

    ${
        message
            ? `
          <div style="
            margin:20px 0;
            padding:16px;
            border-left:4px solid #22c55e;
            background-color:#f0fdf4;
          ">
            <strong>Message from the administrator</strong>
            <p style="margin:8px 0 0;">
              ${escapeHtml(message)}
            </p>
          </div>
        `
            : ''
    }
  `);
};


const adminAccountDeleted = ({ fullName, message }) => {
    return renderBase(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_DARK};">
      Your account has been deleted
    </h1>

    <p style="margin:0 0 16px;">
      Hi ${escapeHtml(fullName)},
    </p>

    <p style="margin:0 0 16px;">
      Your VeriNest account has been permanently deleted by an administrator.
      You will no longer be able to sign in to this account.
    </p>

    ${
        message
            ? `
          <div style="
            margin:20px 0;
            padding:16px;
            border-left:4px solid #ef4444;
            background-color:#fef2f2;
          ">
            <strong>Message from the administrator</strong>
            <p style="margin:8px 0 0;">
              ${escapeHtml(message)}
            </p>
          </div>
        `
            : ''
    }

    <p style="margin:0;">
      If you believe this action was taken incorrectly, please contact
      VeriNest support.
    </p>
  `);
};

module.exports = { renderBase, ctaButton, escapeHtml, BRAND_NAME, adminAccountDeleted, adminAccountUnblocked, adminAccountBlocked };
