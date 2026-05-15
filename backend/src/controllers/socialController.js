// src/controllers/socialController.js
const SocialPost = require('../models/SocialPost');
const { classifyPost, batchClassify, checkMisinformation, clusterSosPosts } = require('../services/nlpService');

const runNlpOnPost = async (doc) => {
  try {
    const [nlp, misinfo] = await Promise.all([classifyPost(doc.text), checkMisinformation(doc.text)]);
    doc.urgencyScore = nlp.urgency_score; doc.sentimentScore = nlp.sentiment_score;
    doc.isSOS = nlp.is_sos; doc.disasterType = nlp.disaster_type;
    doc.extractedLocation = nlp.location_hint; doc.keywords = nlp.keywords || [];
    doc.isMisinformation = misinfo.is_misinformation; doc.nlpProcessed = true;
    await doc.save();
    if (nlp.is_sos && global.io) global.io.to('responders').emit('social:sos-cluster', { post: doc });
  } catch (err) { console.error('Social NLP error:', err.message); }
};

exports.getPosts = async (req, res, next) => {
  try {
    const { isSOS, isMisinformation, platform, page = 1, limit = 30 } = req.query;
    const query = {};
    if (isSOS !== undefined) query.isSOS = isSOS === 'true';
    if (isMisinformation !== undefined) query.isMisinformation = isMisinformation === 'true';
    if (platform) query.platform = platform;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await SocialPost.countDocuments(query);
    const docs  = await SocialPost.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)).lean();
    res.json({ success: true, total, data: docs });
  } catch (err) { next(err); }
};

exports.getPostById = async (req, res, next) => {
  try {
    const doc = await SocialPost.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.ingestPost = async (req, res, next) => {
  try {
    const { platform, text, author, locationText, postedAt } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'text is required' });
    const doc = await SocialPost.create({ platform, text, author, locationText, postedAt });
    runNlpOnPost(doc);
    res.status(201).json({ success: true, data: doc, message: 'Ingested; NLP processing in background' });
  } catch (err) { next(err); }
};

exports.batchIngestPosts = async (req, res, next) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || posts.length === 0) return res.status(400).json({ success: false, message: 'posts array required' });
    if (posts.length > 50) return res.status(400).json({ success: false, message: 'Max 50 posts per batch' });
    const created = await SocialPost.insertMany(posts);
    const results = await batchClassify(created.map(p => p.text));
    await Promise.all(created.map((doc, i) => {
      const nlp = results[i] || {};
      return SocialPost.findByIdAndUpdate(doc._id, {
        urgencyScore: nlp.urgency_score, sentimentScore: nlp.sentiment_score,
        isSOS: nlp.is_sos, disasterType: nlp.disaster_type,
        extractedLocation: nlp.location_hint, keywords: nlp.keywords || [], nlpProcessed: true,
      });
    }));
    res.status(201).json({ success: true, inserted: created.length });
  } catch (err) { next(err); }
};

exports.getSosFeed = async (req, res, next) => {
  try {
    const docs = await SocialPost.find({ isSOS: true }).sort('-createdAt').limit(50).lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.getPanicMeter = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 3600000);
    const agg = await SocialPost.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$disasterType', avgUrgency: { $avg: '$urgencyScore' }, sosCount: { $sum: { $cond: ['$isSOS', 1, 0] } }, totalPosts: { $sum: 1 } } },
      { $sort: { avgUrgency: -1 } },
    ]);
    const overallPanic = agg.reduce((a, v) => a + (v.avgUrgency || 0), 0) / (agg.length || 1);
    if (global.io) global.io.emit('panic:level', { areas: agg, overallPanic });
    res.json({ success: true, data: { byType: agg, overallPanic: +overallPanic.toFixed(2) } });
  } catch (err) { next(err); }
};

exports.getMisinformation = async (req, res, next) => {
  try {
    const docs = await SocialPost.find({ isMisinformation: true }).sort('-createdAt').limit(50).lean();
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.getClusters = async (req, res, next) => {
  try {
    const sosPosts = await SocialPost.find({ isSOS: true, nlpProcessed: true }).limit(100).lean();
    const clusters = await clusterSosPosts(sosPosts.map(p => ({ id: p._id.toString(), text: p.text })));
    res.json({ success: true, data: clusters });
  } catch (err) { next(err); }
};

exports.flagPost = async (req, res, next) => {
  try {
    const { flag } = req.body;
    const doc = await SocialPost.findByIdAndUpdate(req.params.id, { flaggedManually: flag, isMisinformation: flag }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};
