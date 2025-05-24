# Project TODO & Test-First Development Plan

**Testing Stack:**
*   **Backend (Node.js):** Mocha (test runner), Chai (assertion library), Sinon (stubs, spies, mocks), Supertest (for API endpoint testing)
*   **Frontend (React):** Jest (test runner, often comes with Create React App), React Testing Library (for component testing), Jest-DOM (for DOM assertions)

**General TFD Workflow for Each Task:**
1.  **Understand Requirements:** Clearly define what the small piece of functionality should do.
2.  **Write a Test (Red):** Write an automated test that will fail because the functionality doesn't exist yet.
    *   Backend: Unit tests for service logic, integration tests for API endpoints.
    *   Frontend: Unit tests for components, hooks, utility functions.
3.  **Write Code (Green):** Write the minimum amount of code to make the test pass.
4.  **Refactor:** Improve the code's structure, readability, and performance without changing its external behavior (tests should still pass).
5.  **Repeat:** Move to the next small piece of functionality.

---
## Phase 0: Project Setup & Foundational Tools

*   **Task:** Setup Monorepo (Optional, but good for managing frontend/backend together - e.g., using Lerna/Nx/Turborepo or just npm/yarn workspaces).
    *   No specific tests here, but ensure build processes work.
*   **Task:** Initialize Backend Project (Node.js, TypeScript, Express.js, ESLint, Prettier).
    *   **Test:** Basic "hello world" endpoint test using Supertest.
*   **Task:** Initialize Frontend Project (React, TypeScript, Vite/CRA, ESLint, Prettier).
    *   **Test:** Default `App.tsx` component rendering test using Jest & React Testing Library.
*   **Task:** Integrate Firebase Admin SDK into Backend.
    *   **Test:** Unit test for a utility function that initializes Firebase Admin (mock Firebase Admin).
*   **Task:** Setup Backend Testing Framework (Mocha, Chai, Sinon, Supertest).
    *   **Test:** Write a sample failing test, then a passing test to confirm setup.
*   **Task:** Setup Frontend Testing Framework (Jest, React Testing Library).
    *   **Test:** Write a sample failing component test, then a passing test.
*   **Task:** Basic WebSocket Server Setup (Node.js - e.g., Socket.IO).
    *   **Test:** Unit test for WebSocket server:
        *   Test: Server starts and listens on a port.
        *   Test: Client can connect (use a WebSocket client library for testing).
        *   Test: Server can receive a basic message and echo it back.

---
## Phase 1: User Authentication & Basic Profile

*   **Feature: User Authentication (Google OAuth via Firebase)**
    *   **Backend Task:** Create API endpoint `/api/auth/login` to verify Firebase ID Token.
        *   **Test (API - Supertest):**
            *   `it('should return 401 if no ID token is provided')`
            *   `it('should return 401 if an invalid ID token is provided')` (mock Firebase Admin `verifyIdToken` to throw error)
            *   `it('should return 200 and user info if a valid ID token is provided')` (mock Firebase Admin `verifyIdToken` to return mock user data)
            *   `it('should (optional) create/update user profile in Firestore on successful login')` (mock Firestore calls)
    *   **Frontend Task:** Implement Google Sign-In button using Firebase Client SDK.
        *   **Test (Component - RTL):**
            *   `it('should render a "Sign in with Google" button')`
            *   `it('should call Firebase signInWithPopup on button click')` (mock Firebase SDK)
    *   **Frontend Task:** Send ID token to backend `/api/auth/login` after successful Firebase sign-in.
        *   **Test (Integration/Component - RTL with mock API):**
            *   `it('should call /api/auth/login with the ID token on successful Firebase sign-in')`
            *   `it('should store user session/info in frontend state on successful backend login')`
    *   **Frontend Task:** Implement Sign-Out.
        *   **Test (Component - RTL):**
            *   `it('should call Firebase signOut on button click')`
            *   `it('should clear user session/info in frontend state')`

---
## Phase 2: Core Whiteboard & Real-time Cursor Sync (MVP Real-time)

