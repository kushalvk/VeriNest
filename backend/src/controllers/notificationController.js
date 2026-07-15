const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// GET /api/notifications/mine
const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = { receiverId: req.user.id };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);

    return res.status(200).json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (notification.receiverId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: this notification is not yours' });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({ notification });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getMyNotifications, markAsRead };
