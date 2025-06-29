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
    let didCancel = false;
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

    // Async function to handle token and socket connection
    const connectSocket = async () => {
      const token = await user.getIdToken();
      if (didCancel) return;
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const newSocket = io(socketUrl, {
        auth: { token },
      });
      socketRef.current = newSocket;
      sockets[boardId] = newSocket;

      newSocket.on('connect', () => {
        console.log(`useSocket: Connected to socket server for board ${boardId}`);
        setIsConnected(true);
        console.log(`useSocket: Emitting 'joinBoardRoom' for ${boardId}`);
        newSocket.emit('joinBoardRoom', { boardId });
      });

      newSocket.on('disconnect', (reason) => {
        console.log(`useSocket: Disconnected from socket server for board ${boardId}. Reason: ${reason}`);
        setIsConnected(false);
        delete sockets[boardId];
      });

      newSocket.on('connect_error', (err) => {
        console.error(`useSocket: Socket connection error for board ${boardId}:`, err);
        setIsConnected(false);
        delete sockets[boardId];
      });
    };

    connectSocket();

    return () => {
      didCancel = true;
      console.log(`useSocket: Main useEffect cleanup for board ${boardId}.`);
      if (socketRef.current) {
        console.log(`useSocket: Disconnecting socket on component unmount for board ${boardId}`);
        socketRef.current.offAny();
        socketRef.current.disconnect();
        delete sockets[boardId];
        socketRef.current = null;
      }
    };
  }, [boardId, user]);

  // Return the socket instance and connection status
  // The socket instance returned here is from the ref, which is stable.
  return { socket: socketRef.current, isConnected };
};
