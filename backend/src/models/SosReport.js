const mongoose = require('mongoose');

const SosReportSchema = new mongoose.Schema({
  senderId:    { type: String, required: true },
  senderName:  { type: String },
  message:     { type: String, required: true },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  channel:      { type: String, enum: ['online','ble','wifi-direct','mesh'], default: 'online' },
  hops:         { type: Number, default: 0 },
  relayChain:   [String],
  status:       { type: String, enum: ['pending','acknowledged','dispatched','resolved'], default: 'pending' },
  urgencyScore: { type: Number, min: 0, max: 1 },
  disasterType: { type: String },
  /** Optional JPEG data URL from citizen app (compressed client-side) */
  photoThumbnail: { type: String },
  assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  /** Command handed case to field rescue (Rescue Coordination queue). */
  dispatchedAt: { type: Date },
  dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt:   { type: Date },
}, { timestamps: true });

SosReportSchema.index({ location: '2dsphere' });
SosReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SosReport', SosReportSchema);