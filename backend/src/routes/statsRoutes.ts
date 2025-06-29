import express, { Request, Response } from 'express';
import { verifyTokenMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/stats/connections - Get active connections count
router.get('/connections', verifyTokenMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get the getActiveConnections function from the socket handler
    const socketHandlers = req.app.get('socketHandlers');
    if (!socketHandlers) {
      res.status(500).json({ error: 'Socket handlers not available' });
      return;
    }

    const activeConnections = socketHandlers.getActiveConnections();
    
    res.json({ 
      activeConnections,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('Error fetching active connections:', error);
    res.status(500).json({ error: 'Failed to fetch active connections' });
  }
});

export default router; 