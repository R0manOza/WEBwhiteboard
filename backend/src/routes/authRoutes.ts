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
                friends: [],
                friendRequests: [],
                sentRequests: [],
            });
            console.log(`New user created in Firestore: ${uid}`);
        } else {
            // Existing user, update last login time and ensure friend fields exist
            console.log('User exists in Firestore, updating lastLoginAt...');
            const userData = userSnapshot.data();
            const updateData: any = {
                lastLoginAt: new Date().toISOString(),
            };
            if (userData) {
                if (!userData.friends) updateData.friends = [];
                if (!userData.friendRequests) updateData.friendRequests = [];
                if (!userData.sentRequests) updateData.sentRequests = [];
            }
            await userRef.update(updateData);
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
    // Check if a specific UID is requested via query parameter
    const requestedUid = req.query.uid as string;
    const uid = requestedUid || req.user?.uid;
    
    console.log('🔍 /api/auth/userInfo called');
    console.log('🔍 Full query object:', req.query);
    console.log('🔍 Requested UID:', requestedUid);
    console.log('🔍 Current user UID:', req.user?.uid);
    console.log('🔍 Final UID to fetch:', uid);
    console.log('🔍 Requested UID type:', typeof requestedUid);
    console.log('🔍 Requested UID length:', requestedUid?.length);
    
    if (!uid) {
        console.log('🔍 No UID provided, returning 400');
        res.status(400).json({ error: 'User ID is required' });
        return;
    }
    
    try {
        console.log('🔍 Fetching user from Firestore with UID:', uid);
        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            console.log('🔍 User not found in Firestore:', uid);
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const userData = userSnapshot.data();
        console.log('🔍 User data found:', userData);
        console.log('🔍 User displayName:', userData?.displayName);
        
        const response = {
            uid: userData?.uid,
            email: userData?.email,
            displayName: userData?.displayName,
            photoURL: userData?.photoURL,
            createdAt: userData?.createdAt,
            lastLoginAt: userData?.lastLoginAt,
        };
        
        console.log('🔍 Sending response:', response);
        res.status(200).json(response);
    } catch (error) {
        console.error('🔍 Error fetching user info:', error);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});
// User search endpoint for autocomplete (by displayName, starts with, case-insensitive)
router.get('/users/search', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const query = (req.query.query as string || '').trim();
    if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
    }
    try {
        // Firestore is case-sensitive, so for case-insensitive search, fetch a range and filter in JS
        const end = query.replace(/.$/, c => String.fromCharCode(c.charCodeAt(0) + 1));
        const snap = await firestore.collection('users')
            .where('displayName', '>=', query)
            .where('displayName', '<', end)
            .limit(10)
            .get();
        // Filter for case-insensitive match
        const users = snap.docs
            .map(doc => doc.data())
            .filter(u => u.displayName && u.displayName.toLowerCase().startsWith(query.toLowerCase()))
            .map(u => ({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL }));
        res.json(users);
    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).json({ error: 'Failed to search users' });
    }
});



export default router;