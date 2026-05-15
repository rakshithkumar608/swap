const mongoose = require('mongoose');

const RescueRouteSchema = new mongoose.Schema({
  name: { type: String },
  origin: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  destination: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  waypoints:    [{ type: { type: String }, coordinates: [Number] }],
  geoJSON:      { type: Object },
  distanceKm:   { type: Number },
  durationMin:  { type: Number },
  blockedRoads: [{ lat: Number, lng: Number, reason: String }],
  safetyScore:  { type: Number, min: 0, max: 100 },
  status:       { type: String, enum: ['active','blocked','completed'], default: 'active' },
  disasterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster' },
  assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdated:  { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('RescueRoute', RescueRouteSchema);
