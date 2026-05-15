const express = require('express');
const router  = express.Router();
const c = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/auth');

router.get  ('/',             protect, c.getAlerts);
router.get  ('/active',       c.getActiveAlerts);
router.get  ('/:id',          protect, c.getAlertById);
router.post ('/send',         protect, authorize('admin'), c.sendAlert);
router.post ('/broadcast',    protect, authorize('admin'), c.broadcastAlert);
router.post ('/evacuate',     protect, authorize('admin'), c.evacuateAlert);
router.patch('/:id/cancel',   protect, authorize('admin'), c.cancelAlert);

module.exports = router;
