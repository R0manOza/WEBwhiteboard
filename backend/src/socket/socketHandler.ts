import { Server, Socket } from 'socket.io';
import admin from '../config/firebaseAdmin';

export function initializeSocket(io: Server) {
  // In-memory map: boardId -> { userId: displayName }
  const onlineUsersByBoard: { [boardId: string]: { [userId: string]: string } } = {};

  // Authenticate socket connections using Firebase ID token
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No auth token'));
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`User connected: ${user.uid}`);

    // Track which board rooms this socket has joined
    const joinedBoards = new Set<string>();

    // Join board room
    socket.on('joinBoardRoom', async ({ boardId }) => {
      console.log(`User ${user.uid} joined board: ${boardId}`);
      socket.join(`board:${boardId}`);
      joinedBoards.add(boardId);

      // Fetch displayName from Firestore
      let displayName = user.name || user.displayName || '';
      try {
        const userDoc = await admin.firestore().collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.displayName) displayName = userData.displayName;
        }
      } catch (e) {
        console.warn('Could not fetch user displayName from Firestore:', e);
      }

      // Add to online users map
      if (!onlineUsersByBoard[boardId]) onlineUsersByBoard[boardId] = {};
      onlineUsersByBoard[boardId][user.uid] = displayName;

      // Broadcast updated online users list
      io.to(`board:${boardId}`).emit('onlineUsers', {
        boardId,
        users: Object.entries(onlineUsersByBoard[boardId]).map(([uid, name]) => ({ userId: uid, displayName: name }))
      });
    });

    // Handle cursor position events
    socket.on('cursorPosition', ({ boardId, x, y }) => {
      console.log(`Cursor from ${user.uid} on board ${boardId}: (${x}, ${y})`);
      socket.to(`board:${boardId}`).emit('cursorMoved', { boardId, userId: user.uid, x, y });
    });

    // Handle drawing status events
    socket.on('drawingStatus', ({ boardId, isDrawing }) => {
      socket.to(`board:${boardId}`).emit('userDrawingStatus', {
        boardId,
        userId: user.uid,
        isDrawing,
      });
    });

    // Handle drawing stroke events
    socket.on('strokeStart', ({ boardId, strokeId, color, brushSize, opacity }) => {
      console.log(`Stroke start from ${user.uid} on board ${boardId}: ${strokeId}`);
      socket.to(`board:${boardId}`).emit('strokeStart', {
        boardId,
        strokeId,
        userId: user.uid,
        color,
        brushSize,
        opacity
      });
    });

    socket.on('strokePoint', ({ boardId, strokeId, point }) => {
      socket.to(`board:${boardId}`).emit('strokePoint', {
        boardId,
        strokeId,
        userId: user.uid,
        point
      });
    });

    socket.on('strokeEnd', ({ boardId, strokeId }) => {
      console.log(`Stroke end from ${user.uid} on board ${boardId}: ${strokeId}`);
      socket.to(`board:${boardId}`).emit('strokeEnd', {
        boardId,
        strokeId,
        userId: user.uid
      });
    });

    // Handle container drawing events
    socket.on('containerDrawingStatus', ({ boardId, containerId, isDrawing }) => {
      socket.to(`board:${boardId}`).emit('containerUserDrawingStatus', {
        boardId,
        containerId,
        userId: user.uid,
        isDrawing,
      });
    });

    socket.on('containerStrokeStart', ({ boardId, containerId, strokeId, color, brushSize, opacity }) => {
      console.log(`Container stroke start from ${user.uid} on board ${boardId}, container ${containerId}: ${strokeId}`);
      socket.to(`board:${boardId}`).emit('containerStrokeStart', {
        boardId,
        containerId,
        strokeId,
        userId: user.uid,
        color,
        brushSize,
        opacity
      });
    });

    socket.on('containerStrokePoint', ({ boardId, containerId, strokeId, point }) => {
      socket.to(`board:${boardId}`).emit('containerStrokePoint', {
        boardId,
        containerId,
        strokeId,
        userId: user.uid,
        point
      });
    });

    socket.on('containerStrokeEnd', ({ boardId, containerId, strokeId }) => {
      console.log(`Container stroke end from ${user.uid} on board ${boardId}, container ${containerId}: ${strokeId}`);
      socket.to(`board:${boardId}`).emit('containerStrokeEnd', {
        boardId,
        containerId,
        strokeId,
        userId: user.uid
      });
    });

    // Handle clear board drawing event
    socket.on('clearBoardDrawing', ({ boardId }) => {
      io.to(`board:${boardId}`).emit('clearBoardDrawing', { boardId });
    });

    // Add more event handlers as needed

    // Handle disconnect
    socket.on('disconnect', () => {
      for (const boardId of joinedBoards) {
        if (onlineUsersByBoard[boardId]) {
          delete onlineUsersByBoard[boardId][user.uid];
          // Broadcast updated list
          io.to(`board:${boardId}`).emit('onlineUsers', {
            boardId,
            users: Object.entries(onlineUsersByBoard[boardId]).map(([uid, name]) => ({ userId: uid, displayName: name }))
          });
        }
      }
      console.log(`User disconnected: ${user.uid}`);
    });
  });
} 