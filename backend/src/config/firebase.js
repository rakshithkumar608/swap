// src/config/firebase.js
const admin = require('firebase-admin');

const hasFirebaseCreds =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

if (hasFirebaseCreds) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id:   process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅  Firebase Admin initialised');
} else {
  console.warn('⚠️  Firebase creds not set — FCM push notifications disabled');
}

module.exports = admin;