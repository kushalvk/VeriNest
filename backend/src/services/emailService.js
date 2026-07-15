const nodemailer = require('nodemailer');
const { renderBase, escapeHtml } = require('../emails/baseTemplate');

const isSmtpConfigured = () =>
  Boolean(
    process.env.EMAIL_SMTP_HOST &&
      process.env.EMAIL_SMTP_PORT &&
      process.env.EMAIL_SMTP_USER &&
      process.env.EMAIL_SMTP_PASS
  );

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT),
    secure: Number(process.env.EMAIL_SMTP_PORT) === 465,
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  });

/** Plain-text-only callers still get a branded email: wrap the text in
 *  the default shell (escaped, newlines preserved). */
const defaultHtmlFor = (text) =>
  renderBase(
    `<p style="margin:0;">${escapeHtml(text || '').replace(/\n/g, '<br />')}</p>`
  );

// Log a readable summary — never the full HTML markup dump.
const logDevEmail = ({ to, subject, html, text }) => {
  console.log('[DEV EMAIL]', {
    to,
    subject,
    text,
    html: html ? `<custom template, ${html.length} chars>` : '<default template>',
  });
};

/**
 * Sends an email via SMTP. Accepts { to, subject, html?, text }: html is
 * the branded template body, text the plain-text fallback for clients
 * that don't render HTML. When html is omitted, text is wrapped in the
 * default branded shell.
 *
 * Outside production, missing SMTP config (or NODE_ENV=development) falls
 * back to logging the message server-side instead of throwing. In
 * production there is no fallback: missing config or a send failure throws,
 * so callers surface a generic 500 and the message body is never logged.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const message = {
    from: process.env.EMAIL_SMTP_USER,
    to,
    subject,
    text,
    html: html || defaultHtmlFor(text),
  };

  if (isProduction) {
    if (!isSmtpConfigured()) {
      throw new Error('SMTP is not configured');
    }
    await createTransport().sendMail(message);
    return;
  }

  if (!isSmtpConfigured() || process.env.NODE_ENV === 'development') {
    logDevEmail({ to, subject, html, text });
    return;
  }

  try {
    await createTransport().sendMail(message);
  } catch (err) {
    console.warn(`[email] SMTP send failed (${err.message}), dev fallback:`);
    logDevEmail({ to, subject, html, text });
  }
};

module.exports = { sendEmail };
