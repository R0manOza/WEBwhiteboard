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
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
- [Firebase Admin SDK Setup](#firebase-admin-sdk-setup)
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
    *   Rename this file to `firebase.json` (or your chosen name).
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
├── config/ # Configuration files (.env and firebase.json)
├── dist/ # Compiled JavaScript output  
├── node_modules/ # Project dependencies
├── src/ # TypeScript source code
│ ├── config/ # Configuration-related modules ( firebaseAdmin.ts)
│ ├── controllers/ # (To be added later) Route handlers
│ ├── models/ # (To be added) Data models/interfaces
│ ├── routes/ # (To be added) Express route definitions
│ ├── services/ # (To be added) Business logic services
│ └── index.ts # Main application entry point
├── .gitignore
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

## Core Technologies

*   **Node.js**: JavaScript runtime environment.
*   **Express.js**: Web application framework for Node.js.
*   **TypeScript**: Superset of JavaScript that adds static typing.
*   **Firebase Admin SDK**: For server-side interaction with Firebase services (Authentication, Firestore).
*   **(Middleware Used)**:
    *   `express.json()`: Parses incoming requests with JSON payloads.
    *   `express.urlencoded({ extended: true })`: Parses incoming requests with URL-encoded payloads.


## API Endpoints

### Health Check

*   **Endpoint**: `GET /api/health`
*   **Description**: A simple endpoint to check if the backend server is running and responsive.
*   **Response**:
    *   **Status**: `200 OK`
    *   **Body**: `Backend is healthy and running!`
*   **Usage**: Useful for uptime monitoring or a basic server status check during development.

*(More API endpoints will be documented here as they are developed.)*

## Firebase Admin SDK Setup

The Firebase Admin SDK is initialized when the server starts. This is handled in `src/config/firebaseAdmin.ts`.

*   **Initialization**: The SDK attempts to initialize using a service account key.
*   **Service Account Key**:
    *   **Filename**: Expected to be `firebase.json` (or as configured in `src/config/firebaseAdmin.ts`).
    *   **Location**: Must be placed in the `backend/config/` directory for local development.
    *   **Security**: This file is sensitive and **MUST NOT** be committed to Git. It should be added to `.gitignore`.
*   **Purpose**: Allows the backend to perform privileged operations such as verifying user ID tokens from Firebase Authentication and interacting directly with Firestore.
*   **Verification**: Upon successful server start, a console message "Firebase Admin SDK initialized successfully from: /path/to/your/project/backend/config/firebase.json" will be displayed. If errors occur, they will be logged to the console, typically indicating an issue with the key file's path or content.

---
