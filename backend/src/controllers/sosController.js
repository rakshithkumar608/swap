// src/controllers/sosController.js
const SosReport  = require('../models/SosReport');
const { classifyPost, clusterSosPosts } = require('../services/nlpService');
const { sendSosAlert }                  = require('../services/fcmService');

exports.getSosReports = async (req, res, next) => {
  try {
    const { status, channel, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status)  query.status  = status;
    if (channel) query.channel = channel;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await SosReport.countDocuments(query);
    const docs  = await SosReport.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)).lean();
    res.json({ success: true, total, data: docs });
  } catch (err) { next(err); }
};

exports.getSosById = async (req, res, next) => {
  try {
    const doc = await SosReport.findById(req.params.id).populate('assignedTeam', 'name email');
    if (!doc) return res.status(404).json({ success: false, message: 'SOS not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getNearbySos = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });
    const docs = await SosReport.find({
      status: { $ne: 'resolved' },
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000,
        },
      },
    }).limit(50).lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.submitSos = async (req, res, next) => {
  try {
    const { senderId, senderName, message, location, channel, photoThumbnail } = req.body;
    if (!senderId || !message || !location?.coordinates) {
      return res.status(400).json({ success: false, message: 'senderId, message, and location.coordinates are required' });
    }

    let thumb = typeof photoThumbnail === 'string' ? photoThumbnail.trim() : '';
    if (thumb.length > 600000) thumb = thumb.slice(0, 600000);

    const doc = await SosReport.create({
      senderId,
      senderName,
      message,
      location,
      channel: channel || 'online',
      ...(thumb ? { photoThumbnail: thumb } : {}),
    });

    // NLP classification (async — don't block response)
    classifyPost(message).then(async (nlp) => {
      doc.urgencyScore = nlp.urgency_score;
      doc.disasterType = nlp.disaster_type;
      await doc.save();

      // Broadcast updated SOS via socket
      if (global.io) global.io.to('responders').emit('sos:new', { sos: doc, urgency: nlp.urgency_score });

      // FCM push if high urgency
      if (nlp.urgency_score >= 0.7) await sendSosAlert(doc);
    }).catch(err => console.error('SOS NLP error:', err.message));

    // Immediately broadcast unscored SOS
    if (global.io) global.io.to('responders').emit('sos:new', { sos: doc, urgency: null });

    res.status(201).json({ success: true, data: doc, message: 'SOS received and dispatched' });
  } catch (err) { next(err); }
};

exports.relayGhostSos = async (req, res, next) => {
  try {
    const { originalSosId, senderId, relayChain = [], hops = 0, message, location, channel, timestamp } = req.body;

    // Deduplicate by originalSosId
    const existing = await SosReport.findOne({ 'relayChain.0': originalSosId });
    if (existing) return res.json({ success: true, message: 'Already relayed', data: existing });

    const doc = await SosReport.create({
      senderId, message, location, channel: channel || 'ble',
      hops, relayChain: [originalSosId, ...relayChain],
      createdAt: timestamp ? new Date(timestamp) : new Date(),
    });

    if (global.io) global.io.to('responders').emit('sos:new', { sos: doc, urgency: null, relay: true });

    res.status(201).json({ success: true, data: doc, message: 'Ghost Network relay recorded' });
  } catch (err) { next(err); }
};

exports.acknowledgeSos = async (req, res, next) => {
  try {
    const doc = await SosReport.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged', assignedTeam: req.user._id },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'SOS not found' });
    if (global.io) global.io.to('responders').emit('sos:update', { sosId: doc._id, status: 'acknowledged' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

/** Hand SOS from command desk to Rescue Coordination / field teams (not the same as resolved). */
exports.dispatchSosToRescue = async (req, res, next) => {
  try {
    const existing = await SosReport.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'SOS not found' });
    if (existing.status === 'resolved') {
      return res.status(400).json({ success: false, message: 'SOS already resolved' });
    }
    if (existing.status === 'dispatched') {
      return res.status(400).json({ success: false, message: 'SOS already with rescue team' });
    }
    const doc = await SosReport.findByIdAndUpdate(
      req.params.id,
      {
        status: 'dispatched',
        dispatchedAt: new Date(),
        dispatchedBy: req.user._id,
      },
      { new: true },
    );
    if (global.io) {
      global.io.to('responders').emit('sos:update', { sosId: doc._id, status: 'dispatched' });
      global.io.emit('sos:rescue-dispatch', { sosId: doc._id, status: 'dispatched' });
    }
    res.json({ success: true, data: doc, message: 'Queued for rescue team' });
  } catch (err) { next(err); }
};

exports.resolveSos = async (req, res, next) => {
  try {
    const doc = await SosReport.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedAt: new Date() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'SOS not found' });
    if (global.io) global.io.to('responders').emit('sos:update', { sosId: doc._id, status: 'resolved' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getSosClusters = async (req, res, next) => {
  try {
    const pending = await SosReport.find({ status: 'pending' }).limit(100).lean();
    const posts   = pending.map(s => ({
      id:       s._id.toString(),
      text:     s.message,
      location: { coordinates: s.location.coordinates },
    }));
    const clusters = await clusterSosPosts(posts);
    res.json({ success: true, data: clusters });
  } catch (err) { next(err); }
};

exports.getSosStats = async (req, res, next) => {
  try {
    const byStatus  = await SosReport.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byChannel = await SosReport.aggregate([{ $group: { _id: '$channel', count: { $sum: 1 } } }]);
    const last24h   = await SosReport.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } });
    res.json({ success: true, data: { byStatus, byChannel, last24h } });
  } catch (err) { next(err); }
};
