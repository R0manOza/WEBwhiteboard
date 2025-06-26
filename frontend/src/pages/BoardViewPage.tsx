// frontend/src/pages/BoardViewPage.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../contexts/AuthContext";
import throttle from "lodash.throttle";
import type { Board, Container as ContainerType, ContainerPurpose } from "../../../shared/types";
import BoardSettingsModal from "../components/Board/BoardSettingsModal";
import Container from "../components/Board/Container";
import CreateContainerForm from "../components/Board/CreateContainerForm";
import DrawingCanvas from "../components/Board/DrawingCanvas";
import "./BoardViewPage.css";

// Define a type for cursor data received from others
interface CursorPosition {
  boardId: string;
  userId: string;
  x: number;
  y: number;
}

// Define a unique ID for the sample board for offline/demo mode
const SAMPLE_BOARD_ID = "sample-solo-board";

// Define static data for the sample board
const sampleBoardData: Board = {
  id: SAMPLE_BOARD_ID,
  name: "Sample Solo Board", // Use 'name' for board objects
  description: "A static board to explore features without backend data.",
  visibility: "public",
  ownerId: "sample-user-id",
  members: { "sample-user-id": "owner" },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Define static data for initial containers on the sample board
// Standardized on 'title' and 'type' for consistency
const sampleContainersData: ContainerType[] = [
  {
    id: "sample-container-1",
    boardId: SAMPLE_BOARD_ID,
    title: "Welcome!", // Standardized to 'title'
    type: "notes",   // Standardized to 'type'
    
    position: { x: 50, y: 50 },
    size: { width: 300, height: 200 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "sample-container-2",
    boardId: SAMPLE_BOARD_ID,
    title: "Example Links", // Standardized to 'title'
    type: "links",      // Standardized to 'type'
    
    position: { x: 400, y: 100 },
    size: { width: 350, height: 300 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];


function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket(boardId || "");
  const navigate = useNavigate();

  // Component States
  const [board, setBoard] = useState<Board | null>(null);
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [hasAccess, setHasAccess] = useState(false);

  // Loading and Error States
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [containersLoading, setContainersLoading] = useState(false);
  const [containersError, setContainersError] = useState<string | null>(null);
  const [createContainerLoading, setCreateContainerLoading] = useState(false);
  const [createContainerError, setCreateContainerError] = useState<string | null>(null);

  // UI States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateContainerForm, setShowCreateContainerForm] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Real-time Collaboration States
  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [drawingUsers, setDrawingUsers] = useState<{ [userId: string]: boolean }>({});
  const [otherCursors, setOtherCursors] = useState<{ [userId: string]: { x: number; y: number } }>({});
  const [ownerName, setOwnerName] = useState<string>("");

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Data Fetching and Logic ---

  // Fetches containers for a given board. Memoized to keep its identity stable.
  const fetchContainers = useCallback(async (currentBoardId: string, authToken: string) => {
    console.log(`BoardViewPage (${currentBoardId}): Fetching containers...`);
    setContainersLoading(true);
    setContainersError(null);
    try {
      const response = await fetch(`/api/boards/${currentBoardId}/containers`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to fetch containers.' }));
        throw new Error(errData.error || `Error: ${response.status}`);
      }
      const fetchedContainers: ContainerType[] = await response.json();
      setContainers(fetchedContainers);
      console.log(`BoardViewPage (${currentBoardId}): Fetched ${fetchedContainers.length} containers successfully.`);
    } catch (err: any) {
      setContainersError(err.message);
      setContainers([]);
    } finally {
      setContainersLoading(false);
    }
  }, []);

  // Main data fetching effect, runs when boardId, user, or authLoading changes.
  useEffect(() => {
    console.log(`BoardViewPage (${boardId}): Main data fetching effect triggered.`);

    if (boardId === SAMPLE_BOARD_ID) {
      console.log(`BoardViewPage (${boardId}): Loading sample board.`);
      setBoard(sampleBoardData);
      setContainers(sampleContainersData);
      setHasAccess(true);
      setBoardLoading(false);
      setContainersLoading(false);
      setBoardError(null);
      setOwnerName("Sample User");
      return;
    }

    if (authLoading) {
      console.log(`BoardViewPage (${boardId}): Auth is loading, waiting...`);
      setBoardLoading(true);
      return;
    }

    if (!user) {
      console.log(`BoardViewPage (${boardId}): No authenticated user.`);
      setBoardLoading(false);
      setHasAccess(false);
      setBoard(null);
      setContainers([]);
      setBoardError("You must be logged in to view this board.");
      return;
    }

    const fetchBoardAndDependentData = async () => {
      console.log(`BoardViewPage (${boardId}): Starting backend data fetch for user ${user.uid}`);
      setBoardLoading(true);
      setBoardError(null);
      setHasAccess(false);
      setContainers([]);

      try {
        const token = await user.getIdToken();
        const boardResponse = await fetch(`/api/boards/${boardId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!boardResponse.ok) {
          const errData = await boardResponse.json().catch(() => ({ error: 'Board not found or access denied.' }));
          throw new Error(errData.error || `Error fetching board: ${boardResponse.status}`);
        }

        const boardData: Board = await boardResponse.json();
        setBoard(boardData);

        const isMember = boardData.members && boardData.members[user.uid] !== undefined;
        const isPublic = boardData.visibility === "public";
        const currentUserHasAccess = isPublic || isMember;
        setHasAccess(currentUserHasAccess);

        if (currentUserHasAccess) {
          // Fetch containers now that we have board access
          fetchContainers(boardId!, token);

          // Fetch owner's display name
          if (boardData.ownerId === user.uid) {
            setOwnerName(user.displayName || "Me");
          } else {
            fetch(`/api/auth/userInfo?uid=${boardData.ownerId}`, { headers: { 'Authorization': `Bearer ${token}` }})
              .then(res => res.ok ? res.json() : Promise.resolve({ displayName: boardData.ownerId }))
              .then(userInfo => setOwnerName(userInfo.displayName || boardData.ownerId))
              .catch(() => setOwnerName(boardData.ownerId));
          }
        } else {
          setBoardError('Access Denied: You do not have permission to view this board.');
        }
      } catch (err: any) {
        setBoardError(err.message);
        setBoard(null);
        setHasAccess(false);
      } finally {
        setBoardLoading(false);
      }
    };

    fetchBoardAndDependentData();
  }, [boardId, user, authLoading, fetchContainers]);

  // Handler for creating a container via the form. Passed as a prop.
  const handleCreateContainer = useCallback(async (formData: { title: string; purpose: ContainerPurpose }) => {
    if (!user || !boardId || boardId === SAMPLE_BOARD_ID) return;

    setCreateContainerLoading(true);
    setCreateContainerError(null);
    try {
      const token = await user.getIdToken();
      const containerDataForBackend = {
        title: formData.title,
        type: formData.purpose,
        position: { x: Math.floor(Math.random() * 400) + 50, y: Math.floor(Math.random() * 200) + 50 },
        size: { width: 300, height: formData.purpose === 'links' ? 300 : 200 }
      };
      
      const response = await fetch(`/api/boards/${boardId}/containers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(containerDataForBackend),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || `Failed to create container`);
      }
      
      // We don't need to manually add the container to state here.
      // The backend will emit a 'containerCreated' socket event that the socket listener will handle.
      setShowCreateContainerForm(false);
    } catch (err: any) {
      setCreateContainerError(err.message || 'Failed to create container');
    } finally {
      setCreateContainerLoading(false);
    }
  }, [user, boardId]);

  // TODO: Create memoized handlers for updating and deleting containers that call the backend APIs
  const handleContainerPositionChange = (
  containerId: string,
  newPosition: { x: number; y: number }
) => {
  setContainers((prev) =>
    prev.map((container) =>
      container.id === containerId
        ? { ...container, position: newPosition, updatedAt: Date.now() }
        : container
    )
  );
  // TODO: Add API call to persist this change
};
  const handleContainerSizeChange = (
  containerId: string,
  newSize: { width: number; height: number }
) => {
  setContainers((prev) =>
    prev.map((container) =>
      container.id === containerId
        ? { ...container, size: newSize, updatedAt: Date.now() }
        : container
    )
  );
  // TODO: Add API call to persist this change
};
  const handleContainerDelete = (containerId: string) => {
  if (window.confirm("Are you sure you want to delete this container?")) {
    setContainers((prev) =>
      prev.filter((container) => container.id !== containerId)
    );
    // TODO: Add API call to persist this change
  }
};

  // Effect for Socket Listeners
  useEffect(() => {
    // Exit if socket isn't ready or user doesn't have access
    if (!socket || !isConnected || !hasAccess || !boardId || !user) {
      // Clear any stale real-time data if dependencies change and we can't listen
      setOnlineUsers([]);
      setDrawingUsers({});
      setOtherCursors({});
      return;
    }

    console.log(`BoardViewPage (${boardId}): Setting up all socket listeners.`);

    // Handler for when a container is created by any user
    const onContainerCreated = (newContainer: ContainerType) => {
      console.log(`[Socket IN board:${boardId}] containerCreated received:`, newContainer);
      if (newContainer.boardId === boardId) {
        setContainers(prev => {
          if (prev.find(c => c.id === newContainer.id)) return prev;
          return [...prev, newContainer].sort((a,b) => a.createdAt - b.createdAt);
        });
      }
    };

    // Handler for the list of all online users in the room
    const handleOnlineUsers = (data: { boardId: string; users: { userId: string; displayName: string }[] }) => {
      if (data.boardId === boardId) setOnlineUsers(data.users);
    };

    // Handler for another user's drawing status (pen icon)
    const handleUserDrawingStatus = (data: { boardId: string; userId: string; isDrawing: boolean }) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        setDrawingUsers(prev => ({ ...prev, [data.userId]: data.isDrawing }));
      }
    };

    // Handler for another user's cursor position
    const handleCursorMoved = (data: CursorPosition) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        setOtherCursors(prev => ({ ...prev, [data.userId]: { x: data.x, y: data.y } }));
      }
    };

    // --- Register all the listeners ---
    socket.on('containerCreated', onContainerCreated);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("userDrawingStatus", handleUserDrawingStatus);
    socket.on("cursorMoved", handleCursorMoved); // <<< ADDED THIS BACK

    // Cleanup function to remove listeners when component unmounts or dependencies change
    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up all socket listeners.`);
      socket.off('containerCreated', onContainerCreated);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("userDrawingStatus", handleUserDrawingStatus);
      socket.off("cursorMoved", handleCursorMoved); // <<< ALSO ADD CLEANUP FOR IT
    };
  }, [socket, isConnected, hasAccess, boardId, user]);

  // Effect for Mouse Move Listener for broadcasting cursor position
  const sendCursorPosition = useCallback(throttle((x, y) => {
    if (socket && isConnected && hasAccess && user) socket.emit('cursorPosition', { boardId, x, y });
  }, 50), [socket, isConnected, hasAccess, user, boardId]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      if (!canvasElement) return;
      const rect = canvasElement.getBoundingClientRect();
      sendCursorPosition(event.clientX - rect.left, event.clientY - rect.top);
    };
    if (canvasElement && hasAccess) canvasElement.addEventListener("mousemove", handleMouseMove);
    return () => {
      if (canvasElement) canvasElement.removeEventListener("mousemove", handleMouseMove);
      sendCursorPosition.cancel();
    };
  }, [hasAccess, sendCursorPosition]);

  // --- Render Logic ---

  if (authLoading || boardLoading) {
    return ( <div className="page board-view-page"><p>Loading Board...</p></div> );
  }

  if (boardError) {
    return ( <div className="page board-view-page"><p style={{color: 'red'}}>Error: {boardError}</p></div> );
  }

  if (!hasAccess) {
    return ( <div className="page board-view-page"><p>Access Denied. You do not have permission to view this board.</p></div> );
  }

  if (!board) {
    return ( <div className="page board-view-page"><p>Board not found.</p></div> );
  }

  return (
    <div className={`boardview-root-bg ${boardId === SAMPLE_BOARD_ID ? "sample-board-bg" : ""}`}>
      <div className="boardview-header-card">
        <div className="boardview-header-left">
          <h2 className="boardview-title">
            {board.name}
            {boardId === SAMPLE_BOARD_ID && <span className="sample-indicator">(Sample)</span>}
          </h2>
          {board.description && (<p className="boardview-description">{board.description}</p>)}
          <div className="board-meta"><b>Owner:</b> {ownerName || board.ownerId}</div>
          <div className="online-users-meta">
            <b>Online:</b> {onlineUsers.length} {onlineUsers.length === 1 ? "user" : "users"}
            <ul className="online-users-list">
              {onlineUsers.map((u) => (
                <li key={u.userId} className="online-user-item">
                  <span>{u.displayName}</span>
                  {drawingUsers[u.userId] && <span className="drawing-indicator" title="Drawing">✏️</span>}
                  {u.userId === board.ownerId && <span className="owner-indicator" title="Owner">★</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="boardview-header-actions">
          {boardId !== SAMPLE_BOARD_ID && (
            <button className="boardview-settings-btn" onClick={() => setShowSettingsModal(true)} title="Board Settings">⚙️</button>
          )}
          {board && user && (
            <button className="mode-toggle-btn" onClick={() => setIsDrawingMode(!isDrawingMode)} title={isDrawingMode ? "Switch to Container Mode" : "Switch to Drawing Mode"}>
              <span role="img" aria-label={isDrawingMode ? "container" : "drawing"}>{isDrawingMode ? "📦" : "✏️"}</span>
              {isDrawingMode ? "Containers" : "Draw"}
            </button>
          )}
        </div>
      </div>

      {showSettingsModal && (
        <BoardSettingsModal boardId={board.id} isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      )}

      <div ref={canvasRef} className={`boardview-canvas-area ${isDrawingMode ? 'drawing-mode' : ''}`}>
        {isDrawingMode && user && (
          <DrawingCanvas boardId={boardId || ""} width={1200} height={600} className="drawing-canvas" />
        )}
        
        {Object.entries(otherCursors).map(([userId, position]) => {
          // Find the user object to get their display name.
          const userObj = onlineUsers.find((u) => u.userId === userId);
          
          // Render the cursor regardless of whether the user name is available yet.
          // This fixes the race condition.
          return (
            <div
              key={userId}
              className="other-user-cursor-wrapper"
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex: 1001, // Ensure cursors are on top
                pointerEvents: "none",
              }}
            >
              <div className="cursor-name-label">
                {/* Fallback to showing a snippet of the userId if the full user object isn't in state yet */}
                {userObj ? userObj.displayName : userId.substring(0, 6) + '...'}
              </div>
              <div className="other-user-cursor"></div>
            </div>
          );
        })}

        {!isDrawingMode && (
          <>
            {containersLoading && <p className="status-message">Loading containers...</p>}
            {containersError && <p className="status-message error">{containersError}</p>}
            {!containersLoading && containers.map((container) => (
              <Container
                key={container.id}
                container={container}
                onPositionChange={handleContainerPositionChange}
                onSizeChange={handleContainerSizeChange}
                onDelete={handleContainerDelete}
                canvasBounds={{ width: 1200, height: 600 }}
              />
            ))}
          </>
        )}

        {showCreateContainerForm && (
          <div className="create-container-modal">
            <div className="create-container-modal-content">
              <h3>Create New Container</h3>
              <CreateContainerForm
                boardId={boardId || SAMPLE_BOARD_ID}
                onCreateSuccess={handleCreateContainer}
                onCancel={() => setShowCreateContainerForm(false)}
                loading={createContainerLoading}
                error={createContainerError}
              />
            </div>
          </div>
        )}

        {!isDrawingMode && hasAccess && (
          <button className="add-container-btn" onClick={() => setShowCreateContainerForm(true)} title="Add Container">+</button>
        )}
      </div>
    </div>
  );
}

export default BoardViewPage;