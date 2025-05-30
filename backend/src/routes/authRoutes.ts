import express, { Router, Request, Response } from 'express';
import admin from '../config/firebaseAdmin'; // Import auth and firestore services
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth'; // Import your auth middleware

const firestore = admin.firestore();


const router: Router = express.Router();
// POST /api/auth/login
// This endpoint receives a Firebase ID token from the client and  verifies it
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { idToken } = req.body;
    if (!idToken) {
        res.status(400).json({ error: 'ID token is required to log in' });
        return;
    }
    try {
        // Verify the id token using firebase admin sdk 
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name, picture } = decodedToken;
        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
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
            await userRef.update({
                lastLoginAt: new Date().toISOString(),
            });
            console.log(`User login updated in Firestore: ${uid}`);
        }
        
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
        console.error('Error during login:', error.code, error.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});
router.post('/logout', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  
  console.log(`User ${uid} logout request received.`);
  res.status(200).json({ message: 'Logout acknowledged.' });
});
export default router;