import express, { Express, Request, Response } from 'express';
 import admin from './config/firebaseAdmin';

//usefull features of express
//app.get('/users', getAllUsers);
// app.post('/users', createUser);
// app.put('/users/:id', updateUser);
// app.delete('/users/:id', deleteUser);
//app.use(express.json()); // Parse JSON bodies
// app.use('/api', authMiddleware); // Require auth for /api routes
const app: Express = express();
const port = process.env.PORT || 3001; // Backend port
// Example of where you might use it later (not for this specific task)
import authRoutes from './routes/authRoutes';


app.use(express.json());

app.post('/api/verifyToken', async (req, res) => {
  const idToken = req.body.token;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    res.json({ uid: decodedToken.uid });
  } catch (error) {
    res.status(401).send('Unauthorized');
    
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.send('Backend is healthy and running!');
});



//bonus points stuff ends here
app.use('/api/auth', authRoutes);


app.listen(port, () => {
  console.log(`[server]: Backend server is running at http://localhost:${port}`);
});
