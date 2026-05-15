// src/controllers/shelterController.js
const Shelter = require('../models/Shelter');

exports.getShelters = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type)   query.disasterTypes = type;
    const docs = await Shelter.find(query).sort('-createdAt').lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.getShelterById = async (req, res, next) => {
  try {
    const doc = await Shelter.findById(req.params.id).populate('managedBy', 'name email');
    if (!doc) return res.status(404).json({ success: false, message: 'Shelter not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getNearbyShelters = async (req, res, next) => {
  try {
    const { lat, lng, radius = 20 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });
    const docs = await Shelter.find({
      status: 'open',
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000,
        },
      },
    }).limit(20).lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.createShelter = async (req, res, next) => {
  try {
    const doc = await Shelter.create({ ...req.body, managedBy: req.user._id });
    if (global.io) global.io.emit('shelter:update', doc);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateShelter = async (req, res, next) => {
  try {
    const doc = await Shelter.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Shelter not found' });
    if (global.io) global.io.emit('shelter:update', { shelterId: doc._id, occupancy: doc.occupancy, status: doc.status });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateOccupancy = async (req, res, next) => {
  try {
    const { delta } = req.body; // +ve = people checked in, -ve = checked out
    const doc = await Shelter.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Shelter not found' });

    const newOccupancy = Math.max(0, doc.occupancy + parseInt(delta));
    if (newOccupancy > doc.capacity) return res.status(400).json({ success: false, message: 'Shelter at full capacity' });

    doc.occupancy = newOccupancy;
    doc.status    = newOccupancy >= doc.capacity ? 'full' : 'open';
    await doc.save();

    if (global.io) global.io.emit('shelter:update', { shelterId: doc._id, occupancy: doc.occupancy, status: doc.status });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};
