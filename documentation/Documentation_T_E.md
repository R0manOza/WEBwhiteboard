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

### Inside the onAuthStateChanged callback (`async (firebaseUser) => { ... }`):

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

### login Function

`const login = async () => { ... }`: This function is intended to be called by UI components (like a Login button) to start the login process.

It sets `loading` to `true`.

It has a `try...catch...finally` block.

**NOTE on current implementation**: As indicated by the `console.warn` comment, in the provided code, this `login` function does not actually contain the `signInWithPopup` call or the backend fetch logic. It logs a warning and relies on the `onAuthStateChanged` listener (part of the `useEffect`) to detect when a user is signed in by some other means (like your `LoginPage.tsx` component calling `signInWithPopup` directly). If you were to refactor your `LoginPage.tsx` to use `useAuth().login()`, you would move the `signInWithPopup` and subsequent backend fetch logic into this function. For now, it primarily serves to set `loading` state.

It sets `loading` to `false` in `finally`.

### logout Function

`const logout = async () => { ... }`: This function is intended to be called by UI components (like a Sign Out button) to log the user out.

It sets `loading` to `true`.

It uses a `try...catch...finally` block.

`await signOut(auth);`: Calls the Firebase Auth `signOut` function, which ends the user's session with Firebase.

`setUser(null);`: Clears the user state in the context.

It logs success or error.

It sets `loading` to `false` in `finally`.


### Summery
 So in summery The AuthContext is a powerful pattern for centrally managing your application's authentication state. The AuthProvider component acts as a gatekeeper, using Firebase's onAuthStateChanged listener to stay updated on the user's login status.



### New Problems
Well we hit another wall, even though I tested AuthContext (basic stuf with mocikng logins to test if it was actualy working) when I tried to test it on our website I got surprise visit from someone Roma has been fighting for a long time. Maybe not today meybe not tomorrow but eventually I hope we will beat it.
![MainEnemy](MainEnemy.png)

### new problem fixed? kinda but not really 
ROMA: this cross problem has been after me this whole project it ruined my productivity , and yet i couldn't fix it . even tho now frontend finnaly is able to get the token and send it to backend that error still pops up , 80% of the time it's not a problem , but sometimes it causes front not to send the token to the back , anyhow , for now this should work 