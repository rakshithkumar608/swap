// src/controllers/alertController.js
const Alert   = require('../models/Alert');
const User    = require('../models/User');
const { sendToTokens, sendToTopic } = require('../services/fcmService');

exports.getAlerts = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Alert.countDocuments();
    const docs  = await Alert.find().sort('-createdAt').skip(skip).limit(parseInt(limit)).populate('createdBy', 'name').lean();
    res.json({ success: true, total, data: docs });
  } catch (err) { next(err); }
};

exports.getAlertById = async (req, res, next) => {
  try {
    const doc = await Alert.findById(req.params.id).populate('createdBy', 'name email').populate('disasterId', 'title type');
    if (!doc) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getActiveAlerts = async (req, res, next) => {
  try {
    const docs = await Alert.find({ $or: [{ sentAt: { $gte: new Date(Date.now() - 86400000) } }, { sentAt: null }] }).sort('-createdAt').limit(20).lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.sendAlert = async (req, res, next) => {
  try {
    const { title, body, type, severity, targetTopics = [], targetTokens = [], disasterId, targetArea } = req.body;
    if (!title || !body || !type) return res.status(400).json({ success: false, message: 'title, body, and type are required' });

    const doc = await Alert.create({ title, body, type, severity, targetTopics, targetTokens, disasterId, targetArea, createdBy: req.user._id, sentAt: new Date() });

    // FCM — send to topics
    const topicResults = await Promise.all(targetTopics.map(t => sendToTopic(t, title, body, { alertId: doc._id.toString(), type, severity })));

    // FCM — send to specific tokens
    let tokenResult = null;
    if (targetTokens.length > 0) {
      tokenResult = await sendToTokens(targetTokens, title, body, { alertId: doc._id.toString(), type, severity });
    }

    const sentCount = targetTopics.length + (tokenResult?.successCount || 0);
    await Alert.findByIdAndUpdate(doc._id, { sentCount });

    // Socket broadcast
    if (global.io) global.io.emit('alert:broadcast', { title, body: body, type, severity, alertId: doc._id });

    res.status(201).json({ success: true, data: { ...doc.toObject(), sentCount }, message: `Alert sent to ${targetTopics.length} topics` });
  } catch (err) { next(err); }
};

exports.broadcastAlert = async (req, res, next) => {
  try {
    const { title, body, type = 'disaster', severity = 'warning' } = req.body;
    const doc = await Alert.create({ title, body, type, severity, targetTopics: ['all-users'], createdBy: req.user._id, sentAt: new Date() });
    await sendToTopic('all-users', title, body, { alertId: doc._id.toString(), type, severity });
    if (global.io) global.io.emit('alert:broadcast', { title, body, type, severity });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.evacuateAlert = async (req, res, next) => {
  try {
    const { title, body, disasterId, targetTopics = ['all-users'] } = req.body;
    const doc = await Alert.create({ title, body, type: 'evacuation', severity: 'critical', targetTopics, disasterId, createdBy: req.user._id, sentAt: new Date() });
    await Promise.all(targetTopics.map(t => sendToTopic(t, `🚨 EVACUATE: ${title}`, body, { alertId: doc._id.toString(), type: 'evacuation' })));
    if (global.io) global.io.emit('alert:broadcast', { title, body, type: 'evacuation', severity: 'critical' });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.cancelAlert = async (req, res, next) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert cancelled' });
  } catch (err) { next(err); }
};
