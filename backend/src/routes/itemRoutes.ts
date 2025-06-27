// Create new file: backend/src/routes/itemRoutes.ts
import express, { Router, Response } from 'express';
import admin from '../config/firebaseAdmin'; // Or your correct path to the initialized admin object
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router({ mergeParams: true }); // 'mergeParams' is crucial for getting :boardId and :containerId
const firestore = admin.firestore();

// Define the shape of a single note item
interface NoteItemData {
  id: string;
  boardId: string;
  containerId: string;
  type: 'note';
  content: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

// This handles: POST /api/boards/:boardId/containers/:containerId/items
router.post('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId, containerId } = req.params;
  const { type, content } = req.body;
  const user = req.user;

  // --- Validation ---
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!boardId || !containerId) {
    res.status(400).json({ error: 'Board ID and Container ID are required.' });
    return;
  }
  if (type !== 'note') {
    res.status(400).json({ error: "Invalid item type. Only 'note' is supported for now." });
    return;
  }
  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'Note content is required.' });
    return;
  }

  try {
    // Check if the parent container exists
    const containerRef = firestore.collection('boards').doc(boardId).collection('containers').doc(containerId);
    const containerDoc = await containerRef.get();
    if (!containerDoc.exists) {
      res.status(404).json({ error: 'Parent container not found.' });
      return;
    }

    const itemId = uuidv4();
    const now = Date.now();

    const newItem: NoteItemData = {
      id: itemId,
      boardId,
      containerId,
      type: 'note',
      content: content,
      ownerId: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    // Save the new item in a subcollection named 'items' under the container
    await containerRef.collection('items').doc(itemId).set(newItem);
    console.log(`[ITEM POST] Note item created: ${itemId} in container ${containerId}`);

    // TODO: Emit socket event 'itemCreated' later
    
    res.status(201).json(newItem);

  } catch (error: any) {
    console.error(`[ITEM POST] Error creating item:`, error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

export default router;