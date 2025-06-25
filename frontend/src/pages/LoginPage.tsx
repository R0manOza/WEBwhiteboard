import {
  GoogleAuthProvider,
  signInWithPopup,
  type UserCredential,
  type IdTokenResult,
  onAuthStateChanged,
} from "firebase/auth"; // <-- ADDED onAuthStateChanged
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/config";

interface BackendUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function LoginPage() {
  console.log("[LoginPage] Component Rendered/Re-rendered"); // Log 0

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[LoginPage useEffect] Running. isLoading:", isLoading); // Log A
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log(
        "[LoginPage useEffect onAuthStateChanged] Firebase user from listener:",
        user
      ); // Log B
      if (user && !isLoading) {
        console.log(
          "[LoginPage useEffect] User already authenticated (from listener), redirecting to dashboard."
        ); // Log C
        navigate("/dashboard");
      } else if (!user) {
        console.log(
          "[LoginPage useEffect] No Firebase user currently authenticated (from listener)."
        ); // Log D
      } else if (user && isLoading) {
        console.log(
          "[LoginPage useEffect] Firebase user present (from listener), but login process is active (isLoading=true), not redirecting yet."
        ); // Log E
      }
    });

    return () => {
      console.log(
        "[LoginPage useEffect] Unsubscribing from onAuthStateChanged."
      ); // Log F
      unsubscribe();
    };
  }, [auth, navigate, isLoading]);

  const handleGoogleSignIn = async () => {
    console.log("[handleGoogleSignIn] Process Started."); // Log 1
    setIsLoading(true);
    console.log("[handleGoogleSignIn] isLoading set to true."); // Log 2
    setError(null);
    console.log("[handleGoogleSignIn] error set to null."); // Log 3
    const provider = new GoogleAuthProvider();
    console.log("[handleGoogleSignIn] GoogleAuthProvider created."); // Log 4

    try {
      console.log("[handleGoogleSignIn try] Attempting signInWithPopup..."); // Log 5
      const result: UserCredential = await signInWithPopup(auth, provider);
      console.log(
        "[handleGoogleSignIn try] signInWithPopup successful. Result user:",
        result.user
      ); // Log 6
      const user = result.user;

      if (user) {
        console.log("[handleGoogleSignIn try if(user)] User object exists."); // Log 7
        console.log(
          "[handleGoogleSignIn try if(user)] Attempting user.getIdTokenResult()..."
        ); // Log 8
        const IdTokenResultObject: IdTokenResult =
          await user.getIdTokenResult();
        console.log(
          "[handleGoogleSignIn try if(user)] IdTokenResult Object:",
          IdTokenResultObject
        ); // Log 9

        const tokenString = IdTokenResultObject.token; // You already have this
        console.log(
          "[handleGoogleSignIn try if(user)] Extracted Token String:",
          tokenString
        ); // Log 10

        // This is the object the backend expects directly in req.body
        const payloadForBackend = { idToken: tokenString };
        console.log(
          "[handleGoogleSignIn try if(user)] Frontend: Object being stringified for backend:",
          JSON.stringify(payloadForBackend)
        ); // Log the correct payload

        console.log(
          "[handleGoogleSignIn try if(user)] Attempting fetch to /api/auth/login..."
        );
        const BackendResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadForBackend), // Send the payloadForBackend object directly
        });
        console.log(
          "[handleGoogleSignIn try if(user)] Fetch call completed. Response status:",
          BackendResponse.status
        ); // Log 13

        console.log(
          "[handleGoogleSignIn try if(user)] Attempting BackendResponse.json()..."
        ); // Log 14
        const backendData = await BackendResponse.json();
        console.log(
          "[handleGoogleSignIn try if(user)] Parsed backendData:",
          backendData
        ); // Log 15

        if (!BackendResponse.ok) {
          console.error(
            "[handleGoogleSignIn try if(user)] Backend response not OK. Throwing error."
          ); // Log 16
          throw new Error(
            backendData.error || `Backend error: ${BackendResponse.status}`
          );
        }

        console.log(
          "[handleGoogleSignIn try if(user)] Login successful (backend responded OK). Backend data:",
          backendData
        ); // Log 17

        console.log(
          "[handleGoogleSignIn try if(user)] Navigating to /dashboard."
        ); // Log 18
        navigate("/dashboard");
      } else {
        console.warn(
          "[handleGoogleSignIn try] signInWithPopup resolved, but result.user is null/undefined."
        ); // Log 19
        throw new Error("Firebase user not found after sign-in.");
      }
    } catch (err: any) {
      console.error(
        "[handleGoogleSignIn catch] Error during sign-in process:",
        err
      ); // Log 20

      setError(err.message || "An error occurred during sign-in.");
      console.log("[handleGoogleSignIn catch] Error state set."); // Log 21
    } finally {
      console.log(
        "[handleGoogleSignIn finally] Process finished. Setting isLoading to false."
      ); // Log 22
      setIsLoading(false);
    }
  };

  return (
    <div className="page login-page">
      <h1>Login</h1>
      <p>Please sign in with your Google account to continue.</p>

      {isLoading ? (
        <p>Signing in...</p>
      ) : (
        <button onClick={handleGoogleSignIn} disabled={isLoading}>
          Sign in with Google
        </button>
      )}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
    </div>
  );
}
export default LoginPage;
