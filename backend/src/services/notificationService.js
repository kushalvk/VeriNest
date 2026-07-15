const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('./emailService');
const templates = require('../emails/templates');

/**
 * Creates a notification record; the record is the source of truth.
 * For type "email", additionally attempts delivery via emailService —
 * strictly best-effort: a send failure is logged, never thrown, and never
 * rolls back the record. Always returns the created Notification.
 * (notification.emailDelivered is attached in-memory for debugging only —
 * it is not persisted and not part of the API contract.)
 *
 * Optional emailTemplate { templateName, templateArgs }: when provided
 * (and type is "email"), the named function from emails/templates.js is
 * called with templateArgs (positional array) and its { subject, html,
 * text } is sent instead of the raw title/message. Unknown template names
 * fall back to the plain title/message email rather than failing.
 */
const createNotification = async ({
  receiverId,
  title,
  message,
  type = 'push',
  event,
  emailTemplate,
}) => {
  const notification = await Notification.create({
    receiverId,
    title,
    message,
    type,
    event,
    sentAt: new Date(),
  });

  if (type === 'email') {
    let emailDelivered = false;
    try {
      const receiver = await User.findById(receiverId).select('email');
      if (!receiver?.email) {
        throw new Error(`receiver ${receiverId} has no email address`);
      }

      // Default: plain title/message (emailService wraps it in the shell).
      let payload = { to: receiver.email, subject: title, text: message };
      if (emailTemplate?.templateName) {
        const templateFn = templates[emailTemplate.templateName];
        if (typeof templateFn === 'function') {
          const { subject, html, text } = templateFn(
            ...(emailTemplate.templateArgs || [])
          );
          payload = { to: receiver.email, subject, html, text };
        } else {
          console.warn(
            `[notifications] Unknown email template "${emailTemplate.templateName}" — using plain title/message`
          );
        }
      }

      await emailService.sendEmail(payload);
      emailDelivered = true;
    } catch (err) {
      console.error(
        `[notifications] Email delivery failed for notification ${notification._id}: ${err.message}`
      );
    }
    notification.emailDelivered = emailDelivered;
  }

  return notification;
};

module.exports = { createNotification };
