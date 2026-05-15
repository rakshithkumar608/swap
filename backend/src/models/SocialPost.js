const mongoose = require('mongoose');

const SocialPostSchema = new mongoose.Schema({
  platform:   { type: String, enum: ['twitter','facebook','telegram','manual'], default: 'manual' },
  originalId: { type: String },
  text:       { type: String, required: true },
  author:     { type: String },
  location: {
    type:        { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }
  },
  locationText:      { type: String },
  urgencyScore:      { type: Number, min: 0, max: 1 },
  sentimentScore:    { type: Number, min: -1, max: 1 },
  isSOS:             { type: Boolean, default: false },
  isMisinformation:  { type: Boolean, default: false },
  disasterType:      { type: String },
  extractedLocation: { type: String },
  keywords:          [String],
  nlpProcessed:      { type: Boolean, default: false },
  clusterId:         { type: String },
  flaggedManually:   { type: Boolean, default: false },
  postedAt:          { type: Date },
}, { timestamps: true });

SocialPostSchema.index({ location: '2dsphere' });
SocialPostSchema.index({ isSOS: 1, nlpProcessed: 1, createdAt: -1 });

module.exports = mongoose.model('SocialPost', SocialPostSchema);
