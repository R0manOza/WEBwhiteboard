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

// Set up the HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Change this if frontend runs elsewhere
    methods: ['GET', 'POST']
  }
});

// Initialize all the socket stuff (see socketHandler.ts)
initializeSocket(io);

// CORS config for API routes (make sure this matches your frontend)
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Parse JSON bodies (pretty standard)
app.use(express.json());

// Health check endpoint (handy for debugging)
app.get('/api/health', (req: Request, res: Response) => {
  res.send('Backend is healthy and running!');
});

// Auth routes (login, etc.)
app.use('/api/auth', authRoutes);

// Boards routes
app.use('/api/boards', boardsRouter);

// Start the server (only need this once!)
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
app.set('socketio', io);

//usefull features of express
//app.get('/users', getAllUsers);
// app.post('/users', createUser);
// app.put('/users/:id', updateUser);
// app.delete('/users/:id', deleteUser);
//app.use(express.json()); // Parse JSON bodies
// app.use('/api', authMiddleware); // Require auth for /api routes