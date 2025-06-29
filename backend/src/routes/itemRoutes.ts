// Create new file: backend/src/routes/itemRoutes.ts
import express, { Router, Response } from 'express';
import admin from '../config/firebaseAdmin'; // Or your correct path to the initialized admin object
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import type { NoteItem, LinkItem } from '../../../shared/types';

const router: Router = express.Router({ mergeParams: true }); // 'mergeParams' is crucial for getting :boardId and :containerId
const firestore = admin.firestore();

// GET /api/boards/:boardId/containers/:containerId/items - Get all items for a container
router.get('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId, containerId } = req.params;
  const user = req.user;

  console.log(`[GET /api/boards/${boardId}/containers/${containerId}/items] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId || !containerId) {
    res.status(400).json({ error: 'Board ID and Container ID are required.' });
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

    // Get all items for this container
    const itemsSnapshot = await containerRef.collection('items').orderBy('createdAt', 'asc').get();
    const items = itemsSnapshot.docs.map(doc => doc.data());

    console.log(`[GET /api/boards/${boardId}/containers/${containerId}/items] Found ${items.length} items`);
    res.json(items);

  } catch (error: any) {
    console.error(`[GET /api/boards/${boardId}/containers/${containerId}/items] Error:`, error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/boards/:boardId/containers/:containerId/items - Create a new item
router.post('/', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId, containerId } = req.params;
  const { type, title, content, url, description, color } = req.body;
  const user = req.user;

  console.log(`[POST /api/boards/${boardId}/containers/${containerId}/items] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId || !containerId) {
    res.status(400).json({ error: 'Board ID and Container ID are required.' });
    return;
  }

  if (!type || !['note', 'link'].includes(type)) {
    res.status(400).json({ error: "Invalid item type. Must be 'note' or 'link'." });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required.' });
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

    let newItem: NoteItem | LinkItem;

    if (type === 'note') {
      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Content is required for notes.' });
        return;
      }

      newItem = {
        id: itemId,
        containerId,
        title: title.trim(),
        content: content.trim(),
        color: color || '#fef3c7',
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      } as NoteItem;
    } else {
      // type === 'link'
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'URL is required for links.' });
        return;
      }

      // Add protocol if missing
      let urlToSave = url.trim();
      if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
        urlToSave = 'https://' + urlToSave;
      }

      newItem = {
        id: itemId,
        containerId,
        url: urlToSave,
        title: title.trim(),
        description: description?.trim() || '',
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      } as LinkItem;
    }

    // Save the new item in a subcollection named 'items' under the container
    await containerRef.collection('items').doc(itemId).set(newItem);
    console.log(`[POST /api/boards/${boardId}/containers/${containerId}/items] ${type} item created: ${itemId}`);

    // Emit real-time event to other users
    const io = req.app.get('socketio');
    if (io) {
      io.to(`board:${boardId}`).emit('itemCreated', {
        boardId,
        containerId,
        item: newItem,
        userId: user.uid
      });
      console.log(`[Socket EMIT board:${boardId}] itemCreated`);
    }

    res.status(201).json(newItem);

  } catch (error: any) {
    console.error(`[POST /api/boards/${boardId}/containers/${containerId}/items] Error:`, error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/boards/:boardId/containers/:containerId/items/:itemId - Update an item
router.put('/:itemId', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId, containerId, itemId } = req.params;
  const updates = req.body;
  const user = req.user;

  console.log(`[PUT /api/boards/${boardId}/containers/${containerId}/items/${itemId}] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId || !containerId || !itemId) {
    res.status(400).json({ error: 'Board ID, Container ID, and Item ID are required.' });
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

    // Check if the item exists
    const itemRef = containerRef.collection('items').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    // Update the item
    const updateData = {
      ...updates,
      updatedAt: Date.now()
    };

    await itemRef.update(updateData);
    console.log(`[PUT /api/boards/${boardId}/containers/${containerId}/items/${itemId}] Item updated`);

    // Get the updated item
    const updatedItemDoc = await itemRef.get();
    const updatedItem = updatedItemDoc.data();

    // Emit real-time event to other users
    const io = req.app.get('socketio');
    if (io) {
      io.to(`board:${boardId}`).emit('itemUpdated', {
        boardId,
        containerId,
        itemId,
        updates: updateData,
        item: updatedItem,
        userId: user.uid
      });
      console.log(`[Socket EMIT board:${boardId}] itemUpdated`);
    }

    res.json(updatedItem);

  } catch (error: any) {
    console.error(`[PUT /api/boards/${boardId}/containers/${containerId}/items/${itemId}] Error:`, error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/boards/:boardId/containers/:containerId/items/:itemId - Delete an item
router.delete('/:itemId', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { boardId, containerId, itemId } = req.params;
  const user = req.user;

  console.log(`[DELETE /api/boards/${boardId}/containers/${containerId}/items/${itemId}] Requested by user: ${user?.uid}`);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!boardId || !containerId || !itemId) {
    res.status(400).json({ error: 'Board ID, Container ID, and Item ID are required.' });
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

    // Check if the item exists
    const itemRef = containerRef.collection('items').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    // Delete the item
    await itemRef.delete();
    console.log(`[DELETE /api/boards/${boardId}/containers/${containerId}/items/${itemId}] Item deleted`);

    // Emit real-time event to other users
    const io = req.app.get('socketio');
    if (io) {
      io.to(`board:${boardId}`).emit('itemDeleted', {
        boardId,
        containerId,
        itemId,
        userId: user.uid
      });
      console.log(`[Socket EMIT board:${boardId}] itemDeleted`);
    }

    res.json({ success: true, message: 'Item deleted successfully' });

  } catch (error: any) {
    console.error(`[DELETE /api/boards/${boardId}/containers/${containerId}/items/${itemId}] Error:`, error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;