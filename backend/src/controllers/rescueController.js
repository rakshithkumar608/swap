// src/controllers/rescueController.js
const RescueRoute = require('../models/RescueRoute');
const { calculateRoute, calculateSafeRoute } = require('../services/routingService');

exports.getRoutes = async (req, res, next) => {
  try {
    const { status, disasterId } = req.query;
    const query = {};
    if (status)     query.status     = status;
    if (disasterId) query.disasterId = disasterId;
    const docs = await RescueRoute.find(query).sort('-createdAt').lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.getRouteById = async (req, res, next) => {
  try {
    const doc = await RescueRoute.findById(req.params.id).populate('disasterId', 'title type').populate('assignedTeam', 'name');
    if (!doc) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getActiveRoutes = async (req, res, next) => {
  try {
    const docs = await RescueRoute.find({ status: 'active' }).lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.calculateRoute = async (req, res, next) => {
  try {
    const { origin, destination, profile = 'driving-car', blockedRoads = [], avoidAreas = [], disasterId } = req.body;
    if (!origin || !destination) return res.status(400).json({ success: false, message: 'origin and destination required' });

    const originCoords      = [origin.lng, origin.lat];
    const destinationCoords = [destination.lng, destination.lat];

    const routeData = blockedRoads.length > 0
      ? await calculateSafeRoute(originCoords, destinationCoords, blockedRoads, avoidAreas)
      : await calculateRoute(originCoords, destinationCoords, profile, avoidAreas);

    if (!routeData) return res.status(502).json({ success: false, message: 'Routing service unavailable' });

    const safetyScore = Math.max(0, 100 - blockedRoads.length * 15 - (routeData.warnings?.length || 0) * 5);

    const doc = await RescueRoute.create({
      name:        `Route ${Date.now()}`,
      origin:      { type: 'Point', coordinates: originCoords },
      destination: { type: 'Point', coordinates: destinationCoords },
      geoJSON:     routeData.geoJSON,
      distanceKm:  routeData.distanceKm,
      durationMin: routeData.durationMin,
      blockedRoads,
      safetyScore,
      disasterId,
      status: 'active',
      lastUpdated: new Date(),
    });

    if (global.io) global.io.emit('route:updated', doc);
    res.status(201).json({ success: true, data: { ...doc.toObject(), warnings: routeData.warnings } });
  } catch (err) { next(err); }
};

exports.recalculateRoute = async (req, res, next) => {
  try {
    const existing = await RescueRoute.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Route not found' });

    const { blockedRoads = [] } = req.body;
    const allBlocked = [...(existing.blockedRoads || []), ...blockedRoads];

    const routeData = await calculateSafeRoute(
      existing.origin.coordinates,
      existing.destination.coordinates,
      allBlocked
    );

    if (!routeData) return res.status(502).json({ success: false, message: 'Routing service unavailable' });

    const safetyScore = Math.max(0, 100 - allBlocked.length * 15);
    const updated = await RescueRoute.findByIdAndUpdate(req.params.id, {
      geoJSON: routeData.geoJSON, distanceKm: routeData.distanceKm,
      durationMin: routeData.durationMin, blockedRoads: allBlocked,
      safetyScore, lastUpdated: new Date(),
    }, { new: true });

    if (global.io) global.io.emit('route:updated', updated);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.blockRoad = async (req, res, next) => {
  try {
    const { lat, lng, reason } = req.body;
    const doc = await RescueRoute.findByIdAndUpdate(
      req.params.id,
      { $push: { blockedRoads: { lat, lng, reason } }, status: 'blocked' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Route not found' });
    if (global.io) global.io.emit('route:updated', doc);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.updateRoute = async (req, res, next) => {
  try {
    const doc = await RescueRoute.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteRoute = async (req, res, next) => {
  try {
    await RescueRoute.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Route deleted' });
  } catch (err) { next(err); }
};
