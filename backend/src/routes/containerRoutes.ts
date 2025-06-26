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
  title: string; // Use 'title' for consistency with frontend
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
    title,
    type, 
    position, 
    size, 
  } = req.body;
  console.log(`[POST /api/boards/${boardId}/containers] Received type from req.body: "${type}"`);
  const user = req.user;

  console.log(`[POST /api/boards/${boardId}/containers] Attempting to create container. User: ${user?.uid}, Name: ${title}, Type: ${type}`);
   

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
  if (!title || typeof title !== 'string' || title.trim() === '') {
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
      title: title.trim(), // Use 'title' for consistency with frontend
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

// PUT /api/boards/:boardId/containers/:containerId - Update container position/size
router.put('/:containerId', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { boardId, containerId } = req.params;
    const { position, size } = req.body;
    const user = req.user;

    console.log(`[PUT /api/boards/${boardId}/containers/${containerId}] Attempting to update container. User: ${user?.uid}`);

    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    if (!boardId || !containerId) {
        res.status(400).json({ error: 'Board ID and Container ID parameters are required.' });
        return;
    }

    // Validate position and size if provided
    if (position && (typeof position.x !== 'number' || typeof position.y !== 'number')) {
        res.status(400).json({ error: 'Container position must have valid x and y coordinates.' });
        return;
    }

    if (size && (typeof size.width !== 'number' || typeof size.height !== 'number' || size.width <= 0 || size.height <= 0)) {
        res.status(400).json({ error: 'Container size must have valid positive width and height.' });
        return;
    }

    try {
        const boardRef = firestore.collection('boards').doc(boardId);
        const boardDoc = await boardRef.get();
        if (!boardDoc.exists) {
            res.status(404).json({ error: 'Board not found.' });
            return;
        }

        const containerRef = firestore.collection('boards').doc(boardId).collection('containers').doc(containerId);
        const containerDoc = await containerRef.get();
        if (!containerDoc.exists) {
            res.status(404).json({ error: 'Container not found.' });
            return;
        }

        // Build update object with only provided fields
        const updateData: Partial<ContainerData> = { updatedAt: Date.now() };
        if (position) updateData.position = position;
        if (size) updateData.size = size;

        await containerRef.update(updateData);
        
        // Get the updated container data
        const updatedContainerDoc = await containerRef.get();
        const updatedContainer = updatedContainerDoc.data() as ContainerData;

        console.log(`[PUT /api/boards/${boardId}/containers/${containerId}] Container updated successfully`);

        // Emit real-time event
        const io = req.app.get('socketio');
        if (io) {
            io.to(`board:${boardId}`).emit('containerUpdated', {
                boardId,
                containerId,
                updates: updateData,
                container: updatedContainer,
                userId: user.uid
            });
            console.log(`[Socket EMIT board:${boardId}] containerUpdated:`, containerId);
        } else {
            console.warn('Socket.IO instance not found on app object. Cannot emit containerUpdated.');
        }

        res.status(200).json(updatedContainer);

    } catch (error: any) {
        console.error(`[PUT /api/boards/${boardId}/containers/${containerId}] Error updating container:`, error);
        res.status(500).json({ error: 'Failed to update container', details: error.message });
    }
});

// DELETE /api/boards/:boardId/containers/:containerId - Delete container
router.delete('/:containerId', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { boardId, containerId } = req.params;
    const user = req.user;

    console.log(`[DELETE /api/boards/${boardId}/containers/${containerId}] Attempting to delete container. User: ${user?.uid}`);

    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    if (!boardId || !containerId) {
        res.status(400).json({ error: 'Board ID and Container ID parameters are required.' });
        return;
    }

    try {
        const boardRef = firestore.collection('boards').doc(boardId);
        const boardDoc = await boardRef.get();
        if (!boardDoc.exists) {
            res.status(404).json({ error: 'Board not found.' });
            return;
        }

        const containerRef = firestore.collection('boards').doc(boardId).collection('containers').doc(containerId);
        const containerDoc = await containerRef.get();
        if (!containerDoc.exists) {
            res.status(404).json({ error: 'Container not found.' });
            return;
        }

        // TODO: Add authorization check - only container owner or board owner can delete
        const containerData = containerDoc.data() as ContainerData;
        if (containerData.ownerId !== user.uid && boardDoc.data()?.ownerId !== user.uid) {
            res.status(403).json({ error: 'You do not have permission to delete this container.' });
            return;
        }

        await containerRef.delete();
        console.log(`[DELETE /api/boards/${boardId}/containers/${containerId}] Container deleted successfully`);

        // Emit real-time event
        const io = req.app.get('socketio');
        if (io) {
            io.to(`board:${boardId}`).emit('containerDeleted', {
                boardId,
                containerId
            });
            console.log(`[Socket EMIT board:${boardId}] containerDeleted:`, containerId);
        } else {
            console.warn('Socket.IO instance not found on app object. Cannot emit containerDeleted.');
        }

        res.status(200).json({ message: 'Container deleted successfully' });

    } catch (error: any) {
        console.error(`[DELETE /api/boards/${boardId}/containers/${containerId}] Error deleting container:`, error);
        res.status(500).json({ error: 'Failed to delete container', details: error.message });
    }
});

export default router; 
