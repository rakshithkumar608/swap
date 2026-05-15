// src/services/nlpService.js
const axios = require('axios');

const NLP_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';
const NLP_KEY  = process.env.NLP_API_KEY || '';

const headers = () => ({ 'x-api-key': NLP_KEY });

const classifyPost = async (text) => {
  try {
    const { data } = await axios.post(
      `${NLP_URL}/classify/classify`,
      { text },
      { headers: headers(), timeout: 8000 }
    );
    return data;
  } catch (err) {
    console.warn('NLP classify error:', err.message);
    return { urgency_score: 0.5, is_sos: false, disaster_type: 'unknown', sentiment_score: 0, keywords: [], location_hint: '', model_confidence: 0.4 };
  }
};

const batchClassify = async (texts) => {
  try {
    const { data } = await axios.post(
      `${NLP_URL}/classify/classify/batch`,
      { texts },
      { headers: headers(), timeout: 30000 }
    );
    return data.results || [];
  } catch (err) {
    console.warn('NLP batch classify error:', err.message);
    return texts.map(() => ({ urgency_score: 0.5, is_sos: false, disaster_type: 'unknown' }));
  }
};

const clusterSosPosts = async (posts) => {
  try {
    const { data } = await axios.post(
      `${NLP_URL}/cluster/cluster`,
      { posts },
      { headers: headers(), timeout: 15000 }
    );
    return data.clusters || {};
  } catch (err) {
    console.warn('NLP cluster error:', err.message);
    return {};
  }
};

const checkMisinformation = async (text) => {
  try {
    const { data } = await axios.post(
      `${NLP_URL}/misinfo/misinfo`,
      { text },
      { headers: headers(), timeout: 8000 }
    );
    return data;
  } catch (err) {
    console.warn('NLP misinfo error:', err.message);
    return { is_misinformation: false, confidence: 0.3, reason: 'Service unavailable' };
  }
};

module.exports = { classifyPost, batchClassify, clusterSosPosts, checkMisinformation };
