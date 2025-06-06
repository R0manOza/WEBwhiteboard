# Collaborative whiteboard WEb application - dev specifications
---
## 1. Project overview 
### the idea is : Build a multi-user, real-time collaborative web app allowing users to save and organize links and notes on shared whiteboards (“boards”).

## web app features :
- public and private boards with role-based permissions 
- OAuth or simple username/password authentication 
- Real-time syncronizastion of content , layout , and presence 
- Boards as large whiteboard canvases with movable/resizable containers 
- Desktop-first UI simplistic like michrosoft teams 
-  **Data storage and identity management using Firebase (Firestore for database, Firebase Auth for authentication).**
- **Backend business logic, API, and real-time communication managed by a custom Node.js server.**
- **Deployment on AWS Free Tier with static frontend hosting (e.g., S3 + CloudFront or Amplify) and a Node.js application server (e.g., on EC2).**

--- 
## 2. core features
### 2.1 User Authentication & Authorization

- OAuth 2.0 authentication with Google Sign-In via Firebase Authentication SDK on the client.
- User profile minimally stored: user ID, email, display name, avatar URL (managed by Firebase Auth, potentially synced to Firestore `users` collection by backend if needed).
- Session management: Frontend uses Firebase ID tokens; backend verifies these tokens.
- Role management per board (enforced by the Node.js backend):
  - **Owner:** Full control; can invite, edit/delete any item on their board.
  - **Member:** Add/edit/delete own items, view board and containers.
- Unauthenticated users can browse public boards (read-only access controlled by backend API).
### 2.2 Boards

- Boards have:
  - Unique ID (e.g., UUID generated by backend)
  - Name
  - Description
  - Visibility: **Public** or **Private**
  - Private boards require Board ID + password to join (password managed and verified by backend).
  - Password stored securely (hashed by backend before storing in Firestore).
  - Owners can toggle visibility and update password (via backend API).
  - Membership list with user IDs and roles (stored in Firestore, managed by backend).
### 2.3 Containers

- Types:
  - **Links container:** holds multiple link items
  - **Notes container:** holds multiple sticky note items
- Containers have:
  - Unique ID (e.g., UUID generated by backend)
  - Title
  - Purpose/type (links or notes)
  - Position (x,y on board)
  - Size (width, height)
  - Optional style attributes (background color, border style)
- Containers can be created via in-board UI menu, moved, resized, and edited (all actions mediated by backend API).
### 2.4 Items

- **Link items:**
  - Unique ID (e.g., UUID generated by backend)
  - URL
  - Title
  - Short note/description
  - (Optional) thumbnail URL (future)
- **Note items:**
  - Unique ID (e.g., UUID generated by backend)
  - Title
  - Content (text)
  - Optional color/style
- Items can be added, edited, deleted by authorized users (creators or owners, enforced by backend API), dragged/dropped within containers.
- Container-level search bar filters items (likely client-side filtering of items loaded for that container).
- All changes sync live in real-time via Node.js backend and WebSockets.
# 2.5 Real-Time Collaboration

- Sync board presence, container moves/resizes, item edits, and drag-drop.
- Live cursor/interaction indicators .
- **Real-time updates will be managed by a custom Node.js backend using WebSockets (e.g., Socket.IO).**
  - **Clients will connect to the Node.js WebSocket server and subscribe to relevant "rooms" (e.g., per board).**
  - **The Node.js server will receive actions from clients (via API calls), persist changes to Firestore, and then broadcast these changes over WebSockets to all subscribed clients in the appropriate room.**
- Throttle/debounce updates for performance (both on client-side before sending to server, and potentially server-side before broadcasting if applicable).
- Conflict resolution: last-write-wins (the last write operation to the Node.js server/Firestore will be the final state).
### 2.6 Search

- Container-level search bar to filter contained items.
- Global board search across all containers and items (complexity to be assessed; might require backend support or advanced Firestore querying if possible, or a dedicated search service as a stretch goal).
### 2.7 UI/UX Design

- Desktop-first, Teams-like clean interface.
- Views:
  - Dashboard listing visible boards.
  - Sidebar for board navigation and creation.
  - Board View with whiteboard canvas and containers.
- UI elements for board creation (sidebar), container creation (in-board menu), and editing settings.
### 2.8 Deployment

