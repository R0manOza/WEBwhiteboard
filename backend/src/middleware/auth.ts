import { Request, Response, NextFunction } from 'express';
import  admin  from '../config/firebaseAdmin'; 
// Extend Express Request type for TypeScript
export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken; // Using admin.auth namespace for DecodedIdToken
}

// Middleware to verify Firebase ID token
export const verifyTokenMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided or invalid format.' });
    return;
  }
  const token = authorizationHeader.split('Bearer ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Token is missing.' });
    return;
  }

   try {
   
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; 
    next(); 
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error.code, error.message);
   
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({ error: 'Unauthorized: Token has expired.' });
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    } else {
      res.status(401).json({ error: 'Unauthorized: Token verification failed.' });
    }
  }
};