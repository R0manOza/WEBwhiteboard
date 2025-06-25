import 'mocha';
import chai, { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import express, { Request, Response, NextFunction } from 'express';
import supertest from 'supertest';
import boardRouterForTest from './boards';
import containerRouterForTest from './containerRoutes';
import admin from '../config/firebaseAdmin';

const createTestAppWithContainerRoutes = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/boards', boardRouterForTest);
   return app;
};
const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  
};

const mockVerifyTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
     (req as any).user = mockUser; // Assume authenticated for simplicity in basic mock
  next();
};


describe('Container Routes (/api/boards/:boardId/containers)', () => {
  let testApp: express.Express;
  let firestoreCollectionStub: SinonStub;
  let firestoreDocStub: SinonStub;
  let firestoreGetStub: SinonStub;
  let firestoreSetStub: SinonStub;
  let firestoreOrderByStub: SinonStub;
   beforeEach(() => {
    testApp = createTestAppWithContainerRoutes();
    firestoreGetStub = sinon.stub();
    firestoreSetStub = sinon.stub().resolves(); 
     firestoreOrderByStub = sinon.stub().returns({ get: firestoreGetStub });
     firestoreDocStub = sinon.stub().returns({
      get: firestoreGetStub,
      set: firestoreSetStub,
      collection: sinon.stub().returnsThis(),
  });
  const subCollectionDocMethods = { set: firestoreSetStub, get: firestoreGetStub /* add update, delete later */ };
    const subCollectionMethods = { doc: sinon.stub().returns(subCollectionDocMethods), orderBy: firestoreOrderByStub };
    const boardDocMethods = { get: firestoreGetStub, collection: sinon.stub().returns(subCollectionMethods) };
    firestoreDocStub = sinon.stub(admin.firestore(), 'doc'); 
    firestoreCollectionStub = sinon.stub(admin.firestore(), 'collection');
     firestoreCollectionStub.withArgs('boards').returns({
        doc: sinon.stub().returns(boardDocMethods) 
    } as any);
    });

    afterEach(() => {
    sinon.restore();
  });
  const sampleBoardId = 'board-exists-123';
  const mockContainerData = {
    name: 'Test Container',
    type: 'notes' as 'notes' | 'links' | 'drawing',
    position: { x: 10, y: 20 },
    size: { width: 100, height: 100 },
  };

  describe('POST / (Create Container)', () => {
    it('should create a new container and return 201 if board exists and data is valid', async () => {
      // Mock board existence check
      (admin.firestore().collection('boards').doc(sampleBoardId).get as unknown as SinonStub) = firestoreGetStub.resolves({ exists: true });

      (admin.firestore().collection('boards').doc(sampleBoardId).collection('containers').doc() as any).set = firestoreSetStub;

      const response = await supertest(testApp)
        .post(`/api/boards/${sampleBoardId}/containers`)
        .set('Authorization', 'Bearer mock-token')
        .send(mockContainerData);
expect(response.status).to.equal(201);
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(mockContainerData.name);
      expect(response.body.type).to.equal(mockContainerData.type);
      expect(response.body.boardId).to.equal(sampleBoardId);
      expect(response.body.ownerId).to.equal(mockUser.uid); 
      expect(firestoreSetStub.calledOnce).to.be.true;
      const setData = firestoreSetStub.firstCall.args[0];
      expect(setData.name).to.equal(mockContainerData.name);
    });

    it('should return 400 if container name is missing', async () => {
      const response = await supertest(testApp)
        .post(`/api/boards/${sampleBoardId}/containers`)
        .set('Authorization', 'Bearer mock-token')
        .send({ ...mockContainerData, name: '' });
        expect(response.status).to.equal(400);
      expect(response.body.error).to.equal('Container name is required and must be a non-empty string.');
    });
    it('should return 400 if container type is invalid', async () => {
        const response = await supertest(testApp)
          .post(`/api/boards/${sampleBoardId}/containers`)
          .set('Authorization', 'Bearer mock-token')
          .send({ ...mockContainerData, type: 'invalid-type' });
          expect(response.status).to.equal(400);
        expect(response.body.error).to.include("Container type is required and must be one of: 'notes', 'links', 'drawing'.");
      });

       it('should return 404 if boardId does not exist', async () => {
      (admin.firestore().collection('boards').doc('non-existent-board').get as unknown as SinonStub) = firestoreGetStub.resolves({ exists: false });

      const response = await supertest(testApp)
        .post(`/api/boards/non-existent-board/containers`)
        .set('Authorization', 'Bearer mock-token')
        .send(mockContainerData);

      expect(response.status).to.equal(404);
      expect(response.body.error).to.equal('Board not found.');
    });
    });



    describe('GET / (List Containers for a Board)', () => {
    const containersForBoard = [
      { id: 'container1', name: 'C1', boardId: sampleBoardId, ownerId: 'user1', type: 'notes', position: {x:0,y:0}, size:{width:10,height:10}, createdAt: Date.now(), updatedAt: Date.now() },
      { id: 'container2', name: 'C2', boardId: sampleBoardId, ownerId: 'user2', type: 'links', position: {x:0,y:0}, size:{width:10,height:10}, createdAt: Date.now(), updatedAt: Date.now() },
    ];
     it('should return 200 and a list of containers if board exists', async () => {
      (admin.firestore().collection('boards').doc(sampleBoardId).get as unknown as SinonStub) = firestoreGetStub.resolves({ exists: true });
      firestoreGetStub.resolves({ 
        docs: containersForBoard.map(c => ({ data: () => c, id: c.id }))
      });
      (admin.firestore().collection('boards').doc(sampleBoardId).collection('containers').orderBy('createdAt', 'asc') as any).get = firestoreGetStub;
       const response = await supertest(testApp)
        .get(`/api/boards/${sampleBoardId}/containers`)
        .set('Authorization', 'Bearer mock-token');

         expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array').with.lengthOf(containersForBoard.length);
      expect(response.body[0].name).to.equal(containersForBoard[0].name);
      expect(firestoreGetStub.calledTwice).to.be.true; 
    });

     it('should return 404 if boardId does not exist when listing containers', async () => {
      (admin.firestore().collection('boards').doc('non-existent-board').get as unknown as SinonStub) = firestoreGetStub.resolves({ exists: false });

      const response = await supertest(testApp)
        .get(`/api/boards/non-existent-board/containers`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).to.equal(404);
      expect(response.body.error).to.equal('Board not found.');
    });

     });
});