const express = require('express');
const router  = express.Router();
const c = require('../controllers/resourceController');
const { protect } = require('../middleware/auth');

router.get  ('/',                protect, c.getResources);
router.get  ('/summary',         protect, c.getResourceSummary);
router.post ('/',                protect, c.createResource);
router.patch('/:id/deploy',      protect, c.deployResource);
router.patch('/:id/return',      protect, c.returnResource);

module.exports = router;
