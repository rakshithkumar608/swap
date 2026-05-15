// src/controllers/resourceController.js
const Resource = require('../models/Resource');

exports.getResources = async (req, res, next) => {
  try {
    const { category, status } = req.query;
    const query = {};
    if (category) query.category = category;
    if (status)   query.status   = status;
    const docs = await Resource.find(query).populate('assignedTo', 'title type').sort('-createdAt').lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.createResource = async (req, res, next) => {
  try {
    const doc = await Resource.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deployResource = async (req, res, next) => {
  try {
    const { disasterId } = req.body;
    const doc = await Resource.findByIdAndUpdate(
      req.params.id,
      { status: 'deployed', assignedTo: disasterId, deployedAt: new Date() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Resource not found' });
    if (global.io) global.io.to('responders').emit('resource:deployed', doc);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.returnResource = async (req, res, next) => {
  try {
    const doc = await Resource.findByIdAndUpdate(
      req.params.id,
      { status: 'available', assignedTo: null, deployedAt: null, estimatedReturn: null },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Resource not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getResourceSummary = async (req, res, next) => {
  try {
    const summary = await Resource.aggregate([
      { $group: { _id: '$category', total: { $sum: '$quantity' }, available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, '$quantity', 0] } }, deployed: { $sum: { $cond: [{ $eq: ['$status', 'deployed'] }, '$quantity', 0] } } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};
