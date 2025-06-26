import express, { Router, Response } from 'express';
import admin from '../config/firebaseAdmin';
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid'; 
const firestore = admin.firestore();
const router: Router = express.Router({ mergeParams: true });
interface Position {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}
type ContainerType = 'notes' | 'links' | 'drawing';
interface ContainerData {
  id: string;
  boardId: string;
  name: string;
  position: Position;
  size: Size;
  type: ContainerType;
  createdAt: number;
  updatedAt: number;
  ownerId: string; 
  
}
router.post('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
     const { boardId } = req.params;
const {
    name,
    type, 
    position, 
    size, 
  } = req.body;
  console.log(`[POST /api/boards/${boardId}/containers] Received type from req.body: "${type}"`);
  const user = req.user;

  console.log(`[POST /api/boards/${boardId}/containers] Attempting to create container. User: ${user?.uid}, Name: ${name}, Type: ${type}`);
   

  if (!user) {
    console.log(`[POST /api/boards/${boardId}/containers] Unauthorized - No user on request.`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
// --- Input Validation ------------------------------------------------------------------------------------------------------------
  if (!boardId || typeof boardId !== 'string') {
    res.status(400).json({ error: 'Board ID parameter is required and must be a string.' });
    return;
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'Container name is required and must be a non-empty string.' });
    return;
  }
  if (!type || !['notes', 'links', 'drawing'].includes(type)) { // Validate type
    res.status(400).json({ error: "Container type is required and must be one of: 'notes', 'links', 'drawing'." });
    return;
  }
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    res.status(400).json({ error: 'Container position (with x and y coordinates) is required and must be numbers.' });
    return;
  }
  if (!size || typeof size.width !== 'number' || typeof size.height !== 'number' || size.width <= 0 || size.height <= 0) {
    res.status(400).json({ error: 'Container size (with width and height) is required, and dimensions must be positive numbers.' });
    return;
  }
  // --- End Input Validation --------------------------------------------------------------------------------------------------------------

  try {
    const boardRef = firestore.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();
     if (!boardDoc.exists) {
      console.log(`[POST /api/boards/${boardId}/containers] Board not found: ${boardId}`);
      res.status(404).json({ error: 'Board not found.' });
      return;
    }
    const containerId = uuidv4();
    const now = Date.now();
    const newContainer: ContainerData = {
      id: containerId,
      boardId: boardId,
      name: name.trim(),
      type: type as ContainerType, // Cast to type after validation
      position: { x: position.x, y: position.y },
      size: { width: size.width, height: size.height },
      createdAt: now,
      updatedAt: now,
      ownerId: user.uid,
    };
    await firestore.collection('boards').doc(boardId).collection('containers').doc(containerId).set(newContainer);
    console.log(`[POST /api/boards/${boardId}/containers] Container created successfully: ${containerId}`);
    
    // Emit event to notify other users in the board via Socket.IO
    const io = req.app.get('socketio'); 
    if (io) {
      io.to(`board:${boardId}`).emit('containerCreated', newContainer);
      console.log(`[Socket EMIT board:${boardId}] containerCreated:`, newContainer.id);
    } else {
      console.warn('Socket.IO instance not found on app object. Cannot emit containerCreated.');
    }
    // Emit event to notify other users in the board
     res.status(201).json(newContainer);
     } catch (error: any) {
    console.error(`[POST /api/boards/${boardId}/containers] Error creating container:`, error);
    res.status(500).json({ error: 'Failed to create container', details: error.message });
  }
});
router.get('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { boardId } = req.params;
    const user = req.user;

    console.log(`[GET /api/boards/${boardId}/containers] Attempting to fetch containers. User: ${user?.uid}`);

    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!boardId) {
        res.status(400).json({ error: 'Board ID parameter is missing.' });
        return;
    }

    try {
        const boardRef = firestore.collection('boards').doc(boardId);
        const boardDoc = await boardRef.get();
        if (!boardDoc.exists) {
            res.status(404).json({ error: 'Board not found.' });
            return;
        }
        // TODO: Access control - check if user is member of board or if board is public

        const containersSnapshot = await firestore.collection('boards').doc(boardId).collection('containers').orderBy('createdAt', 'asc').get();
        const containers = containersSnapshot.docs.map(doc => doc.data() as ContainerData);
        
        console.log(`[GET /api/boards/${boardId}/containers] Successfully fetched ${containers.length} containers.`);
        res.status(200).json(containers);

    } catch (error: any) {
        console.error(`[GET /api/boards/${boardId}/containers] Error fetching containers:`, error);
        res.status(500).json({ error: 'Failed to fetch containers', details: error.message });
    }
});
export default router; 
