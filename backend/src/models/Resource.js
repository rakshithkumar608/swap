const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  category: { type: String, enum: ['vehicle','medical','food','water','equipment','personnel'], required: true },
  quantity: { type: Number, default: 1 },
  unit:     { type: String, default: 'units' },
  status:   { type: String, enum: ['available','deployed','maintenance'], default: 'available' },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }
  },
  assignedTo:      { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster' },
  deployedAt:      { type: Date },
  estimatedReturn: { type: Date },
}, { timestamps: true });

ResourceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Resource', ResourceSchema);
