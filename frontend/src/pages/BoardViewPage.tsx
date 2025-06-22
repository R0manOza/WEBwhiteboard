import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import throttle from 'lodash.throttle';
// Import types from shared module - make sure these paths are correct for your project structure
import type { Board, Container as ContainerType } from '../../../shared/types';
import BoardSettingsModal from '../components/Board/BoardSettingsModal'; // Import the settings modal component
import Container from '../components/Board/Container'; // Import the Container component
import CreateContainerForm from '../components/Board/CreateContainerForm'; // Import the Create Container Form component


// Define a type for cursor data received from others
interface CursorPosition {
  boardId: string;
  userId: string;
  x: number;
  y: number;
}

// TODO Phase 2: Create a component for the private board join form and uncomment the import
// import JoinPrivateBoardForm from '../components/Board/JoinPrivateBoardForm';


function BoardViewPage() {
  // --- State from Phase 2 and earlier ---
  const { boardId } = useParams<{ boardId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket(boardId || '');

  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [otherCursors, setOtherCursors] = useState<{ [userId: string]: { x: number; y: number } }>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- New State for Phase 3: Containers ---
  const [containers, setContainers] = useState<ContainerType[]>([]);


  // --- Existing Throttled Cursor Position Sender ---
  const sendCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      if (socket && isConnected && boardId && user && hasAccess) {
        socket.emit('cursorPosition', { boardId, x, y });
      }
    }, 50),
    [socket, isConnected, boardId, user, hasAccess]
  );


  // --- Effect to fetch Board Data AND Containers (Modified for Phase 3) ---
  useEffect(() => {
      console.log(`BoardViewPage (${boardId}): Running fetch effect.`);
      if (!boardId || !user) {
          console.log(`BoardViewPage (${boardId}): Skipping fetch. Missing boardId or user.`);
          setBoardLoading(false);
          setHasAccess(false);
          setContainers([]); // Clear containers
          setBoard(null); // Clear board
          setBoardError(null);
          return;
      }
       // If auth is still loading, wait for it
      if (authLoading) {
           console.log(`BoardViewPage (${boardId}): Waiting for auth to load.`);
          setBoardLoading(true); // Keep loading true while auth loads
          return;
      }


      const fetchBoardDataAndContainers = async () => {
          console.log(`BoardViewPage (${boardId}): Starting data fetch for authenticated user ${user.uid}`);
          setBoardLoading(true);
          setBoardError(null);
          setHasAccess(false); // Assume no access until confirmed by board data
          setContainers([]); // Clear containers before fetching

          try {
               const token = await user.getIdToken();

               // --- Fetch Board Data ---
               console.log(`BoardViewPage (${boardId}): Fetching board details from /api/boards/${boardId}`);
               const boardResponse = await fetch(`/api/boards/${boardId}`, {
                   headers: {
                       'Authorization': `Bearer ${token}`,
                       'Content-Type': 'application/json',
                   },
               });

               if (!boardResponse.ok) {
                   const errData = await boardResponse.json().catch(() => ({ message: 'Failed to fetch board data.' }));
                   throw new Error(errData.message || `Error fetching board: ${boardResponse.status} ${boardResponse.statusText}`);
               }
               const boardData: Board = await boardResponse.json();
               setBoard(boardData);
               console.log(`BoardViewPage (${boardId}): Fetched board data successfully.`, boardData);

               // --- Access Check ---
               const userUid = user.uid;
               const isMember = boardData.members && boardData.members[userUid] !== undefined;
               const isPublic = boardData.visibility === 'public';
               const userHasAccess = isPublic || isMember;
               setHasAccess(userHasAccess);
               console.log(`BoardViewPage (${boardId}): User ${userUid} has access: ${userHasAccess}`);
               // --- End Access Check ---


               // --- Fetch Containers ONLY if user has access ---
               if (userHasAccess) {
                   console.log(`BoardViewPage (${boardId}): User has access, fetching containers from /api/boards/${boardId}/containers...`);
                   const containersResponse = await fetch(`/api/boards/${boardId}/containers`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                   });
                    if (!containersResponse.ok) {
                       const errData = await containersResponse.json().catch(() => ({ message: 'Failed to fetch containers.' }));
                       // Decide if container fetch failure should prevent board view entirely
                       // For now, treating it as a critical error for the page.
                       throw new Error(errData.message || `Error fetching containers: ${containersResponse.status} ${containersResponse.statusText}`);
                    }
                   const containersData: ContainerType[] = await containersResponse.json();
                   setContainers(containersData);
                   console.log(`BoardViewPage (${boardId}): Fetched ${containersData.length} containers successfully.`);
               } else {
                    setContainers([]); // Ensure containers state is empty if no access
                    console.log(`BoardViewPage (${boardId}): User does not have access, skipping container fetch.`);
               }

          } catch (err: any) {
               console.error(`BoardViewPage (${boardId}): Error during data fetch process:`, err);
               setBoardError(err.message || 'Failed to load board or containers.');
               setBoard(null); // Clear board data on error
               setContainers([]); // Clear containers on error
               setHasAccess(false); // Ensure no access on error
          } finally {
              setBoardLoading(false);
              console.log(`BoardViewPage (${boardId}): Data fetch process finished. Loading: ${false}, Access: ${hasAccess}.`);
          }
      };

       // Only run the fetch logic if auth is NOT loading and we have a user and boardId
       // The initial 'if (!boardId || !user)' handles the missing data case early.
       // The 'if (authLoading)' handles waiting for auth.
       // So, if we reach here, auth is loaded, user and boardId are present, so we fetch.
       fetchBoardDataAndContainers();


       // Cleanup function for this effect
       return () => {
           console.log(`BoardViewPage (${boardId}): Cleaning up data fetch effect.`);
           // No specific cleanup needed for fetch calls themselves
       };

  }, [boardId, user, authLoading]); // Depend on boardId, user, and authLoading state


  // --- Existing Effect for Mouse Move Listener ---
  useEffect(() => {
    const canvasElement = canvasRef.current;
    const handleMouseMove = (event: MouseEvent) => {
         // Pass coordinates to the core sender function
         sendCursorPosition(event.clientX, event.clientY);
    };

    // Only attach listener if canvas exists AND user has access
    if (canvasElement && hasAccess) {
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
     // Depend on canvasRef.current, sendCursorPosition, and hasAccess
  }, [canvasRef.current, sendCursorPosition, hasAccess, boardId]); // Added boardId dependency


  // --- Effect for Socket Listeners (Modified for Phase 3) ---
  useEffect(() => {
      // Only attach socket listeners if socket is available AND user has access AND we have a boardId/user
      if (!socket || !hasAccess || !boardId || !user) {
          console.log(`BoardViewPage (${boardId}): Skipping socket listener setup (no socket, no access, or missing data).`);
          // Important: Clear state related to real-time presence/updates if socket/access is lost
          // Clear cursors (real-time presence)
          setOtherCursors({});
           // DECISION: Do NOT clear containers state here on access loss.
           // Clearing containers should happen during the fetch effect if access is determined false,
           // or when the component unmounts. Clearing them here might cause flicker if
           // hasAccess briefly goes false during a state update chain.
          return;
      }

      console.log(`BoardViewPage (${boardId}): Socket available and user has access. Setting up listeners.`);

      // --- Existing Cursor Event Handler ---
      const handleCursorMoved = (data: CursorPosition) => {
          // Ensure we only update for the current board and not our own cursor
          if (data.userId !== user?.uid && data.boardId === boardId) { // Added boardId check
               // console.log(`BoardViewPage (${boardId}): Received cursorMoved event`, data);
              setOtherCursors(prev => ({
                  ...prev,
                  [data.userId]: { x: data.x, y: data.y }
              }));
          } else if (data.boardId !== boardId) {
               console.log(`BoardViewPage: Received cursorMoved for different board ${data.boardId}. Ignoring.`);
          }
      };

      // TODO Phase 2: Add user presence listeners here (handleUserJoined, handleUserLeft)
      // socket.on('userJoined', handleUserJoined);
      // socket.on('userLeft', handleUserLeft);

      // --- Container Event Handlers (Phase 3) - Added ---
      // These handlers update the local state based on events from other users or backend broadcasts
       const handleContainerAdded = (data: { boardId: string; containerData: ContainerType }) => {
           // Ensure event is for this board and the container isn't already in state (basic check)
           if (data.boardId === boardId && data.containerData?.id && !containers.some(c => c.id === data.containerData.id)) {
               console.log(`BoardViewPage (${boardId}): Received containerAdded`, data.containerData.id);
               // Use functional update for state based on previous state - safer in effects
               setContainers(prev => [...prev, data.containerData]);
           } else if (data.boardId !== boardId) {
               console.log(`BoardViewPage: Received containerAdded for different board ${data.boardId}. Ignoring.`);
           } else if (data.containerData?.id && containers.some(c => c.id === data.containerData.id)) {
                 console.log(`BoardViewPage (${boardId}): Received containerAdded for existing container ${data.containerData.id}. Ignoring potential duplicate.`);
           } else {
                console.warn(`BoardViewPage (${boardId}): Received invalid containerAdded data:`, data);
           }
       };

        const handleContainerUpdated = (data: { boardId: string; containerId: string; updatedContainerData: Partial<ContainerType> }) => {
             // Check added: ensure data is valid and for the correct board
             if (data.boardId === boardId && data.containerId && data.updatedContainerData) {
                 console.log(`BoardViewPage (${boardId}): Received containerUpdated`, data.containerId);
                 // Use functional update for state based on previous state
                 setContainers(prev =>
                     prev.map(container =>
                         container.id === data.containerId
                             ? { ...container, ...data.updatedContainerData } // Merge updated data onto existing container
                             : container // Keep other containers as they are
                     )
                 );
             } else if (data.boardId !== boardId) {
                  console.log(`BoardViewPage: Received containerUpdated for different board ${data.boardId}. Ignoring.`);
             }
              else {
                 console.warn(`BoardViewPage (${boardId}): Received invalid containerUpdated data:`, data);
             }
        };

        const handleContainerDeleted = (data: { boardId: string; containerId: string }) => {
             // Check added: ensure data is valid and for the correct board
             if (data.boardId === boardId && data.containerId) {
                 console.log(`BoardViewPage (${boardId}): Received containerDeleted`, data.containerId);
                 // Use functional update for state based on previous state
                 setContainers(prev => prev.filter(container => container.id !== data.containerId));
             } else if (data.boardId !== boardId) {
                 console.log(`BoardViewPage: Received containerDeleted for different board ${data.boardId}. Ignoring.`);
             }
              else {
                  console.warn(`BoardViewPage (${boardId}): Received invalid containerDeleted data:`, data);
             }
        };
      // --- End Container Event Handlers ---


      // --- Attach Listeners to Socket ---
      socket.on('cursorMoved', handleCursorMoved);

      // --- Attach Container Listeners (Phase 3) ---
       socket.on('containerAdded', handleContainerAdded);
       socket.on('containerUpdated', handleContainerUpdated);
       socket.on('containerDeleted', handleContainerDeleted);
      // --- End Attach Container Listeners ---


      // Cleanup function for this effect - removes listeners
      return () => {
          console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
          socket.off('cursorMoved', handleCursorMoved);

          // --- Clean up Container Listeners ---
           socket.off('containerAdded', handleContainerAdded);
           socket.off('containerUpdated', handleContainerUpdated);
           socket.off('containerDeleted', handleContainerDeleted);
          // --- End Clean up Container Listeners ---

           // Note: The useSocket hook handles disconnecting the socket instance itself
           // when boardId or user changes or component unmounts.
      };

       // Dependencies for the socket effect: socket, user, boardId, hasAccess
       // We do NOT include 'containers' state in dependencies because the event handlers
       // use the functional update form (prev => ...) which gets the latest state.
  }, [socket, user, boardId, hasAccess]);


   // --- Render Logic ---

   // Handle initial authentication loading state
   if (authLoading) {
        console.log(`BoardViewPage (${boardId}): Rendering Auth Loading state.`);
       return <div className="page board-view-page"><p>Loading authentication...</p></div>;
   }

   // Handle board data loading state (after auth)
   if (boardLoading) {
        console.log(`BoardViewPage (${boardId}): Rendering Board Loading state.`);
       return <div className="page board-view-page"><p>Loading board data...</p></div>;
   }

   // Handle board fetch error state
   if (boardError) {
        console.log(`BoardViewPage (${boardId}): Rendering Board Error state.`, boardError);
       return <div className="page board-view-page"><p style={{ color: 'red' }}>Error loading board: {boardError}</p></div>;
   }

   // If board loaded but user does NOT have access (and it's private)
   if (!hasAccess && board && board.visibility === 'private') {
        console.log(`BoardViewPage (${boardId}): Rendering JoinPrivateBoardForm.`);
        // TODO Phase 2: Render JoinPrivateBoardForm component here
        // Pass boardId and a callback like onSuccessfulJoin
        const handleSuccessfulJoin = () => {
            console.log(`BoardViewPage (${boardId}): Join successful, setting hasAccess to true and triggering re-fetch.`);
            // Setting hasAccess to true immediately changes UI
            setHasAccess(true);
             // Re-fetch board data (and containers if user now has access) to get latest state
             // This might be needed to update members list, etc.
             // To do this, you'd need to wrap the fetch logic from the first effect into a separate function
             // and call it here. Or, rely on the socket 'userJoined' event if implemented.
             // For simplicity now, just setting hasAccess(true) immediately changes the UI to show the canvas.
        };

        return (
            <div className="page board-view-page">
                 <h1>Private Board: {board.name}</h1>
                 <p>You do not have access to this private board. Enter password to join.</p>
                 {/* TODO Phase 2: Uncomment and render your JoinPrivateBoardForm component here */}
                 {/* <JoinPrivateBoardForm boardId={boardId} onSuccessfulJoin={handleSuccessfulJoin} /> */}
                 {/* --- Temporary Placeholder for Join Form --- */}
                 <div style={{ border: '1px dashed blue', padding: '20px', maxWidth: '400px', margin: '20px auto' }}>
                     Placeholder for JoinPrivateBoardForm (Password Input + Join Button)
                     {/* Button below is TEMPORARY for testing the UI transition */}
                     <button onClick={handleSuccessfulJoin} style={{ display: 'block', marginTop: '10px' }}>Simulate Successful Join (TEMP)</button>
                 </div>
                 {/* --- End Temporary Placeholder --- */}
            </div>
        );
   }


   // If we get here, board is loaded, no error, and user has access (or board is public)
   // Render the main board content
    console.log(`BoardViewPage (${boardId}): Rendering main board content.`);

  return (
    <div className="page board-view-page">
      <h1>Board: {board?.name || boardId}</h1>
      {/* Add button to open settings (only visible if user has access) */}
       {hasAccess && ( // Conditionally render settings button if user has access
            <button onClick={() => setShowSettingsModal(true)} className="sign-out-button" style={{ marginBottom: '10px' }}>
               Settings
           </button>
       )}


      <p>Socket Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

      {/* The main board canvas area */}
      <div
        ref={canvasRef} // Attach the ref
        className="board-canvas"
        style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100vh - 200px)', // Adjust height slightly for settings button/padding
            border: '1px solid #ccc',
            overflow: 'hidden', // Important: Clips anything dragged/resized outside
            backgroundColor: '#f9f9f9',
            touchAction: 'none', // Prevent browser touch gestures interfering with drag/pan
        }}
      >
        {/* Optional message if no containers */}
        {containers.length === 0 && (
             <p style={{ textAlign: 'center', marginTop: '50px', color: '#605e5c' }}>
                 {hasAccess ? 'No containers yet. Create one!' : 'Board is empty or still loading containers.'}
             </p>
         )}


        {/* --- Render Containers here (Phase 3) --- */}
         {containers.map(container => (
            // Render the Container component, pass container data
            // You will add more props here later for drag/resize/items
            <Container key={container.id} container={container} />
         ))}
        {/* --- End Render Containers --- */}


        {/* --- Create Container UI (Phase 3) --- */}
         {/* Position this wherever it makes sense, e.g., a fixed button or in a sidebar (future) */}
         {hasAccess && ( // Only show create form if user has access
              <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10 }}> {/* Added zIndex to ensure visibility */}
                 <CreateContainerForm boardId={boardId || ''} /> {/* Pass boardId */}
             </div>
         )}
        {/* --- End Create Container UI --- */}


        {/* Render other users' cursors */}
        {/* Ensure cursors are above containers/forms by setting zIndex */}
        {Object.entries(otherCursors)
            // Filter out the current user's cursor if it somehow gets into state
            .filter(([userId]) => userId !== user?.uid)
            .map(([userId, pos]) => (
             <div
                key={userId}
                style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'red', // Placeholder color
                    borderRadius: '50%',
                    pointerEvents: 'none', // Important: cursor dot doesn't block clicks on elements underneath
                    zIndex: 2000, // Ensure cursors are on top of everything else
                    transform: 'translate(-50%, -50%)', // Center the dot exactly on the (x,y) coordinate
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
                 }}>{userId}</span> {/* Placeholder for username - replace with fetched user info if available */}
             </div>
        ))}
      </div>

        {/* Render the Settings Modal */}
        <BoardSettingsModal
           boardId={boardId || ''}
           isOpen={showSettingsModal}
           onClose={() => setShowSettingsModal(false)}
         />

         {/* TODO Phase 2: Render JoinPrivateBoardForm here conditionally if needed */}
         {/* It is rendered in the early return block above */}

    </div>
  );
}

export default BoardViewPage;