import express, { Express, Request, Response } from 'express';
import cors from 'cors'; // Import cors middleware
import http from 'http';
import { Server } from 'socket.io';
import admin from './config/firebaseAdmin';
import authRoutes from './routes/authRoutes';
import boardsRouter from './routes/boards';
import { initializeSocket } from './socket/socketHandler';

const app: Express = express();
const port = process.env.PORT || 3001; // Backend port

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || (isProduction ? 'https://yourdomain.com' : 'http://localhost:5173');

// Set up the HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Ensure WebSocket works in production
});

// Initialize all the socket stuff (see socketHandler.ts)
initializeSocket(io);

// CORS config for API routes
const corsOptions = {
  origin: frontendUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Parse JSON bodies (pretty standard)
app.use(express.json({ limit: '10mb' })); // Add limit for large payloads

// Security headers for production
if (isProduction) {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// Health check endpoint (handy for debugging)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes (login, etc.)
app.use('/api/auth', authRoutes);

// Boards routes
app.use('/api/boards', boardsRouter);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: isProduction ? 'Internal server error' : err.message 
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${frontendUrl}`);
});

app.set('socketio', io);

//usefull features of express
//app.get('/users', getAllUsers);
// app.post('/users', createUser);
// app.put('/users/:id', updateUser);
// app.delete('/users/:id', deleteUser);
//app.use(express.json()); // Parse JSON bodies
// app.use('/api', authMiddleware); // Require auth for /api routes