*   **Feature: Basic Board Data Structure & API**
    *   **Backend Task:** Define `Board` data model (ID, name - keep it simple initially).
    *   **Backend Task:** Create Firestore service function to create a new board.
        *   **Test (Unit - Mocha/Chai):**
            *   `it('should create a board document in Firestore with an ownerId and default name')` (mock Firestore)
    *   **Backend Task:** Create API endpoint `POST /api/boards` to create a new board.
        *   **Test (API - Supertest):**
            *   `it('should require authentication')`
            *   `it('should create a new board and return its details')` (mock auth middleware, mock board service)
    *   **Backend Task:** Create API endpoint `GET /api/boards/:boardId` to fetch board details.
        *   **Test (API - Supertest):**
            *   `it('should require authentication')`
            *   `it('should return 404 if board not found')`
            *   `it('should return board details if found and user has access (simplistic access for now)')`
    *   **Backend Task:** Create API endpoint `GET /api/boards` to list user's boards.
        *   **Test (API - Supertest):**
            *   `it('should require authentication')`
            *   `it('should return a list of boards owned by/member of the user')`

*   **Feature: Real-time Board Connection & Cursor Sync**
    *   **Backend Task:** WebSocket: Handle `joinBoardRoom { boardId, token }`.
        *   **Test (Unit - Mocha/Chai with WebSocket test client):**
            *   `it('should require a valid token to join a room')` (mock ID token verification)
            *   `it('should add client to the specified boardId room in Socket.IO')`
            *   `it('should broadcast a "userJoined" event to the room with user details')`
            *   `it('should emit current list of users in room back to the joining client')`
    *   **Backend Task:** WebSocket: Handle `cursorPosition { boardId, x, y }`.
        *   **Test (Unit - Mocha/Chai):**
            *   `it('should require authentication/valid room membership')`
            *   `it('should broadcast "cursorMoved { userId, x, y }" to other clients in the same boardId room')`
            *   `it('should NOT broadcast to the sender')`
    *   **Backend Task:** WebSocket: Handle client disconnect.
        *   **Test (Unit - Mocha/Chai):**
            *   `it('should broadcast "userLeft" event to the room when a client disconnects')`
    *   **Frontend Task:** Implement WebSocket client connection on entering a board view.
        *   **Test (Component/Hook - RTL):**
            *   `it('should attempt to connect to WebSocket server with boardId and token')` (mock WebSocket client)
            *   `it('should join the board room upon successful connection')`
    *   **Frontend Task:** Display other users' cursors (colored dots).
        *   **Test (Component - RTL):**
            *   `it('should render a dot for each active user in the room (excluding self)')`
            *   `it('should update dot position when "cursorMoved" event is received')`
            *   `it('should add/remove dots when "userJoined"/"userLeft" events are received')`
    *   **Frontend Task:** Send local cursor position to WebSocket server.
        *   **Test (Component/Hook - RTL):**
            *   `it('should emit "cursorPosition" event on mouse move (throttled)')` (mock WebSocket client)
    *   **Frontend Task:** Basic Board View Component.
        *   **Test (Component - RTL):**
            *   `it('should render a placeholder for the board canvas')`
            *   `it('should fetch board data from API when mounted with a boardId')`

---
## Phase 3: Containers - Creation and Basic Real-time Sync

*   **Feature: Container Data Structure & API**
    *   **Backend Task:** Define `Container` data model (ID, boardId, title, position, size, type - start with "notes").
    *   **Backend Task:** Create Firestore service for container CRUD operations (create, get by board, update position/size, delete).
        *   **Test (Unit - Mocha/Chai):** For each service function:
            *   `it('should create a container document correctly')`
            *   `it('should fetch containers for a given boardId')`
            *   `it('should update container position/size')`
            *   `it('should delete a container')`
            *   (Mock Firestore, test input validation, test correct data is written/returned)
    *   **Backend Task:** Create API endpoints for containers (nested under boards):
        *   `POST /api/boards/:boardId/containers`
        *   `GET /api/boards/:boardId/containers`
        *   `PUT /api/boards/:boardId/containers/:containerId` (for position/size initially)
        *   `DELETE /api/boards/:boardId/containers/:containerId`
        *   **Test (API - Supertest):** For each endpoint:
            *   `it('should require authentication and board ownership/membership (implement basic roles)')`
            *   `it('should call the correct service function and return appropriate response/status')`
            *   Test edge cases (board not found, container not found, invalid input).

