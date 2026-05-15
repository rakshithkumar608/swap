const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  body:     { type: String, required: true },
  type:     { type: String, enum: ['disaster','sos','weather','evacuation','allclear'], required: true },
  severity: { type: String, enum: ['info','warning','critical'], default: 'warning' },
  targetArea: {
    type:        { type: String, enum: ['Polygon'] },
    coordinates: [[[Number]]]
  },
  targetTopics:   [String],
  targetTokens:   [String],
  sentCount:      { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  sentAt:         { type: Date },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  disasterId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster' },
}, { timestamps: true });

AlertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
