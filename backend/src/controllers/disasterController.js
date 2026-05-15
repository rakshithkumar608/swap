// src/controllers/disasterController.js
const Disaster  = require('../models/Disaster');
const { computeRiskScore, scoreToSeverity } = require('../services/riskService');
const { getWeatherByCoords }               = require('../services/weatherService');

exports.getDisasters = async (req, res, next) => {
  try {
    const { status = 'active', type, severity, lat, lng, radius = 50, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = {};
    if (status !== 'all') query.status = status;
    if (type)     query.type     = type;
    if (severity) query.severity = severity;

    if (lat && lng) {
      query.location = {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000,
        },
      };
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Disaster.countDocuments(query);
    const docs  = await Disaster.find(query).sort(sort).skip(skip).limit(parseInt(limit)).lean();

    res.json({ success: true, total, page: parseInt(page), data: docs });
  } catch (err) { next(err); }
};

exports.getDisasterById = async (req, res, next) => {
  try {
    const doc = await Disaster.findById(req.params.id).populate('reportedBy', 'name email role');
    if (!doc) return res.status(404).json({ success: false, message: 'Disaster not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getNearbyDisasters = async (req, res, next) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });
    const docs = await Disaster.find({
      status: 'active',
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

exports.getDisastersByType = async (req, res, next) => {
  try {
    const docs = await Disaster.find({ type: req.params.type, status: { $ne: 'resolved' } }).sort('-createdAt').lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.createDisaster = async (req, res, next) => {
  try {
    const { type, title, description, severity, location, affectedRadius, affectedPeople, weatherData } = req.body;
    const doc = new Disaster({ type, title, description, severity, location, affectedRadius, affectedPeople, weatherData, reportedBy: req.user._id });

    // Compute risk score from weather + attrs
    const riskScore = await computeRiskScore(doc);
    doc.riskScore = riskScore;
    if (!severity) doc.severity = scoreToSeverity(riskScore);

    // Attach live weather if not provided
    if (!weatherData && location?.coordinates) {
      const [lng, lat] = location.coordinates;
      const weather = await getWeatherByCoords(lat, lng);
      if (weather) doc.weatherData = { windSpeed: weather.windSpeed, rainfall: weather.rainfall, temperature: weather.temperature };
    }

    await doc.save();

    // Real-time broadcast
    if (global.io) global.io.emit('disaster:new', doc);

    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateDisaster = async (req, res, next) => {
  try {
    const doc = await Disaster.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Disaster not found' });
    if (global.io) global.io.emit('disaster:update', doc);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateDisasterStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const doc = await Disaster.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Disaster not found' });
    if (global.io) global.io.emit('disaster:update', doc);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteDisaster = async (req, res, next) => {
  try {
    await Disaster.findByIdAndUpdate(req.params.id, { status: 'resolved' });
    res.json({ success: true, message: 'Disaster marked as resolved' });
  } catch (err) { next(err); }
};

exports.getDisasterStats = async (req, res, next) => {
  try {
    const byType = await Disaster.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$type', count: { $sum: 1 }, avgRisk: { $avg: '$riskScore' } } },
    ]);
    const bySeverity = await Disaster.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);
    const total = await Disaster.countDocuments({ status: 'active' });
    res.json({ success: true, data: { total, byType, bySeverity } });
  } catch (err) { next(err); }
};
