import { useEffect, useState, useRef } from 'react';
import { io, type Socket } from 'socket.io-client'; // Import io and Socket type
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

interface UseSocketResult {
  socket: Socket | null; // The socket instance
  isConnected: boolean; // Connection status
  // You might add errors or other statuses later
}

// A map to hold active socket connections, keyed by boardId
// This prevents reconnecting if the hook is used multiple times for the same board
// across different components, though typically only one BoardViewPage is mounted at a time.
// More importantly, it allows sharing the same socket instance.
const sockets: { [boardId: string]: Socket } = {};

// Custom hook to manage WebSocket connection for a specific board
export const useSocket = (boardId: string): UseSocketResult => {
  const { user } = useAuth(); // Get current user from auth context
  const [isConnected, setIsConnected] = useState(false);
  // Use useRef to store the socket instance that persists across renders
  // We'll manage the actual socket instance outside of state to avoid re-renders
  // every time it changes internally (though useState works too).
  const socketRef = useRef<Socket | null>(null);


  useEffect(() => {
    // Only attempt connection if we have a boardId and the user is authenticated
    if (!boardId || !user) {
      console.log(`useSocket: Skipping connection. boardId: ${boardId}, user: ${!!user}`);
       // If boardId is nullified or user logs out, ensure we disconnect
       if(socketRef.current) {
           console.log(`useSocket: Disconnecting existing socket for ${boardId}`);
           socketRef.current.disconnect();
           delete sockets[boardId]; // Clean up the shared map
           socketRef.current = null;
       }
       setIsConnected(false);
      return;
    }

    // If a socket for this boardId already exists, use it
    if (sockets[boardId]) {
        console.log(`useSocket: Using existing socket for board ${boardId}`);
        socketRef.current = sockets[boardId];
        setIsConnected(sockets[boardId].connected); // Update connection status based on existing socket
        // If already connected and user exists, re-emit joinBoardRoom in case of component re-mount/re-render?
        // Or rely on backend to keep track. Simplest is to just ensure listeners are re-attached below.
    } else {
         // --- Connect to the Socket.IO server ---
        console.log(`useSocket: Connecting to socket server for board ${boardId}...`);
         // Use the /api path prefix which Vite will proxy to the backend Socket.IO server in dev
        const newSocket = io('/', { // Connect to the same origin / route, Vite proxy will forward /api
             path: '/api/socket.io', // Specify the path if your backend mounts Socket.IO under /api/socket.io (typical Express setup)
             // You might need to adjust this path based on Developer A's setup
             // E.g., if backend index.ts has io('/api'), path here would be '/api'
            auth: {
              // Pass the user's ID token for authentication on the WebSocket connection handshake
              token: user.getIdToken(), // This returns a Promise<string>, Socket.IO v4 handles Promises here
            },
            // Add CORS options if needed, though Vite proxy often handles this in dev
            // cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' }
        });

        socketRef.current = newSocket; // Store the new socket instance
        sockets[boardId] = newSocket; // Store in the shared map

        // --- Set up basic event listeners ---
        newSocket.on('connect', () => {
          console.log(`useSocket: Connected to socket server for board ${boardId}`);
          setIsConnected(true);
           // Once connected, explicitly join the room for this board
           console.log(`useSocket: Emitting 'joinBoardRoom' for ${boardId}`);
           newSocket.emit('joinBoardRoom', { boardId }); // Token is already in auth handshake
        });

        newSocket.on('disconnect', (reason) => {
          console.log(`useSocket: Disconnected from socket server for board ${boardId}. Reason: ${reason}`);
          setIsConnected(false);
           // Remove from shared map on disconnect (important for clean reconnects)
           delete sockets[boardId];
        });

        newSocket.on('connect_error', (err) => {
          console.error(`useSocket: Socket connection error for board ${boardId}:`, err);
          setIsConnected(false);
           delete sockets[boardId]; // Clean up on error too
        });

        // TODO: Add listeners for specific board events (container, item updates) here or in consuming components

    }

     // --- Add/Re-add specific board event listeners ---
     // These listeners should be set up/torn down whenever the component
     // that uses this hook mounts/unmounts or updates.
     // They use the socket instance from socketRef.current

     // Example (assuming BoardViewPage sets up 'cursorMoved' listener)
     // const currentSocket = socketRef.current;
     // if(currentSocket) {
     //     const handleCursorMoved = (data) => { /* ... update state ... */ };
     //     currentSocket.on('cursorMoved', handleCursorMoved);
     //
     //     return () => {
     //          console.log(`useSocket: Cleaning up listeners for board ${boardId}`);
     //          currentSocket.off('cursorMoved', handleCursorMoved);
     //          // Disconnect the socket ONLY if no other component is using it?
     //          // Or rely on the top-level effect logic to disconnect.
     //     };
     // }


    // Cleanup function for the main effect (runs on component unmount)
    return () => {
      console.log(`useSocket: Main useEffect cleanup for board ${boardId}.`);
      // Decide if we disconnect the socket on cleanup.
      // If we want the socket to persist while the user is on *any* page
      // related to this board or even in the app, we might not disconnect here.
      // For a simple per-board socket, disconnecting on unmount is fine.
      // However, if using the `sockets` map, the logic becomes slightly more complex
      // to only disconnect when *no one* is using it.
      // For simplicity for Phase 2, let's disconnect on component unmount
      // and rely on the initial connection logic using `sockets[boardId]` check.

       if (socketRef.current) {
           console.log(`useSocket: Disconnecting socket on component unmount for board ${boardId}`);
            // Important: Use .off() for all listeners defined *inside* this effect
           socketRef.current.offAny(); // Remove ALL listeners set within this effect scope if any added here
           socketRef.current.disconnect(); // Disconnect the socket
           delete sockets[boardId]; // Remove from shared map
           socketRef.current = null;
       }

    };
  }, [boardId, user]); // Effect dependencies: boardId or user changes

  // Return the socket instance and connection status
  // The socket instance returned here is from the ref, which is stable.
  return { socket: socketRef.current, isConnected };
};