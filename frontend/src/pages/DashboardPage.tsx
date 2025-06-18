import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation

// Define a basic type for a board based on your shared types
interface SimpleBoard {
  id: string;
  name: string;
  // Add other properties you might display later, like description
}

function DashboardPage() {
  const [boards, setBoards] = useState<SimpleBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('DashboardPage: Fetching boards...');
    // Function to fetch boards from the backend
    const fetchBoards = async () => {
      // In a real app, you'd get the user's ID token from useAuth
      // and potentially add it to the Authorization header here,
      // but the AuthContext's initial check should have happened already,
      // and ProtectedRoute ensures we only get here if authenticated.
      // Subsequent API calls requiring auth should use the token in headers.
      // For this simple fetch GET, let's assume the backend middleware
      // uses the existing auth context/session if applicable, or you'll add
      // the Authorization header later.

      try {
        // Use the /api prefix for Vite's proxy in development
        // Assuming VITE_BACKEND_API_URL is configured in .env.local or similar
        // Or just use /api directly as the proxy handles it
        const response = await fetch(`/api/boards`, { // Fetch from the backend endpoint
          method: 'GET',
           headers: {
            'Content-Type': 'application/json',
            // If your backend /api/boards requires the token in the Authorization header,
            // you would get it from useAuth() and add it here:
            // Authorization: `Bearer ${await user?.getIdToken()}`,
           },
        });

        if (!response.ok) {
          // Handle HTTP errors
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(`Failed to fetch boards: ${response.status} ${response.statusText} - ${errorData.message}`);
        }

        const data = await response.json();
         // Assuming the backend returns an array of board objects like { id: '...', name: '...' }
        console.log('DashboardPage: Boards fetched successfully', data);
        setBoards(data); // Update the state with the fetched boards
      } catch (err: any) {
        console.error('DashboardPage: Error fetching boards:', err);
        setError(err.message || 'Failed to load boards.');
      } finally {
        setLoading(false); // Always stop loading regardless of success or failure
      }
    };

    // Call the fetch function
    fetchBoards();

    // No cleanup needed for this simple fetch effect
  }, []); // Empty dependency array means this effect runs once after the initial render

  // Render logic based on state
  return (
    <div className="page dashboard-page"> {/* Use existing CSS class */}
      <h1>Your Boards</h1>

      {loading && <p>Loading boards...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && boards.length === 0 && (
        <p>No boards found. Create one!</p>
        // TODO: Add a button to create a new board here later
      )}

      {!loading && !error && boards.length > 0 && (
        <ul className="board-list"> {/* Add a class for styling list */}
          {boards.map((board) => (
            <li key={board.id}>
              {/* Link to the BoardViewPage using the board's ID */}
              <Link to={`/board/${board.id}`}>{board.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DashboardPage;