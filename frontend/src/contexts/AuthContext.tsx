import  {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  type User,
  // signInWithPopup,
  // GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, 
 // googleProvider 
} from "../firebase/config";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  // TODO: Could add an error state here later
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  console.log(
    "AuthContext: Provider rendering. Current user:",
    !!user,
    "loading:",
    loading
  );

  useEffect(() => {
    console.log(
      "AuthContext: useEffect running (setting up auth state listener)"
    );

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        "AuthContext: onAuthStateChanged fired. firebaseUser:",
        !!firebaseUser
      );

      if (firebaseUser) {
        console.log("AuthContext: Firebase user detected:", firebaseUser.uid);

        // --- Backend Verification Step ---
        // Use the /api prefix so Vite's proxy handles the request during development
        // This path matches the backend router mounting point: app.use('/api/auth', ...)
        const backendLoginUrl = "/api/auth/login";
        // REMOVED THE LOG THAT SHOWED THE HARDCODED URL TO AVOID CONFUSION
        console.log(
          "AuthContext: Attempting verification with backend URL:",
          backendLoginUrl
        ); // This log should now show '/api/auth/login'

        try {
          const idToken = await firebaseUser.getIdToken();
          console.log("AuthContext: Got ID token. Sending to backend...");
          console.log("Your Firebase ID token:", idToken);
          // This is a test to see if the user is authenticated

          // USE THE CORRECT PROXY URL HERE
          const backendResponse = await fetch(backendLoginUrl, {
            // <--- THIS LINE MUST USE backendLoginUrl
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });

          console.log(
            "AuthContext: Backend verification fetch response status:",
            backendResponse.status
          );

          if (!backendResponse.ok) {
            console.error(
              "AuthContext: Backend login verification failed:",
              backendResponse.status
            );
            // Log response body for more details if it's not JSON (like a 404 HTML page)
            try {
              const errorBody = await backendResponse.json(); // This will likely fail for 404 HTML
              console.error("AuthContext: Backend error body:", errorBody);
            } catch (e) {
              // Log the response text if JSON parsing failed (common for 404/500)
              const errorText = await backendResponse.text();
              console.error(
                "AuthContext: Failed to parse backend error body, raw text:",
                errorText
              );
              console.error("AuthContext: JSON parse error:", e); // Log the original JSON parse error
            }
            await signOut(auth);
            console.log(
              "AuthContext: Signed out from Firebase due to backend error."
            );
            setUser(null);
          } else {
            const backendUserData = await backendResponse.json();
            console.log(
              "AuthContext: Backend verification successful.",
              backendUserData
            );
            setUser(firebaseUser); // Set the authenticated Firebase user
            console.log("AuthContext: User state set:", !!firebaseUser);
          }
        } catch (error: any) {
          console.error(
            "AuthContext: Error during backend verification fetch:",
            error
          );
          await signOut(auth);
          setUser(null);
          console.log(
            "AuthContext: Signed out from Firebase due to fetch error."
          );
        } finally {
          setLoading(false);
          console.log(
            "AuthContext: setLoading(false). Final loading state:",
            false
          );
        }
      } else {
        console.log("AuthContext: No Firebase user detected.");
        setUser(null);
        setLoading(false);
        console.log("AuthContext: User state set to null, setLoading(false).");
      }
      console.log("AuthContext: onAuthStateChanged callback finished.");
    });

    return () => {
      console.log(
        "AuthContext: useEffect cleanup - Unsubscribing from onAuthStateChanged."
      );
      unsubscribe();
    };
  }, []);
  const login = async () => {
    console.log("AuthContext: login function called.");
    setLoading(true);
    console.log("AuthContext: login function - setLoading(true).");
    try {
      // Note: signInWithPopup is currently handled in LoginPage.tsx
      // The onAuthStateChanged listener above will pick up the successful sign-in.
      console.warn(
        "AuthContext: login() function is currently relying on onAuthStateChanged listener to update state after signInWithPopup in LoginPage."
      );
      // If you move signInWithPopup here, you would need to replicate the backend fetch logic.

      // Simulate loading for the explicit login action, even if sign-in happens elsewhere
      // In a refactored version, signInWithPopup and the *initial* backend fetch would live here.
    } catch (error: any) {
      console.error("AuthContext: Login function error:", error);
      // Error handling for the popup itself (e.g., user closes popup)
      // If popup fails, onAuthStateChanged won't fire with a user, so the state remains null/loading becomes false eventually.
      // No need to signOut here if popup failed, as no session was established.
      // You might want to set an error message state here.
    } finally {
      // setLoading(false); // Let the onAuthStateChanged finally block handle this
      // If signInWithPopup was here, the finally block would be more important for loading state.
      console.log(
        "AuthContext: login function finally block (did not set loading here)."
      );
    }
    // The onAuthStateChanged listener will eventually fire and handle the state update
    // and set loading to false.
  };

  const logout = async () => {
    console.log("AuthContext: logout function called.");
    setLoading(true); // Optional: Show loading during logout
    try {
      console.log("AuthContext: Initiating Firebase sign out...");
      await signOut(auth);
      console.log("AuthContext: Firebase signOut complete.");
      // onAuthStateChanged will fire with null user and update context state
      // setUser(null); // No need, listener handles it
    } catch (error) {
      console.error("AuthContext: Logout process failed:", error);
      // TODO: Handle error display
    } finally {
      // setLoading(false); // No need, onAuthStateChanged handles it
      console.log(
        "AuthContext: logout function finally block (did not set loading here)."
      );
    }
  };

  const value: AuthContextType = { user, loading, login, logout };

  console.log(
    "AuthContext: Providing value - user:",
    !!user,
    "loading:",
    loading
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
