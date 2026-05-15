const express = require('express');
const router  = express.Router();
const { register, login, logout, getMe, updateMe, registerFcmToken } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register',   register);
router.post('/login',      login);
router.post('/logout',     protect, logout);
router.get ('/me',         protect, getMe);
router.put ('/me',         protect, updateMe);
router.post('/fcm-token',  protect, registerFcmToken);

module.exports = router;