*   **Feature: Real-time Container Sync**
    *   **Backend Task:** Modify API handlers for containers to broadcast WebSocket events after successful DB operations.
        *   `containerAdded { boardId, containerData }`
        *   `containerUpdated { boardId, containerId, updatedContainerData }` (for position/size)
        *   `containerDeleted { boardId, containerId }`
        *   **Test (Integration - API endpoint test + WebSocket client listener):**
            *   `it('POST /api/.../containers should result in a "containerAdded" WebSocket event to room clients')`
            *   `it('PUT /api/.../containers/:id should result in a "containerUpdated" WebSocket event')`
            *   `it('DELETE /api/.../containers/:id should result in a "containerDeleted" WebSocket event')`
    *   **Frontend Task:** UI to create a new container (e.g., a box on the board ).
        *   **Test (Component - RTL):**
            *   `it('should render a "New Container" button')`
            *   `it('clicking button should show a form/modal for container title')`
            *   `it('submitting form should call POST /api/.../containers API')` (mock API)
    *   **Frontend Task:** Display containers on the board.
        *   **Test (Component - RTL):**
            *   `it('should fetch containers via API on board load')`
            *   `it('should render a visual representation for each container')`
            *   `it('should add a new container when "containerAdded" WebSocket event is received')`
            *   `it('should update container position/size when "containerUpdated" event is received')`
            *   `it('should remove container when "containerDeleted" event is received')`
    *   **Frontend Task:** Implement drag-and-drop for moving containers.
        *   **Test (Component - RTL, may need a drag-and-drop testing utility or more complex setup):**
            *   `it('should update container position in local state on drag end')`
            *   `it('should call PUT /api/.../containers/:id with new position on drag end (debounced)')` (mock API)
    *   **Frontend Task:** Implement resizing for containers.
        *   **Test (Component - RTL):** (Similar to drag-and-drop)
            *   `it('should update container size in local state on resize end')`
            *   `it('should call PUT /api/.../containers/:id with new size on resize end (debounced)')` (mock API)

---
## Phase 4: Items (Notes) - Creation and Basic Real-time Sync

*   **Feature: Note Item Data Structure & API**
    *   **Backend Task:** Define `NoteItem` data model (ID, containerId, title, content).
    *   **Backend Task:** Firestore service for note item CRUD.
        *   **Test (Unit - Mocha/Chai):** (Similar to container service tests)
    *   **Backend Task:** API endpoints for note items (nested under containers):
        *   `POST /api/boards/:boardId/containers/:containerId/items` (specify type "note")
        *   `GET /api/boards/:boardId/containers/:containerId/items`
        *   `PUT /api/boards/:boardId/containers/:containerId/items/:itemId`
        *   `DELETE /api/boards/:boardId/containers/:containerId/items/:itemId`
        *   **Test (API - Supertest):** (Similar to container API tests)

*   **Feature: Real-time Note Item Sync**
    *   **Backend Task:** Modify API handlers for items to broadcast WebSocket events.
        *   `itemAdded { boardId, containerId, itemData }`
        *   `itemUpdated { boardId, containerId, itemId, updatedItemData }`
        *   `itemDeleted { boardId, containerId, itemId }`
        *   **Test (Integration - API + WebSocket):** (Similar to container sync tests)
    *   **Frontend Task:** UI to add a new note item within a container.
        *   **Test (Component - RTL):**
    *   **Frontend Task:** Display note items within their containers.
        *   **Test (Component - RTL):**
            *   `it('should fetch items for a container via API or receive them with container data')`
            *   `it('should render each note item')`
            *   `it('should update via WebSocket events ("itemAdded", "itemUpdated", "itemDeleted")')`
    *   **Frontend Task:** UI to edit/delete a note item.
        *   **Test (Component - RTL):**
    *   **(Optional) Frontend Task:** Drag-and-drop note items within a container.
        *   **Test (Component - RTL):**

---
## Phase 5: Link Items - Creation and Basic Real-time Sync

