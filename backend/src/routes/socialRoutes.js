const express = require('express');
const router  = express.Router();
const c = require('../controllers/socialController');
const { protect } = require('../middleware/auth');

router.get  ('/posts',               protect, c.getPosts);
router.get  ('/sos-feed',            protect, c.getSosFeed);
router.get  ('/panic-meter',         protect, c.getPanicMeter);
router.get  ('/misinformation',      protect, c.getMisinformation);
router.get  ('/clusters',            protect, c.getClusters);
router.get  ('/posts/:id',           protect, c.getPostById);
router.post ('/posts',               protect, c.ingestPost);
router.post ('/posts/batch',         protect, c.batchIngestPosts);
router.patch('/posts/:id/flag',      protect, c.flagPost);

module.exports = router;
