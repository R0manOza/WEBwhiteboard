import express, { Request, Response } from 'express';
import admin from '../config/firebaseAdmin';
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const firestore = admin.firestore();

// POST /api/boards - Create a new board
router.post('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description = '', visibility = 'public' } = req.body;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'Board name is required' });
      return;
    }

    const boardId = uuidv4();
    const now = Date.now();
    const board = {
      id: boardId,
      name,
      description,
      visibility,
      ownerId: user.uid,
      members: { [user.uid]: 'owner' },
      createdAt: now,
      updatedAt: now,
    };
    await firestore.collection('boards').doc(boardId).set(board);

    res.status(201).json(board);
  } catch (err: any) {
    console.error('Error creating board:', err);
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// GET /api/boards - List boards for the current user
router.get('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const boardsRef = firestore.collection('boards');
    // Firestore does not support querying map keys directly, so we fetch all boards and filter in code
    const snapshot = await boardsRef.get();
    const boards = snapshot.docs
      .map(doc => doc.data())
      .filter(board => board.members && board.members[user.uid]);
    res.json(boards);
  } catch (err: any) {
    console.error('Error fetching boards:', err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// GET /api/boards/:id - Get a single board by ID
router.get('/:id', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const boardId = req.params.id;
    console.log(`[GET /api/boards/${boardId}] Requested by user:`, user ? user.uid : 'none');
    if (!user) {
      console.warn(`[GET /api/boards/${boardId}] Unauthorized: No user in request.`);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const doc = await firestore.collection('boards').doc(boardId).get();
    if (!doc.exists) {
      console.warn(`[GET /api/boards/${boardId}] Board not found.`);
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const board = doc.data();
    if (!board) {
      console.warn(`[GET /api/boards/${boardId}] Board data missing after doc.exists.`);
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const isMember = board.members && board.members[user.uid];
    const isPublic = board.visibility === 'public';
    if (isPublic || isMember) {
      // Pretty formatting: only return relevant fields, sorted keys
      const prettyBoard = {
        id: board.id,
        name: board.name,
        description: board.description || '',
        visibility: board.visibility,
        ownerId: board.ownerId,
        members: board.members,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      };
      console.log(`[GET /api/boards/${boardId}] Success. Returning board.`);
      res.json(prettyBoard);
    } else {
      console.warn(`[GET /api/boards/${boardId}] Forbidden: User ${user.uid} is not a member and board is not public.`);
      res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err) {
    console.error(`[GET /api/boards/:id] Error:`, err);
    res.status(500).json({ error: 'Failed to fetch board', details: err instanceof Error ? err.message : err });
  }
});

// PUT /api/boards/:id - Update board name, description, and visibility
router.put('/:id', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const boardId = req.params.id;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const boardRef = firestore.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();
    if (!boardDoc.exists) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const board = boardDoc.data();
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    if (board.ownerId !== user.uid) {
      res.status(403).json({ error: 'Only the board owner can update settings.' });
      return;
    }
    const { name, description = '', visibility = 'public', password } = req.body;
    const updateData: any = {
      name,
      description,
      visibility,
      updatedAt: Date.now(),
    };
    // Optionally handle password for private boards (not implemented here)
    await boardRef.update(updateData);
    const updatedDoc = await boardRef.get();
    res.json(updatedDoc.data());
  } catch (err) {
    console.error(`[PUT /api/boards/${req.params.id}] Error:`, err);
    res.status(500).json({ error: 'Failed to update board', details: err instanceof Error ? err.message : err });
  }
});

// DELETE /api/boards/:id - Delete a board
router.delete('/:id', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const boardId = req.params.id;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const boardRef = firestore.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();
    if (!boardDoc.exists) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const board = boardDoc.data();
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    if (board.ownerId !== user.uid) {
      res.status(403).json({ error: 'Only the board owner can delete this board.' });
      return;
    }
    await boardRef.delete();
    res.json({ success: true, message: 'Board deleted.' });
  } catch (err) {
    console.error(`[DELETE /api/boards/${req.params.id}] Error:`, err);
    res.status(500).json({ error: 'Failed to delete board', details: err instanceof Error ? err.message : err });
  }
});

export default router; 