*   **Feature: Link Item Data Structure & API** (Similar to Note Items, but with URL, link title, description fields)
    *   **Backend Task:** Define `LinkItem` data model.
    *   **Backend Task:** Firestore service for link item CRUD.
        *   **Test (Unit - Mocha/Chai):**
    *   **Backend Task:** Modify/extend API endpoints for items to support "link" type.
        *   **Test (API - Supertest):**
*   **Feature: Real-time Link Item Sync** (Similar to Note Items)
    *   **Backend Task:** Ensure WebSocket events support link item data.
        *   **Test (Integration - API + WebSocket):**
    *   **Frontend Task:** UI to add/edit/delete link items within a "links" type container.
        *   **Test (Component - RTL):**
    *   **Frontend Task:** Display link items.
        *   **Test (Component - RTL):**

---
## Phase 6: Board Management & Roles

*   **Feature: Board Settings (Name, Description, Visibility, Password for Private)**
    *   **Backend Task:** Extend `Board` model.
    *   **Backend Task:** Extend `PUT /api/boards/:boardId` to handle these settings. Implement password hashing for private boards.
        *   **Test (API - Supertest):**
            *   `it('should only allow owner to update settings')`
            *   `it('should correctly update name/description')`
            *   `it('should correctly update visibility')`
            *   `it('should correctly hash and store new password for private board')`
    *   **Backend Task:** Implement `POST /api/boards/:boardId/join` for private boards (verify password).
        *   **Test (API - Supertest):**
            *   `it('should allow joining a private board with correct password and add user as member')`
            *   `it('should deny joining with incorrect password')`
    *   **Frontend Task:** UI for board settings modal/page.
        *   **Test (Component - RTL):**
    *   **Frontend Task:** UI for joining a private board.
        *   **Test (Component - RTL):**

*   **Feature: Role-Based Access Control (Owner, Member)**
    *   **Backend Task:** Refine all API endpoint authorization logic to strictly enforce owner/member roles based on `board.members` and `board.ownerId`.
        *   **Test (API - Supertest):** For critical endpoints:
            *   `it('as owner, should allow action X')`
            *   `it('as member, should allow action Y but deny action Z')`
            *   `it('as non-member, should deny action X, Y, Z on private boards')`
    *   **Frontend Task:** Conditionally render UI elements/actions based on user's role for the current board.
        *   **Test (Component - RTL):**
            *   `it('should show "Delete Board" button only to owner')`
            *   `it('should allow editing own items for members, but not others' items')`

---
## Phase 7: UI Polish, Search, Sidebar & Dashboard

*   **Feature: Dashboard View**
    *   **Frontend Task:** Implement Dashboard to list public boards and user's private/member boards.
        *   **Test (Component - RTL):**
            *   `it('should fetch and display list of boards from /api/boards')`
*   **Feature: Sidebar Navigation**
    *   **Frontend Task:** Implement Sidebar for board navigation and "Create New Board" button.
        *   **Test (Component - RTL):**
*   **Feature: Container-Level Search**
    *   **Frontend Task:** Add search input to containers to filter items (client-side).
        *   **Test (Component - RTL):**
            *   `it('should filter displayed items based on search term')`
*   **(Stretch) Feature: Global Board Search**
    *   **Backend Task:** Design and implement global search strategy (e.g., backend API endpoint, potentially simple Firestore queries or more complex solution).
    *   **Frontend Task:** Implement global search UI.
*   **Task:** General UI/UX improvements based on "Teams-like" inspiration (cleanliness, usability).

---
## Phase 8: Error Handling, Testing Refinement & Deployment

*   **Task:** Comprehensive Error Handling.
    *   **Backend:** Consistent error responses from API. Graceful error handling in WebSocket logic.
    *   **Frontend:** Display user-friendly error messages for API failures, WebSocket disconnections.
    *   **Test:** Add tests for specific error scenarios.
*   **Task:** Testing Coverage Review and Refinement.
    *   Aim for good unit test coverage for critical backend logic and frontend components.
    *   Ensure key integration flows are tested.
*   **Task:** Manual End-to-End Testing for core scenarios.
*   **Task:** Deployment Setup.
    *   Frontend to S3/CloudFront or Amplify.
    *   Backend to AWS EC2 (setup Node.js environment, PM2, Nginx for reverse proxy/HTTPS).
    *   Configure environment variables for production.
*   **Task:** Create final project documentation.

---