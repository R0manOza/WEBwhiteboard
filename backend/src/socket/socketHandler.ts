import { Server, Socket } from 'socket.io';
import admin from '../config/firebaseAdmin';

export function initializeSocket(io: Server) {
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

    // Join board room
    socket.on('joinBoardRoom', ({ boardId }) => {
      console.log(`User ${user.uid} joined board: ${boardId}`);
      socket.join(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit('userJoined', { userId: user.uid });
    });

    // Handle cursor position events
    socket.on('cursorPosition', ({ boardId, x, y }) => {
      console.log(`Cursor from ${user.uid} on board ${boardId}: (${x}, ${y})`);
      socket.to(`board:${boardId}`).emit('cursorMoved', { boardId, userId: user.uid, x, y });
    });

    // Add more event handlers as needed

    socket.on('disconnect', () => {
      // Optionally broadcast user left
      // socket.to(...).emit('userLeft', { userId: user.uid });
      console.log(`User disconnected: ${user.uid}`);
    });
  });
} 