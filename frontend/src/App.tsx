import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
// Import AuthProvider and useAuth
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { type ReactNode } from "react"; // Import ReactNode for ProtectedRoute props

// Import your page components
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BoardViewPage from "./pages/BoardViewPage";
import NotFoundPage from "./pages/NotFoundPage";

// Import styling
import "./App.css";

// --- Protected Route Component ---
// This component checks authentication status and renders the child route
// or redirects to the login page.
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  // console.log('ProtectedRoute: Rendering for', (children as any).type.name, 'User:', !!user, 'Loading:', loading); // Optional: Keep logs for debugging

  // If still determining auth state, show a loading indicator
  if (loading) {
    // Or return null or a full-page spinner component
    return <div>Loading authentication...</div>; // You could replace this with a spinner component
  }

  // If not authenticated, redirect to the login page
  if (!user) {
    // console.log('ProtectedRoute: No user, redirecting to /login.'); // Optional: Keep logs for debugging
    // replace prop prevents adding the login page to the history stack
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the content for the requested route
  // console.log('ProtectedRoute: User authenticated, rendering children.'); // Optional: Keep logs for debugging
  return <>{children}</>;
};


// --- Create a separate Navigation Component ---
// This component will use the useAuth hook to conditionally render content and structure the nav layout.
const AppNav = () => {
  const { user, loading, logout } = useAuth(); // Get auth state and logout function

  // Determine if user is authenticated (not loading and user object exists)
  const isAuthenticated = !loading && !!user;

  // console.log('AppNav: Rendering. User:', !!user, 'Loading:', loading, 'isAuthenticated:', isAuthenticated); // Optional: Keep logs for debugging

  return (
    <nav>
      {/* --- Left-aligned section (Other links) --- */}
      <div className="nav-left">
        {" "}
        {/* Add a class for styling */}
        <Link to="/" className="nav-link">
          Home
        </Link>{" "}
        {/* Add class for styling */}

        {/* Dashboard Link (Conditional) */}
        {isAuthenticated && ( // <-- Shows Dashboard when logged in
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>
        )}

        {/* --- START: BoardView Link (Conditional Placeholder) --- */}
        {isAuthenticated && ( // <-- Shows Board View link when logged in
           // NOTE: This is a placeholder linking to a hardcoded ID.
           // In a real app, you'd list actual boards here, likely fetched from the backend.
          <Link to="/board/sample-board-id-123" className="nav-link">
            Sample Board
          </Link>
        )}
        {/* --- END: BoardView Link (Conditional Placeholder) --- */}


      </div>

      {/* --- Right-aligned section (Login link OR User Info) --- */}
      <div className="nav-right">
        {" "}
        {/* Add a class for styling */}
        {loading ? (
          // Show loading state in the nav
          <span className="nav-status">Loading...</span>
        ) : isAuthenticated ? (
          // Show user info and sign-out button if authenticated
          // Access user.photoURL and user.displayName here
          <div className="user-info">
            {/* Display Google profile picture - only if photoURL exists */}
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"} // Use displayName as alt text, or 'User' if null
                className="user-avatar" // Use the existing CSS class
              />
            )}
            {/* Display username - use displayName from the user object */}
            <span className="user-name">{user.displayName || user.email || 'User'}</span> {/* Use displayName, fallback to email, then 'User' */}
            {/* --- Add Sign Out Button --- */}
            {/* This button already calls your logout function */}
            <button onClick={logout} className="sign-out-button">
              Sign Out
            </button>
          </div>
        ) : (
          // Show Login link if not authenticated
          <Link to="/login" className="nav-link">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

function App() {
  return (
    // AuthProvider should wrap the part of the app that needs auth context, typically the BrowserRouter
    <BrowserRouter>
      {/* AuthProvider wraps the routes so useAuth can be used anywhere */}
      <AuthProvider>
        <div className="app-container">
          {/* AppNav uses the AuthContext */}
          <AppNav />

          <main className="page-content">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              {/* Login page - redirect if already logged in (handled in LoginPage itself) */}
              <Route path="/login" element={<LoginPage />} />

              {/* --- Protected Routes --- */}
              {/* Wrap routes that require authentication with the ProtectedRoute component */}

               {/* Dashboard is now protected */}
               <Route
                 path="/dashboard"
                 element={
                    <ProtectedRoute> {/* This component handles auth check */}
                       <DashboardPage /> {/* This is the component rendered if authenticated */}
                    </ProtectedRoute>
                 }
               />
                {/* BoardView is now protected - the :boardId is a URL parameter */}
                <Route
                 path="/board/:boardId" // Matches URLs like /board/abc-123
                 element={
                    <ProtectedRoute> {/* This component handles auth check */}
                       <BoardViewPage /> {/* This is the component rendered if authenticated */}
                    </ProtectedRoute>
                 }
               />

              {/* Catch-all route for 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;