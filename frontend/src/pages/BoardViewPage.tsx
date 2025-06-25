import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import throttle from 'lodash.throttle';
import type { Board, Container as ContainerType } from '../../../shared/types';
import BoardSettingsModal from '../components/Board/BoardSettingsModal';
import Container from '../components/Board/Container';
import CreateContainerForm from '../components/Board/CreateContainerForm';
import DrawingCanvas from '../components/Board/DrawingCanvas';
import './BoardViewPage.css';

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
  const { socket, isConnected } = useSocket(boardId || '');

  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [otherCursors, setOtherCursors] = useState<{ [userId: string]: { x: number; y: number } }>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Container state
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [drawingUsers, setDrawingUsers] = useState<{ [userId: string]: boolean }>({});
  const [ownerName, setOwnerName] = useState<string>('');

  // Throttled Cursor Position Sender
  const sendCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      if (socket && isConnected && boardId && user && hasAccess) {
        socket.emit('cursorPosition', { boardId, x, y });
      }
    }, 50),
    [socket, isConnected, boardId, user, hasAccess]
  );

  // Container handlers
  const handleCreateContainer = (formData: { title: string; purpose: ContainerType['purpose'] }) => {
    // Generate a new container object with required fields
    const newContainer: ContainerType = {
      id: Math.random().toString(36).substr(2, 9), // or use uuid if available
      boardId: boardId || '',
      title: formData.title,
      purpose: formData.purpose,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setContainers(prev => [...prev, newContainer]);
    setShowCreateForm(false);
  };

  const handleContainerPositionChange = (containerId: string, newPosition: { x: number; y: number }) => {
    setContainers(prev => 
      prev.map(container => 
        container.id === containerId 
          ? { ...container, position: newPosition, updatedAt: Date.now() }
          : container
      )
    );
  };

  const handleContainerSizeChange = (containerId: string, newSize: { width: number; height: number }) => {
    setContainers(prev => 
      prev.map(container => 
        container.id === containerId 
          ? { ...container, size: newSize, updatedAt: Date.now() }
          : container
      )
    );
  };

  const handleContainerDelete = (containerId: string) => {
    setContainers(prev => prev.filter(container => container.id !== containerId));
  };

  // Effect to fetch Board Data
  useEffect(() => {
    console.log(`BoardViewPage (${boardId}): Running fetch effect.`);
    if (!boardId || !user) {
      console.log(`BoardViewPage (${boardId}): Skipping fetch. Missing boardId or user.`);
      setBoardLoading(false);
      setHasAccess(false);
      setBoard(null);
      setBoardError(null);
      return;
    }
    
    if (authLoading) {
      console.log(`BoardViewPage (${boardId}): Waiting for auth to load.`);
      setBoardLoading(true);
      return;
    }

    const fetchBoardData = async () => {
      console.log(`BoardViewPage (${boardId}): Starting data fetch for authenticated user ${user.uid}`);
      setBoardLoading(true);
      setBoardError(null);
      setHasAccess(false);

      try {
        const token = await user.getIdToken();

        // Fetch Board Data
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

        // Access Check
        const userUid = user.uid;
        const isMember = boardData.members && boardData.members[userUid] !== undefined;
        const isPublic = boardData.visibility === 'public';
        const userHasAccess = isPublic || isMember;
        setHasAccess(userHasAccess);
        console.log(`BoardViewPage (${boardId}): User ${userUid} has access: ${userHasAccess}`);

      } catch (err: any) {
        console.error(`BoardViewPage (${boardId}): Error during data fetch process:`, err);
        setBoardError(err.message || 'Failed to load board.');
        setBoard(null);
        setHasAccess(false);
      } finally {
        setBoardLoading(false);
        console.log(`BoardViewPage (${boardId}): Data fetch process finished. Loading: ${false}, Access: ${hasAccess}.`);
      }
    };

    fetchBoardData();

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up data fetch effect.`);
    };

  }, [boardId, user, authLoading]);

  // Effect for Mouse Move Listener
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
      console.log(`BoardViewPage (${boardId}): Attaching mousemove listener.`);
      canvasElement.addEventListener('mousemove', handleMouseMove);
    } else {
      console.log(`BoardViewPage (${boardId}): Skipping mousemove listener attachment (no canvas or no access).`);
    }

    return () => {
      if (canvasElement) {
        console.log(`BoardViewPage (${boardId}): Removing mousemove listener.`);
        canvasElement.removeEventListener('mousemove', handleMouseMove);
        sendCursorPosition.cancel();
      }
    };
  }, [canvasRef.current, sendCursorPosition, hasAccess, boardId]);

  // Effect for Socket Listeners
  useEffect(() => {
    if (!socket || !hasAccess || !boardId || !user) {
      console.log(`BoardViewPage (${boardId}): Skipping socket listener setup (no socket, no access, or missing data).`);
      return;
    }

    console.log(`BoardViewPage (${boardId}): Setting up socket listeners.`);

    const handleCursorMoved = (data: CursorPosition) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        setOtherCursors(prev => ({
          ...prev,
          [data.userId]: { x: data.x, y: data.y }
        }));
      }
    };

    const handleUserJoined = (data: { boardId: string; userId: string }) => {
      if (data.boardId === boardId) {
        console.log(`BoardViewPage (${boardId}): User ${data.userId} joined the board.`);
      }
    };

    const handleUserLeft = (data: { boardId: string; userId: string }) => {
      if (data.boardId === boardId) {
        console.log(`BoardViewPage (${boardId}): User ${data.userId} left the board.`);
        setOtherCursors(prev => {
          const newCursors = { ...prev };
          delete newCursors[data.userId];
          return newCursors;
        });
      }
    };

    socket.on('cursorMoved', handleCursorMoved);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);

    return () => {
      console.log(`BoardViewPage (${boardId}): Cleaning up socket listeners.`);
      socket.off('cursorMoved', handleCursorMoved);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
    };
  }, [socket, hasAccess, boardId, user]);

  const handleMouseDown = () => {
    if (socket && isConnected && boardId && user && hasAccess) {
      socket.emit('userDrawingStatus', { boardId, isDrawing: true });
    }
  };

  const handleMouseUp = () => {
    if (socket && isConnected && boardId && user && hasAccess) {
      socket.emit('userDrawingStatus', { boardId, isDrawing: false });
    }
  };

  // Fetch owner display name when board loads
  useEffect(() => {
    const fetchOwnerName = async () => {
      if (!board?.ownerId || !user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/auth/userInfo?uid=${board.ownerId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setOwnerName(data.displayName || board.ownerId);
        } else {
          setOwnerName(board.ownerId);
        }
      } catch {
        setOwnerName(board.ownerId);
      }
    };
    if (board && user) fetchOwnerName();
  }, [board, user]);

  // Listen for onlineUsers and userDrawingStatus events
  useEffect(() => {
    if (!socket || !hasAccess || !boardId || !user) return;
    const handleOnlineUsers = (data: { boardId: string; users: { userId: string; displayName: string }[] }) => {
      if (data.boardId === boardId) setOnlineUsers(data.users);
    };
    const handleUserDrawingStatus = (data: { boardId: string; userId: string; isDrawing: boolean }) => {
      if (data.boardId === boardId && data.userId !== user.uid) {
        setDrawingUsers(prev => ({ ...prev, [data.userId]: data.isDrawing }));
      }
    };
    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('userDrawingStatus', handleUserDrawingStatus);
    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('userDrawingStatus', handleUserDrawingStatus);
    };
  }, [socket, hasAccess, boardId, user]);

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
            <h2 className="boardview-title">Error</h2>
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
            <p className="boardview-description">You don't have access to this board.</p>
          </div>
        </div>
      </div>
    );
  }

  // Main board view
  return (
    <div className="boardview-root-bg">
      <div className="boardview-header-card">
        <div className="boardview-header-left">
          <h2 className="boardview-title">
            {board?.name}
          </h2>
          {board?.description && (
            <p className="boardview-description">{board.description}</p>
          )}
          <div style={{ marginTop: 8, fontSize: 14, color: '#555' }}>
            <b>Owner:</b> {ownerName || board?.ownerId}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#2563eb' }}>
            <b>Online:</b> {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 8 }}>
              {onlineUsers.map(u => (
                <li key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{u.displayName}</span>
                  {drawingUsers[u.userId] && <span style={{ color: '#10b981', fontSize: 16 }}>✏️</span>}
                  {u.userId === board?.ownerId && <span style={{ color: '#f59e42', fontSize: 14 }} title="Owner">★</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="boardview-header-actions">
          <button
            className="boardview-settings-btn"
            onClick={() => setShowSettingsModal(true)}
            title="Board Settings"
          >
            <span role="img" aria-label="settings">⚙️</span>
          </button>
        </div>
      </div>

      {/* Board Settings Modal */}
      {showSettingsModal && board && (
        <BoardSettingsModal
          boardId={board.id}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Canvas Area */}
      <div 
        ref={canvasRef} 
        className={`boardview-canvas-area ${isDrawingMode ? 'drawing-mode' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Drawing Canvas - shown when in drawing mode */}
        {isDrawingMode && (
          <DrawingCanvas
            boardId={boardId || ''}
            width={1200}
            height={600}
            className="drawing-canvas"
          />
        )}

        {/* Cursor indicators */}
        {Object.entries(otherCursors).map(([userId, position]) => {
          const userObj = onlineUsers.find(u => u.userId === userId);
          return (
            <div key={userId} style={{ position: 'absolute', left: position.x, top: position.y, zIndex: 1000, pointerEvents: 'none' }}>
              <div style={{
                position: 'absolute',
                top: '-22px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.95)',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: 13,
                padding: '2px 8px',
                borderRadius: 6,
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                border: '1px solid #e5e7eb',
              }}>
                {userObj?.displayName || userId}
              </div>
              <div
                className="other-user-cursor"
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#ff6b6b',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            </div>
          );
        })}

        {/* Containers - shown when not in drawing mode */}
        {!isDrawingMode && containers.map(container => (
          <Container
            key={container.id}
            container={container}
            onPositionChange={handleContainerPositionChange}
            onSizeChange={handleContainerSizeChange}
            onDelete={handleContainerDelete}
            canvasBounds={{ width: 1200, height: 600 }}
          />
        ))}

        {/* Create Container Form */}
        {showCreateForm && (
          <div className="create-container-modal">
            <div className="create-container-modal-content">
              <h3>Create New Container</h3>
              <CreateContainerForm
                boardId={boardId || ''}
                onCreateSuccess={handleCreateContainer}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        )}

        {/* Mode Toggle Button */}
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

        {/* Add Container Button - only shown in container mode */}
        {!isDrawingMode && (
          <button
            className="add-container-btn"
            onClick={() => setShowCreateForm(true)}
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
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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