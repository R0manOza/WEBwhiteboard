import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { NoteItem as NoteItemType } from '../../../../shared/types';
import debounce from 'lodash.debounce';

interface NoteItemProps {
  item: NoteItemType;
  onUpdate?: (itemId: string, updates: Partial<NoteItemType>) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  isEditing?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({
  item,
  onUpdate,
  onDelete,
  isEditing = false,
  onEditStart,
  onEditEnd
}) => {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [color, setColor] = useState(item.color || '#fef3c7');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [internalEditing, setInternalEditing] = useState(isEditing);
  
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Color options for notes
  const colorOptions = [
    { name: 'Yellow', value: '#fef3c7' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Pink', value: '#fce7f3' },
    { name: 'Purple', value: '#f3e8ff' },
    { name: 'Orange', value: '#fed7aa' },
    { name: 'Red', value: '#fee2e2' },
    { name: 'Gray', value: '#f3f4f6' },
  ];

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (updates: Partial<NoteItemType>) => {
      if (!onUpdate) return;
      
      try {
        setIsSaving(true);
        await onUpdate(item.id, updates);
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to save note:', error);
        // Could add toast notification here
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    [onUpdate, item.id]
  );

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasChanges(true);
    debouncedSave({ title: newTitle });
  };

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
    debouncedSave({ content: newContent });
  };

  // Handle color change
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setHasChanges(true);
    debouncedSave({ color: newColor });
  };

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await onDelete(item.id);
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    }
  };

  // Handle edit start
  const handleEditStart = () => {
    setInternalEditing(true);
    onEditStart?.();
    
    // Focus on title input after a brief delay
    setTimeout(() => {
      titleRef.current?.focus();
    }, 100);
  };

  // Handle edit end
  const handleEditEnd = () => {
    setInternalEditing(false);
    onEditEnd?.();
    
    // Save any remaining changes
    if (hasChanges) {
      debouncedSave.flush();
    }
  };

  // Handle double click to edit
  const handleDoubleClick = () => {
    if (!internalEditing) {
      handleEditStart();
    }
  };

  // Handle key shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleEditEnd();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleEditEnd();
    }
  };

  // Update local state when item prop changes
  useEffect(() => {
    setTitle(item.title);
    setContent(item.content);
    setColor(item.color || '#fef3c7');
    setHasChanges(false);
  }, [item.title, item.content, item.color]);

  // Update internal editing state when prop changes
  useEffect(() => {
    setInternalEditing(isEditing);
  }, [isEditing]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return (
    <div
      className="note-item"
      style={{
        backgroundColor: color,
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        cursor: internalEditing ? 'text' : 'pointer',
        minHeight: '80px',
        position: 'relative',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header with title and actions */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
        {internalEditing ? (
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note title..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
            }}
          />
        ) : (
          <h4
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title || 'Untitled Note'}
          </h4>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Color picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#6b7280',
              }}
              title="Change color"
            >
              🎨
            </button>
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '8px',
                display: 'none',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '4px',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
              className="color-picker"
            >
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleColorChange(colorOption.value);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: colorOption.value,
                    border: color === colorOption.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>

          {/* Edit button */}
          {!internalEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditStart();
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#6b7280',
              }}
              title="Edit note"
            >
              ✏️
            </button>
          )}

          {/* Save indicator */}
          {isSaving && (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>💾</span>
          )}

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#ef4444',
            }}
            title="Delete note"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Content area */}
      {internalEditing ? (
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your note content here..."
          style={{
            width: '100%',
            minHeight: '60px',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            resize: 'vertical',
            fontSize: '13px',
            lineHeight: '1.4',
            color: '#374151',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          style={{
            fontSize: '13px',
            lineHeight: '1.4',
            color: '#374151',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: '20px',
          }}
        >
          {content || 'No content'}
        </div>
      )}

      {/* Status indicator */}
      {hasChanges && !isSaving && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            backgroundColor: '#f59e0b',
            borderRadius: '50%',
          }}
        />
      )}

      {/* Instructions */}
      {internalEditing && (
        <div
          style={{
            fontSize: '11px',
            color: '#9ca3af',
            marginTop: '8px',
            fontStyle: 'italic',
          }}
        >
          Press Ctrl+Enter to save, Esc to cancel
        </div>
      )}
    </div>
  );
};

export default NoteItem; 