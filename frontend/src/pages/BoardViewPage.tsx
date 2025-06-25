import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';
import type { Board, Container as ContainerType, DrawingStroke, ContainerPurpose } from '../../../shared/types';
import BoardSettingsModal from '../components/Board/BoardSettingsModal';
import Container from '../components/Board/Container';
import CreateContainerForm from '../components/Board/CreateContainerForm';
import DrawingCanvas from '../components/Board/DrawingCanvas';
import './BoardViewPage.css';

// Define a unique ID for the sample board
const SAMPLE_BOARD_ID = 'sample-solo-board';

// Define static data for the sample board
const sampleBoardData: Board = {
  id: SAMPLE_BOARD_ID,
  name: 'Sample Solo Board',
  description: 'A static board to explore features without backend data.',
  visibility: 'public', // Doesn't affect solo mode
  ownerId: 'sample-user-id', // Placeholder owner ID
  members: { 'sample-user-id': 'owner' }, // Placeholder member
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Define static data for initial containers on the sample board
const sampleContainersData: ContainerType[] = [
  {
    id: 'sample-container-1',
    boardId: SAMPLE_BOARD_ID,
    title: 'Welcome!',
    purpose: 'notes',
    position: { x: 50, y: 50 },
    size: { width: 300, height: 200 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'sample-container-2',
    boardId: SAMPLE_BOARD_ID,
    title: 'Example Links',
    purpose: 'links',
    position: { x: 400, y: 100 },
    size: { width: 350, height: 300 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  // Add more sample containers if desired
];


// Define a type for cursor data received from others
interface CursorPosition {
  boardId: string;
  userId: string;
  x: number;
  y: number;
}

function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>();
  // Ensure boardId is available before passing to useSocket
  const { socket, isConnected } = useSocket(boardId || '');
  const { user, loading: authLoading } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true); // Loading state for initial board/container fetch
  const [boardError, setBoardError] = useState<string | null>(null);

  const [otherCursors, setOtherCursors] = useState<{ [userId: string]: { x: number; y: number } }>(
    {}
  );
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(false); // Controls rendering of board content vs join form

  // Container state - Now managed based on initial fetch and socket events
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // State to track if a container is currently being created via API
  const [isCreatingContainer, setIsCreatingContainer] = useState(false);
   // State to track errors during container creation
  const [createContainerError, setCreateContainerError] = useState<string | null>(null);


  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  // Note: Full board drawing strokes state might need to live here or in DrawingCanvas
  // For now, DrawingCanvas manages its own strokes and listens to socket events directly.

  const canvasRef = useRef<HTMLDivElement>(null); // Ref for the main canvas area

  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [drawingUsers, setDrawingUsers] = useState<{ [userId: string]: boolean }>({}); // Tracks who is drawing
  const [ownerName, setOwnerName] = useState<string>(''); // Display name of the board owner

  // Throttled Cursor Position Sender (already implemented)
  const sendCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      if (socket && isConnected && boardId && user && hasAccess) { // Ensure user and access
        socket.emit('cursorPosition', { boardId, x, y });
      }
    }, 50),
    [socket, isConnected, boardId, user, hasAccess] // Dependencies for useCallback
  );

  // Debounced function for sending container position/size updates
  // This function will only make the API call
  const updateContainerApi = useCallback(
      debounce(async (containerId: string, updates: { position?: { x: number; y: number }; size?: { width: number; height: number } }) => {
        console.log(`Attempting to send debounced update for container ${containerId}:`, updates);
        if (!user || !boardId || boardId === SAMPLE_BOARD_ID) {
             console.warn("Skipping API update for container (no user, boardId, or it's sample board)");
             return; // Don't call API for sample board or if requirements not met
        }

        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/boards/${boardId}/containers/${containerId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                 // Handle API error during update
                 console.error(`Failed to update container ${containerId} via API:`, response.status, response.statusText);
                 // TODO: Maybe revert local state or show a notification?
                 // Reverting state is complex with optimistic updates and real-time sync.
                 // For now, rely on the user seeing the correct state eventually via socket or refresh.
            } else {
                 console.log(`Container ${containerId} updated successfully via API.`);
                 // Note: The state update should ideally come from the socket event,
                 // which the backend broadcasts after successfully saving the update.
                 // Optimistic update already happened in handleContainerPositionChange/SizeChange
            }
        } catch (error) {
             console.error(`Error sending container update API call for ${containerId}:`, error);
             // TODO: Handle network errors etc.
             // Show user a network error notification?
        }
      }, 300), // Debounce time: 300ms
      [user, boardId] // Debounce function dependencies
  );

  // Container handlers - these now trigger API calls for real boards
  const handleCreateContainer = async (formData: { title: string; purpose: ContainerPurpose }) => {
    console.log("Attempting to create container with form data:", formData);
    if (!user || !boardId) {
         console.warn("Skipping container creation (no user or boardId)");
         return;
    }

    setCreateContainerError(null); // Clear previous errors
    setIsCreatingContainer(true); // Indicate creation is in progress

    // Default initial position and size - can be improved later
    // Example: place it near the center of the current view, or relative to mouse
    const defaultPosition = { x: 100, y: 100 };
    const defaultSize = {
        width: 300,
        height: formData.purpose === 'links' ? 300 : 200 // Make links containers taller
    };

     // For sample board, just update local state
    if (boardId === SAMPLE_BOARD_ID) {
         console.log("Creating container locally for sample board.");
          const newContainer: ContainerType = {
            id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Local temp ID
            boardId: boardId,
            title: formData.title.trim(),
            purpose: formData.purpose,
            position: defaultPosition,
            size: defaultSize,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setContainers(prev => [...prev, newContainer]);
          setShowCreateForm(false); // Close form on success
          setIsCreatingContainer(false); // Finish local creation state
          console.log("Sample container created locally:", newContainer.id);
          return;
    }


    // For real boards, call the backend API
    try {
      const token = await user.getIdToken();
      const payload = {
        boardId: boardId,
        title: formData.title.trim(),
        purpose: formData.purpose,
        position: defaultPosition, // Send initial position
        size: defaultSize,       // Send initial size
        // Backend will add ID, ownerId, timestamps
      };

      console.log("Calling backend API to create container:", payload);
      const response = await fetch(`/api/boards/${boardId}/containers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend API container creation failed:", response.status, data);
        setCreateContainerError(data.error || 'Failed to create container via API.');
         // Do NOT update local state here. Wait for WebSocket event.
      } else {
         console.log("Backend API container creation successful:", data);
         // Success - The new container should be added to state via the WebSocket listener ('containerAdded' event)
         // Close the form even if we wait for socket event, as the API call was successful
         setShowCreateForm(false);
      }

    } catch (err: any) {
      console.error("Error calling backend API to create container:", err);
      setCreateContainerError(err.message || 'Network error during container creation.');
       // Do NOT update local state here. Wait for WebSocket event (or handle network error state).
    } finally {
      setIsCreatingContainer(false); // Creation process finished (either success or error)
    }
  };

  // Handle position changes - triggers debounced API call for real boards
  const handleContainerPositionChange = useCallback((containerId: string, newPosition: { x: number; y: number }) => {
    // Update local state immediately for perceived responsiveness (optimistic update)
    setContainers(prev =>
      prev.map(container =>
        container.id === containerId
          ? { ...container, position: newPosition, updatedAt: Date.now() } // Update timestamp locally too
          : container
      )
    );
     console.log(`Container ${containerId}: Position updated locally.`);

    // Trigger debounced API call for real boards
     if (boardId !== SAMPLE_BOARD_ID && user) { // Ensure it's a real board and user is logged in
         updateContainerApi(containerId, { position: newPosition });
     }
  }, [boardId, user, updateContainerApi]); // updateContainerApi is a stable ref thanks to useCallback/debounce

  // Handle size changes - triggers debounced API call for real boards
  const handleContainerSizeChange = useCallback((containerId: string, newSize: { width: number; height: number }) => {
    // Update local state immediately (optimistic update)
    setContainers(prev =>
      prev.map(container =>
        container.id === containerId
          ? { ...container, size: newSize, updatedAt: Date.now() } // Update timestamp locally too
          : container
      )
    );
     console.log(`Container ${containerId}: Size updated locally.`);

    // Trigger debounced API call for real boards
    if (boardId !== SAMPLE_BOARD_ID && user) { // Ensure it's a real board and user is logged in
        updateContainerApi(containerId, { size: newSize });
    }
  }, [boardId, user, updateContainerApi]); // updateContainerApi is a stable ref thanks to useCallback/debounce


  // Handle container deletion - triggers API call for real boards
  const handleContainerDelete = async (containerId: string) => {
    if (!user || !boardId) {
         console.warn("Skipping container deletion (no user or boardId)");
         return;
    }
    // Confirm before deleting (optional but good UX)
     if (!window.confirm('Are you sure you want to delete this container?')) {
         return;
     }

     // For sample board, just update local state
    if (boardId === SAMPLE_BOARD_ID) {
         console.log("Deleting container locally for sample board:", containerId);
         setContainers(prev => prev.filter(container => container.id !== containerId));
         return;
    }

    // For real boards, call the backend API
    try {
      const token = await user.getIdToken();
      console.log(`Calling backend API to delete container: ${containerId}`);
      const response = await fetch(`/api/boards/${boardId}/containers/${containerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Backend API container deletion failed:", response.status);
        // TODO: Show deletion error to user
        alert('Failed to delete container.'); // Simple error feedback
      } else {
         console.log(`Container ${containerId} deleted successfully via API.`);
         // Success - The container should be removed from state via the WebSocket listener ('containerDeleted' event)
      }

    } catch (err: any) {
      console.error(`Error calling backend API to delete container ${containerId}:`, err);
      // TODO: Handle network error etc.
       alert('Network error during container deletion.'); // Simple error feedback
    }
     // Note: We don't remove from local state immediately for real boards.
     // The state update comes from the socket event to avoid conflicts.
  };


  // Effect to fetch Board Data AND Containers (or load sample data)
  useEffect(() => {
    console.log(`BoardViewPage (${boardId}): Running main effect.`);

    // --- START: Sample Board Logic ---
    if (boardId === SAMPLE_BOARD_ID) {
        console.log(`BoardViewPage (${boardId}): Loading sample board.`);
        setBoardLoading(false); // Loading finishes immediately
        setHasAccess(true);    // Access is granted automatically
        setBoard(sampleBoardData); // Set static board data
        setContainers(sampleContainersData); // Set static container data
        setBoardError(null);   // Clear any previous error
        setOwnerName('Sample User'); // Set sample owner name
        // No backend fetch needed for sample board
        return; // Crucially, stop the effect here if it's the sample board
    }
    // --- END: Sample Board Logic ---


    // --- START: Real Board Logic ---
    // If not sample board, proceed with authentication and backend fetch checks

    // Function to fetch board and container data from backend
    const fetchBoardAndContainerData = async (currentUser: typeof user) => { // Explicitly pass user
      console.log(`BoardViewPage (${boardId}): Starting backend data fetch for authenticated user ${currentUser!.uid}`); // Use currentUser!
      setBoardLoading(true); // Still loading for backend fetch
      setBoardError(null);
      setHasAccess(false); // Assume no access until verified
      setBoard(null); // Clear previous board state
      setContainers([]); // Clear previous containers state
      setOwnerName('');

      try {
        const token = await currentUser!.getIdToken(); // Use currentUser!

        // --- Fetch Board Data ---
        console.log(`BoardViewPage (${boardId}): Fetching board details from /api/boards/${boardId}`);
        const boardResponse = await fetch(`/api/boards/${boardId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        // If board fetch fails (e.g., 404, 403)
        if (!boardResponse.ok) {
          const errData = await boardResponse.json().catch(() => ({ message: 'Failed to fetch board data.' }));
          // Handle specific errors like 403 (Forbidden) or 404 (Not Found)
          const errorMessage = errData.error || errData.message || `Error fetching board: ${boardResponse.status} ${boardResponse.statusText}`;
          console.error(`BoardViewPage (${boardId}): Backend board fetch failed:`, boardResponse.status, errorMessage);

          setBoardError(errorMessage);
          setHasAccess(false); // Explicitly set false
          setBoard(null); // Clear previous board state
          setContainers([]); // Clear containers state
          setOwnerName('');
          // Note: Access is not granted, so no need to fetch containers.
          return; // Stop fetching process if board details failed
        }

        const boardData: Board = await boardResponse.json();
        setBoard(boardData);
        console.log(`BoardViewPage (${boardId}): Fetched board data successfully.`, boardData);


        // --- Fetch Containers for real boards ---
        console.log(`BoardViewPage (${boardId}): Fetching containers from /api/boards/${boardId}/containers`);
         // Assuming a new endpoint GET /api/boards/:boardId/containers exists
        const containersResponse = await fetch(`/api/boards/${boardId}/containers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (containersResponse.ok) {
           const containersData: ContainerType[] = await containersResponse.json();
           setContainers(containersData); // Set real containers
           console.log(`BoardViewPage (${boardId}): Fetched ${containersData.length} containers.`);
        } else {
           console.warn("Failed to fetch containers for board:", boardId, containersResponse.status);
           setContainers([]); // Set empty array if fetch fails
           // Decide if failing to fetch containers should be a hard error or just show an empty board
           // For now, let's allow the board to load without containers if that fails.
           // TODO: Display a warning message to the user if containers fail to load.
        }


        // Access Check for real boards (If we reached here, backend GET /:id was successful, implies access)
        setHasAccess(true); // If board fetch was ok and not 403/404, user has access

        // Fetch owner name for display for real boards
         if (boardData.ownerId) {
            const userInfoRes = await fetch(`/api/auth/userInfo?uid=${boardData.ownerId}`, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
             if(userInfoRes.ok) {
                const userInfoData = await userInfoRes.json();
                setOwnerName(userInfoData.displayName || boardData.ownerId);
             } else {
                setOwnerName(boardData.ownerId); // Fallback to UID
             }
         } else {
            setOwnerName(currentUser!.displayName || currentUser!.email || 'Unknown Owner'); // Fallback, use currentUser!
         }


      } catch (err: any) {
        console.error(`BoardViewPage (${boardId}): Error during backend data fetch process:`, err);
        // Handle network errors or unexpected issues during fetch
        setBoardError(err.message || 'Failed to load board.');
        setBoard(null);
        setHasAccess(false); // Ensure access is false on error
        setContainers([]); // Clear containers on error
        setOwnerName('');
      } finally {
        setBoardLoading(false); // Loading finishes regardless of fetch success/failure
        console.log(`BoardViewPage (${boardId}): Backend data fetch process finished. Loading: ${false}.`);
      }
    };

    // Condition to trigger the fetch for REAL boards
    // Only fetch if boardId is present AND it's NOT the sample ID AND user is logged in AND authLoading is false
    // Added check that board is currently null or different boardId to prevent unnecessary fetches on unrelated user/authLoading changes
    if (
         boardId &&
         boardId !== SAMPLE_BOARD_ID &&
         user &&
         !authLoading &&
         (!board || board.id !== boardId) // Only fetch if board state needs updating for this ID
       )
    {
         fetchBoardAndContainerData(user); // Call the backend fetch function, passing the user
    }
    // Note: If authLoading is false but user is null, the component will render the error/no-auth state.

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up data fetch effect.`);
       // Cancel pending debounced updates when boardId changes or component unmounts
       updateContainerApi.cancel();
    };

  }, [boardId, user, authLoading, updateContainerApi, board]); // Added 'board' to dependencies

  // ... rest of the component (cursor effect, socket effect, render logic) remains the same ...

  // Effect for Mouse Move Listener (for cursor position)
  // This effect runs for both sample and real boards if hasAccess is true and user exists
  // Note: Cursor requires user ID for distinction, so only runs if user is logged in.
  // This effect should run whenever boardId, user, or hasAccess changes.
   useEffect(() => {
    const canvasElement = canvasRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      if (!canvasElement || !user) return; // Ensure canvas and user
      const rect = canvasElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      sendCursorPosition(x, y);
    };

    // Attach listener only if canvas, hasAccess, and user exist
    // Re-attach if boardId changes (even if it's the sample board)
    if (canvasElement && hasAccess && user) {
      console.log(`BoardViewPage (${boardId}): Attaching mousemove listener for cursor.`);
      canvasElement.addEventListener('mousemove', handleMouseMove);
    } else {
      console.log(`BoardViewPage (${boardId}): Skipping mousemove listener attachment (no canvas, no access, or no user).`);
    }

    return () => {
      if (canvasElement) {
        console.log(`BoardViewPage (${boardId}): Removing mousemove listener.`);
        canvasElement.removeEventListener('mousemove', handleMouseMove);
        sendCursorPosition.cancel(); // Cancel any pending throttled calls
      }
    };
  }, [canvasRef.current, sendCursorPosition, hasAccess, boardId, user]); // Added boardId and user dependencies

  // Effect for Socket Listeners (cursor movements, user presence, drawing sync, CONTAINER SYNC)
  // This effect should run whenever boardId, socket, isConnected, hasAccess, user changes.
  useEffect(() => {
    // Only set up listeners if socket is connected, hasAccess is true, boardId is valid, and user exists
    // (user is needed to exclude self from other users' events)
    if (!socket || !isConnected || !hasAccess || !boardId || !user) {
      console.log(`BoardViewPage (${boardId}): Skipping socket listener setup (socket/access/boardId/user missing).`);
      return;
    }

    console.log(`BoardViewPage (${boardId}): Setting up socket listeners.`);

    // --- Cursor/Presence Listeners ---
    const handleCursorMoved = (data: CursorPosition) => {
      if (data.boardId === boardId && data.userId !== user.uid) { // Only update for other users on this board
        setOtherCursors(prev => ({
          ...prev,
          [data.userId]: { x: data.x, y: data.y }
        }));
      }
    };

     const handleOnlineUsers = (data: { boardId: string; users: { userId: string; displayName: string }[] }) => {
      if (data.boardId === boardId) {
        console.log(`BoardViewPage (${boardId}): Received online users update:`, data.users);
        setOnlineUsers(data.users);
        // Clean up cursors/drawing status for users no longer online
        setOtherCursors(prevCursors => {
             const onlineUserIds = new Set(data.users.map(u => u.userId));
             const updatedCursors = { ...prevCursors };
             for (const userId in updatedCursors) {
                 // Keep cursors for users still online (excluding self)
                 if (userId !== user.uid && !onlineUserIds.has(userId)) {
                     delete updatedCursors[userId];
                 }
             }
             return updatedCursors;
        });
         setDrawingUsers(prevDrawing => {
             const onlineUserIds = new Set(data.users.map(u => u.userId));
             const updatedDrawing = { ...prevDrawing };
             for (const userId in updatedDrawing) {
                 // Keep drawing status for users still online (excluding self)
                 if (userId !== user.uid && !onlineUserIds.has(userId)) {
                     delete updatedDrawing[userId];
                 }
             }
             return updatedDrawing;
        });
      }
    };

    const handleUserDrawingStatus = (data: { boardId: string; userId: string; isDrawing: boolean }) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        console.log(`BoardViewPage (${boardId}): User ${data.userId} is ${data.isDrawing ? 'drawing' : 'not drawing'}`);
        setDrawingUsers(prev => ({ ...prev, [data.userId]: data.isDrawing }));
      }
    };

     // --- Container Listeners ---
     const handleContainerAdded = (data: { boardId: string; container: ContainerType }) => {
         if (data.boardId === boardId) {
             console.log(`BoardViewPage (${boardId}): Received containerAdded event:`, data.container);
             // Check if container already exists (e.g., from optimistic update or duplicate event)
             setContainers(prev => {
                 if (prev.some(c => c.id === data.container.id)) {
                      console.warn(`BoardViewPage (${boardId}): Received containerAdded for existing container ${data.container.id}. Ignoring.`);
                     return prev; // Return previous state if container already exists
                 }
                 return [...prev, data.container]; // Add new container
             });
         }
     };

     const handleContainerUpdated = (data: { boardId: string; containerId: string; updates: Partial<ContainerType> }) => {
          if (data.boardId === boardId) {
              console.log(`BoardViewPage (${boardId}): Received containerUpdated event for ${data.containerId}:`, data.updates);
              setContainers(prev =>
                  prev.map(container =>
                      container.id === data.containerId
                          ? { ...container, ...data.updates } // Merge updates
                          : container
                  )
              );
          }
     };

     const handleContainerDeleted = (data: { boardId: string; containerId: string }) => {
          if (data.boardId === boardId) {
              console.log(`BoardViewPage (${boardId}): Received containerDeleted event for ${data.containerId}`);
              setContainers(prev => prev.filter(container => container.id !== data.containerId));
          }
     };


    socket.on('cursorMoved', handleCursorMoved);
    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('userDrawingStatus', handleUserDrawingStatus);
    // Attach container listeners
    socket.on('containerAdded', handleContainerAdded);
    socket.on('containerUpdated', handleContainerUpdated);
    socket.on('containerDeleted', handleContainerDeleted);


    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
      socket.off('cursorMoved', handleCursorMoved);
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('userDrawingStatus', handleUserDrawingStatus);
      // Clean up container listeners
      socket.off('containerAdded', handleContainerAdded);
      socket.off('containerUpdated', handleContainerUpdated);
      socket.off('containerDeleted', handleContainerDeleted);
    };
  }, [socket, isConnected, hasAccess, boardId, user, containers]); // Added 'containers' for handleContainerAdded check

    // Listen for clearBoardDrawing event from socket (DrawingCanvas also listens)
    // This effect runs for both sample and real boards
    useEffect(() => {
      if (!socket || !isConnected || !boardId) return; // User not needed for this generic event
      const handleClear = (data: { boardId: string }) => {
        if (data.boardId !== boardId) return;
         console.log(`BoardViewPage (${boardId}): Received clearBoardDrawing event.`);
         // This event implies clearing both drawing and potentially containers?
         // Based on the README, it seems specific to drawing. DrawingCanvas handles its state.
         // If we add clearing containers, handle it here: setContainers([]);
      };
      socket.on('clearBoardDrawing', handleClear);
      return () => {
        socket.off('clearBoardDrawing', handleClear);
      };
    }, [socket, isConnected, boardId]); // Added boardId to dependencies


  // Loading state for initial fetch
  if (authLoading || boardLoading) {
    return (
      <div className="boardview-root-bg">
        <div className="boardview-header-card">
          <div className="boardview-header-left">
            <h2 className="boardview-title">Loading...</h2>
            <p className="boardview-description">Fetching board data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (applies if boardError is set during fetch)
  if (boardError) {
    return (
      <div className="boardview-root-bg">
        <div className="boardview-header-card">
          <div className="boardview-header-left">
            <h2 className="boardview-title">Error Loading Board</h2>
            <p className="boardview-description">{boardError}</p>
             {/* TODO: Potentially render JoinPrivateBoardForm here if the error is "Access Denied" */}
             {/* You would need to check if the board data (if available) is private */}
             {/* For now, the error message itself should guide the user. */}
          </div>
        </div>
      </div>
    );
  }

  // No access state (should only be reached if board fetch succeeded but hasAccess is false,
  // which is less likely with current backend that returns 403/404, but kept for robustness)
   if (!hasAccess) {
       console.warn(`BoardViewPage (${boardId}): hasAccess is false, but no boardError. This state might indicate a logic flaw or is for future use (e.g., public board with private content).`);
       // This case is less likely with the backend returning 403/404 handled by boardError.
       // However, if your backend design changes or for future features (e.g., password protected content),
       // this block might be needed. For now, redirecting to Dashboard might be better UX.
       // return <Navigate to="/dashboard" replace />; // Example: Redirect if somehow here without error/access
       return (
           <div className="boardview-root-bg">
                <div className="boardview-header-card">
                    <div className="boardview-header-left">
                         <h2 className="boardview-title">Access Denied</h2>
                         <p className="boardview-description">You do not have permission to view this board.</p>
                         {/* TODO: Maybe render the JoinPrivateBoardForm here if appropriate */}
                         {/* For example, if board && board.visibility === 'private' and user is NOT a member */}
                    </div>
                </div>
           </div>
       );
  }


  // Main board view (rendered if hasAccess is true and no boardError)
  return (
    <div className={`boardview-root-bg ${boardId === SAMPLE_BOARD_ID ? 'sample-board-bg' : ''}`}>
      <div className="boardview-header-card">
        <div className="boardview-header-left">
          <h2 className="boardview-title">
            {board?.name}
            {/* Indicator for sample board */}
            {boardId === SAMPLE_BOARD_ID && (
                 <span style={{ marginLeft: '10px', fontSize: '1.1rem', color: '#605e6c', fontWeight: 'normal' }}> (Sample)</span>
            )}
          </h2>
          {board?.description && (
            <p className="boardview-description">{board.description}</p>
          )}
           {/* Display owner name for real boards (or sample user for sample) */}
          <div style={{ marginTop: 8, fontSize: 14, color: '#555' }}>
            <b>Owner:</b> {ownerName || board?.ownerId || 'Loading...'}
          </div>
           {/* Display online users count and list for both types of boards */}
          <div style={{ marginTop: 4, fontSize: 13, color: '#2563eb' }}>
            <b>Online:</b> {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {onlineUsers.map(u => (
                <li key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Display user's own name as "You" or similar if desired */}
                   {user && u.userId === user.uid ? <span style={{ fontWeight: 'bold' }}>You</span> : <span>{u.displayName || u.userId}</span>} {/* Other users by display name, fallback to UID */}

                  {drawingUsers[u.userId] && <span style={{ color: '#10b981', fontSize: 16 }} title={`${u.displayName || u.userId} is drawing`}>✏️</span>}
                  {board && u.userId === board.ownerId && <span style={{ color: '#f59e42', fontSize: 14 }} title="Owner">★</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="boardview-header-actions">
          {/* Settings Button - Only shown for real boards (not sample) AND if current user is owner */}
          {boardId !== SAMPLE_BOARD_ID && board && user && board.ownerId === user.uid && (
            <button
              className="boardview-settings-btn"
              onClick={() => setShowSettingsModal(true)}
              title="Board Settings"
            >
              <span role="img" aria-label="settings">⚙️</span>
            </button>
          )}
        </div>
      </div>

      {/* Board Settings Modal - Only show/open for real boards and if current user is owner */}
      {showSettingsModal && board && boardId !== SAMPLE_BOARD_ID && user && board.ownerId === user.uid && (
        <BoardSettingsModal
          boardId={board.id}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Canvas Area - Set width/height based on requirements */}
      <div
        ref={canvasRef}
        className={`boardview-canvas-area ${isDrawingMode ? 'drawing-mode' : ''}`}
        // Mouse events for drawing/panning are handled by the DrawingCanvas component itself
      >
         {/* Drawing Canvas - shown when in drawing mode */}
        {/* Render DrawingCanvas only if boardId exists, user exists (for emitting events), and isDrawingMode is true */}
        {isDrawingMode && boardId && user && (
          <DrawingCanvas
            boardId={boardId}
            width={1200} // Fixed width for now, could make dynamic
            height={600} // Fixed height for now, could make dynamic
            className="drawing-canvas"
          />
        )}

        {/* Cursor indicators */}
        {/* Render cursors if user is logged in (needed for UID) and hasAccess */}
        {user && hasAccess && Object.entries(otherCursors).map(([userId, position]) => {
           // Don't render cursor for the current user (it's local)
           if (userId === user.uid) return null;

          // Find the user's display name from the onlineUsers list
          const userObj = onlineUsers.find(u => u.userId === userId);
          // Only show cursors for users who are currently marked as online
          if (!userObj) return null;

           // Calculate cursor position relative to the canvas area offset/scroll if any
           // Assuming canvas area is positioned absolutely or relatively with no margin/padding impacting offset
          return (
            <div key={userId} style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                zIndex: 1000, // Above containers/drawing
                pointerEvents: 'none' // Make it non-interactive
                }}>
              {/* Cursor label */}
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 2px)', // Position above the cursor dot
                left: '50%', // Center above the dot
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.95)',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: 12, // Slightly smaller font for label
                padding: '1px 6px', // Smaller padding
                borderRadius: 4, // Smaller radius
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                border: '1px solid #e5e7eb',
                minWidth: '30px', /* Ensure label has some width */
                textAlign: 'center',
                zIndex: 1 /* Below the cursor dot visually if overlapping */
              }}>
                {userObj?.displayName || 'Guest'}
              </div>
              {/* Cursor dot */}
              <div
                className="other-user-cursor"
                style={{
                  width: '10px', // Cursor dot size
                  height: '10px',
                  backgroundColor: drawingUsers[userId] ? '#10b981' : '#ff6b6b', // Change color if user is drawing
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  transform: 'translate(-50%, -50%)', // Center dot on the exact x,y
                   zIndex: 2 /* Above the label visually */
                }}
              />
            </div>
          );
        })}


        {/* Containers - shown when not in drawing mode */}
        {/* Render containers only if boardId exists and isDrawingMode is false */}
        {boardId && !isDrawingMode && containers.map(container => (
          <Container
            key={container.id}
            container={container}
            onPositionChange={handleContainerPositionChange} // Will trigger debounced API call for real boards
            onSizeChange={handleContainerSizeChange}     // Will trigger debounced API call for real boards
            onDelete={handleContainerDelete}           // Will trigger API call for real boards
            canvasBounds={{ width: 1200, height: 600 }} // Pass bounds if needed for dragging constraints
          />
        ))}

        {/* Create Container Form Modal */}
        {/* Show modal only if requested and boardId exists */}
        {showCreateForm && boardId && (
          <div className="create-container-modal">
            <div className="create-container-modal-content">
              <h3>Create New Container</h3>
              {/* Pass loading and error states down to the form */}
              <CreateContainerForm
                boardId={boardId} // Pass the current boardId
                onCreateSuccess={(formData) => { // Pass form data to handler
                    handleCreateContainer(formData);
                }}
                onCancel={() => {
                    setShowCreateForm(false);
                    setCreateContainerError(null); // Clear error when closing
                }}
                loading={isCreatingContainer} // Pass loading state for API call
                error={createContainerError}  // Pass error state from API call
              />
            </div>
          </div>
        )}

        {/* Mode Toggle Button */}
        {/* Show mode toggle only if board and user exist */}
        {board && user && (
          <button
            className="mode-toggle-btn"
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              padding: '8px 16px',
              borderRadius: '20px',
              backgroundColor: isDrawingMode ? '#10b981' : '#2563eb',
              color: 'white',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={isDrawingMode ? "Switch to Container Mode" : "Switch to Drawing Mode"}
          >
            <span role="img" aria-label={isDrawingMode ? "container" : "drawing"}>
              {isDrawingMode ? "📦" : "✏️"}
            </span>
            {isDrawingMode ? "Containers" : "Draw"}
          </button>
        )}


        {/* Add Container Button - only shown in container mode and if boardId/user exist */}
        {/* Disable button while creating container */}
        {!isDrawingMode && boardId && user && (
          <button
            className="add-container-btn"
            onClick={() => setShowCreateForm(true)}
            disabled={isCreatingContainer} // Disable while creating
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              fontSize: '24px',
              cursor: isCreatingContainer ? 'not-allowed' : 'pointer', // Change cursor
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
               // Add disabled styles if needed
            }}
            title="Add Container"
          >
            {isCreatingContainer ? '...' : '+'} {/* Show loading indicator in button */}
          </button>
        )}
      </div>
    </div>
  );
}

export default BoardViewPage;