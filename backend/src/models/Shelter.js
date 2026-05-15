const mongoose = require('mongoose');

const ShelterSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  address:  { type: String },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  capacity:     { type: Number, required: true },
  occupancy:    { type: Number, default: 0 },
  status:       { type: String, enum: ['open','full','closed'], default: 'open' },
  facilities:   [{ type: String, enum: ['food','water','medical','power','wifi'] }],
  contactPhone: { type: String },
  managedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  disasterTypes:[String],
}, { timestamps: true });

ShelterSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Shelter', ShelterSchema);
