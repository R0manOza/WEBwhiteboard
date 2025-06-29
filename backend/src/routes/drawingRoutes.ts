import express, { Request, Response } from 'express';
import admin from '../config/firebaseAdmin';
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { BoardDrawing, DrawingStroke } from '../../../shared/types';

const router = express.Router({ mergeParams: true });
const firestore = admin.firestore();

const DRAWINGS_COLLECTION = 'boardDrawings';

// GET /api/boards/:boardId/drawing - Get board drawing data
router.get('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId } = req.params;
  const user = req.user;

  console.log(`[GET /api/boards/${boardId}/drawing] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId) {
    res.status(400).json({ error: 'Board ID is required' });
    return;
  }

  try {
    // First check if user has access to the board
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

    const isMember = board.members && board.members[user.uid];
    const isPublic = board.visibility === 'public';
    
    if (!isPublic && !isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Get drawing data
    const drawingRef = firestore.collection(DRAWINGS_COLLECTION).doc(boardId);
    const drawingDoc = await drawingRef.get();

    if (drawingDoc.exists) {
      const drawingData = drawingDoc.data() as BoardDrawing;
      console.log(`[GET /api/boards/${boardId}/drawing] Drawing found with ${drawingData.strokes.length} strokes`);
      res.json(drawingData);
    } else {
      console.log(`[GET /api/boards/${boardId}/drawing] No drawing data found`);
      res.json({ boardId, strokes: [], lastUpdated: Date.now() });
    }
  } catch (error: any) {
    console.error(`[GET /api/boards/${boardId}/drawing] Error:`, error);
    res.status(500).json({ error: 'Failed to fetch drawing data' });
  }
});

// POST /api/boards/:boardId/drawing - Save board drawing data
router.post('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId } = req.params;
  const { strokes } = req.body;
  const user = req.user;

  console.log(`[POST /api/boards/${boardId}/drawing] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId) {
    res.status(400).json({ error: 'Board ID is required' });
    return;
  }

  if (!Array.isArray(strokes)) {
    res.status(400).json({ error: 'Strokes must be an array' });
    return;
  }

  try {
    // First check if user has access to the board
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

    const isMember = board.members && board.members[user.uid];
    const isPublic = board.visibility === 'public';
    
    if (!isPublic && !isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Save drawing data
    const drawingRef = firestore.collection(DRAWINGS_COLLECTION).doc(boardId);
    const drawingData: BoardDrawing = {
      boardId,
      strokes,
      lastUpdated: Date.now()
    };

    await drawingRef.set(drawingData);
    console.log(`[POST /api/boards/${boardId}/drawing] Drawing saved with ${strokes.length} strokes`);

    // Emit real-time event to other users
    const io = req.app.get('socketio');
    if (io) {
      io.to(`board:${boardId}`).emit('drawingSaved', {
        boardId,
        strokes,
        lastUpdated: drawingData.lastUpdated,
        userId: user.uid
      });
      console.log(`[Socket EMIT board:${boardId}] drawingSaved`);
    }

    res.status(200).json(drawingData);
  } catch (error: any) {
    console.error(`[POST /api/boards/${boardId}/drawing] Error:`, error);
    res.status(500).json({ error: 'Failed to save drawing data' });
  }
});

// POST /api/boards/:boardId/drawing/stroke - Add a single stroke
router.post('/stroke', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId } = req.params;
  const { stroke } = req.body;
  const user = req.user;

  console.log(`[POST /api/boards/${boardId}/drawing/stroke] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId) {
    res.status(400).json({ error: 'Board ID is required' });
    return;
  }

  if (!stroke || typeof stroke !== 'object') {
    res.status(400).json({ error: 'Valid stroke object is required' });
    return;
  }

  try {
    // First check if user has access to the board
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

    const isMember = board.members && board.members[user.uid];
    const isPublic = board.visibility === 'public';
    
    if (!isPublic && !isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Get current drawing data
    const drawingRef = firestore.collection(DRAWINGS_COLLECTION).doc(boardId);
    const drawingDoc = await drawingRef.get();
    
    let currentStrokes: DrawingStroke[] = [];
    if (drawingDoc.exists) {
      const data = drawingDoc.data() as BoardDrawing;
      currentStrokes = data.strokes;
    }

    // Add new stroke
    const updatedStrokes = [...currentStrokes, stroke];
    const updatedDrawing: BoardDrawing = {
      boardId,
      strokes: updatedStrokes,
      lastUpdated: Date.now()
    };

    await drawingRef.set(updatedDrawing);
    console.log(`[POST /api/boards/${boardId}/drawing/stroke] Stroke added, total strokes: ${updatedStrokes.length}`);

    // Emit real-time event to other users
    const io = req.app.get('socketio');
    if (io) {
      io.to(`board:${boardId}`).emit('strokeAdded', {
        boardId,
        stroke,
        totalStrokes: updatedStrokes.length,
        userId: user.uid
      });
      console.log(`[Socket EMIT board:${boardId}] strokeAdded`);
    }

    res.status(200).json(updatedDrawing);
  } catch (error: any) {
    console.error(`[POST /api/boards/${boardId}/drawing/stroke] Error:`, error);
    res.status(500).json({ error: 'Failed to add stroke' });
  }
});

// DELETE /api/boards/:boardId/drawing - Clear board drawing
router.delete('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId } = req.params;
  const user = req.user;

  console.log(`[DELETE /api/boards/${boardId}/drawing] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId) {
    res.status(400).json({ error: 'Board ID is required' });
    return;
  }

  try {
    // First check if user has access to the board
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

    const isMember = board.members && board.members[user.uid];
    const isPublic = board.visibility === 'public';
    
    if (!isPublic && !isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Clear drawing data
    const drawingRef = firestore.collection(DRAWINGS_COLLECTION).doc(boardId);
    const clearedDrawing: BoardDrawing = {
      boardId,
      strokes: [],
      lastUpdated: Date.now()
    };

    await drawingRef.set(clearedDrawing);
    console.log(`[DELETE /api/boards/${boardId}/drawing] Drawing cleared`);

    // Emit real-time event to other users
    const io = req.app.get('socketio');
    if (io) {
      io.to(`board:${boardId}`).emit('drawingCleared', {
        boardId,
        userId: user.uid
      });
      console.log(`[Socket EMIT board:${boardId}] drawingCleared`);
    }

    res.status(200).json(clearedDrawing);
  } catch (error: any) {
    console.error(`[DELETE /api/boards/${boardId}/drawing] Error:`, error);
    res.status(500).json({ error: 'Failed to clear drawing' });
  }
});

export default router; 