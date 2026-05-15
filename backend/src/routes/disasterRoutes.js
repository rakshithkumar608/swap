const express = require('express');
const router  = express.Router();
const c = require('../controllers/disasterController');
const { protect, authorize } = require('../middleware/auth');

router.get  ('/',           c.getDisasters);
router.get  ('/stats',      c.getDisasterStats);
router.get  ('/nearby',     c.getNearbyDisasters);
router.get  ('/type/:type', c.getDisastersByType);
router.get  ('/:id',        c.getDisasterById);
router.post ('/',           protect, c.createDisaster);
router.put  ('/:id',        protect, c.updateDisaster);
router.patch('/:id/status', protect, c.updateDisasterStatus);
router.delete('/:id',       protect, authorize('admin'), c.deleteDisaster);

module.exports = router;
