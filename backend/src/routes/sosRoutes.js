const express = require('express');
const router  = express.Router();
const c = require('../controllers/sosController');
const { protect } = require('../middleware/auth');

router.get  ('/',                c.getSosReports);
router.get  ('/stats',           c.getSosStats);
router.get  ('/clusters',        protect, c.getSosClusters);
router.get  ('/nearby',          protect, c.getNearbySos);
router.get  ('/:id',             c.getSosById);
router.post ('/',                c.submitSos);
router.post ('/relay',           c.relayGhostSos);
router.patch('/:id/acknowledge', protect, c.acknowledgeSos);
router.patch('/:id/dispatch-rescue', protect, c.dispatchSosToRescue);
router.patch('/:id/resolve',     protect, c.resolveSos);

module.exports = router;
