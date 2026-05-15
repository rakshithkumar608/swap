// src/controllers/authController.js
const jwt   = require('jsonwebtoken');
const User  = require('../models/User');
const { subscribeToTopic } = require('../services/fcmService');

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id, user.role);
  res.status(statusCode).json({
    success: true,
    data: { token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } },
  });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, organisation } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const user = await User.create({ name, email, password, role, phone, organisation });
    sendToken(user, 201, res);
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    sendToken(user, 200, res);
  } catch (err) { next(err); }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

exports.updateMe = async (req, res, next) => {
  try {
    const { name, phone, organisation } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone, organisation }, { new: true, runValidators: true });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.registerFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'FCM token required' });

    const user = req.user;
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save({ validateBeforeSave: false });
    }

    // Subscribe to relevant topics
    await subscribeToTopic([token], 'all-users');
    if (user.role === 'admin' || user.role === 'responder') {
      await subscribeToTopic([token], 'all-responders');
      await subscribeToTopic([token], 'sos-high-urgency');
    }

    res.json({ success: true, message: 'FCM token registered and subscribed to topics' });
  } catch (err) { next(err); }
};

exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};
