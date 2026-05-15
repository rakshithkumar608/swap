const express = require('express');
const router  = express.Router();
const c = require('../controllers/rescueController');
const { protect, authorize } = require('../middleware/auth');

router.get  ('/',              protect, c.getRoutes);
router.get  ('/active',        protect, c.getActiveRoutes);
router.get  ('/:id',           protect, c.getRouteById);
router.post ('/calculate',     protect, c.calculateRoute);
router.post ('/recalculate/:id', protect, c.recalculateRoute);
router.post ('/:id/block',     protect, c.blockRoad);
router.put  ('/:id',           protect, c.updateRoute);
router.delete('/:id',          protect, authorize('admin'), c.deleteRoute);

module.exports = router;
