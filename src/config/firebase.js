const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let db = null;
let auth = null;

// We will expect a serviceAccountKey.json file in the root
try {
  const serviceAccount = require('../../serviceAccountKey.json');
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  db = getFirestore(app);
  auth = getAuth(app);
  console.log('Firebase Admin initialized successfully.');
} catch (error) {
  console.error('Failed to initialize Firebase Admin. Please ensure serviceAccountKey.json exists in the root directory.', error.message);
}

module.exports = { db, auth };
