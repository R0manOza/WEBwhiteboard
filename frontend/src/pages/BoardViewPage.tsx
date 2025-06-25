import //React, 
{ useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../contexts/AuthContext";
import throttle from "lodash.throttle";
import type { Board, Container as ContainerType } from "../../../shared/types";
import BoardSettingsModal from "../components/Board/BoardSettingsModal";
import Container from "../components/Board/Container";
import CreateContainerForm from "../components/Board/CreateContainerForm";
import DrawingCanvas from "../components/Board/DrawingCanvas";
import "./BoardViewPage.css";

// Define a unique ID for the sample board
const SAMPLE_BOARD_ID = "sample-solo-board";

// Define static data for the sample board
const sampleBoardData: Board = {
  id: SAMPLE_BOARD_ID,
  name: "Sample Solo Board",
  description: "A static board to explore features without backend data.",
  visibility: "public", // Doesn't affect solo mode
  ownerId: "sample-user-id", // Placeholder owner ID
  members: { "sample-user-id": "owner" }, // Placeholder member
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Define static data for initial containers on the sample board
const sampleContainersData: ContainerType[] = [
  {
    id: "sample-container-1",
    boardId: SAMPLE_BOARD_ID,
    title: "Welcome!",
    purpose: "notes",
    position: { x: 50, y: 50 },
    size: { width: 300, height: 200 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "sample-container-2",
    boardId: SAMPLE_BOARD_ID,
    title: "Example Links",
    purpose: "links",
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
  const { user, loading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket(boardId || ""); // Pass boardId to socket hook

  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [otherCursors, setOtherCursors] = useState<{
    [userId: string]: { x: number; y: number };
  }>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(false); // Controls rendering of board content vs join form

  // Container state
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const [onlineUsers, setOnlineUsers] = useState<
    { userId: string; displayName: string }[]
  >([]);
  const [drawingUsers, setDrawingUsers] = useState<{
    [userId: string]: boolean;
  }>({});
  const [ownerName, setOwnerName] = useState<string>(""); // Display name of the board owner

  // Throttled Cursor Position Sender
  const sendCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      if (socket && isConnected && boardId && user && hasAccess) {
        // Ensure user and access
        socket.emit("cursorPosition", { boardId, x, y });
      }
    }, 50),
    [socket, isConnected, boardId, user, hasAccess] // Dependencies for useCallback
  );

  // Container handlers
  const handleCreateContainer = (newContainer: ContainerType) => {
    // Note: For the sample board, this only updates local state.
    // When backend is implemented for containers, this will also trigger an API call
    // and the state update will likely happen via a WebSocket event listener.
    console.log("Attempting to create container:", newContainer);
    // Ensure the new container has a unique ID if the source doesn't provide one (like the mock form)
    if (!newContainer.id) {
      newContainer.id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    setContainers((prev) => [...prev, newContainer]);
    setShowCreateForm(false);
    console.log("Container created (locally):", newContainer.id);
  };

  const handleContainerPositionChange = (
    containerId: string,
    newPosition: { x: number; y: number }
  ) => {
    // Note: For the sample board, this only updates local state.
    // When backend is implemented, this will trigger an API call
    // and the state update might happen via a WebSocket event listener
    // or optimistic update followed by reconciliation.
    setContainers((prev) =>
      prev.map((container) =>
        container.id === containerId
          ? { ...container, position: newPosition, updatedAt: Date.now() }
          : container
      )
    );
    // TODO: Add backend API call here for non-sample boards
  };

  const handleContainerSizeChange = (
    containerId: string,
    newSize: { width: number; height: number }
  ) => {
    // Note: For the sample board, this only updates local state.
    // When backend is implemented, this will trigger an API call.
    setContainers((prev) =>
      prev.map((container) =>
        container.id === containerId
          ? { ...container, size: newSize, updatedAt: Date.now() }
          : container
      )
    );
    // TODO: Add backend API call here for non-sample boards
  };

  const handleContainerDelete = (containerId: string) => {
    // Note: For the sample board, this only updates local state.
    // When backend is implemented, this will trigger an API call.
    setContainers((prev) =>
      prev.filter((container) => container.id !== containerId)
    );
    // TODO: Add backend API call here for non-sample boards
  };

  // Effect to fetch Board Data (or load sample data)
  useEffect(() => {
    console.log(`BoardViewPage (${boardId}): Running data fetch effect.`);

    // --- START: Sample Board Logic ---
    if (boardId === SAMPLE_BOARD_ID) {
      console.log(`BoardViewPage (${boardId}): Loading sample board.`);
      setBoardLoading(false); // Loading finishes immediately
      setHasAccess(true); // Access is granted automatically
      setBoard(sampleBoardData); // Set static board data
      setContainers(sampleContainersData); // Set static container data
      setBoardError(null); // Clear any previous error
      // For sample board, the "owner" is just a placeholder
      setOwnerName("Sample User");
      // For sample board, we don't need to wait for auth to load or fetch user info
      return; // Crucially, stop the effect here if it's the sample board
    }
    // --- END: Sample Board Logic ---

    // If not sample board, proceed with authentication and backend fetch checks
    if (!boardId || !user) {
      console.log(
        `BoardViewPage (${boardId}): Skipping backend fetch. Missing boardId or user.`
      );
      setBoardLoading(false);
      setHasAccess(false);
      setBoard(null);
      setBoardError(null);
      // Do NOT return here yet, let the authLoading check run if needed
    }

    // Wait for authentication state to be determined for real boards
    if (authLoading) {
      console.log(
        `BoardViewPage (${boardId}): Waiting for auth to load for backend fetch.`
      );
      setBoardLoading(true);
      return; // Wait for auth state before fetching
    }

    // If we are here, it's a real board and auth is loaded (user is either null or exists)
    // If user is null, the previous check should have set hasAccess to false and loading to false.
    // If user exists, proceed with fetch:
    if (!user) {
      console.log(
        `BoardViewPage (${boardId}): Auth loaded, but no user. Cannot fetch real board.`
      );
      setBoardLoading(false);
      setHasAccess(false); // Ensure access is false if user is null after auth loads
      return; // Stop if user is null
    }

    const fetchBoardData = async () => {
      console.log(
        `BoardViewPage (${boardId}): Starting backend data fetch for authenticated user ${user.uid}`
      );
      setBoardLoading(true); // Still loading for backend fetch
      setBoardError(null);
      setHasAccess(false); // Assume no access until verified

      try {
        const token = await user.getIdToken();

        // --- Fetch Board Data ---
        console.log(
          `BoardViewPage (${boardId}): Fetching board details from /api/boards/${boardId}`
        );
        const boardResponse = await fetch(`/api/boards/${boardId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!boardResponse.ok) {
          const errData = await boardResponse
            .json()
            .catch(() => ({ message: "Failed to fetch board data." }));
          throw new Error(
            errData.message ||
              `Error fetching board: ${boardResponse.status} ${boardResponse.statusText}`
          );
        }

        const boardData: Board = await boardResponse.json();
        setBoard(boardData);
        console.log(
          `BoardViewPage (${boardId}): Fetched board data successfully.`,
          boardData
        );

        // --- TODO: Add Fetch Containers for real boards ---
        // This part is pending backend implementation. When implemented,
        // this is where you'll fetch containers for the board.
        // Example (replace with actual fetch):
        // const containersResponse = await fetch(`/api/boards/${boardId}/containers`, {
        //     headers: { 'Authorization': `Bearer ${token}` }
        // });
        // if (containersResponse.ok) {
        //    const containersData = await containersResponse.json();
        //    setContainers(containersData); // Set real containers
        //    console.log(`BoardViewPage (${boardId}): Fetched ${containersData.length} containers.`);
        // } else {
        //    console.warn("Failed to fetch containers for board:", boardId, containersResponse.status);
        //    setContainers([]); // Set empty array if fetch fails
        // }
        // --- END TODO ---

        // Access Check for real boards
        const userUid = user.uid;
        const isMember =
          boardData.members && boardData.members[userUid] !== undefined;
        const isPublic = boardData.visibility === "public";
        const userHasAccess = isPublic || isMember;
        setHasAccess(userHasAccess);
        console.log(
          `BoardViewPage (${boardId}): User ${userUid} has access: ${userHasAccess}`
        );

        // Fetch owner name for display for real boards
        if (boardData.ownerId && boardData.ownerId !== userUid) {
          // Avoid fetching own user info
          const userInfoRes = await fetch(
            `/api/auth/userInfo?uid=${boardData.ownerId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (userInfoRes.ok) {
            const userInfoData = await userInfoRes.json();
            setOwnerName(userInfoData.displayName || boardData.ownerId);
          } else {
            setOwnerName(boardData.ownerId); // Fallback to UID
          }
        } else {
          setOwnerName(
            user.displayName || user.email || boardData.ownerId || "Me"
          ); // Handle owning user or missing data
        }
      } catch (err: any) {
        console.error(
          `BoardViewPage (${boardId}): Error during backend data fetch process:`,
          err
        );
        setBoardError(err.message || "Failed to load board.");
        setBoard(null);
        setHasAccess(false); // Ensure access is false on error
        setContainers([]); // Clear containers on error
        setOwnerName("");
      } finally {
        setBoardLoading(false);
        console.log(
          `BoardViewPage (${boardId}): Backend data fetch process finished. Loading: ${false}.`
        );
      }
    };

    // Only fetch data if it's not the sample board AND auth is loaded AND user exists
    if (boardId !== SAMPLE_BOARD_ID && user) {
      fetchBoardData(); // Call the backend fetch function
    }

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up data fetch effect.`);
    };
  }, [boardId, user, authLoading]); // Re-run effect if these dependencies change

  // Effect for Mouse Move Listener (for cursor position)
  // This effect runs for both sample and real boards if hasAccess is true
  useEffect(() => {
    const canvasElement = canvasRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      if (!canvasElement) return;
      const rect = canvasElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      sendCursorPosition(x, y);
    };

    if (canvasElement && hasAccess) {
      console.log(
        `BoardViewPage (${boardId}): Attaching mousemove listener for cursor.`
      );
      canvasElement.addEventListener("mousemove", handleMouseMove);
    } else {
      console.log(
        `BoardViewPage (${boardId}): Skipping mousemove listener attachment (no canvas, no access, or sample board without explicit user).`
      );
      // Note: For the sample board without real auth, user might be null initially, preventing listener.
      // This is acceptable for a simple solo demo mode.
    }

    return () => {
      if (canvasElement) {
        console.log(`BoardViewPage (${boardId}): Removing mousemove listener.`);
        canvasElement.removeEventListener("mousemove", handleMouseMove);
        sendCursorPosition.cancel(); // Cancel any pending throttled calls
      }
    };
  }, [canvasRef.current, sendCursorPosition, hasAccess, boardId]); // Added boardId to dependencies

  // Effect for Socket Listeners (cursor movements, user presence, drawing sync, etc.)
  // This effect runs for both sample and real boards if socket is connected and hasAccess is true
  useEffect(() => {
    // Only set up listeners if socket is connected, hasAccess is true, boardId is valid, and user exists
    // (user is needed to exclude self from other users' events)
    if (!socket || !isConnected || !hasAccess || !boardId || !user) {
      console.log(
        `BoardViewPage (${boardId}): Skipping socket listener setup (socket/access/boardId/user missing).`
      );
      return;
    }

    console.log(`BoardViewPage (${boardId}): Setting up socket listeners.`);

    const handleCursorMoved = (data: CursorPosition) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        // Only update for other users on this board
        setOtherCursors((prev) => ({
          ...prev,
          [data.userId]: { x: data.x, y: data.y },
        }));
      }
    };

    // The 'userJoined' and 'userLeft' events might be handled by the 'onlineUsers' event instead
    // based on the socketHandler.ts implementation. Let's primarily rely on 'onlineUsers'.
    // const handleUserJoined = (data: { boardId: string; userId: string }) => {
    //   if (data.boardId === boardId) {
    //     console.log(`BoardViewPage (${boardId}): User ${data.userId} joined the board.`);
    //   }
    // };

    // const handleUserLeft = (data: { boardId: string; userId: string }) => {
    //   if (data.boardId === boardId) {
    //     console.log(`BoardViewPage (${boardId}): User ${data.userId} left the board.`);
    //     // Remove cursor and drawing status for the leaving user
    //     setOtherCursors(prev => {
    //       const newCursors = { ...prev };
    //       delete newCursors[data.userId];
    //       return newCursors;
    //     });
    //      setDrawingUsers(prev => {
    //       const newDrawing = { ...prev };
    //       delete newDrawing[data.userId];
    //       return newDrawing;
    //     });
    //   }
    // };

    const handleOnlineUsers = (data: {
      boardId: string;
      users: { userId: string; displayName: string }[];
    }) => {
      if (data.boardId === boardId) {
        console.log(
          `BoardViewPage (${boardId}): Received online users update:`,
          data.users
        );
        setOnlineUsers(data.users);
        // Clean up cursors/drawing status for users no longer online
        setOtherCursors((prevCursors) => {
          const onlineUserIds = new Set(data.users.map((u) => u.userId));
          const updatedCursors = { ...prevCursors };
          for (const userId in updatedCursors) {
            if (!onlineUserIds.has(userId) && userId !== user.uid) {
              delete updatedCursors[userId];
            }
          }
          return updatedCursors;
        });
        setDrawingUsers((prevDrawing) => {
          const onlineUserIds = new Set(data.users.map((u) => u.userId));
          const updatedDrawing = { ...prevDrawing };
          for (const userId in updatedDrawing) {
            if (!onlineUserIds.has(userId) && userId !== user.uid) {
              delete updatedDrawing[userId];
            }
          }
          return updatedDrawing;
        });
      }
    };

    const handleUserDrawingStatus = (data: {
      boardId: string;
      userId: string;
      isDrawing: boolean;
    }) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        console.log(
          `BoardViewPage (${boardId}): User ${data.userId} is ${data.isDrawing ? "drawing" : "not drawing"}`
        );
        setDrawingUsers((prev) => ({ ...prev, [data.userId]: data.isDrawing }));
      }
    };
    // TODO: Add listeners for containerAdded, containerUpdated, containerDeleted events here
    // These listeners should update the 'containers' state immutably based on events from the backend.
    // This is how other users' container changes sync in real-time for non-sample boards.

    socket.on("cursorMoved", handleCursorMoved);
    // socket.on('userJoined', handleUserJoined); // Using onlineUsers instead
    // socket.on('userLeft', handleUserLeft);   // Using onlineUsers instead
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("userDrawingStatus", handleUserDrawingStatus);

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
      socket.off("cursorMoved", handleCursorMoved);
      // socket.off('userJoined', handleUserJoined);
      // socket.off('userLeft', handleUserLeft);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("userDrawingStatus", handleUserDrawingStatus);
      // TODO: Clean up container socket listeners here
    };
  }, [socket, isConnected, hasAccess, boardId, user]); // Added dependencies

  // Listen for clearBoardDrawing event from socket (DrawingCanvas also listens, but good to have here too)
  // This effect runs for both sample and real boards
  useEffect(() => {
    if (!socket || !isConnected || !boardId || !user) return;
    const handleClear = (data: { boardId: string }) => {
      if (data.boardId !== boardId) return;
      console.log(
        `BoardViewPage (${boardId}): Received clearBoardDrawing event.`
      );
      // Note: DrawingCanvas handles clearing its own state.
      // If we later store drawing strokes at the BoardViewPage level, this handler
      // would need to update that state as well. For now, it just logs.
    };
    socket.on("clearBoardDrawing", handleClear);
    return () => {
      socket.off("clearBoardDrawing", handleClear);
    };
  }, [socket, isConnected, boardId, user]);

  // Placeholder for mouse down/up on canvas area to send drawing status (optional, can be handled in DrawingCanvas)
  // const handleMouseDown = () => {
  //   if (socket && isConnected && boardId && user && hasAccess && isDrawingMode) {
  //     socket.emit('userDrawingStatus', { boardId, isDrawing: true });
  //   }
  // };

  // const handleMouseUp = () => {
  //   if (socket && isConnected && boardId && user && hasAccess && isDrawingMode) {
  //     socket.emit('userDrawingStatus', { boardId, isDrawing: false });
  //   }
  // };

  // Loading state
  if (authLoading || boardLoading) {
    return (
      <div className="boardview-root-bg">
        <div className="boardview-header-card">
          <div className="boardview-header-left">
            <h2 className="boardview-title">Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Error state (only applies to real boards)
  if (boardError) {
    return (
      <div className="boardview-root-bg">
        <div className="boardview-header-card">
          <div className="boardview-header-left">
            <h2 className="boardview-title">Error Loading Board</h2>
            <p className="boardview-description">{boardError}</p>
          </div>
        </div>
      </div>
    );
  }

  // No access state (only applies to real private boards)
  // For sample board, hasAccess is set to true immediately
  if (!hasAccess) {
    // This will be true for real private boards where user is not a member
    // TODO: Implement JoinPrivateBoardForm rendering here
    return (
      <div className="boardview-root-bg">
        <div className="boardview-header-card">
          <div className="boardview-header-left">
            <h2 className="boardview-title">Access Denied</h2>
            <p className="boardview-description">
              You don't have access to this board or it does not exist.
            </p>
            {/* TODO: Add JoinPrivateBoardForm here when implemented and needed */}
            {/* <JoinPrivateBoardForm boardId={boardId || ''} onSuccessfulJoin={() => {}} /> */}
          </div>
        </div>
      </div>
    );
  }

  // Main board view (rendered if hasAccess is true)
  return (
    <div
      className={`boardview-root-bg ${boardId === SAMPLE_BOARD_ID ? "sample-board-bg" : ""}`}
    >
      <div className="boardview-header-card">
        <div className="boardview-header-left">
          <h2 className="boardview-title">
            {board?.name}
            {/* Indicator for sample board */}
            {boardId === SAMPLE_BOARD_ID && (
              <span
                style={{
                  marginLeft: "10px",
                  fontSize: "1.1rem",
                  color: "#605e5c",
                  fontWeight: "normal",
                }}
              >
                {" "}
                (Sample)
              </span>
            )}
          </h2>
          {board?.description && (
            <p className="boardview-description">{board.description}</p>
          )}
          {/* Display owner name for real boards (or sample user for sample) */}
          <div style={{ marginTop: 8, fontSize: 14, color: "#555" }}>
            <b>Owner:</b> {ownerName || board?.ownerId || "Loading..."}
          </div>
          {/* Display online users count and list for both types of boards */}
          <div style={{ marginTop: 4, fontSize: 13, color: "#2563eb" }}>
            <b>Online:</b> {onlineUsers.length}{" "}
            {onlineUsers.length === 1 ? "user" : "users"}
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {onlineUsers.map((u) => (
                <li
                  key={u.userId}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <span>{u.displayName}</span>
                  {drawingUsers[u.userId] && (
                    <span
                      style={{ color: "#10b981", fontSize: 16 }}
                      title={`${u.displayName} is drawing`}
                    >
                      ✏️
                    </span>
                  )}
                  {board && u.userId === board.ownerId && (
                    <span
                      style={{ color: "#f59e42", fontSize: 14 }}
                      title="Owner"
                    >
                      ★
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="boardview-header-actions">
          {/* Settings Button - Only shown for real boards */}
          {boardId !== SAMPLE_BOARD_ID && (
            <button
              className="boardview-settings-btn"
              onClick={() => setShowSettingsModal(true)}
              title="Board Settings"
            >
              <span role="img" aria-label="settings">
                ⚙️
              </span>
            </button>
          )}
          {/* You might add other sample-specific actions here later, or general actions */}
        </div>
      </div>

      {/* Board Settings Modal - Only show/open for real boards */}
      {showSettingsModal && board && boardId !== SAMPLE_BOARD_ID && (
        <BoardSettingsModal
          boardId={board.id}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className={`boardview-canvas-area ${isDrawingMode ? "drawing-mode" : ""}`}
        // onMouseDown={handleMouseDown} // Handled by DrawingCanvas
        // onMouseUp={handleMouseUp}   // Handled by DrawingCanvas
      >
        {/* Drawing Canvas - shown when in drawing mode */}
        {isDrawingMode &&
          boardId &&
          user && ( // Ensure boardId and user exist for DrawingCanvas
            <DrawingCanvas
              boardId={boardId}
              width={1200} // Fixed width for now, could make dynamic
              height={600} // Fixed height for now, could make dynamic
              className="drawing-canvas"
            />
          )}

        {/* Cursor indicators */}
        {/* Render cursors regardless of mode if enabled */}
        {Object.entries(otherCursors).map(([userId, position]) => {
          // Find the user's display name from the onlineUsers list
          const userObj = onlineUsers.find((u) => u.userId === userId);
          // Only show cursors for users who are currently marked as drawing? Or always?
          // Let's show them always if we have their online status.
          if (!userObj) return null; // Don't show cursor if user isn't in online list
          // Calculate cursor position relative to the canvas area offset/scroll if any
          // For now, assuming canvas area is top:0, left:0 relative to its container
          return (
            <div
              key={userId}
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex: 1000,
                pointerEvents: "none", // Make it non-interactive
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-22px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(255,255,255,0.95)",
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: 13,
                  padding: "2px 8px",
                  borderRadius: 6,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  border: "1px solid #e5e7eb",
                }}
              >
                {userObj?.displayName || userId}
              </div>
              <div
                className="other-user-cursor"
                style={{
                  width: "10px", // Smaller cursor dot
                  height: "10px",
                  backgroundColor: "#ff6b6b", // Example color
                  borderRadius: "50%",
                  pointerEvents: "none",
                  transform: "translate(-50%, -50%)", // Center dot on mouse position
                }}
              />
            </div>
          );
        })}

        {/* Containers - shown when not in drawing mode */}
        {/* Containers are currently managed via local state. Real boards will need this sync */}
        {!isDrawingMode &&
          containers.map((container) => (
            <Container
              key={container.id}
              container={container}
              onPositionChange={handleContainerPositionChange} // Uses local state for now
              onSizeChange={handleContainerSizeChange} // Uses local state for now
              onDelete={handleContainerDelete} // Uses local state for now
              canvasBounds={{ width: 1200, height: 600 }} // Pass bounds if needed for dragging constraints
            />
          ))}

        {/* Create Container Form Modal */}
        {showCreateForm &&
          boardId && ( // Ensure boardId exists
            <div className="create-container-modal">
              <div className="create-container-modal-content">
                <h3>Create New Container</h3>
                <CreateContainerForm
                  boardId={boardId} // Pass the current boardId
                  onCreateSuccess={handleCreateContainer} // Call local handler for now
                  onCancel={() => setShowCreateForm(false)}
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
              position: "absolute",
              top: "20px",
              right: "20px",
              padding: "8px 16px",
              borderRadius: "20px",
              backgroundColor: isDrawingMode ? "#10b981" : "#2563eb",
              color: "white",
              border: "none",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            title={
              isDrawingMode
                ? "Switch to Container Mode"
                : "Switch to Drawing Mode"
            }
          >
            <span
              role="img"
              aria-label={isDrawingMode ? "container" : "drawing"}
            >
              {isDrawingMode ? "📦" : "✏️"}
            </span>
            {isDrawingMode ? "Containers" : "Draw"}
          </button>
        )}

        {/* Add Container Button - only shown in container mode and if boardId/user exist */}
        {!isDrawingMode && boardId && user && (
          <button
            className="add-container-btn"
            onClick={() => setShowCreateForm(true)}
            style={{
              position: "absolute",
              bottom: "20px",
              right: "20px",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Add Container"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

export default BoardViewPage;