- Frontend: AWS Amplify.
- **Backend (Node.js application): AWS EC2 (or other AWS Node.js hosting like Elastic Beanstalk, Fargate - EC2 for initial simplicity on Free Tier).**
- Data & Auth: Firebase Firestore and Firebase Authentication.


---

## 3. Architecture & Technology Stack

| Layer                  | Technology                                                        |
|------------------------|-------------------------------------------------------------------|
| Frontend               | React + TypeScript                                                |
| State management       | React Context or Redux (optional, e.g., Zustand, Jotai)           |
| **Backend API**        | **Node.js + Express.js (or similar framework) + TypeScript**        |
| **Real-time Sync**     | **Node.js + WebSockets (e.g., Socket.IO or `ws` library)**           |
| **Authentication**     | **Firebase Auth with Google OAuth (identity provider for clients); Node.js backend verifies ID tokens via Firebase Admin SDK** |
| **Data Storage**       | **Firebase Firestore**                                              |
| **Frontend Hosting**   | AWS S3 + CloudFront / AWS Amplify                                 |
| **Backend Hosting**    | **AWS EC2 (or similar Node.js hosting platform on AWS Free Tier)** |
| Dev tools              | ESLint, Prettier, React Testing Library                           |

---
## 4. Data Models
### 4.1 User
```ts
interface UserProfile { 
  id: string; 
  email: string; //a maybe , doesn't seem very usefull tbh
  displayName: string;
  avatarUrl?: string; //another maybe 
 
}
```
4.2 Board
```ts
interface Board {
  id: string; // UUID
  name: string;
  description?: string;
  visibility: "public" | "private";
  passwordHash?: string; // Only for private boards, hashed by backend
  ownerId: string; // Firebase Auth UID of the owner
  members: {
    [userId: string]: "owner" | "member"; // userId is Firebase Auth UID
  };
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}
```
4.3 Container //  probably will be added much later 
```ts
interface Container {
  id: string; // UUID
  boardId: string; // ID of the parent board get it ? foreign key and stuff dd
  title: string;
  purpose: "links" | "notes"; //will add more later!!
  position: { x: number; y: number };// position might be reworked we'll see 
  size: { width: number; height: number };
  style?: {
    backgroundColor?: string;
    borderStyle?: string;
  };
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}
```
4.4 Link Item
```ts
interface LinkItem {
  id: string; // UUID
  containerId: string; // ID of the parent container
  url: string;
  title: string;
  description?: string;
  createdBy: string; // Firebase Auth UID of the creator
  createdAt: number; // Timestamp
  updatedAt?: number; // Timestamp
}
```
4.5 Note Item
```ts
interface NoteItem {
  id: string; // UUID
  containerId: string; // ID of the parent container
  title: string;
  content: string;
  color?: string;
  createdBy: string; // Firebase Auth UID of the creator
  createdAt: number; // Timestamp
  updatedAt?: number; // Timestamp
}

```
---
# 5 . API & Data Handling
## 5.1 Data Storage (Firestore)
Firestore collections structured as:
users/{userId} (Stores UserProfile if needed beyond Firebase Auth)
boards/{boardId}
boards/{boardId}/containers/{containerId}
boards/{boardId}/containers/{containerId}/items/{itemId} (Items can be a subcollection, or fields within container docs if item count per container is small and fixed - subcollection is more scalable)
## 5.2 Backend API (Node.js / Express.js)
The React frontend will communicate with the custom Node.js backend via a RESTful API for all data manipulation and business logic. The backend will use the Firebase Admin SDK to interact with Firestore and verify user authentication. 

### Key API Endpoints (Illustrative - to be fully defined more proper):
Authentication:
POST /api/auth/login (Client sends Firebase ID token; server verifies, potentially sets up its own session or confirms stateless auth for subsequent requests. Could also be implicit if ID token is sent with every request.)
Boards:
GET /api/boards (List boards accessible to the authenticated user)
POST /api/boards (Create new board)
GET /api/boards/:boardId (Get board details)
PUT /api/boards/:boardId (Update board settings - name, description, visibility, password)
DELETE /api/boards/:boardId (Delete board - owner only)
POST /api/boards/:boardId/join (Join a private board using password)
POST /api/boards/:boardId/members (Invite/add member - owner only)
DELETE /api/boards/:boardId/members/:userId (Remove member - owner only)
Containers:
(Endpoints will be nested under boards, e.g., POST /api/boards/:boardId/containers)
GET /api/boards/:boardId/containers
POST /api/boards/:boardId/containers
PUT /api/boards/:boardId/containers/:containerId (Update title, position, size, style)
DELETE /api/boards/:boardId/containers/:containerId
Items (Links & Notes):
(Endpoints will be nested under containers, e.g., POST /api/boards/:boardId/containers/:containerId/items)
GET /api/boards/:boardId/containers/:containerId/items
POST /api/boards/:boardId/containers/:containerId/items (type specified in payload)
PUT /api/boards/:boardId/containers/:containerId/items/:itemId
DELETE /api/boards/:boardId/containers/:containerId/items/:itemId

