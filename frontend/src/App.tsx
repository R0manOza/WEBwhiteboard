//import React from 'react'; // commented out to avoid warning during building 
//tornike roca a iyeneb imports reactisas comment it out to mere ginda gamoiyeno
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';       // Need to create
import LoginPage from './pages/LoginPage';     // Need to create
import DashboardPage from './pages/DashboardPage'; // Need to create
import BoardViewPage from './pages/BoardViewPage'; // Need to create
import NotFoundPage from './pages/NotFoundPage'; // Need to create
import './App.css'; // We'll create this next

// function App() {
//   return (
//     <>
//       <h1>Collaborative Whiteboard</h1>
//       <p>Frontend setup in progress!</p>
//       {/* Routing will go here later */}
//     </>
//   );
// }

// export default App;

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <nav>
          {/* Basic nav for testing routes - will be replaced by real UI */}
          <Link to="/">Home</Link> |
          <Link to="/login">Login</Link> |
          <Link to="/dashboard">Dashboard</Link> |
          <Link to="/board/example-id">Example Board</Link>
        </nav>
        <main className="page-content"> {/* Container for page content */}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/board/:boardId" element={<BoardViewPage />} />
            {/* Catch-all route for 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;