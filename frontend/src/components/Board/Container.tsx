import React, { useState, useRef, useEffect } from 'react';
import type { Container as ContainerType, NoteItem as NoteItemType, LinkItem as LinkItemType } from '../../../../shared/types';
import ContainerDrawing from './ContainerDrawing';
import NoteItem from '../Items/NoteItem';
import LinkItem from '../Items/LinkItem';
import CreateItemForm from '../Items/CreateItemForm';

interface ContainerProps {
  container: ContainerType;
  onPositionChange?: (containerId: string, newPosition: { x: number; y: number }) => void;
  onSizeChange?: (containerId: string, newSize: { width: number; height: number }) => void;
  onDelete?: (containerId: string) => void;
  onDragEnd?: (containerId: string) => void;
  onResizeEnd?: (containerId: string) => void;
  canvasBounds?: { width: number; height: number };
}

const Container: React.FC<ContainerProps> = ({ 
  container, 
  onPositionChange, 
  onSizeChange, 
  onDelete,
  onDragEnd,
  onResizeEnd,
  canvasBounds
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // Items state
  const [notes, setNotes] = useState<NoteItemType[]>([]);
  const [links, setLinks] = useState<LinkItemType[]>([]);
  
  // Drawing state for notes containers
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  
  // Item creation state
  const [showCreateItemForm, setShowCreateItemForm] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('.container-header')) {
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate offset from mouse position to container's current position
        setDragOffset({
          x: e.clientX - container.position.x,
          y: e.clientY - container.position.y
        });
      }
      e.preventDefault();
    }
  };

  // Handle mouse down for resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height
      });
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle creating a new item
  const handleCreateItem = (newItem: NoteItemType | LinkItemType) => {
    if (container.type === 'notes') {
      setNotes(prev => [...prev, newItem as NoteItemType]);
    } else {
      setLinks(prev => [...prev, newItem as LinkItemType]);
    }
    setShowCreateItemForm(false);
  };

  // Handle updating a note
  const handleUpdateNote = async (itemId: string, updates: Partial<NoteItemType>) => {
    setNotes(prev => 
      prev.map(note => 
        note.id === itemId 
          ? { ...note, ...updates, updatedAt: Date.now() }
          : note
      )
    );
    // TODO: Call API to update note
  };

  // Handle updating a link
  const handleUpdateLink = async (itemId: string, updates: Partial<LinkItemType>) => {
    setLinks(prev => 
      prev.map(link => 
        link.id === itemId 
          ? { ...link, ...updates, updatedAt: Date.now() }
          : link
      )
    );
    // TODO: Call API to update link
  };

  // Handle deleting a note
  const handleDeleteNote = async (itemId: string) => {
    setNotes(prev => prev.filter(note => note.id !== itemId));
    // TODO: Call API to delete note
  };

  // Handle deleting a link
  const handleDeleteLink = async (itemId: string) => {
    setLinks(prev => prev.filter(link => link.id !== itemId));
    // TODO: Call API to delete link
  };

  // Handle mouse move for dragging
  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && onPositionChange) {
        // Use requestAnimationFrame for smoother updates
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
          // Calculate new position based on mouse position minus the initial offset
          const newX = e.clientX - dragOffset.x;
          const newY = e.clientY - dragOffset.y;
          
          // Keep container within canvas bounds
          const maxX = canvasBounds ? canvasBounds.width - container.size.width : window.innerWidth - container.size.width;
          const maxY = canvasBounds ? canvasBounds.height - container.size.height : window.innerHeight - container.size.height;
          
          const clampedX = Math.max(0, Math.min(maxX, newX));
          const clampedY = Math.max(0, Math.min(maxY, newY));
          
          onPositionChange(container.id, { x: clampedX, y: clampedY });
        });
      }
      
      if (isResizing && onSizeChange) {
        // Use requestAnimationFrame for smoother resizing
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
          const deltaX = e.clientX - resizeStart.x;
          const deltaY = e.clientY - resizeStart.y;
          
          const newWidth = Math.max(200, resizeStart.width + deltaX);
          const newHeight = Math.max(150, resizeStart.height + deltaY);
          
          // Also constrain resize to canvas bounds
          const maxWidth = canvasBounds ? canvasBounds.width - container.position.x : window.innerWidth - container.position.x;
          const maxHeight = canvasBounds ? canvasBounds.height - container.position.y : window.innerHeight - container.position.y;
          
          const constrainedWidth = Math.min(newWidth, maxWidth);
          const constrainedHeight = Math.min(newHeight, maxHeight);
          
          onSizeChange(container.id, { width: constrainedWidth, height: constrainedHeight });
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (onDragEnd) {
        onDragEnd(container.id);
      }
      if (onResizeEnd) {
        onResizeEnd(container.id);
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, container, onPositionChange, onSizeChange, canvasBounds, onDragEnd, onResizeEnd]);

  const getContainerIcon = () => {
    return container.type === 'notes' ? '📝' : '🔗';
  };

  const getContainerColor = () => {
    return container.type === 'notes' ? '#fef3c7' : '#dbeafe';
  };

  // Generate user avatar with initials
  const getUserAvatar = (displayName: string, userId: string) => {
    // Clean and validate display name
    const cleanName = displayName?.trim() || `User${userId.substring(0, 4)}`;
    
    // Extract initials (handle multiple words)
    const words = cleanName.split(/\s+/).filter(word => word.length > 0);
    let initials = '';
    
    if (words.length >= 2) {
      // Use first letter of first and last word
      initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words.length === 1) {
      // Use first two letters if available
      initials = words[0].substring(0, 2).toUpperCase();
    } else {
      // Fallback to user ID
      initials = userId.substring(0, 2).toUpperCase();
    }
    
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    
    return { initials, color: colors[colorIndex] };
  };

  return (
    <div
      ref={containerRef}
      className="draggable-container"
      style={{
        position: 'absolute',
        left: container.position.x,
        top: container.position.y,
        width: container.size.width,
        height: container.size.height,
        backgroundColor: container.style?.backgroundColor || getContainerColor(),
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        zIndex: isDragging ? 1000 : 1,
        // Performance optimizations
        willChange: isDragging || isResizing ? 'transform' : 'auto',
        transform: isDragging || isResizing ? 'translateZ(0)' : 'none', // Force hardware acceleration
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Container Header */}
      <div
        className="container-header"
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{getContainerIcon()}</span>
          <h3 style={{ 
            margin: 0, 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#374151',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {container.title}
          </h3>
        </div>
        
        {/* Notes container mode toggle */}
        {container.type === 'notes' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDrawingMode(!isDrawingMode);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              color: isDrawingMode ? '#10b981' : '#6b7280',
              fontSize: '12px',
              marginRight: '8px',
            }}
            title={isDrawingMode ? "Switch to Text Mode" : "Switch to Drawing Mode"}
          >
            {isDrawingMode ? "📝" : "✏️"}
          </button>
        )}

        {/* Add item button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowCreateItemForm(true);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            color: '#2563eb',
            fontSize: '12px',
            marginRight: '8px',
          }}
          title={`Add ${container.type === 'notes' ? 'Note' : 'Link'}`}
        >
          ➕
        </button>
        
        {/* Delete container button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(container.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              color: '#6b7280',
              fontSize: '12px',
            }}
            title="Delete container"
          >
            ✕
          </button>
        )}
      </div>

      {/* Container Content */}
      <div 
        className="container-content"
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          overflowX: 'hidden',
          maxHeight: '400px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db #f3f4f6',
          backgroundColor: 'transparent',
        }}
      >
        {container.type === 'notes' ? (
          isDrawingMode ? (
            <ContainerDrawing
              boardId={container.boardId}
              containerId={container.id}
              width={container.size.width - 32}
              height={container.size.height - 80}
              className="container-drawing-canvas"
            />
          ) : (
            <div>
              {notes.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#9ca3af', 
                  fontSize: '13px', 
                  fontStyle: 'italic',
                  padding: '20px 0'
                }}>
                  No notes yet. Click ➕ to add one!
                </div>
              ) : (
                notes.map(note => (
                  <NoteItem
                    key={note.id}
                    item={note}
                    onUpdate={handleUpdateNote}
                    onDelete={handleDeleteNote}
                  />
                ))
              )}
            </div>
          )
        ) : (
          <div>
            {links.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#9ca3af', 
                fontSize: '13px', 
                fontStyle: 'italic',
                padding: '20px 0'
              }}>
                No links yet. Click ➕ to add one!
              </div>
            ) : (
              links.map(link => (
                <LinkItem
                  key={link.id}
                  item={link}
                  onUpdate={handleUpdateLink}
                  onDelete={handleDeleteLink}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Item Form Modal */}
      {showCreateItemForm && (
        <div className="create-item-modal">
          <div className="create-item-modal-content">
            <CreateItemForm
              containerId={container.id}
              containerPurpose={container.type}
              onCreateSuccess={handleCreateItem}
              onCancel={() => setShowCreateItemForm(false)}
            />
          </div>
        </div>
      )}

      {/* Resize Handle */}
      <div
        className="resize-handle"
        style={{
          position: 'absolute',
          bottom: '0',
          right: '0',
          width: '20px',
          height: '20px',
          cursor: 'nw-resize',
          background: 'linear-gradient(-45deg, transparent 30%, #d1d5db 30%, #d1d5db 40%, transparent 40%)',
        }}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

export default Container; 