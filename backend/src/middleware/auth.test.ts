import 'mocha'; 
import chai, { expect } from 'chai';
import sinon from 'sinon';
import express, { Request, Response, NextFunction } from 'express';
import supertest from 'supertest'; // For making HTTP requests to the test app


import { verifyTokenMiddleware, AuthenticatedRequest } from './auth'; 
import admin from '../config/firebaseAdmin';


// Helper to create a minimal Express app for testing middleware
const createTestApp = () => {
  const app = express();
  // Apply any necessary preceding middleware if your auth middleware depends on them (e.g., express.json())
  // For this specific middleware, it doesn't depend on body parsing for its core logic.

  // A test route that will be protected by our middleware
  app.get(
    '/protected',
    verifyTokenMiddleware, // Apply the middleware
    (req: AuthenticatedRequest, res: Response) => {
      // If middleware passes, req.user should be populated
      res.status(200).json({ message: 'Access granted', user: req.user });
    }
  );

  // A public route for comparison (should not be affected by auth errors if middleware not applied)
  app.get('/public', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Public access' });
  });
  return app;
};

describe('Auth Middleware (verifyTokenMiddleware)', () => {
  let testApp: express.Express;
  let verifyIdTokenStub: sinon.SinonStub;

  
  beforeEach(async () => { 
    testApp = createTestApp();
    verifyIdTokenStub = sinon.stub(admin.auth(), 'verifyIdToken');
  });

 
  afterEach(async () => { 
    verifyIdTokenStub.restore();
    sinon.restore();
  });

  it('should call next() and attach user to req if token is valid', async () => {
    const mockDecodedToken = { uid: 'test-uid-123', email: 'test@example.com', name: 'Test User' };
    verifyIdTokenStub.resolves(mockDecodedToken as any); // Mock successful verification

    const response = await supertest(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token-string');

    expect(response.status).to.equal(200);
    expect(response.body.message).to.equal('Access granted');
    expect(response.body.user).to.deep.equal(mockDecodedToken); // Check if user data is attached
    expect(verifyIdTokenStub.calledOnceWith('valid-token-string')).to.be.true; // Check if verifyIdToken was called correctly
  });

  it('should return 401 if no Authorization header is provided', async () => {
    const response = await supertest(testApp).get('/protected');

    expect(response.status).to.equal(401);
    expect(response.body.error).to.equal('Unauthorized: No token provided or invalid format.');
    expect(verifyIdTokenStub.notCalled).to.be.true; // verifyIdToken should not have been called
  });

  it('should return 401 if Authorization header does not start with "Bearer "', async () => {
    const response = await supertest(testApp)
      .get('/protected')
      .set('Authorization', 'InvalidPrefix token-string');

    expect(response.status).to.equal(401);
    expect(response.body.error).to.equal('Unauthorized: No token provided or invalid format.');
    expect(verifyIdTokenStub.notCalled).to.be.true;
  });

  it('should return 401 if token is missing after "Bearer "', async () => {
    const response = await supertest(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer '); // Note the space after Bearer

    expect(response.status).to.equal(401);
    expect(response.body.error).to.equal('Unauthorized: No token provided or invalid format.');
    expect(verifyIdTokenStub.notCalled).to.be.true;
  });

  it('should return 401 if token is expired', async () => {
    const firebaseError = new Error('Token has expired.') as any;
    firebaseError.code = 'auth/id-token-expired';
    verifyIdTokenStub.rejects(firebaseError); // Mock verifyIdToken to throw an expiration error

    const response = await supertest(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer expired-token-string');

    expect(response.status).to.equal(401);
    expect(response.body.error).to.equal('Unauthorized: Token has expired.');
    expect(verifyIdTokenStub.calledOnceWith('expired-token-string')).to.be.true;
  });

  it('should return 401 if token is invalid (e.g., malformed)', async () => {
    const firebaseError = new Error('Invalid ID token.') as any;
    firebaseError.code = 'auth/invalid-id-token'; // or 'auth/argument-error'
    verifyIdTokenStub.rejects(firebaseError); // Mock verifyIdToken to throw an invalid token error

    const response = await supertest(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer malformed-or-invalid-token');

    expect(response.status).to.equal(401);
    expect(response.body.error).to.equal('Unauthorized: Invalid token.');
    expect(verifyIdTokenStub.calledOnceWith('malformed-or-invalid-token')).to.be.true;
  });

   it('should return 401 for other token verification failures', async () => {
    const genericError = new Error('Something went wrong during verification.') as any;
    // No specific Firebase error code, or a different one
    verifyIdTokenStub.rejects(genericError);

    const response = await supertest(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer some-other-problem-token');

    expect(response.status).to.equal(401);
    expect(response.body.error).to.equal('Unauthorized: Token verification failed.');
    expect(verifyIdTokenStub.calledOnceWith('some-other-problem-token')).to.be.true;
  });

  it('should allow access to public routes without a token', async () => {
    const response = await supertest(testApp).get('/public');
    expect(response.status).to.equal(200);
    expect(response.body.message).to.equal('Public access');
    expect(verifyIdTokenStub.notCalled).to.be.true;
  });
});