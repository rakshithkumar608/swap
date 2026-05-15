const express = require('express');
const router  = express.Router();
const c = require('../controllers/shelterController');
const { protect } = require('../middleware/auth');

router.get  ('/',                    c.getShelters);
router.get  ('/nearby',              c.getNearbyShelters);
router.get  ('/:id',                 c.getShelterById);
router.post ('/',                    protect, c.createShelter);
router.put  ('/:id',                 protect, c.updateShelter);
router.patch('/:id/occupancy',       protect, c.updateOccupancy);

module.exports = router;
