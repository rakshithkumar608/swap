
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'responder', 'viewer', 'citizen'], default: 'viewer' },
  phone: String,
  organisation: String,
  fcmTokens: [String],
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number]
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

UserSchema.pre('save', async function() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

module.exports = mongoose.model('User', UserSchema);