## 5.3 Real-Time Communication (WebSockets)
The Node.js backend will host a WebSocket server (e.g., using Socket.IO) to manage real-time updates.
Clients connect to the WebSocket server upon entering a board view.
Clients join a "room" specific to the boardId.
The Node.js server, after successfully processing an API request that modifies data (e.g., moving a container, adding an item), will retrieve the updated state from Firestore (or use the data it's about to write) and broadcast an event message to all clients in that board's room.


## Key WebSocket Events (Illustrative - to be fully defined):

*Client emits: joinBoardRoom { boardId, token } (token for auth on WebSocket connection if needed)
Client emits: leaveBoardRoom { boardId }
Server emits: boardUpdated { boardId, boardData }
Server emits: containerAdded { boardId, containerData }
Server emits: containerUpdated { boardId, containerId, updatedContainerData } (e.g., position, size)
Server emits: containerDeleted { boardId, containerId }
Server emits: itemAdded { boardId, containerId, itemData }
Server emits: itemUpdated { boardId, containerId, itemId, updatedItemData }
Server emits: itemDeleted { boardId, containerId, itemId }
Server emits (optional): presenceUpdate { boardId, users: [{id, name, avatarUrl?}] }
Server emits (optional): cursorPosition { boardId, userId, x, y }*

## 5.4 Authentication and Authorization
Authentication:
Frontend uses Firebase Client SDK for Google OAuth to get an ID Token.
This ID Token is sent to the Node.js backend with API requests (e.g., in an Authorization: Bearer <ID_TOKEN> header).
Node.js backend uses Firebase Admin SDK to verify the ID Token and extract user information (uid, email, etc.). WebSocket connections also need an auth strategy (e.g., send token on connect).
Authorization (Role-Based Permissions):
Primary authorization logic will reside within the Node.js backend API handlers and WebSocket message handlers.
Before performing any action or returning/broadcasting data, the backend will check the authenticated user's role (owner or member) for the specific board (retrieved from Firestore boards/{boardId}.members).

### 6. Error Handling
Network error detection and retries (client-side for API calls, WebSocket reconnections).
Client/server input validation (URLs, required fields, data formats) in Node.js API.
User-friendly error messages for auth, permissions, API errors, and WebSocket issues.
Last-write-wins conflict resolution with UI feedback (UI updates to reflect the server's authoritative state).
Offline detection (client-side) and graceful fallback (e.g., read-only mode, queueing actions if feasible - advanced).
### 7. Testing Plan //test it!
## 7.1 Frontend Unit Tests (React)
UI components (forms, lists, search bars) using Jest and React Testing Library.
React hooks and utility functions (validation, formatting, throttling).
Client-side state management logic.
WebSocket client-side event handling logic (mocking WebSocket server responses).
## 7.2 Backend Unit Tests (Node.js)
API route handlers/controllers (mocking services, Firebase Admin SDK).
Business logic services/functions (validation, permission checks).
WebSocket event handlers on the server (mocking client connections and Firestore calls).
Utility functions specific to the backend.
## 7.3 Integration Tests
Frontend-Backend API Integration:
User login/logout flows (React -> Node.js API -> Firebase Auth verification).
Full CRUD operations for Boards, Containers, Items (React -> Node.js API -> Firestore).
Real-time Sync Integration:
Test full loop: Client A action -> Node.js API -> Firestore -> Node.js WebSocket broadcast -> Client B UI update.
Test joining/leaving WebSocket rooms and receiving appropriate messages.
(Optional) End-to-End Tests (e.g., Cypress, Playwright) covering key user flows.
## 7.4 Manual Testing
ill do it manually 
