// src/models/Disaster.js
const mongoose = require('mongoose');

const DisasterSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['flood', 'cyclone', 'urban', 'earthquake', 'wildfire', 'landslide', 'tsunami'],
    required: true,
  },
  title:       { type: String, required: true },
  description: String,
  severity:    { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  status:      { type: String, enum: ['active','monitoring','resolved'], default: 'active' },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  affectedRadius: { type: Number, default: 10 },
  affectedPeople: Number,
  riskScore:      Number,
  weatherData: {
    rainfall:    Number,
    windSpeed:   Number,
    temperature: Number,
    humidity:    Number,
  },
  isVerified:  { type: Boolean, default: false },
  reportedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags:        [String],
  externalId:  String,
}, { timestamps: true });

DisasterSchema.index({ location: '2dsphere' });
DisasterSchema.index({ status: 1, severity: 1 });

module.exports = mongoose.model('Disaster', DisasterSchema);