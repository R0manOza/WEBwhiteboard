# Backend Service for Collaborative Whiteboard

This directory contains the Node.js, Express.js, and TypeScript backend service for the Collaborative Whiteboard application.

## Table of Contents

- [Project Setup](#project-setup)
- [Directory Structure](#directory-structure)
- [TypeScript Configuration](#typescript-configuration)
- [Available Scripts](#available-scripts)
- [Core Technologies](#core-technologies)
- [Authentication](#authentication)
  - [Firebase Admin SDK Setup](#firebase-admin-sdk-setup)
  - [Authentication Middleware (`verifyTokenMiddleware`)](#authentication-middleware-verifytokenmiddleware)
- [API Endpoints](#api-endpoints)
  - [Public Endpoints](#public-endpoints)
    - [Health Check](#health-check)
  - [Authentication Endpoints (`/api/auth`)](#authentication-endpoints-apiauth)
    - [POST /login](#post-apilogin)
    - [POST /logout](#post-apilogout)
    - [GET /me (Example Protected Route)](#get-apime-example-protected-route)
  - [Board Endpoints (`/api/boards`)](#board-endpoints-apiboards)
  - [Container Endpoints (`/api/boards/:boardId/containers`)](#container-endpoints-apiboardsboardidcontainers)
    - [POST / (Create Container)](#post--create-container)
    - [GET / (List Containers)](#get--list-containers)
  - [Item Endpoints (To be added)](#item-endpoints-to-be-added)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

## Project Setup

1.  **Prerequisites:**
    *   Node.js (e.g., v18.x or later)
    *   npm, yarn, or pnpm

2.  **Installation:**
    Navigate to the `backend` directory and install dependencies:
    ```bash
    cd backend
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```

3.  **Firebase Admin SDK Setup (Crucial for Authentication & DB Access):**
    *   Download your Firebase project's service account key JSON file from the Firebase Console (Project settings > Service accounts > Generate new private key).
    *   Rename this file to `firebase.json`.
    *   Place this `firebase.json` file inside the `backend/config/` directory.
    *   **IMPORTANT SECURITY NOTE:** This `firebase.json` file contains sensitive credentials. **DO NOT COMMIT IT TO GIT.** Ensure it is listed in your project's root `.gitignore` file (e.g., `backend/config/firebase.json`).
    *   The application is configured to load this key from `backend/config/firebase.json` for local development. See `src/config/firebase.ts`.

4.  **Running the Development Server:**
    To start the backend server in development mode (with auto-recompilation and server restarts on changes):
    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    # pnpm dev
    ```
    The server will typically start on `http://localhost:3001` (or the port specified by the `PORT` environment variable). You should see a log message confirming Firebase Admin SDK initialization.

## Directory Structure (Key Folders)
```ts
backend/
├── config/ # Configuration files (e.g., firebase.json - GITIGNORED)
├── dist/ # Compiled JavaScript output (from TypeScript)
├── node_modules/ # Project dependencies
├── src/ # TypeScript source code
│ ├── config/ # Configuration-related modules (e.g., firebase.ts)
│ ├── middleware/ # Express middleware (e.g., auth.ts)
│ ├── routes/ # Express route definitions (e.g., authRoutes.ts, boards.ts, containerRoutes.ts)
│ ├── services/ # (To be added) Business logic services
│ ├── types/ # (Optional: For shared TypeScript interfaces)
│ └── index.ts # Main application entry point
├── .eslintignore # (If you have one)
├── .eslintrc.js # (Or .json, .yaml) ESLint configuration (If you have one)
├── .gitignore
├── .prettierrc.json # (Or other Prettier config) Prettier configuration (If you have one)
├── package-lock.json
├── package.json
└── tsconfig.json # TypeScript compiler configuration
```

## TypeScript Configuration (`tsconfig.json`)

The `tsconfig.json` file configures the TypeScript compiler (`tsc`). Key settings include:

*   **`target: "ES2020"`**: Compiles to modern JavaScript compatible with recent Node.js versions.
*   **`module: "commonjs"`**: Uses CommonJS modules, standard for Node.js.
*   **`outDir: "./dist"`**: Specifies that compiled JavaScript files are placed in the `dist` directory.
*   **`rootDir: "./src"`**: Indicates that TypeScript source files are located in the `src` directory.
*   **`strict: true`**: Enables all strict type-checking options for better code quality and error prevention.
*   **`esModuleInterop: true`**: Improves compatibility when importing CommonJS modules.
*   **`sourceMap: true`**: Generates source maps for easier debugging of TypeScript code.
*   **Path Aliases**: Configured with `baseUrl` and `paths` to allow cleaner imports (e.g., `@/services/someService` instead of `../../services/someService`).

## Available Scripts (`package.json`)

*   **`npm run build`**: Compiles the TypeScript code from `src/` to JavaScript in `dist/`.
*   **`npm run start`**: Runs the compiled application from `dist/index.js`. Intended for production-like environments.
*   **`npm run dev`**: Starts the development server. It uses `concurrently` to:
    1.  Run `tsc --watch` to continuously watch for changes in `.ts` files and recompile them to `dist/`.
    2.  Run `nodemon dist/index.js` to watch for changes in the compiled `.js` files in `dist/` and automatically restart the server.
*   **`npm run lint`**: Lints the codebase using ESLint.
*   **`npm run lint:fix`**: Attempts to automatically fix ESLint issues.
*   **`npm test`**: Runs automated tests using Mocha, Chai, Sinon, and Supertest. Test files are expected to be `src/**/*.test.ts` (or your configured pattern).

## Core Technologies

*   **Node.js**: JavaScript runtime environment.
*   **Express.js**: Web application framework for Node.js.
*   **TypeScript**: Superset of JavaScript that adds static typing.
*   **Firebase Admin SDK**: For server-side interaction with Firebase services (Authentication, Firestore).
*   **Middleware Used**:
    *   `express.json()`: Parses incoming requests with JSON payloads.
    *   `express.urlencoded({ extended: true })`: Parses incoming requests with URL-encoded payloads.
    *   `cors`: Handles Cross-Origin Resource Sharing.
    *   `verifyTokenMiddleware` (Custom): Verifies Firebase ID tokens for authenticating requests.

## Authentication

### Firebase Admin SDK Setup

The Firebase Admin SDK is initialized when the server starts. This is handled in `src/config/firebase.ts`.

*   **Initialization**: The SDK attempts to initialize using a service account key.
*   **Service Account Key**:
    *   **Filename**: Expected to be `firebase.json`.
    *   **Location**: Must be placed in the `backend/config/` directory for local development.
    *   **Security**: This file is sensitive and **MUST NOT** be committed to Git.
*   **Purpose**: Allows the backend to perform privileged operations such as verifying user ID tokens from Firebase Authentication and interacting directly with Firestore.
*   **Verification**: Upon successful server start, a console message "Firebase Admin SDK initialized successfully..." will be displayed.

### Authentication Middleware (`verifyTokenMiddleware`)

*   **Location**: `src/middleware/auth.ts`
*   **Purpose**: This middleware is designed to protect routes that require user authentication.
*   **Mechanism**:
    1.  It expects a Firebase ID Token to be sent by the client in the `Authorization` HTTP header using the `Bearer` scheme (e.g., `Authorization: Bearer <ID_TOKEN>`).
    2.  It uses the Firebase Admin SDK (`admin.auth().verifyIdToken()`) to validate the received token.
    3.  If the token is valid:
        *   The decoded token information (including `uid`, `email`, `name`, `picture`) is attached to the Express `request` object as `req.user`.
        *   Control is passed to the next middleware or route handler using `next()`.
    4.  If the token is missing, malformed, expired, or invalid:
        *   A `401 Unauthorized` HTTP error response is sent to the client.
        *   The request does not proceed to the protected route handler.
*   **Usage**: Apply this middleware to any Express route or router that should only be accessible by authenticated users.
    ```typescript
    // Example: Protecting all board routes
    // import boardRoutes from './routes/boardRoutes';
    // import { verifyTokenMiddleware } from './middleware/auth';
    // app.use('/api/boards', verifyTokenMiddleware, boardRoutes);
    ```
*   **`AuthenticatedRequest` Interface**: For TypeScript, an `AuthenticatedRequest` interface (extending Express's `Request`) is available in `src/middleware/auth.ts`. Use this type for request objects in route handlers protected by this middleware to get type safety for `req.user`.

## API Endpoints

All API endpoints are prefixed with `/api`.

### Public Endpoints

#### Health Check

*   **Endpoint**: `GET /api/health`
*   **Description**: A simple endpoint to check if the backend server is running and responsive.
*   **Authentication**: None required.
*   **Response**:
    *   **Status**: `200 OK`
    *   **Body**: `Backend is healthy and running!`

### Authentication Endpoints (`/api/auth`)

These endpoints are handled by `src/routes/authRoutes.ts`.

#### POST `/api/auth/login`

*   **Description**: Verifies a client-provided Firebase ID token and syncs/updates user information in the Firestore `users` collection.
*   **Authentication**: None required for this endpoint.
*   **Request Body**: `application/json`
    ```json
    {
      "idToken": "FIREBASE_ID_TOKEN_STRING_FROM_CLIENT"
    }
    ```
*   **Responses**:
    *   **`200 OK`**: `{ "message": "Login successful.", "user": { /* user details */ } }`
        *   (Creates/updates user document in Firestore `users` collection).
    *   **`400 Bad Request`**: `{ "error": "ID token is required to log in" }`
    *   **`401 Unauthorized`**: `{ "error": "Invalid or expired ID token." }`
    *   **`500 Internal Server Error`**: `{ "error": "Login failed. Please try again." }`

#### POST `/api/auth/logout`

*   **Description**: Acknowledges a user's logout request. Client-side token discarding is primary.
*   **Authentication**: Required (uses `verifyTokenMiddleware`).
*   **Request Body**: None.
*   **Responses**:
    *   **`200 OK`**: `{ "message": "Logout acknowledged." }`
    *   **`401 Unauthorized`**: If authentication fails.

#### GET `/api/auth/me`

*   **Description**: Returns details of the currently authenticated user.
*   **Authentication**: Required (uses `verifyTokenMiddleware`).
*   **Request Body**: None.
*   **Responses**:
    *   **`200 OK`**: `{ /* user details: uid, email, displayName, photoURL */ }`
    *   **`401 Unauthorized`**: If authentication fails.

*(Refer to `src/routes/authRoutes.ts` for detailed response structures.)*

### Board Endpoints (`/api/boards`)

These endpoints are handled by `src/routes/boards.ts` and are all protected by `verifyTokenMiddleware`.

*   **`POST /`**: Creates a new board.
    *   Request Body: `{ "name": "Board Name", "description"?: "Optional desc", "visibility"?: "public" | "private" }`
    *   Response: `201 Created` with the new board object.
*   **`GET /`**: Lists all public boards and private boards the authenticated user is a member of.
    *   Response: `200 OK` with an array of board objects.
*   **`GET /:id`**: Retrieves a single board by its ID.
    *   Access: Public boards are accessible to all authenticated users. Private boards are accessible only to members.
    *   Response: `200 OK` with the board object, `403 Forbidden` if private and not a member, `404 Not Found` if board doesn't exist.
*   **`PUT /:id`**: Updates a board's settings. Only the board owner can perform this action.
    *   Request Body: `{ "name"?: "New Name", "description"?: "New Desc", "visibility"?: "public" | "private" }`
    *   Response: `200 OK` with the updated board object.
*   **`DELETE /:id`**: Deletes a board. Only the board owner can perform this action.
    *   Response: `200 OK` with `{ "success": true, "message": "Board deleted." }`.

*(Refer to `src/routes/boards.ts` for detailed request/response structures and error handling.)*

### Container Endpoints (`/api/boards/:boardId/containers`)

These endpoints are handled by `src/routes/containerRoutes.ts` and are mounted under a specific board (`:boardId`). All are protected by `verifyTokenMiddleware`.

#### POST `/` (Create Container)

*   **Full Path**: `POST /api/boards/:boardId/containers`
*   **Description**: Creates a new container within the specified board.
*   **Authentication**: Required.
*   **Request Body**: `application/json`
    ```json
    {
      "name": "Container Name",
      "type": "notes" | "links" | "drawing",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 300, "height": 200 }
    }
    ```
*   **Responses**:
    *   **`201 Created`**: Returns the newly created container object (including `id`, `boardId`, `ownerId`, `createdAt`, `updatedAt`, and input fields).
    *   **`400 Bad Request`**: If required fields are missing or invalid.
    *   **`401 Unauthorized`**: If authentication fails.
    *   **`404 Not Found`**: If the parent `boardId` does not exist.
    *   **`500 Internal Server Error`**: For other server-side errors.

#### GET `/` (List Containers)

*   **Full Path**: `GET /api/boards/:boardId/containers`
*   **Description**: Retrieves all containers for the specified board, ordered by creation time.
*   **Authentication**: Required.
*   **Request Body**: None.
*   **Responses**:
    *   **`200 OK`**: Returns an array of container objects.
    *   **`400 Bad Request`**: If `boardId` is missing.
    *   **`401 Unauthorized`**: If authentication fails.
    *   **`404 Not Found`**: If the parent `boardId` does not exist.
    *   **`500 Internal Server Error`**: For other server-side errors.

*(PUT and DELETE endpoints for containers will be documented here as they are developed.)*

### Item Endpoints (To be added)
*(Endpoints for managing notes and links within containers will be documented here.)*

## Testing

Automated tests are written using Mocha, Chai, Sinon (for mocks/stubs), and Supertest (for HTTP endpoint testing).

*   **Test Files**: Located alongside the source files they test (e.g., `src/middleware/auth.test.ts`, `src/routes/authRoutes.test.ts`, `src/routes/containerRoutes.test.ts`).
*   **Running Tests**:
    ```bash
    npm test
    ```
*   **Focus**: Tests cover middleware logic, API endpoint behavior, and interactions with mocked external services.

## Environment Variables
*(To be added: Document any environment variables like `PORT`, `FRONTEND_URL`, etc.)*