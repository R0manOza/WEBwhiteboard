import React, { useEffect, useRef, useState, useCallback } from "react";
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
  visibility: "public",
  ownerId: "sample-user-id",
  members: { "sample-user-id": "owner" },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Define static data for initial containers on the sample board
const sampleContainersData: ContainerType[] = [
  {
    id: "sample-container-1",
    boardId: SAMPLE_BOARD_ID,
    title: "Welcome!",
    type: "notes",
    position: { x: 50, y: 50 },
    size: { width: 300, height: 200 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "sample-container-2",
    boardId: SAMPLE_BOARD_ID,
    title: "Example Links",
    type: "links",
    position: { x: 400, y: 100 },
    size: { width: 350, height: 300 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Define a type for cursor data received from others
interface CursorPosition {
  boardId: string;
  userId: string;
  x: number;
  y: number;
}

function BoardViewPage() {
  //console.log('BoardViewPage: Component rendering or re-rendering.');
  const { boardId } = useParams<{ boardId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket(boardId || "");

  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [otherCursors, setOtherCursors] = useState<{
    [userId: string]: { x: number; y: number };
  }>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Container state
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [showCreateContainerForm, setshowCreateContainerForm] = useState(false);
  const [containersLoading, setContainersLoading] = useState(false);
  const [containersError, setContainersError] = useState<string | null>(null);
 
  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const [onlineUsers, setOnlineUsers] = useState<
    { userId: string; displayName: string }[]
  >([]);
  const [drawingUsers, setDrawingUsers] = useState<{
    [userId: string]: boolean;
  }>({});
  const [ownerName, setOwnerName] = useState<string>("");

  // Throttled Cursor Position Sender - FIXED: Memoized properly
  const sendCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      if (socket && isConnected && boardId && user && hasAccess) {
        socket.emit("cursorPosition", { boardId, x, y });
      }
    }, 50),
    [socket, isConnected, boardId, user, hasAccess]
  );

  // Container handlers - FIXED: Memoized to prevent re-creation
  const handleCreateContainer = useCallback((newContainer: ContainerType) => {
    console.log("Attempting to create container:", newContainer);
    if (!newContainer.id) {
      newContainer.id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    setContainers((prev) => [...prev, newContainer]);
    setshowCreateContainerForm(false);
    console.log("Container created (locally):", newContainer.id);
  }, []);

  const handleContainerPositionChange = useCallback((
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
  }, []);

  const handleContainerSizeChange = useCallback((
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
  }, []);

  const handleContainerDelete = useCallback((containerId: string) => {
    setContainers((prev) =>
      prev.filter((container) => container.id !== containerId)
    );
  }, []);

  const handleContainerCreated = useCallback((newlyCreatedContainer: ContainerType) => {
    console.log('[BoardViewPage] handleContainerCreated, new container from backend/form:', newlyCreatedContainer);
   
    setContainers(prevContainers => {
      if (prevContainers.find(c => c.id === newlyCreatedContainer.id)) {
        return prevContainers;
      }
      return [...prevContainers, newlyCreatedContainer];
    });
    setshowCreateContainerForm(false);
  }, []);

  // FIXED: Separate fetch containers function to avoid inline definition
  const fetchContainersForBoard = useCallback(async () => {
    if (!boardId || !user || !hasAccess || boardId === SAMPLE_BOARD_ID) {
      console.log(`BoardViewPage (${boardId}): Skipping container fetch. Missing boardId, user, or access.`);
      setContainers(boardId === SAMPLE_BOARD_ID ? sampleContainersData : []);
      return;
    }
    
    console.log(`BoardViewPage (${boardId}): Fetching containers...`);
    setContainersLoading(true);
    setContainersError(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/boards/${boardId}/containers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to fetch containers.' }));
        throw new Error(errData.message || `Error fetching containers: ${response.status}`);
      }
      
      const fetchedContainers: ContainerType[] = await response.json();
      setContainers(fetchedContainers);
      console.log(`BoardViewPage (${boardId}): Fetched ${fetchedContainers.length} containers successfully.`);
    } catch (err: any) {
      console.error(`BoardViewPage (${boardId}): Error fetching containers:`, err);
      setContainersError(err.message || 'Failed to load containers.');
      setContainers([]);
    } finally {
      setContainersLoading(false);
    }
  }, [boardId, user, hasAccess]);

  // Effect to fetch Board Data (or load sample data)
  // FIXED: Removed problematic dependencies
  useEffect(() => {
    console.log(`BoardViewPage (${boardId}): Running data fetch effect.`);

    // Sample Board Logic
    if (boardId === SAMPLE_BOARD_ID) {
      console.log(`BoardViewPage (${boardId}): Loading sample board.`);
      setBoardLoading(false);
      setHasAccess(true);
      setBoard(sampleBoardData);
      setContainers(sampleContainersData);
      setBoardError(null);
      setOwnerName("Sample User");
      return;
    }

    // Check prerequisites
    if (!boardId || !user) {
      console.log(`BoardViewPage (${boardId}): Skipping backend fetch. Missing boardId or user.`);
      setBoardLoading(false);
      setHasAccess(false);
      setBoard(null);
      setBoardError(null);
      return;
    }

    // Wait for auth
    if (authLoading) {
      console.log(`BoardViewPage (${boardId}): Waiting for auth to load for backend fetch.`);
      setBoardLoading(true);
      return;
    }

    const fetchBoardData = async () => {
      console.log(`BoardViewPage (${boardId}): Starting backend data fetch for authenticated user ${user.uid}`);
      setBoardLoading(true);
      setBoardError(null);
      setHasAccess(false);

      try {
        const token = await user.getIdToken();

        // Fetch Board Data
        console.log(`BoardViewPage (${boardId}): Fetching board details from /api/boards/${boardId}`);
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
        console.log(`BoardViewPage (${boardId}): Fetched board data successfully.`, boardData);

        // Access Check for real boards
        const userUid = user.uid;
        const isMember = boardData.members && boardData.members[userUid] !== undefined;
        const isPublic = boardData.visibility === "public";
        const userHasAccess = isPublic || isMember;
        setHasAccess(userHasAccess);
        console.log(`BoardViewPage (${boardId}): User ${userUid} has access: ${userHasAccess}`);

        // Fetch owner name for display for real boards
        if (boardData.ownerId && boardData.ownerId !== userUid) {
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
            setOwnerName(boardData.ownerId);
          }
        } else {
          setOwnerName(user.displayName || user.email || boardData.ownerId || "Me");
        }
      } catch (err: any) {
        console.error(`BoardViewPage (${boardId}): Error during backend data fetch process:`, err);
        setBoardError(err.message || "Failed to load board.");
        setBoard(null);
        setHasAccess(false);
        setContainers([]);
        setOwnerName("");
      } finally {
        setBoardLoading(false);
        console.log(`BoardViewPage (${boardId}): Backend data fetch process finished.`);
      }
    };

    fetchBoardData();

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up data fetch effect.`);
    };
  }, [boardId, user, authLoading]); // FIXED: Removed board and hasAccess dependencies

  // FIXED: Separate effect for fetching containers after access is determined
  useEffect(() => {
    if (hasAccess && board && boardId !== SAMPLE_BOARD_ID) {
      fetchContainersForBoard();
    }
  }, [hasAccess, board, fetchContainersForBoard]);

  // Effect for Mouse Move Listener
  // FIXED: Proper dependency array
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
      console.log(`BoardViewPage (${boardId}): Attaching mousemove listener for cursor.`);
      canvasElement.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      if (canvasElement) {
        console.log(`BoardViewPage (${boardId}): Removing mousemove listener.`);
        canvasElement.removeEventListener("mousemove", handleMouseMove);
        sendCursorPosition.cancel();
      }
    };
  }, [sendCursorPosition, hasAccess, boardId]); // FIXED: Removed canvasRef.current

  // Effect for Socket Listeners
  // FIXED: Memoized socket event handlers
  useEffect(() => {
    if (!socket || !isConnected || !hasAccess || !boardId || !user) {
      console.log(`BoardViewPage (${boardId}): Skipping socket listener setup.`);
      return;
    }

    console.log(`BoardViewPage (${boardId}): Setting up socket listeners.`);

    const handleCursorMoved = (data: CursorPosition) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        setOtherCursors((prev) => ({
          ...prev,
          [data.userId]: { x: data.x, y: data.y },
        }));
      }
    };

    const onContainerCreated = (newContainer: ContainerType) => {
      console.log(`[Socket IN board:${boardId}] containerCreated received:`, newContainer);
      if (newContainer.boardId === boardId) {
        setContainers(prev => {
          if (prev.find(c => c.id === newContainer.id)) return prev;
          return [...prev, newContainer];
        });
      }
    };

    const handleOnlineUsers = (data: {
      boardId: string;
      users: { userId: string; displayName: string }[];
    }) => {
      if (data.boardId === boardId) {
        console.log(`BoardViewPage (${boardId}): Received online users update:`, data.users);
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
        console.log(`BoardViewPage (${boardId}): User ${data.userId} is ${data.isDrawing ? "drawing" : "not drawing"}`);
        setDrawingUsers((prev) => ({ ...prev, [data.userId]: data.isDrawing }));
      }
    };

    socket.on("cursorMoved", handleCursorMoved);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("userDrawingStatus", handleUserDrawingStatus);
    socket.on('containerCreated', onContainerCreated);

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
      socket.off("cursorMoved", handleCursorMoved);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("userDrawingStatus", handleUserDrawingStatus);
      socket.off('containerCreated', onContainerCreated);
    };
  }, [socket, isConnected, hasAccess, boardId, user]); // FIXED: Stable dependencies

  // Listen for clearBoardDrawing event
  useEffect(() => {
    if (!socket || !isConnected || !boardId || !user) return;
    
    const handleClear = (data: { boardId: string }) => {
      if (data.boardId !== boardId) return;
      console.log(`BoardViewPage (${boardId}): Received clearBoardDrawing event.`);
    };
    
    socket.on("clearBoardDrawing", handleClear);
    return () => {
      socket.off("clearBoardDrawing", handleClear);
    };
  }, [socket, isConnected, boardId, user]);

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

  // Error state
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

  // No access state
  if (!hasAccess) {
    return (
      <div className="boardview-root-bg">
        <div className="boardview-header-card">
          <div className="boardview-header-left">
            <h2 className="boardview-title">Access Denied</h2>
            <p className="boardview-description">
              You don't have access to this board or it does not exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main board view
  return (
    <div className={`boardview-root-bg ${boardId === SAMPLE_BOARD_ID ? "sample-board-bg" : ""}`}>
      <div className="boardview-header-card">
        <div className="boardview-header-left">
          <h2 className="boardview-title">
            {board?.name}
            {boardId === SAMPLE_BOARD_ID && (
              <span
                style={{
                  marginLeft: "10px",
                  fontSize: "1.1rem",
                  color: "#605e5c",
                  fontWeight: "normal",
                }}
              >
                {" "}(Sample)
              </span>
            )}
          </h2>
          {board?.description && (
            <p className="boardview-description">{board.description}</p>
          )}
          <div style={{ marginTop: 8, fontSize: 14, color: "#555" }}>
            <b>Owner:</b> {ownerName || board?.ownerId || "Loading..."}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#2563eb" }}>
            <b>Online:</b> {onlineUsers.length} {onlineUsers.length === 1 ? "user" : "users"}
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
                    <span style={{ color: "#10b981", fontSize: 16 }} title={`${u.displayName} is drawing`}>
                      ✏️
                    </span>
                  )}
                  {board && u.userId === board.ownerId && (
                    <span style={{ color: "#f59e42", fontSize: 14 }} title="Owner">
                      ★
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="boardview-header-actions">
          {boardId !== SAMPLE_BOARD_ID && (
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

      {showSettingsModal && board && boardId !== SAMPLE_BOARD_ID && (
        <BoardSettingsModal
          boardId={board.id}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      <div
        ref={canvasRef}
        className={`boardview-canvas-area ${isDrawingMode ? "drawing-mode" : ""}`}
      >
        {isDrawingMode && boardId && user && (
          <DrawingCanvas
            boardId={boardId}
            width={1200}
            height={600}
            className="drawing-canvas"
          />
        )}

        {Object.entries(otherCursors).map(([userId, position]) => {
          const userObj = onlineUsers.find((u) => u.userId === userId);
          if (!userObj) return null;
          
          return (
            <div
              key={userId}
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex: 1000,
                pointerEvents: "none",
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
                  width: "10px",
                  height: "10px",
                  backgroundColor: "#ff6b6b",
                  borderRadius: "50%",
                  pointerEvents: "none",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          );
        })}

        {!isDrawingMode &&
          containers.map((container) => (
            <Container
              key={container.id}
              container={container}
              onPositionChange={handleContainerPositionChange}
              onSizeChange={handleContainerSizeChange}
              onDelete={handleContainerDelete}
              canvasBounds={{ width: 1200, height: 600 }}
            />
          ))}

        {showCreateContainerForm && boardId && (
          <div className="create-container-modal">
            <div className="create-container-modal-content">
              <h3>Create New Container</h3>
              <CreateContainerForm
                boardId={boardId}
                onCreateSuccess={handleContainerCreated}
                onCancel={() => setshowCreateContainerForm(false)}
              />
            </div>
          </div>
        )}

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
            title={isDrawingMode ? "Switch to Container Mode" : "Switch to Drawing Mode"}
          >
            <span role="img" aria-label={isDrawingMode ? "container" : "drawing"}>
              {isDrawingMode ? "📦" : "✏️"}
            </span>
            {isDrawingMode ? "Containers" : "Draw"}
          </button>
        )}

        {!isDrawingMode && hasAccess && (
          <button
            className="add-container-btn"
            onClick={() => setshowCreateContainerForm(true)}
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