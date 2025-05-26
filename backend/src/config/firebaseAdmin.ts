// backend/src/config/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import path from 'path';

// __dirname here will be /path/to/project/backend/dist/config when compiled JS runs
// We want to go up two levels to 'backend/', then into 'config/firebase.json'
const keyPath = path.resolve(__dirname, '..', '..', 'config', 'firebase.json');

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(keyPath),
    });
    console.log('Firebase Admin SDK initialized successfully from:', keyPath);
  }
} catch (error: any) {
  console.error('Firebase Admin SDK initialization error:', error.message);
  console.error('Attempted key path:', keyPath);
}

export default admin;