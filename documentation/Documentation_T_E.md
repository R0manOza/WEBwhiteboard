# Dev Log: Day 1 - Frontend Takes Flight (Sort Of!)

Alright team, Day 1 is in the books!

So, what went down on the frontend side today? I, Developer B, was on Phase 0 duty, basically setting up the initial playground.

### Today's Wins (Frontend Phase 0 - Nailed It!):

*   **Project Started:** Got the whole React + TypeScript thing spinning with Vite. It's like the turbo booster for React apps, apparently. Also pulled in some key players: `firebase` (our direct line to Google Auth), `socket.io-client` (for when things get real-time later), `uuid` (to make sure everyone and everything has a unique ID), and `react-router-dom` (for making pages show up when you click stuff).
*   **Testing Arena Ready:** Set up Vitest, JSDOM, and React Testing Library. This means we can actually write little code tests now. Wrote a super simple one just to make sure the whole testing setup wasn't secretly broken. It passed! *Phew.* Test-first, baby! Gotta follow the plan.
*   **Firebase Connected (Kinda):** Plugged in the Firebase client SDK configuration. It's initialized and ready to talk to Google Auth when Phase 1 hits. Just waiting on Developer C for the proper environment variables so it doesn't spill our secrets.
*   **Pages & Navigation Born:** Built the very basic structure with `react-router-dom`. We now have concept pages like a Home, Login, Dashboard, and a placeholder for the actual Board view. You can click links (or type URLs) and see different (empty) screens!
*   **Style Foundation:** Threw in some basic CSS to make it look less like a default browser page and slightly more "clean and professional" like Teams. It's just a sketch right now, but it gives us something to look at.
*   **First Real Test Passed:** Wrote a test using React Testing Library specifically for the main `App` component to ensure it renders the basic layout and navigation links. It passed, which means the fundamental structure isn't completely messed up! 🎉

### Current Status:

We've got routing on the frontend! You can navigate between different pages, but they are just empty shells right now. Zero actual functionality coded yet.

So far, nothing has spectacularly broken. Let's all collectively cross our fingers and hope it stays that way as things get more complex!

Next up on the list is **Phase 1: User Authentication**. Time to get people actually logged in!

I'm seriously hyped to tackle this next challenge. As the legendary Barney Stinson would say:

