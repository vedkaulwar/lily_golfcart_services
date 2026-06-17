const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let db = null;
let auth = null;

// Try to use Environment Variables first (for Render deployment)
try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const app = initializeApp({
          credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              // Replace escaped newlines with actual newlines to fix formatting issues in Render
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          })
      });
      db = getFirestore(app);
      auth = getAuth(app);
      console.log('Firebase Admin initialized successfully using Environment Variables.');
  } else {
      // Fallback to local serviceAccountKey.json file for local development
      const serviceAccount = require('../../serviceAccountKey.json');
      const app = initializeApp({
        credential: cert(serviceAccount)
      });
      db = getFirestore(app);
      auth = getAuth(app);
      console.log('Firebase Admin initialized successfully using serviceAccountKey.json.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin. Please ensure serviceAccountKey.json exists in the root directory.', error.message);
}

module.exports = { db, auth };
