import express, { Router, Request, Response } from 'express';
import admin from '../config/firebaseAdmin';
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';

const firestore = admin.firestore();
const router: Router = express.Router();

// POST /api/friends/request - Send a friend request by username
router.post('/request', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.body;
  const fromUid = req.user?.uid;
  if (!fromUid || !username) {
    res.status(400).json({ error: 'Missing user or username' });
    return;
  }
  try {
    // Find user by displayName
    const userSnap = await firestore.collection('users').where('displayName', '==', username).get();
    if (userSnap.empty) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const toUserDoc = userSnap.docs[0];
    const toUid = toUserDoc.get('uid');
    if (toUid === fromUid) {
      res.status(400).json({ error: 'Cannot add yourself as a friend' });
      return;
    }
    // Get both user docs
    const fromUserRef = firestore.collection('users').doc(fromUid);
    const toUserRef = firestore.collection('users').doc(toUid);
    const [fromUserSnap, toUserSnap] = await Promise.all([fromUserRef.get(), toUserRef.get()]);
    const fromUser = fromUserSnap.data() || {};
    const toUser = toUserSnap.data() || {};
    // Check if already friends
    if ((fromUser.friends || []).includes(toUid)) {
      res.status(400).json({ error: 'Already friends' });
      return;
    }
    // Check if already sent
    if ((fromUser.sentRequests || []).includes(toUid)) {
      res.status(400).json({ error: 'Request already sent' });
      return;
    }
    // Add to sentRequests and friendRequests
    await fromUserRef.update({
      sentRequests: admin.firestore.FieldValue.arrayUnion(toUid),
    });
    await toUserRef.update({
      friendRequests: admin.firestore.FieldValue.arrayUnion(fromUid),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error sending friend request:', err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// POST /api/friends/accept - Accept a friend request
router.post('/accept', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { fromUid } = req.body;
  const toUid = req.user?.uid;
  if (!fromUid || !toUid) {
    res.status(400).json({ error: 'Missing user' });
    return;
  }
  try {
    const fromUserRef = firestore.collection('users').doc(fromUid);
    const toUserRef = firestore.collection('users').doc(toUid);
    // Remove from requests, add to friends (both sides)
    await Promise.all([
      toUserRef.update({
        friendRequests: admin.firestore.FieldValue.arrayRemove(fromUid),
        friends: admin.firestore.FieldValue.arrayUnion(fromUid),
      }),
      fromUserRef.update({
        sentRequests: admin.firestore.FieldValue.arrayRemove(toUid),
        friends: admin.firestore.FieldValue.arrayUnion(toUid),
      }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error accepting friend request:', err);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// GET /api/friends/list - Get current user's friends list
router.get('/list', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    res.status(400).json({ error: 'Missing user' });
    return;
  }
  try {
    const userSnap = await firestore.collection('users').doc(uid).get();
    const user = userSnap.data();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const friends = user.friends || [];
    if (friends.length === 0) {
      res.json([]);
      return;
    }
    // Get friend user info
    const friendDocs = await firestore.collection('users').where('uid', 'in', friends.slice(0,10)).get();
    // Firestore 'in' queries limited to 10
    const friendList = friendDocs.docs.map(doc => {
      const d = doc.data();
      return { uid: d.uid, displayName: d.displayName, photoURL: d.photoURL };
    });
    res.json(friendList);
  } catch (err) {
    console.error('Error fetching friends list:', err);
    res.status(500).json({ error: 'Failed to fetch friends list' });
  }
});

// (Optional) GET /api/friends/requests - Get pending friend requests
router.get('/requests', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    res.status(400).json({ error: 'Missing user' });
    return;
  }
  try {
    const userSnap = await firestore.collection('users').doc(uid).get();
    const user = userSnap.data();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const requests = user.friendRequests || [];
    if (requests.length === 0) {
      res.json([]);
      return;
    }
    const reqDocs = await firestore.collection('users').where('uid', 'in', requests.slice(0,10)).get();
    const reqList = reqDocs.docs.map(doc => {
      const d = doc.data();
      return { uid: d.uid, displayName: d.displayName, photoURL: d.photoURL };
    });
    res.json(reqList);
  } catch (err) {
    console.error('Error fetching friend requests:', err);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

export default router; 