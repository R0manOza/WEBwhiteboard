import { Server, Socket } from 'socket.io';
import admin from '../config/firebaseAdmin';

export function initializeSocket(io: Server) {
  // In-memory map: boardId -> { userId: displayName }
  const onlineUsersByBoard: { [boardId: string]: { [userId: string]: string } } = {};
  
  // Global connection counter
  let activeConnections = 0;

  // Function to get active connections count (for API routes)
  const getActiveConnections = () => activeConnections;

  // Track all online user UIDs globally
  const onlineUserUids = new Set<string>();

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
    
    // Join personal room for notifications
    socket.join(user.uid);
    console.log(`Socket ${socket.id} joined personal room: ${user.uid}`);
    
    // Increment active connections counter
    activeConnections++;
    console.log(`Active connections: ${activeConnections}`);

    // Track which board rooms this socket has joined
    const joinedBoards = new Set<string>();

    // Join board room
    socket.on('joinBoardRoom', async ({ boardId }) => {
      console.log(`User ${user.uid} joined board: ${boardId}`);
      socket.join(`board:${boardId}`);
      joinedBoards.add(boardId);

      // Enhanced displayName fetching with multiple fallbacks
      let displayName = '';
      try {
        // First try to get from Firestore with better error handling
        const userDoc = await admin.firestore().collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.displayName && userData.displayName.trim()) {
            displayName = userData.displayName.trim();
            console.log(`Found displayName in Firestore: "${displayName}"`);
          }
        }
        
        // If no displayName in Firestore, try Firebase Auth user data
        if (!displayName) {
          try {
            const authUser = await admin.auth().getUser(user.uid);
            if (authUser.displayName && authUser.displayName.trim()) {
              displayName = authUser.displayName.trim();
              console.log(`Found displayName in Firebase Auth: "${displayName}"`);
            } else if (authUser.email) {
              displayName = authUser.email.split('@')[0];
              console.log(`Using email username as displayName: "${displayName}"`);
            }
          } catch (authError) {
            console.warn('Could not fetch Firebase Auth user data:', authError);
          }
        }
        
        // Final fallback: create a user-friendly name from UID
        if (!displayName) {
          displayName = `User${user.uid.substring(0, 6).toUpperCase()}`;
          console.log(`Using fallback displayName: "${displayName}"`);
        }
        
      } catch (e) {
        console.warn('Error fetching user displayName:', e);
        // Emergency fallback
        displayName = `User${user.uid.substring(0, 4).toUpperCase()}`;
        console.log(`Using emergency fallback displayName: "${displayName}"`);
      }

      // Validate displayName is not empty
      if (!displayName || displayName.trim() === '') {
        displayName = `User${user.uid.substring(0, 4).toUpperCase()}`;
        console.log(`DisplayName was empty, using: "${displayName}"`);
      }

      // Add to online users map
      if (!onlineUsersByBoard[boardId]) onlineUsersByBoard[boardId] = {};
      onlineUsersByBoard[boardId][user.uid] = displayName;

      console.log(`Final displayName for user ${user.uid}: "${displayName}"`);

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

    // Handle drawing persistence events
    socket.on('drawingSaved', ({ boardId, strokes, lastUpdated }) => {
      console.log(`Drawing saved from ${user.uid} on board ${boardId} with ${strokes.length} strokes`);
      socket.to(`board:${boardId}`).emit('drawingSaved', {
        boardId,
        strokes,
        lastUpdated,
        userId: user.uid
      });
    });

    socket.on('strokeAdded', ({ boardId, stroke }) => {
      console.log(`Stroke added from ${user.uid} on board ${boardId}: ${stroke.id}`);
      socket.to(`board:${boardId}`).emit('strokeAdded', {
        boardId,
        stroke,
        userId: user.uid
      });
    });

    socket.on('drawingCleared', ({ boardId }) => {
      console.log(`Drawing cleared from ${user.uid} on board ${boardId}`);
      socket.to(`board:${boardId}`).emit('drawingCleared', {
        boardId,
        userId: user.uid
      });
    });

    // Handle immediate container position updates (for real-time sync)
    socket.on('containerPositionUpdate', ({ boardId, containerId, position, userId }) => {
      console.log(`Container position update from ${user.uid} on board ${boardId}, container ${containerId}: (${position.x}, ${position.y})`);
      socket.to(`board:${boardId}`).emit('containerPositionUpdate', {
        boardId,
        containerId,
        position,
        userId: user.uid
      });
    });

    // Handle immediate container size updates (for real-time sync)
    socket.on('containerSizeUpdate', ({ boardId, containerId, size, userId }) => {
      console.log(`Container size update from ${user.uid} on board ${boardId}, container ${containerId}: (${size.width}, ${size.height})`);
      socket.to(`board:${boardId}`).emit('containerSizeUpdate', {
        boardId,
        containerId,
        size,
        userId: user.uid
      });
    });

    // Handle immediate container deletion (for real-time sync)
    socket.on('containerDeleted', ({ boardId, containerId }) => {
      console.log(`Container deletion from ${user.uid} on board ${boardId}, container ${containerId}`);
      socket.to(`board:${boardId}`).emit('containerDeleted', {
        boardId,
        containerId,
        userId: user.uid
      });
    });

    // Listen for getOnlineFriends event
    socket.on('getOnlineFriends', (data: { friendUids: string[] }) => {
      if (!data || !Array.isArray(data.friendUids)) return;
      // Find which friend UIDs are online
      const online = data.friendUids.filter(uid => onlineUserUids.has(uid));
      socket.emit('onlineFriends', { online });
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
      
      // Decrement active connections counter
      activeConnections = Math.max(0, activeConnections - 1);
      console.log(`User disconnected: ${user.uid}. Active connections: ${activeConnections}`);
      onlineUserUids.delete(user.uid);
    });

    onlineUserUids.add(user.uid);
  });

  // Return the getter function for API routes
  return { getActiveConnections };
} 