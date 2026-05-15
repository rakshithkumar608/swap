// src/services/fcmService.js
const admin = require('../config/firebase');

const sendToTokens = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return null;
  try {
    const message = {
      notification: { title, body },
      data: { ...data, timestamp: Date.now().toString() },
      tokens,
      android:  { priority: 'high', notification: { sound: 'default', channelId: 'resqai-alerts' } },
      webpush:  { notification: { icon: '/icon.png', badge: '/badge.png', requireInteraction: true } },
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`FCM tokens: ${response.successCount} sent, ${response.failureCount} failed`);
    return response;
  } catch (err) {
    console.error('FCM token send error:', err.message);
    return null;
  }
};

const sendToTopic = async (topic, title, body, data = {}) => {
  try {
    const message = {
      notification: { title, body },
      data: { ...data, timestamp: Date.now().toString() },
      topic,
      android: { priority: 'high' },
    };
    const response = await admin.messaging().send(message);
    console.log(`FCM topic "${topic}" sent:`, response);
    return response;
  } catch (err) {
    console.error('FCM topic send error:', err.message);
    return null;
  }
};

const subscribeToTopic = async (tokens, topic) => {
  try {
    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    return response;
  } catch (err) {
    console.error('FCM subscribe error:', err.message);
    return null;
  }
};

const sendDisasterAlert = async (disaster, users) => {
  const tokens = users.flatMap(u => u.fcmTokens || []).filter(Boolean);
  const title  = `🚨 ${disaster.severity.toUpperCase()} ALERT: ${disaster.type.toUpperCase()}`;
  const body   = disaster.title;
  const data   = { disasterId: disaster._id.toString(), type: disaster.type, severity: disaster.severity };
  if (tokens.length > 0) await sendToTokens(tokens, title, body, data);
  await sendToTopic('all-responders', title, body, data);
};

const sendSosAlert = async (sos) => {
  const title = '🆘 HIGH PRIORITY SOS';
  const body  = `${sos.senderName || 'Unknown'}: ${sos.message.substring(0, 80)}`;
  const data  = { sosId: sos._id.toString(), urgency: String(sos.urgencyScore || 0) };
  await sendToTopic('sos-high-urgency', title, body, data);
};

module.exports = { sendToTokens, sendToTopic, subscribeToTopic, sendDisasterAlert, sendSosAlert };
