import 'mocha';
import chai, { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import express from 'express';
import supertest from 'supertest';


import authRouter from './authRoutes'; // Assuming this is your router export
import admin from '../config/firebaseAdmin'; // Your initialized services
const firebaseAdminAuth = admin.auth(); // Add this line to define firebaseAdminAuth
const adminFirestore = admin.firestore(); // Add this line to define adminFirestore
// Helper to create a test app mounting only the authRouter

const createTestAppWithAuthRouter = () => {
  const app = express();
  app.use(express.json()); // Important: Your /login route expects JSON body
  app.use('/api/auth', authRouter); // Mount the router like in your main app
  return app;
};

describe('Auth Routes (/api/auth)', () => {
  let testApp: express.Express;
  let verifyIdTokenStub: SinonStub;
  let firestoreGetStub: SinonStub;
  let firestoreSetStub: SinonStub;
  let firestoreUpdateStub: SinonStub;
  let firestoreDocStub: SinonStub;
  let firestoreCollectionStub: SinonStub;

  const mockValidDecodedToken = {
    uid: 'test-user-uid-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'http://example.com/test.jpg',
  };

  beforeEach(() => {
    testApp = createTestAppWithAuthRouter();

    // Stub Firebase Auth
    verifyIdTokenStub = sinon.stub(firebaseAdminAuth, 'verifyIdToken');

    // Stub Firestore methods
    // We need to stub the chain: firestore.collection().doc().get/set/update
    firestoreGetStub = sinon.stub();
    firestoreSetStub = sinon.stub().resolves(); // .set() typically doesn't return much
    firestoreUpdateStub = sinon.stub().resolves(); // .update() also
    
    // Stub for .doc() to return an object that has .get(), .set(), .update() methods
    firestoreDocStub = sinon.stub().returns({
      get: firestoreGetStub,
      set: firestoreSetStub,
      update: firestoreUpdateStub,
    });

    // Stub for .collection() to return an object that has a .doc() method
    firestoreCollectionStub = sinon.stub(adminFirestore, 'collection').returns({
      doc: firestoreDocStub,
    } as any); // Use 'as any' to bypass strict type checking for the complex stub chain
  });

    afterEach(() => {
    sinon.restore(); // Restores all stubs, spies, mocks
  });

describe('POST /login', () => {
    it('should return 400 if idToken is missing in request body', async () => {
      const response = await supertest(testApp)
        .post('/api/auth/login')
        .send({}); // Empty body

      expect(response.status).to.equal(400);
      expect(response.body.error).to.equal('ID token is required to log in');
      expect(verifyIdTokenStub.called).to.be.false;
    });

    it('should return 401 if an invalid idToken is provided', async () => {
      const firebaseError = new Error('Invalid ID token.') as any;
      firebaseError.code = 'auth/invalid-id-token';
      verifyIdTokenStub.rejects(firebaseError);

      const response = await supertest(testApp)
        .post('/api/auth/login')
        .send({ idToken: 'invalid-token' });

      expect(response.status).to.equal(401);
      expect(response.body.error).to.equal('ID token is invalid.');
      expect(verifyIdTokenStub.calledOnceWith('invalid-token')).to.be.true;
    });

    it('should return 401 if idToken is expired', async () => {
        const firebaseError = new Error('ID token has expired.') as any;
        firebaseError.code = 'auth/id-token-expired';
        verifyIdTokenStub.rejects(firebaseError);
  
        const response = await supertest(testApp)
          .post('/api/auth/login')
          .send({ idToken: 'expired-token' });
  
        expect(response.status).to.equal(401);
        expect(response.body.error).to.equal('ID token has expired.');
        expect(verifyIdTokenStub.calledOnceWith('expired-token')).to.be.true;
      });

    it('should return 200 and user details, and create a new user in Firestore if user does not exist', async () => {
      verifyIdTokenStub.resolves(mockValidDecodedToken);
      firestoreGetStub.resolves({ exists: false }); // Simulate user not existing in Firestore

      const response = await supertest(testApp)
        .post('/api/auth/login')
        .send({ idToken: 'valid-new-user-token' });

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Login successful.');
      expect(response.body.user).to.deep.equal({
        uid: mockValidDecodedToken.uid,
        email: mockValidDecodedToken.email,
        displayName: mockValidDecodedToken.name,
        photoURL: mockValidDecodedToken.picture,
      });

      expect(verifyIdTokenStub.calledOnceWith('valid-new-user-token')).to.be.true;
      expect(firestoreCollectionStub.calledOnceWith('users')).to.be.true;
      expect(firestoreDocStub.calledOnceWith(mockValidDecodedToken.uid)).to.be.true;
      expect(firestoreGetStub.calledOnce).to.be.true;
      expect(firestoreSetStub.calledOnce).to.be.true;
      // You can also check the arguments of firestoreSetStub if needed:
      const setData = firestoreSetStub.firstCall.args[0];
      expect(setData.uid).to.equal(mockValidDecodedToken.uid);
      expect(setData.email).to.equal(mockValidDecodedToken.email);
      expect(setData.displayName).to.equal(mockValidDecodedToken.name);
      expect(setData.photoURL).to.equal(mockValidDecodedToken.picture);
      expect(setData).to.have.property('createdAt');
      expect(setData).to.have.property('lastLoginAt');

      expect(firestoreUpdateStub.called).to.be.false; // Ensure update wasn't called for new user
    });

    it('should return 200 and user details, and update lastLoginAt for an existing user in Firestore', async () => {
      verifyIdTokenStub.resolves(mockValidDecodedToken);
      // Simulate user already existing in Firestore
      firestoreGetStub.resolves({
        exists: true,
        data: () => ({ 
          uid: mockValidDecodedToken.uid, 
          email: mockValidDecodedToken.email,
          // ... other existing data
        }),
      });

      const response = await supertest(testApp)
        .post('/api/auth/login')
        .send({ idToken: 'valid-existing-user-token' });

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Login successful.');
      // ... check response.body.user as in the previous test ...

      expect(verifyIdTokenStub.calledOnceWith('valid-existing-user-token')).to.be.true;
      expect(firestoreCollectionStub.calledOnceWith('users')).to.be.true;
      expect(firestoreDocStub.calledOnceWith(mockValidDecodedToken.uid)).to.be.true;
      expect(firestoreGetStub.calledOnce).to.be.true;
      expect(firestoreUpdateStub.calledOnce).to.be.true;
      // Check the arguments of firestoreUpdateStub:
      const updateData = firestoreUpdateStub.firstCall.args[0];
      expect(updateData).to.have.property('lastLoginAt');

      expect(firestoreSetStub.called).to.be.false; // Ensure set wasn't called for existing user
    });

    it('should return 500 for other errors during login process', async () => {
        verifyIdTokenStub.resolves(mockValidDecodedToken); // Auth part succeeds
        firestoreGetStub.rejects(new Error('Firestore connection failed')); // Firestore part fails

        const response = await supertest(testApp)
          .post('/api/auth/login')
          .send({ idToken: 'valid-token-firestore-error' });
  
        expect(response.status).to.equal(500);
        expect(response.body.error).to.equal('Login failed. Please try again.');
    });
  });
});
