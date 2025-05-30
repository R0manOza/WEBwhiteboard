# Today's Progress:
- Backend Project Setup: How to get the backend running.
- TypeScript Configuration (tsconfig.json): Key decisions and structure.
- Build & Dev Scripts (package.json): What they do and how to use them.
- Basic Express Server & Middleware: Overview of the initial server structure.
- Firebase Admin SDK Initialization: How it's set up and where the key file goes (with a security warning).
- Health Check Endpoint: Its purpose and how to test it.


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
  - [Protected Endpoints (To be added)](#protected-endpoints-to-be-added)
- [Testing](#testing)
- [Environment Variables](#environment-variables) (To be added)

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
    *   The application is configured to load this key from `backend/config/firebase.json` for local development. See `src/config/firebaseAdmin.ts`.
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

## Directory Structure (Key Folders , will change later , when it does please document it here )
```ts
backend/
├── config/ # Configuration files (e.g., firebase.json - GITIGNORED)
├── dist/ # Compiled JavaScript output (from TypeScript)
├── node_modules/ # Project dependencies
├── src/ # TypeScript source code
│ ├── config/ # Configuration-related modules (e.g., firebase.ts)
│ ├── middleware/ # Express middleware (e.g., auth.ts)
│ ├── routes/ # Express route definitions (e.g., authRoutes.ts)
│ ├── services/ # (To be added) Business logic services
│ ├── types/ # (Optional: For shared TypeScript interfaces, e.g., AuthenticatedRequest)
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
*   **`npm test`**: (To be configured with Mocha/Chai) Placeholder for running automated tests.
*   **`npm test`**: Runs automated tests using Mocha, Chai, Sinon, and Supertest. Test files are expected to be `src/**/*.test.ts`.

## Core Technologies

*   **Node.js**: JavaScript runtime environment.
*   **Express.js**: Web application framework for Node.js.
*   **TypeScript**: Superset of JavaScript that adds static typing.
*   **Firebase Admin SDK**: For server-side interaction with Firebase services (Authentication, Firestore).
*   **(Middleware Used)**:
    *   `express.json()`: Parses incoming requests with JSON payloads.
    *   `express.urlencoded({ extended: true })`: Parses incoming requests with URL-encoded payloads.
    *   **`verifyTokenMiddleware` (Custom)**: Verifies Firebase ID tokens for authenticating requests (see [Authentication Middleware](#authentication-middleware-verifytokenmiddleware)).

## Authentication
### Firebase Admin SDK Setup
The Firebase Admin SDK is initialized when the server starts. This is handled in `src/config/firebaseAdmin.ts`.
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
        *   A `401 Unauthorized` (or sometimes `403 Forbidden`) HTTP error response is sent to the client.
        *   The request does not proceed to the protected route handler.
*   **Usage**: Apply this middleware to any Express route or router that should only be accessible by authenticated users.
    ```typescript
    // Example: Protecting all board routes
    // import boardRoutes from './routes/boardRoutes';
    // import { verifyTokenMiddleware } from './middleware/auth';
    // app.use('/api/boards', verifyTokenMiddleware, boardRoutes);

    // Example: Protecting a single route
    // app.get('/api/profile', verifyTokenMiddleware, (req: AuthenticatedRequest, res) => { /* ... */ });
    ```
*   **`AuthenticatedRequest` Interface**: For TypeScript, an `AuthenticatedRequest` interface (extending Express's `Request`) is available in `src/middleware/auth.ts`. Use this type for request objects in route handlers protected by this middleware to get type safety for `req.user`.

## API Endpoints

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

*   **Description**: Allows a user to "log in" to the backend system after they have successfully authenticated with Firebase on the client-side (e.g., via Google Sign-In). This endpoint verifies the client-provided Firebase ID token and syncs/updates user information in the backend's Firestore `users` collection.
*   **Authentication**: None required for this endpoint itself (as it's the process *of* logging in).
*   **Request Body**: `application/json`
    ```json
    {
      "idToken": "FIREBASE_ID_TOKEN_STRING_FROM_CLIENT"
    }
    ```
*   **Responses**:
    *   **`200 OK` (Login Successful)**:
        ```json
        {
          "message": "Login successful.",
          "user": {
            "uid": "firebase_user_id",
            "email": "user@example.com",
            "displayName": "User Name",
            "photoURL": "url_to_photo.jpg"
          }
        }
        ```
        Additionally, a user document will be created or updated in the `users` collection in Firestore with fields like `uid`, `email`, `displayName`, `photoURL`, `createdAt`, `lastLoginAt`.
    *   **`400 Bad Request`**: If `idToken` is missing in the request body.
        ```json
        { "error": "ID token is required to log in" }
        ```
    *   **`401 Unauthorized`**: If the provided `idToken` is invalid, expired, or malformed.
        ```json
        { "error": "Invalid or expired ID token." } // or "ID token is invalid."
        ```
    *   **`500 Internal Server Error`**: If an unexpected error occurs during the login process (e.g., Firestore interaction fails).
        ```json
        { "error": "Login failed. Please try again." }
        ```

#### POST `/api/auth/logout`

*   **Description**: Acknowledges a user's logout request. For Firebase ID token-based authentication, the primary logout action (invalidating the token's utility for future requests) happens on the client by discarding the ID token. This backend endpoint can be used for server-side cleanup if necessary (e.g., revoking refresh tokens, though this is not implemented by default in the current version).
*   **Authentication**: **Required.** Uses the `verifyTokenMiddleware`. The client must send a valid Firebase ID Token in the `Authorization: Bearer <token>` header.
*   **Request Body**: None.
*   **Responses**:
    *   **`200 OK`**:
        ```json
        { "message": "Logout acknowledged." }
        ```
    *   **`401 Unauthorized` / `403 Forbidden`**: If authentication fails (handled by `verifyTokenMiddleware`).

#### GET `/api/auth/me` (Example Protected Route)

*   **Description**: An example endpoint that demonstrates a protected route. It returns details of the currently authenticated user based on the verified ID token.
*   **Authentication**: **Required.** Uses the `verifyTokenMiddleware`.
*   **Request Body**: None.
*   **Responses**:
    *   **`200 OK`**:
        ```json
        {
          "uid": "firebase_user_id",
          "email": "user@example.com",
          "displayName": "User Name",
          "photoURL": "url_to_photo.jpg"
        }
        ```
    *   **`401 Unauthorized` / `403 Forbidden`**: If authentication fails (handled by `verifyTokenMiddleware`).

### Protected Endpoints (To be added)
*(Future endpoints for boards, containers, items will be documented here and will require authentication using the `verifyTokenMiddleware`.)*

## Testing

Automated tests are written using Mocha, Chai, Sinon (for mocks/stubs), and Supertest (for HTTP endpoint testing).

*   **Test Files**: Located alongside the source files they test (e.g., `src/middleware/auth.test.ts`, `src/routes/authRoutes.test.ts`).
*   **Running Tests**:
    ```bash
    npm test
    ```
*   **Focus**: Tests aim to cover:
    *   Middleware logic (e.g., token validation, error handling).
    *   API endpoint request/response behavior.
    *   Interactions with mocked external services (Firebase Auth, Firestore).
---
