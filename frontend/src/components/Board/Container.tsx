import React, { useState, useRef, useEffect } from 'react';
import type { Container as ContainerType } from '../../../../shared/types';

interface ContainerProps {
  container: ContainerType;
  onPositionChange?: (containerId: string, newPosition: { x: number; y: number }) => void;
  onSizeChange?: (containerId: string, newSize: { width: number; height: number }) => void;
  onDelete?: (containerId: string) => void;
  canvasBounds?: { width: number; height: number };
}

interface LinkItem {
  id: string;
  url: string;
  title: string;
}

const Container: React.FC<ContainerProps> = ({ 
  container, 
  onPositionChange, 
  onSizeChange, 
  onDelete,
  canvasBounds
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // Link state
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  
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

  // Handle adding a link
  const handleAddLink = () => {
    if (!urlInput.trim()) return;
    
    const newLink: LinkItem = {
      id: `link-${Date.now()}`,
      url: urlInput.trim(),
      title: titleInput.trim() || urlInput.trim()
    };
    
    setLinks(prev => [...prev, newLink]);
    setUrlInput('');
    setTitleInput('');
  };

  // Handle deleting a link
  const handleDeleteLink = (linkId: string) => {
    setLinks(prev => prev.filter(link => link.id !== linkId));
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && onPositionChange) {
        // Calculate new position based on mouse position minus the initial offset
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep container within canvas bounds
        const maxX = canvasBounds ? canvasBounds.width - container.size.width : window.innerWidth - container.size.width;
        const maxY = canvasBounds ? canvasBounds.height - container.size.height : window.innerHeight - container.size.height;
        
        const clampedX = Math.max(0, Math.min(maxX, newX));
        const clampedY = Math.max(0, Math.min(maxY, newY));
        
        onPositionChange(container.id, { x: clampedX, y: clampedY });
      }
      
      if (isResizing && onSizeChange) {
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
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, container, onPositionChange, onSizeChange, canvasBounds]);

  const getContainerIcon = () => {
    return container.purpose === 'notes' ? '📝' : '🔗';
  };

  const getContainerColor = () => {
    return container.purpose === 'notes' ? '#fef3c7' : '#dbeafe';
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
          overflow: 'auto',
          backgroundColor: 'transparent',
        }}
      >
        {container.purpose === 'notes' ? (
          <textarea
            placeholder="Write your notes here..."
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              resize: 'none',
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#374151',
              fontFamily: 'inherit',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
            {/* Add Link Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <input
                type="url"
                placeholder="Enter URL (e.g., https://example.com)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '11px',
                  outline: 'none',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <input
                type="text"
                placeholder="Link title (optional)"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '11px',
                  outline: 'none',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <button
                onClick={handleAddLink}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                Add Link
              </button>
            </div>

            {/* Links List */}
            <div style={{ 
              borderTop: '1px solid #e5e7eb', 
              paddingTop: '8px',
              marginTop: '8px',
              flex: 1,
              overflow: 'auto',
              minHeight: '60px'
            }}>
              {links.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#9ca3af', 
                  fontSize: '11px',
                  fontStyle: 'italic',
                  padding: '20px 0'
                }}>
                  No links yet. Add your first link above!
                </div>
              ) : (
                <div style={{ fontSize: '11px' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#374151', 
                    marginBottom: '8px',
                    fontSize: '12px'
                  }}>
                    Links ({links.length}):
                  </div>
                  {links.map(link => (
                    <div key={link.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '4px 0',
                      borderBottom: '1px solid #f3f4f6'
                    }}>
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#2563eb', 
                          textDecoration: 'none',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '11px'
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {link.title}
                      </a>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          fontSize: '10px',
                          padding: '2px',
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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