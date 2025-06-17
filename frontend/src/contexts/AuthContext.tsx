import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
// Import specific functions from firebase/auth (reduce bundle size)
import { type User, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider} from '../firebase/config'; // Import configured auth and provider instances

// Define the shape of the AuthContext state and actions
interface AuthContextType {
  user: User | null; // The Firebase User object, null if not logged in
  loading: boolean; // True while checking auth status or performing auth operations
  login: () => Promise<void>; // Function to trigger the login flow
  logout: () => Promise<void>; // Function to trigger the logout flow
  // TODO: Could add an error state here later
}

// Create the context with an initial null value.
// The type assertion 'as any' or providing a default value is often needed for React Context.
// A common pattern is to throw an error in the default value if the hook is used outside the provider.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to easily consume the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  // If context is undefined, it means the hook was used outside the AuthProvider
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider component that wraps the application
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // Start in a loading state while we check for existing sessions
  const [loading, setLoading] = useState(true); 
  // TODO: Add state for error messages if needed

  // Effect to handle initial authentication state check (Firebase persistence)
  useEffect(() => {
    // onAuthStateChanged is the primary way to observe auth state changes,
    // including initial load and session persistence.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase reports a user is logged in (could be a fresh login or persistent session)
        console.log('AuthContext: Firebase user detected:', firebaseUser.uid);
        
        // --- Backend Verification Step ---
        // Important for security and syncing user info/roles from backend DB.
        try {
            const idToken = await firebaseUser.getIdToken();
            console.log('AuthContext: Verifying Firebase ID token with backend...');
            // Call your backend's login/verify endpoint
            // Use environment variable for the backend API URL (Developer C task)
            const backendResponse = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Although the spec says to send the token in the body for /auth/login,
                    // for *subsequent* protected routes, it will be in the Authorization header.
                    // Sending it in the body here matches the backend spec provided earlier.
                },
                body: JSON.stringify({ idToken }),
            });

            if (!backendResponse.ok) {
                // Backend rejected the token or login (e.g., user deleted in backend, invalid token)
                console.error('AuthContext: Backend login verification failed:', backendResponse.status);
                 // Force Firebase sign out to clear potentially inconsistent state
                await signOut(auth); 
                setUser(null); // Ensure context state is null
                // TODO: Handle/expose backend error message
            } else {
                // Backend successfully verified the token
                const backendUserData = await backendResponse.json(); // Backend might return more user info
                console.log('AuthContext: Backend verification successful.', backendUserData);
                // Set the user state in the context
                // Using the Firebase user object is often simplest initially,
                // but you might merge with backendUserData later if it contains roles etc.
                setUser(firebaseUser); 
            }
        } catch (error) {
           // Handle network errors or errors during backend fetch/processing
           console.error('AuthContext: Error during backend verification:', error);
            // Sign out if backend communication fails to avoid false logged-in state
           await signOut(auth); 
           setUser(null); // Ensure context state is null
           // TODO: Handle/expose this error
        } finally {
            // Stop loading once the initial check is complete (success or failure)
           setLoading(false); 
        }

      } else {
        // Firebase reports no user is logged in (either initially or after logout)
        console.log('AuthContext: No Firebase user detected.');
        setUser(null);
        setLoading(false); // Stop loading
      }
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
     // The effect should only run once on mount and cleanup on unmount.
     // auth is stable. No other dependencies needed.
  }, []); 

  // Function to handle the complete login flow (triggered by UI, e.g., button click)
  const login = async () => {
     // Start loading state only for the explicit login *process*,
     // not the initial load check. Or manage loading states separately.
     // Let's use the same loading state for simplicity now.
     setLoading(true); 
     try {
        console.log('AuthContext: Initiating Google Sign-In popup...');
        // 1. Trigger Firebase Google Sign-In popup
        const result = await signInWithPopup(auth, googleProvider);
        const firebaseUser = result.user;
        console.log('AuthContext: Firebase Google Sign-In successful:', firebaseUser.uid);

        // 2. Get ID token from the newly signed-in user
        const idToken = await firebaseUser.getIdToken();
        console.log('AuthContext: Sending new ID token to backend for login...');

        // 3. Call backend login endpoint to verify token and sync user
        const backendResponse = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                 // No Authorization header here, token is in the body as per backend spec for this endpoint
            },
            body: JSON.stringify({ idToken }),
        });

        if (!backendResponse.ok) {
             console.error('AuthContext: Backend login failed during explicit login:', backendResponse.status);
             const errorBody = await backendResponse.json();
             console.error('AuthContext: Backend error details:', errorBody);
             // If backend rejects, sign out from Firebase client too for consistency
             await signOut(auth); 
             setUser(null); // Ensure context state is null
             // TODO: Expose a user-facing error message
             throw new Error(errorBody.error || 'Backend login failed'); // Throw error to calling component
        } else {
            const backendUserData = await backendResponse.json();
            console.log('AuthContext: Explicit login verified by backend.', backendUserData);
            // Set the user state in the context
            setUser(firebaseUser); 
            // TODO: Maybe use backendUserData if it has critical info
        }

     } catch (error: any) { // Catch errors from popup, token get, or backend fetch/logic
       console.error('AuthContext: Login process failed:', error);
       setUser(null); // Ensure user is null on any error
       // TODO: Handle error display in UI layer using state/context or return value
       throw error; // Re-throw so calling component can handle it (e.g., show error message)
     } finally {
        // Stop loading regardless of success or failure
        setLoading(false); 
     }
  };

  // Function to handle the logout process
  const logout = async () => {
    setLoading(true); // Optional: Show loading during logout
    try {
       console.log('AuthContext: Initiating Firebase sign out...');
       // 1. Sign out from Firebase client
       await signOut(auth); 
       // No backend API call needed for logout based on initial backend spec
       setUser(null); // Clear user state in context
       console.log('AuthContext: User logged out successfully.');
       // TODO: Redirect user after logout (handled by UI components using useAuth)
    } catch (error) {
       console.error('AuthContext: Logout process failed:', error);
       // TODO: Handle error display
    } finally {
       setLoading(false); // Stop loading
    }
  };

  // The value provided by the context to consuming components
  const value: AuthContextType = { user, loading, login, logout };

  // Provide the context value to the children components tree
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};