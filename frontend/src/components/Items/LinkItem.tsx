import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { LinkItem as LinkItemType } from '../../../../shared/types';
import debounce from 'lodash.debounce';

interface LinkItemProps {
  item: LinkItemType;
  onUpdate?: (itemId: string, updates: Partial<LinkItemType>) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  isEditing?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

const LinkItem: React.FC<LinkItemProps> = ({
  item,
  onUpdate,
  onDelete,
  isEditing = false,
  onEditStart,
  onEditEnd
}) => {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url);
  const [description, setDescription] = useState(item.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [internalEditing, setInternalEditing] = useState(isEditing);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // URL validation function
  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) return false;
    
    try {
      // Add protocol if missing
      let urlToValidate = urlString;
      if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
        urlToValidate = 'https://' + urlToValidate;
      }
      
      new URL(urlToValidate);
      return true;
    } catch {
      return false;
    }
  };

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (updates: Partial<LinkItemType>) => {
      if (!onUpdate) return;
      
      try {
        setIsSaving(true);
        await onUpdate(item.id, updates);
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to save link:', error);
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

  // Handle URL change
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setHasChanges(true);
    
    // Validate URL
    if (newUrl.trim()) {
      const isValid = validateUrl(newUrl);
      setUrlError(isValid ? null : 'Please enter a valid URL');
      
      if (isValid) {
        // Add protocol if missing
        let urlToSave = newUrl;
        if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
          urlToSave = 'https://' + urlToSave;
        }
        debouncedSave({ url: urlToSave });
      }
    } else {
      setUrlError(null);
    }
  };

  // Handle description change
  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    setHasChanges(true);
    debouncedSave({ description: newDescription });
  };

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this link?')) {
      try {
        await onDelete(item.id);
      } catch (error) {
        console.error('Failed to delete link:', error);
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
    if (hasChanges && !urlError) {
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

  // Handle link click
  const handleLinkClick = (e: React.MouseEvent) => {
    if (internalEditing) {
      e.preventDefault();
      return;
    }
    
    // Open link in new tab
    let urlToOpen = url;
    if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
      urlToOpen = 'https://' + urlToOpen;
    }
    
    window.open(urlToOpen, '_blank', 'noopener,noreferrer');
  };

  // Update local state when item prop changes
  useEffect(() => {
    setTitle(item.title);
    setUrl(item.url);
    setDescription(item.description || '');
    setHasChanges(false);
    setUrlError(null);
  }, [item.title, item.url, item.description]);

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

  // Get display URL (without protocol for cleaner display)
  const getDisplayUrl = (urlString: string): string => {
    return urlString.replace(/^https?:\/\//, '');
  };

  return (
    <div
      className="link-item"
      style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
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
            placeholder="Link title..."
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
            {title || 'Untitled Link'}
          </h4>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
              title="Edit link"
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
            title="Delete link"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* URL field */}
      {internalEditing ? (
        <div style={{ marginBottom: '8px' }}>
          <input
            ref={urlRef}
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            style={{
              width: '100%',
              border: urlError ? '1px solid #ef4444' : '1px solid #d1d5db',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '13px',
              backgroundColor: 'white',
              outline: 'none',
            }}
          />
          {urlError && (
            <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>
              {urlError}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '8px' }}>
          <a
            href={url.startsWith('http') ? url : `https://${url}`}
            onClick={handleLinkClick}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '13px',
              wordBreak: 'break-all',
              display: 'block',
            }}
            title={url}
          >
            🔗 {getDisplayUrl(url)}
          </a>
        </div>
      )}

      {/* Description field */}
      {internalEditing ? (
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a description (optional)..."
          style={{
            width: '100%',
            minHeight: '40px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '13px',
            resize: 'vertical',
            backgroundColor: 'white',
            outline: 'none',
          }}
        />
      ) : (
        description && (
          <div
            style={{
              fontSize: '13px',
              lineHeight: '1.4',
              color: '#6b7280',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: '8px',
            }}
          >
            {description}
          </div>
        )
      )}

      {/* Status indicator */}
      {hasChanges && !isSaving && !urlError && (
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

export default LinkItem; 