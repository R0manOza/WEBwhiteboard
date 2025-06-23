import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import throttle from 'lodash.throttle';
import type { Board, Container as ContainerType } from '../../../shared/types';
import BoardSettingsModal from '../components/Board/BoardSettingsModal';
import Container from '../components/Board/Container';
import CreateContainerForm from '../components/Board/CreateContainerForm';
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

  const canvasRef = useRef<HTMLDivElement>(null);

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
  const handleCreateContainer = (newContainer: ContainerType) => {
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
      sendCursorPosition(event.clientX, event.clientY);
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
        className="boardview-canvas-area"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Cursor indicators */}
        {Object.entries(otherCursors).map(([userId, position]) => (
          <div
            key={userId}
            className="other-user-cursor"
            style={{
              position: 'absolute',
              left: position.x,
              top: position.y,
              width: '20px',
              height: '20px',
              backgroundColor: '#ff6b6b',
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        ))}

        {/* Containers */}
        {containers.map(container => (
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

        {/* Add Container Button */}
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
      </div>
    </div>
  );
}

export default BoardViewPage;