![Challenge Accepted](https://media.tenor.com/4Ph4U-srDVsAAAAe/challenge-accepted-barney-stinson.png)







# Development Log - 6/15/2025

We are back and are stronger than ever, so what we did today (or tried to do), my plan for today was to make frontend more sophisticated, when user logs in with google use his username and profile picture as username and profile picture on our site also without authentication other pages will not be accessible, for that I made `AuthContext` which imports specific authentication related types and functions from `firebase/auth`.

## AuthContextType Interface

`AuthContextType` interface in `AuthContext` defines the contract for what the authentication context will provide to any component that uses it. It specifies that the context value will have three properties:

-   `user`: This will hold the authenticated Firebase `User` object if someone is logged in, or `null` if they are not.
-   `loading`: A boolean indicating if the authentication state is currently being determined (e.g., on app load, during login, or logout). Useful for showing spinners.
-   `login`: An asynchronous function that components can call to initiate the login process. It returns a `Promise`.
-   `logout`: An asynchronous function that components can call to initiate the logout process. It returns a `Promise`.

## AuthContext

`const AuthContext = createContext<AuthContextType | undefined>(undefined);` creates the actual React Context object.

It's initialized with `undefined`, and typed to potentially hold `AuthContextType` or `undefined`. Using `undefined` as the initial value and type allows the `useAuth` hook to detect if it's being used outside of the `AuthProvider`.

## useAuth Hook

`export const useAuth = () => { ... }` is a custom React hook that makes it easy for any functional component to access the value provided by the `AuthContext`.

It uses `useContext(AuthContext)` to read the current context value.

The `if (context === undefined)` check ensures that this hook is only used by components that are rendered inside the `AuthProvider`. If used outside, it throws an error, which is helpful for debugging during development.

It returns the context value (`{ user, loading, login, logout }`).

## AuthProvider Component

`export const AuthProvider = ({ children }: { children: ReactNode }) => { ... }` is a standard React component. This component is meant to "wrap" a part of your application's component tree (typically the root of the application, or the part that needs authentication).

It uses `useState` to manage the `user` and `loading` state internally within this component.

`[loading, setLoading] = useState(true)`: Initializes the `loading` state to `true`. This is important because when your app first loads, you need to check if the user is already logged in (e.g., via a persistent session), and this process takes time.

### useEffect (The Core State Listener)

`useEffect(() => { ... }, []);`: This effect runs only once when the `AuthProvider` component mounts (`[]` empty dependency array).

`const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => { ... });`: This is the most critical part. `onAuthStateChanged` is a Firebase Auth function that sets up a listener. This listener will:

-   Fire immediately when the listener is attached, reporting the current authentication state (whether a user is already logged in, perhaps from a previous session persisted by Firebase).
-   Fire again any time the authentication state changes (e.g., after `signInWithPopup` completes successfully, or after `signOut` completes).

## Inside the onAuthStateChanged callback (`async (firebaseUser) => { ... }`):

-   `if (firebaseUser)`: If Firebase reports that a user is logged in (`firebaseUser` is not null):
    -   It logs the user detected.
    -   It enters a `try...catch...finally` block to perform the Backend Verification Step. This is essential because while Firebase knows the user logged in, your backend needs to verify the ID token to be sure the user is valid and potentially sync/load their profile or roles from your backend database (Firestore in this case).
    -   `const idToken = await firebaseUser.getIdToken();`: Gets the user's current ID token.
    -   `await fetch(...)`: Makes a `POST` request to your backend's `/auth/login` endpoint, sending the `idToken`.
    -   `if (!backendResponse.ok)`: If the backend responds with a non-200 status (e.g., 401 Unauthorized, 500 Internal Server Error), it means the backend rejected the token or encountered an error. It logs the error, calls `signOut(auth)` to clear the potentially invalid Firebase state client-side, and sets the context `user` state to `null`.
    -   `else`: If the backend responds successfully (`backendResponse.ok` is true), it means the backend verified the token. It logs success, potentially reads data from the backend response (`backendUserData`), and sets the context `user` state to the `firebaseUser` object.
    -   `finally { setLoading(false); }`: Regardless of backend success or failure in this initial check, the `loading` state is set to `false` because the initial check process is complete.
-   `else`: If Firebase reports no user is logged in (`firebaseUser` is null, either initially or after logout):
    -   It logs no user detected.
    -   Sets the context `user` state to `null`.
    -   Sets the `loading` state to `false`.

`return () => unsubscribe();`: This is the cleanup function for the `useEffect`. It's called when the `AuthProvider` component unmounts, and it stops the `onAuthStateChanged` listener to prevent memory leaks.

## login Function

`const login = async () => { ... }`: This function is intended to be called by UI components (like a Login button) to start the login process.

It sets `loading` to `true`.

It has a `try...catch...finally` block.

**NOTE on current implementation**: As indicated by the `console.warn` comment, in the provided code, this `login` function does not actually contain the `signInWithPopup` call or the backend fetch logic. It logs a warning and relies on the `onAuthStateChanged` listener (part of the `useEffect`) to detect when a user is signed in by some other means (like your `LoginPage.tsx` component calling `signInWithPopup` directly). If you were to refactor your `LoginPage.tsx` to use `useAuth().login()`, you would move the `signInWithPopup` and subsequent backend fetch logic into this function. For now, it primarily serves to set `loading` state.

It sets `loading` to `false` in `finally`.

## logout Function

`const logout = async () => { ... }`: This function is intended to be called by UI components (like a Sign Out button) to log the user out.

It sets `loading` to `true`.

It uses a `try...catch...finally` block.

`await signOut(auth);`: Calls the Firebase Auth `signOut` function, which ends the user's session with Firebase.

`setUser(null);`: Clears the user state in the context.

It logs success or error.

It sets `loading` to `false` in `finally`.


## Summery
 So in summery The AuthContext is a powerful pattern for centrally managing your application's authentication state. The AuthProvider component acts as a gatekeeper, using Firebase's onAuthStateChanged listener to stay updated on the user's login status.



## New Problems
Well we hit another wall, even though I tested AuthContext (basic stuf with mocikng logins to test if it was actualy working) when I tried to test it on our website I got surprise visit from someone Roma has been fighting for a long time. Maybe not today meybe not tomorrow but eventually I hope we will beat it.
![MainEnemy](MainEnemy.png)

### new problem fixed? kinda but not really 
ROMA: this cross problem has been after me this whole project it ruined my productivity , and yet i couldn't fix it . even tho now frontend finnaly is able to get the token and send it to backend that error still pops up , 80% of the time it's not a problem , but sometimes it causes front not to send the token to the back , anyhow , for now this should work 





## Completion of Frontend Phase 2 & Initiation of Phase 3 (Containers)
Today's development efforts focused on finalizing the frontend tasks outlined for Phase 2, specifically related to board access and settings UI, and subsequently commencing work on Phase 3, which introduces the container system.

## Phase 2 Completion: Board Access and Settings UI
The primary objective was to implement the necessary user interfaces and conditional rendering logic within the BoardViewPage to handle board settings and access control for private boards. Key accomplishments include:

### Board Settings Modal (BoardSettingsModal.tsx): 
A dedicated component was developed to display and facilitate the editing of board properties such as name, description, and visibility. This modal includes form elements to capture user input and is structured to integrate with a backend API endpoint for saving changes (implementation of the save logic depends on backend readiness, currently mocked for testing).

### Private Board Join Form (JoinPrivateBoardForm.tsx):
 A component was created to handle the process of joining a private board. It provides a password input field and a submission mechanism designed to send the password to the backend for verification (logic depends on backend readiness, currently mocked for testing).
 
### BoardViewPage Access Logic and Integration: 
The core BoardViewPage.tsx component was updated to dynamically determine the user's access level to a specific board based on fetched board data (visibility and membership). It now conditionally renders either the main board canvas (if access is granted) or the JoinPrivateBoardForm (if the board is private and access is denied). A mechanism was included to transition to the board view upon successful joining via the form. The BoardSettingsModal was integrated, controlled by local state, and rendered when triggered.

This completes the defined frontend tasks for Phase 2, establishing the UI framework for managing board access and properties.


## Phase 3 Initiation: Container System Foundation
Following the completion of Phase 2 frontend tasks, work began on Phase 3, focusing on the foundational elements of the container system on the frontend:

### Basic Container Component (Container.tsx):
 A foundational React component was created to represent a single container on the board. This initial version focuses on rendering the container's title and establishing a basic visual placeholder, ready to be enhanced with interactivity (dragging, resizing) in subsequent steps.

### Container Fetching and Rendering: 
The BoardViewPage.tsx component was extended to fetch the list of containers associated with the current board from a designated backend endpoint (/api/boards/:boardId/containers) as part of its initial data loading process (this fetch is conditional on the user having access to the board). The fetched container data is stored in component state, and the Container components are rendered within the board canvas area by mapping over this state.

### Create Container Form (CreateContainerForm.tsx): 
A basic form component was created to allow users to input details (title, purpose) for a new container. This component is integrated into the BoardViewPage and is designed to call a backend API endpoint (/api/boards/:boardId/containers) to create the container (logic depends on backend readiness, currently mocked for testing).

### Real-time Container Event Listeners:
 Crucially, WebSocket listeners were implemented within the BoardViewPage's socket effect. These listeners are configured to listen for containerAdded, containerUpdated, and containerDeleted events broadcast by the backend. Corresponding handler functions were implemented to update the component's containers state immutably in real-time based on the data received from these events, ensuring the UI reflects changes made by other users or the backend.

## Current Status:
The frontend is now capable of managing board access and settings UI flows, fetching and displaying a static representation of containers, and is equipped with real-time listeners ready to synchronize container changes pushed from the backend WebSocket server.

## Next Steps:
The immediate next steps for Phase 3 involve adding interactivity to the Container component by implementing drag-and-drop and resizing capabilities, along with the necessary logic to communicate these changes back to the backend via API calls and ensure smooth real-time updates across clients.


## Fortifying the Frontend with Tests

Okay, with features flying into the codebase, it was time to slow down and build some scaffolding. You can't build a skyscraper on a foundation of sand, right? So, we rolled up our sleeves and dived head-first into the world of automated testing to make sure our app doesn't crumble under pressure.

#### The Testing Arsenal

We decided to go with a modern, fast, and frankly, pretty slick testing stack:

*   **[Vitest](https://vitest.dev/):** The testing engine. It's built on top of Vite, which already powers our development server, so it's ridiculously fast.
*   **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/):** The philosophy. Instead of testing implementation details (like "did this state variable change?"), we test what the user actually sees and interacts with. This makes our tests more resilient to code refactoring.
*   **`@testing-library/jest-dom`:** A handy extension that adds a bunch of useful matchers for checking on the state of the DOM (e.g., `.toBeInTheDocument()`).

#### The Battle Plan & Execution

We didn't just add tests for one thing; we went on a testing spree across the most critical pages of the application.

1.  **`BoardViewPage.test.tsx`:** This is the heart of our app, so it got top priority. We wrote tests to ensure:
    *   It shows a "Loading..." state correctly.
    *   It properly denies access if a user isn't logged in.
    *   It handles the special "sample board" for demo purposes.

2.  **`DashboardPage.test.tsx`:** The user's home base. We needed to make sure it was solid. Tests now cover:
    *   The initial loading and error states when fetching boards.
    *   The "No boards found" message when the user's list is empty.
    *   The search functionality, ensuring that filtering boards by name works as expected.

3.  **`LoginPage.test.tsx`:** The front door to our app. We locked it down with tests for:
    *   Successful Google Sign-In, including mocking the backend call and navigation.
    *   Failed sign-ins, making sure an error message is shown to the user.
    *   Automatically redirecting users who are already logged in.

#### The Struggle (and Triumph!) with Mocks

It wasn't all smooth sailing. Getting our tests to correctly mock Firebase's authentication flow was... a journey. We wrestled with Vitest's module hoisting and asynchronous `act()` warnings. The `onAuthStateChanged` listener is a powerful tool, but it's tricky to tame in a test environment.

After a few rounds of refactoring, we landed on a stable and reliable mocking strategy that properly simulates the entire authentication lifecycle. It was a tough fight, but the result is a set of tests that we can trust.

With this new testing foundation, we can now build new features with much more confidence, knowing that our automated safety net is there to catch us if we fall.