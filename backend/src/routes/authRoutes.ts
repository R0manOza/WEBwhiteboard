import express, { Router, Request, Response } from 'express';
import admin from '../config/firebaseAdmin'; // Import auth and firestore services
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth'; // Import your auth middleware

const firestore = admin.firestore();


const router: Router = express.Router();
// POST /api/auth/login
// This endpoint receives a Firebase ID token from the client and  verifies it
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    console.log('--- /api/auth/login endpoint HIT ---');
    const { idToken } = req.body;
    console.log('Received req.body:', JSON.stringify(req.body)); // Log the whole body
    console.log('Received idToken:', idToken);
    if (!idToken) {
        console.log('idToken is missing, sending 400');
        res.status(400).json({ error: 'ID token is required to log in' });
        return;
    }
    try {
        console.log('Attempting to verify idToken...');
        // Verify the id token using firebase admin sdk 
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('idToken verified. UID:', decodedToken.uid);
        const { uid, email, name, picture } = decodedToken;
        
        const userRef = firestore.collection('users').doc(uid);
        console.log('Getting user snapshot from Firestore for UID:', uid);
        const userSnapshot = await userRef.get();
        console.log('User snapshot exists:', userSnapshot.exists);

        if (!userSnapshot.exists) {
             console.log('User does not exist in Firestore, creating...');
            // User does not exist, create a new user document in Firestore
            await userRef.set({
                uid,
                email,
                displayName: name || '', 
                photoURL: picture || '', 
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
            });
            console.log(`New user created in Firestore: ${uid}`);
        } else {
            // Existing user, update last login time
            console.log('User exists in Firestore, updating lastLoginAt...');
            await userRef.update({
                lastLoginAt: new Date().toISOString(),
            });
            console.log(`User login updated in Firestore: ${uid}`);
        }
        console.log('Login process successful, sending 200 response.');
        res.status(200).json({
            message: 'Login successful.',
            user: {
                uid,
                email,
                displayName: name,
                photoURL: picture,
            },
        });
    } catch (error: any) {
         console.error('--- ERROR IN /api/auth/login ---');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Full Error Object:', error);
        
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});
router.post('/logout', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  
  console.log(`User ${uid} logout request received.`);
  res.status(200).json({ message: 'Logout acknowledged.' });
});
router.get('/userInfo', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) {
        res.status(400).json({ error: 'User ID is required' });
        return;
    }
    try {
        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const userData = userSnapshot.data();
        res.status(200).json({
            uid: userData?.uid,
            email: userData?.email,
            displayName: userData?.displayName,
            photoURL: userData?.photoURL,
            createdAt: userData?.createdAt,
            lastLoginAt: userData?.lastLoginAt,
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

import bcrypt from 'bcrypt'; // bonus points stuff
const saltRounds = 10; // bonus points stuff

router.post('/hash', async (req: Request, res: Response) => {
  const { textToHash } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(textToHash, saltRounds);

    res.json({
      originalString: textToHash,
      algorithm: 'bcrypt',
      hash: hashedPassword
    });
  } catch (error) {
    res.status(500).json({ error: 'Hashing failed.' });
  }
});


export default router;