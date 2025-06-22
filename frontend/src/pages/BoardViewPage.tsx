import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import throttle from 'lodash.throttle';
import type { Board } from '../../../shared/types'; // Import Board type
import BoardSettingsModal from '../components/Board/BoardSettingsModal'; // Import the new modal component

// Define a type for cursor data received from others
interface CursorPosition {
  userId: string;
  x: number;
  y: number;
}

// TODO: Create a component for the private board join form
// import JoinPrivateBoardForm from '../components/Board/JoinPrivateBoardForm';


function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, loading: authLoading } = useAuth(); // Get user and auth loading state
  const { socket, isConnected } = useSocket(boardId || '');

  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  // State for other users' cursor positions
  const [otherCursors, setOtherCursors] = useState<{ [userId: string]: { x: number; y: number } }>({});

  // State to control settings modal visibility
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // State to determine if user has access to view board content
  // This will be true if board is public OR user is a member
  // Placeholder for now, will implement proper check in Step 6
   const [hasAccess, setHasAccess] = useState(false);


  const canvasRef = useRef<HTMLDivElement>(null);

  const sendCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      // Only send if socket is connected, boardId exists, and user is authenticated AND has access
      if (socket && isConnected && boardId && user && hasAccess) { // Added hasAccess check
        socket.emit('cursorPosition', { boardId, x, y });
      }
    }, 50), // Throttle rate
    [socket, isConnected, boardId, user, hasAccess] // Dependencies for useCallback
  );


  // Effect to fetch board data on mount or boardId/user change
  useEffect(() => {
      console.log(`BoardViewPage (${boardId}): Fetching board data...`);
      if (!boardId || !user) {
          setBoardLoading(false);
           // If boardId or user is null, user doesn't have access by default
          setHasAccess(false);
          return;
      }

      const fetchBoardData = async () => {
          setBoardLoading(true);
          setBoardError(null);
           setHasAccess(false); // Assume no access until confirmed

          try {
               const token = await user.getIdToken();
               const response = await fetch(`/api/boards/${boardId}`, {
                   headers: {
                       'Authorization': `Bearer ${token}`,
                       'Content-Type': 'application/json',
                   },
               });

               if (!response.ok) {
                   const errData = await response.json().catch(() => ({ message: 'Failed to fetch board data.' }));
                   throw new Error(errData.message || `Error ${response.status}`);
               }

               const data: Board = await response.json();
               setBoard(data);
               console.log(`BoardViewPage (${boardId}): Fetched board data`, data);

               // --- Access Check (Step 6 Implementation) ---
               // Determine if the current user has access to view this board
               const userUid = user.uid;
               const isMember = data.members && data.members[userUid] !== undefined;
               const isPublic = data.visibility === 'public';
               const userHasAccess = isPublic || isMember;
               setHasAccess(userHasAccess);
               console.log(`BoardViewPage (${boardId}): User ${userUid} has access: ${userHasAccess}`);
               // --- End Access Check ---


          } catch (err: any) {
               console.error(`BoardViewPage (${boardId}): Error fetching board data:`, err);
               setBoardError(err.message || 'Failed to load board.');
               setBoard(null); // Clear board data on error
               setHasAccess(false); // Ensure no access on error
          } finally {
              setBoardLoading(false);
          }
      };

       // Only fetch if not authLoading, and we have a user and boardId
      if (!authLoading && user) {
         fetchBoardData();
      }

  }, [boardId, user, authLoading]); // Depend on boardId, user, and authLoading state

  // Effect for Mouse Move Listener (attaches to canvasRef)
  useEffect(() => {
    const canvasElement = canvasRef.current;
    // Use the throttled function from useCallback
    const handleMouseMove = (event: MouseEvent) => {
         sendCursorPosition(event.clientX, event.clientY);
    };

    if (canvasElement && hasAccess) { // Only attach listener if user has access
        console.log(`BoardViewPage (${boardId}): Attaching mousemove listener.`);
        canvasElement.addEventListener('mousemove', handleMouseMove);
    } else {
         console.log(`BoardViewPage (${boardId}): Skipping mousemove listener attachment (no canvas or no access).`);
    }

    return () => {
        if (canvasElement) {
             console.log(`BoardViewPage (${boardId}): Removing mousemove listener.`);
             canvasElement.removeEventListener('mousemove', handleMouseMove);
              // Cancel any pending throttled calls
             sendCursorPosition.cancel(); // throttle from lodash has a .cancel() method
        }
    };
     // Depend on canvasRef.current, sendCursorPosition (which depends on socket, etc.), and hasAccess
  }, [canvasRef.current, sendCursorPosition, hasAccess]);


  // Effect for Socket Listeners (attaches to socket instance)
  useEffect(() => {
      if (!socket || !hasAccess) { // Only attach socket listeners if socket is available and user has access
          console.log(`BoardViewPage (${boardId}): Skipping socket listener setup (no socket or no access).`);
          setOtherCursors({}); // Clear cursors if socket/access lost
          return;
      }

      console.log(`BoardViewPage (${boardId}): Socket available and user has access. Setting up listeners.`);

      const handleCursorMoved = (data: CursorPosition) => {
          // Ensure we only update for the current board and not our own cursor
          if (data.userId !== user?.uid) {
               // console.log(`BoardViewPage (${boardId}): Received cursorMoved event`, data); // Optional log
              setOtherCursors(prev => ({
                  ...prev,
                  [data.userId]: { x: data.x, y: data.y }
              }));
          }
      };

      // TODO Phase 2: Add user presence listeners here
      // socket.on('userJoined', handleUserJoined);
      // socket.on('userLeft', handleUserLeft);

      // TODO Phase 3: Add container listeners here
      // socket.on('containerAdded', handleContainerAdded);
      // socket.on('containerUpdated', handleContainerUpdated);
      // socket.on('containerDeleted', handleContainerDeleted);


      socket.on('cursorMoved', handleCursorMoved);


      // Cleanup socket listeners
      return () => {
          console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
          socket.off('cursorMoved', handleCursorMoved);
          // TODO Phase 2: Clean up user presence listeners
          // socket.off('userJoined', handleUserJoined);
          // socket.off('userLeft', handleUserLeft);
          // TODO Phase 3: Clean up container listeners
          // socket.off('containerAdded', handleContainerAdded);
          // socket.off('containerUpdated', handleContainerUpdated);
          // socket.off('containerDeleted', handleContainerDeleted);

           // Note: The useSocket hook handles disconnecting the socket instance itself
           // when boardId or user changes or component unmounts.
      };

       // Depend on socket, user, and hasAccess
  }, [socket, user, boardId, hasAccess]); // Added boardId dependency for clarity, though socket dependency might be sufficient


   // Handle loading/error states for the page itself
   if (authLoading || boardLoading) {
       return <div className="page board-view-page"><p>Loading board...</p></div>;
   }

   if (boardError) {
       return <div className="page board-view-page"><p style={{ color: 'red' }}>Error: {boardError}</p></div>;
   }

   // If user does NOT have access, show the join form (Step 6 Implementation)
   if (!hasAccess && board && board.visibility === 'private') {
        console.log(`BoardViewPage (${boardId}): Rendering JoinPrivateBoardForm`);
        // TODO: Render JoinPrivateBoardForm component here
        // Pass boardId and a callback like onSuccessfulJoin
        const handleSuccessfulJoin = () => {
            console.log(`BoardViewPage (${boardId}): Join successful, setting hasAccess to true.`);
            setHasAccess(true); // Grant access
            // Alternatively, you might re-fetch board data here to get the updated members list
            // fetchBoardData(); // Requires moving fetchBoardData outside effects/making it callable
        };

        return (
            <div className="page board-view-page">
                 <h1>Private Board: {board.name}</h1>
                 <p>You do not have access to this private board. Enter password to join.</p>
                 {/* TODO: Render your JoinPrivateBoardForm component here */}
                 {/* <JoinPrivateBoardForm boardId={boardId} onSuccessfulJoin={handleSuccessfulJoin} /> */}
                 <div style={{ border: '1px dashed blue', padding: '20px' }}>
                     Placeholder for JoinPrivateBoardForm (Password Input + Join Button)
                     <button onClick={handleSuccessfulJoin}>Simulate Successful Join</button> {/* Temporary for testing */}
                 </div>
            </div>
        );
   }


   // If we get here, board is loaded, no error, and user has access (or board is public)
   // Render the main board content
    console.log(`BoardViewPage (${boardId}): Rendering main board content.`);

  return (
    <div className="page board-view-page">
      <h1>Board: {board?.name || boardId}</h1>
      {/* Add button to open settings */}
       <button onClick={() => setShowSettingsModal(true)} className="sign-out-button" style={{ marginBottom: '10px' }}>
           Settings
       </button>

      <p>Socket Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

      {/* The main board canvas area */}
      <div
        ref={canvasRef} // Attach the ref
        className="board-canvas"
        style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100vh - 200px)', // Adjust height slightly for settings button
            border: '1px solid #ccc',
            overflow: 'hidden',
            backgroundColor: '#f9f9f9',
            touchAction: 'none',
        }}
      >
        <p>Board canvas area. Move your mouse here.</p>

        {/* TODO Phase 3: Render Containers here */}
         {/* {containers.map(container => (
            <Container key={container.id} container={container} /> // Pass container data
         ))} */}
         <div style={{ border: '1px dashed green', padding: '20px', position: 'absolute', top: 50, left: 50 }}>
             Placeholder for Containers (Phase 3)
         </div>
         {/* TODO Phase 3: Placeholder/button for Create Container UI */}
          <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
             {/* <CreateContainerForm boardId={boardId} /> */}
              Placeholder for Create Container UI
          </div>


        {/* Render other users' cursors */}
        {Object.entries(otherCursors)
            // Filter out the current user's cursor if it somehow gets into state
            .filter(([userId]) => userId !== user?.uid)
            .map(([userId, pos]) => (
             <div
                key={userId}
                style={{
                    position: 'absolute',
                    left: pos.x, // Use received page coordinates
                    top: pos.y,
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'red',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 0.05s linear, top 0.05s linear', // Smooth movement
                }}
             >
                {/* Optional: Add username tooltip */}
                 <span style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    whiteSpace: 'nowrap',
                 }}>{userId}</span> {/* Placeholder for username */}
             </div>
        ))}
      </div>

        {/* Render the Settings Modal */}
        <BoardSettingsModal
           boardId={boardId || ''} // Pass boardId
           isOpen={showSettingsModal} // Control visibility via state
           onClose={() => setShowSettingsModal(false)} // Close handler
         />

         {/* TODO: Render JoinPrivateBoardForm here conditionally if needed */}
         {/* ... (handled above in the early return) ... */}

    </div>
  );
}

export default BoardViewPage;