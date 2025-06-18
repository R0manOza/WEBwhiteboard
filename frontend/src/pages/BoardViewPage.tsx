import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket'; // Import the hook
import throttle from 'lodash.throttle'; // Ensure lodash.throttle is installed

// Define a type for cursor data received from others
interface CursorPosition {
  userId: string;
  x: number;
  y: number;
}

function BoardViewPage() {
  // Get the boardId from the URL
  const { boardId } = useParams<{ boardId: string }>();

  // Use the useSocket hook for this boardId
  const { socket, isConnected } = useSocket(boardId || '');

  // State to hold other users' cursor positions (keyed by userId)
  const [otherCursors, setOtherCursors] = useState<{ [userId: string]: { x: number; y: number } }>({});

  // Ref to the canvas DOM element so we can add/remove event listeners
  const canvasRef = useRef<HTMLDivElement>(null);

  // Define the core function that sends the cursor position via socket
  // This function will be throttled. Use useCallback to ensure its identity is stable.
  const sendCursorPosition = useCallback(
    (x: number, y: number) => {
      if (socket && isConnected && boardId) {
        // Emit the cursor position event
        socket.emit('cursorPosition', { boardId, x, y });
        // console.log(`BoardViewPage (${boardId}): Emitted cursorPosition`, { x, y }); // Optional log
      }
    },
    [socket, isConnected, boardId] // Dependencies for useCallback
  );

  // Effect to set up event listeners (DOM events like mousemove, and socket events)
  useEffect(() => {
    console.log(`BoardViewPage (${boardId}): Running useEffect.`);

    if (!boardId) {
      console.error('BoardViewPage: No boardId provided in URL.');
      // TODO: Redirect to a 404 or error page if boardId is missing
      return; // Exit early if boardId is not valid
    }

    // --- Handle Mouse Move / Cursor Sync Emission ---
    const canvasElement = canvasRef.current;

    // Define the throttled version of the send function
    // Use useRef to keep the throttled function stable across effect re-runs,
    // but create it *inside* the effect to capture the latest `sendCursorPosition`.
    // Alternatively, create the throttled function outside and update the ref?
    // Let's keep it simple and create it inside the effect, and ensure cleanup cancels it.
    // A more standard approach is to throttle the *event handler* itself. Let's do that.

     const throttledHandleMouseMove = throttle((event: MouseEvent) => {
         // Pass coordinates to the core sender function
         sendCursorPosition(event.clientX, event.clientY);
     }, 50); // Throttle rate: send at most every 50ms


    if (canvasElement) {
        console.log(`BoardViewPage (${boardId}): Attaching mousemove listener.`);
         // Attach the throttled event handler directly to the DOM element
        canvasElement.addEventListener('mousemove', throttledHandleMouseMove);
    } else {
        console.warn(`BoardViewPage (${boardId}): Canvas element ref not available to attach listener.`);
    }


    // --- Handle Real-time Updates from Other Users ---
    if (socket) {
        console.log(`BoardViewPage (${boardId}): Socket available, setting up listeners.`);
        const handleCursorMoved = (data: CursorPosition) => {
             // Ensure we only update for the current board (though backend should handle this)
             // if (data.boardId !== boardId) return; // Add this check if necessary

             // console.log(`BoardViewPage (${boardId}): Received cursorMoved event`, data); // Optional log

             // Update the state for the specific user's cursor
             setOtherCursors(prev => ({
                 ...prev,
                 [data.userId]: { x: data.x, y: data.y }
             }));
         };

        // Listen for the cursor moved event
        socket.on('cursorMoved', handleCursorMoved);

        // TODO: Add listeners for 'userJoined', 'userLeft', 'containerAdded', etc.

        // Cleanup socket listeners
        const cleanupSocketListeners = () => {
            console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
            socket.off('cursorMoved', handleCursorMoved);
            // Add cleanup for other listeners here
        };
         // Return this cleanup function
        return cleanupSocketListeners; // This cleanup function runs when dependencies change or component unmounts

    } else {
         console.log(`BoardViewPage (${boardId}): Socket not available for listeners.`);
         setOtherCursors({}); // Clear cursors if socket is not available
    }


    // --- Main cleanup function for the useEffect ---
    // This runs when dependencies change or the component unmounts.
    return () => {
        console.log(`BoardViewPage (${boardId}): Main useEffect cleanup.`);
        const canvasElement = canvasRef.current;
        if (canvasElement) {
             console.log(`BoardViewPage (${boardId}): Removing mousemove listener.`);
             // Remove the specific throttled event handler
            canvasElement.removeEventListener('mousemove', throttledHandleMouseMove);
             // Cancel any pending throttled calls associated with this handler
            throttledHandleMouseMove.cancel();
        }

        // The socket listener cleanup is handled by the inner return function above
        // if the socket was available when the effect last ran.
    };


    // Effect dependencies: Re-run if boardId, socket instance, or the sendCursorPosition function changes
    // Note: sendCursorPosition only changes if its dependencies [socket, isConnected, boardId] change.
  }, [boardId, socket, sendCursorPosition]);


  // Render the board canvas area
  return (
    <div className="page board-view-page">
      {/* Display the boardId from the URL */}
      <h1>Board: {boardId || 'Loading...'}</h1>
      {/* Display socket connection status */}
      {/* Use the isConnected state from the useSocket hook */}
      <p>Socket Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

      {/* The main board canvas area */}
      <div
        ref={canvasRef} // Attach the ref to the canvas element
        className="board-canvas" // Add a class for styling
        style={{
            position: 'relative', // Needed for absolute positioning of cursors/elements
            width: '100%', // Fill available width
            height: 'calc(100vh - 150px)', // Example height (viewport height minus header/padding)
            border: '1px solid #ccc', // Visual boundary
            overflow: 'hidden', // Hide elements that go outside this boundary
            backgroundColor: '#f9f9f9', // Light background
            touchAction: 'none', // Prevent touch scrolling on this element if needed
        }}
        // REMOVED onMouseMove={handleCanvasMouseMove} FROM HERE - using addEventListener instead
      >
        {/* Placeholder for containers and items later */}
        <p>Board canvas area. Move your mouse here.</p>

        {/* Render other users' cursors */}
        {/* Filter out your own cursor if you have your user.uid from useAuth() */}
        {/* {Object.entries(otherCursors).filter(([userId]) => user?.uid !== userId).map(([userId, pos]) => ( ... )) } */}
        {Object.entries(otherCursors).map(([userId, pos]) => (
             <div
                key={userId}
                style={{
                    position: 'absolute',
                    left: pos.x, // Use received page coordinates
                    top: pos.y,
                    width: '10px', // Size of the cursor dot
                    height: '10px',
                    backgroundColor: 'red', // Placeholder color (maybe vary color per user later?)
                    borderRadius: '50%', // Make it round
                    pointerEvents: 'none', // Important: cursor dot doesn't block clicks on elements underneath
                    zIndex: 1000, // Ensure cursors are on top of other board elements
                    transform: 'translate(-50%, -50%)', // Center the dot exactly on the (x,y) coordinate
                     // Add transition for smooth movement (optional)
                    transition: 'left 0.05s linear, top 0.05s linear',
                }}
             >
                {/* Optional: Add username tooltip */}
             </div>
        ))}
      </div>
    </div>
  );
}

export default BoardViewPage;