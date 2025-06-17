import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
// Import AuthProvider and useAuth
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Import your page components
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BoardViewPage from "./pages/BoardViewPage";
import NotFoundPage from "./pages/NotFoundPage";

// Import styling
import "./App.css";

// --- Create a separate Navigation Component ---
// This component will use the useAuth hook to conditionally render content and structure the nav layout.
const AppNav = () => {
  const { user, loading, logout } = useAuth(); // Get auth state and logout function

  // Determine if user is authenticated (not loading and user object exists)
  const isAuthenticated = !loading && !!user;

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
        {/* Show Dashboard link only if authenticated */}
        {isAuthenticated && (
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>
        )}
        {/* Add other left-side links here as needed */}
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
          <div className="user-info">
            {/* Display Google profile picture */}
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="user-avatar"
              />
            )}
            {/* Display username */}
            <span className="user-name">{user.displayName || "User"}</span>
            {/* --- Add Sign Out Button --- */}
            {/* We can use a simple button here or create a dedicated SignOutButton component */}
            <button onClick={logout} className="sign-out-button">
              Sign Out
            </button>
          </div>
        ) : (
          // Show Login link if not authenticated
          <Link to="/login" className="nav-link">
            Login
          </Link> // Add class for styling
        )}
      </div>
    </nav>
  );
};

function App() {
  return (
    // AuthProvider should wrap the part of the app that needs auth context, typically the BrowserRouter
    <BrowserRouter>
      <AuthProvider>
        <div className="app-container">
          {/* Use the separate Navigation Component */}
          <AppNav />

          <main className="page-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              {/* Login page - redirect if already logged in (handled in LoginPage itself based on your provided code) */}
              <Route path="/login" element={<LoginPage />} />

              {/* --- Protected Routes --- */}
              {/* Wrap routes that require authentication with a ProtectedRoute component */}
              {/* You will need to create/use the ProtectedRoute component */}
              {/* Example (requires ProtectedRoute component): */}
              {/* <Route 
                 path="/dashboard" 
                 element={
                    <ProtectedRoute>
                       <DashboardPage />
                    </ProtectedRoute>
                 } 
              />
               <Route 
                 path="/board/:boardId" 
                 element={
                    <ProtectedRoute>
                       <BoardViewPage />
                    </ProtectedRoute>
                 } 
              /> */}

              {/* For now, using unprotected routes as per your provided App.tsx */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/board/:boardId" element={<BoardViewPage />} />

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
