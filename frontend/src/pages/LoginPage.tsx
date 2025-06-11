import { GoogleAuthProvider, signInWithPopup, type UserCredential, type IdTokenResult } from 'firebase/auth';
import React, { useState } from 'react';
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
  
  
  //Oauth with google 
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
        const requestBody = { idToken: tokenString }; // Key is 'idToken', value is the token string
        console.log("Frontend: Sending this body to backend:", JSON.stringify(requestBody));



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
          
          throw new Error(backendData.error || `Backend error: ${BackendResponse.status}`);
        }

     
        // 4 if successful 
        console.log('Login successful:', backendData);
         const backendUser: BackendUser = backendData.user;

         // success , now go to dashboard boi 
         navigate('/dashboard')
      }
      else {// This case should ideally not happen if signInWithPopup resolves successfully
        throw new Error('Firebase user not found after sign-in.');
      }


   } catch (err : any ) {
    console.error('Error during Google sign-in' , err);
}


   };//o auth with google end here handleGoogleSignIn
   return (
    <div className="page login-page"> {/* Added a more specific class */}
      <h1>Login</h1>
      <p>Please sign in with your Google account to continue.</p>
      
      {isLoading ? (
        <p>Signing in...</p>
      ) : (
        <button onClick={handleGoogleSignIn} disabled={isLoading}>
          Sign in with Google
        </button>
      )}

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
   );
  }
export default LoginPage;