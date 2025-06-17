import { GoogleAuthProvider, signInWithPopup, type UserCredential, type IdTokenResult, onAuthStateChanged } from 'firebase/auth'; // <-- ADDED onAuthStateChanged
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';

interface BackendUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function LoginPage() {
  const navigate = useNavigate();
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // --- START: ADDED Logic for Redirecting Already Logged-In Users ---
   useEffect(() => {
       // Subscribe to Firebase Auth state changes. This is the reliable way
       // to check for persistent sessions when the component mounts.
       const unsubscribe = onAuthStateChanged(auth, (user) => {
           // If a user is found (meaning they are authenticated with Firebase)
           // AND we are NOT currently in the middle of the handleGoogleSignIn process (popup active/fetching)
           if (user && !isLoading) {
               console.log('LoginPage Effect: User already authenticated, redirecting to dashboard.');
               navigate('/dashboard'); // Redirect to the dashboard page
           }
           // If no user is found, the effect does nothing, and the user stays on the login page.
       });

       // Cleanup the subscription when the component unmounts
       return () => unsubscribe();

       // Dependencies: The effect should re-run if the 'auth' instance changes (rare),
       // 'navigate' function changes (stable), or 'isLoading' state changes (important
       // so it can re-evaluate after the handleGoogleSignIn process finishes).
   }, [auth, navigate, isLoading]); // <-- ADDED Dependencies
   // --- END: ADDED Logic for Redirecting Already Logged-In Users ---


   // Oauth with google
   const handleGoogleSignIn = async () => {
  setIsLoading(true);
  setError(null);
  const provider = new GoogleAuthProvider();
   
   try { 
         // 1. Sign in with Google via Firebase popup
         const result : UserCredential = await signInWithPopup(auth , provider);
         const user = result.user;
          
         if(user){
         // 2get the id token from firebase
         
        const IdTokenResultObject : IdTokenResult = await user.getIdTokenResult();
        console.log('IdTokenResult Object:', IdTokenResultObject);
        const tokenString = IdTokenResultObject.token; // Extracted the actual token string
        console.log('Firebase ID Token String:', tokenString);

            // Prepare the body for the backend
            // Note: Backend spec said body is { idToken: string }, but partner's code sends { requestBody: { idToken: string } }.
            // Keeping partner's structure here as requested for minimal change, but this might be a backend/frontend mismatch.
            const requestBody = { idToken: tokenString };
            console.log("Frontend: Sending this body to backend:", JSON.stringify({ requestBody }));



        // 3 give bakcend the user token at /api/auth/login endpoint 
        

        const BackendResponse = await fetch('/api/auth/login' , {
          method: 'POST',
          headers: {
            'Content-Type' : 'application/json',
          },
          body: JSON.stringify({ requestBody}),

            });

            const backendData = await BackendResponse.json();

            if (!BackendResponse.ok) {
               // If backend responds with an error status (4xx, 5xx)
              throw new Error(backendData.error || `Backend error: ${BackendResponse.status}`);
            }

            // 4 if successful
            console.log('Login successful:', backendData);
             const backendUser: BackendUser = backendData.user; // Assuming backend returns { user: { ... } }

             // --- START: Existing Success Redirect ---
             // This redirects after the user just successfully signed in and backend verified.
             console.log('LoginPage: Backend verified, redirecting to dashboard.');
             navigate('/dashboard');
             // --- END: Existing Success Redirect ---
          }
          else { // This case should ideally not happen if signInWithPopup resolves successfully
            throw new Error('Firebase user not found after sign-in.');
          }

       } catch (err : any ) {
          console.error('Error during Google sign-in' , err);
          setError(err.message || 'An error occurred during sign-in.'); // Set error state
      } finally {
          setIsLoading(false); // Stop loading regardless of success or failure
      }
   };

   return (
    <div className="page login-page"> {/* Added a more specific class */}
      <h1>Login</h1>
      <p>Please sign in with your Google account to continue.</p>

      {/* The button is disabled while isLoading is true, which is correct */}
      {isLoading ? (
        <p>Signing in...</p>
      ) : (
        <button onClick={handleGoogleSignIn} disabled={isLoading}>
          Sign in with Google
        </button>
      )}

      {/* Display error message if present */}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
   );
  }
export default LoginPage;