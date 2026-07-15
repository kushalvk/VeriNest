const AuditLog = require('../models/AuditLog');

const logAction = async ({ userId, action, module, req }) => {
  return AuditLog.create({
    userId,
    action,
    module,
    ipAddress: req?.ip,
    device: req?.headers?.['user-agent'],
  });
};

module.exports = { logAction };
