import express, { Express, Request, Response } from 'express';
import cors from 'cors'; // Import cors middleware
import admin from './config/firebaseAdmin';

import authRoutes from './routes/authRoutes';

const app: Express = express();
const port = process.env.PORT || 3001; // Backend port

//usefull features of express
//app.get('/users', getAllUsers);
// app.post('/users', createUser);
// app.put('/users/:id', updateUser);
// app.delete('/users/:id', deleteUser);
//app.use(express.json()); // Parse JSON bodies
// app.use('/api', authMiddleware); // Require auth for /api routes
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Replace with your frontend's actual origin(s) in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
};
app.use(cors(corsOptions));
// --- End CORS Middleware ---


app.use(express.json()); // Parse JSON bodies

// Remove or comment out this potentially redundant endpoint
// app.post('/api/verifyToken', async (req, res) => {
//   const idToken = req.body.token;
//   try {
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//
//     res.json({ uid: decodedToken.uid });
//   } catch (error) {
//     res.status(401).send('Unauthorized');
//
//   }
// });

app.get('/api/health', (req: Request, res: Response) => {
  res.send('Backend is healthy and running!');
});


// Use the auth routes
app.use('/api/auth', authRoutes);


app.listen(port, () => {
  console.log(`[server]: Backend server is running at http://localhost:${port}`);
});