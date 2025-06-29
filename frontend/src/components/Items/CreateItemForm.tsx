import React, { useState } from 'react';
import type { NoteItem, LinkItem } from '../../../../shared/types';
import itemService from '../../services/itemService';

interface CreateItemFormProps {
  boardId: string;
  containerId: string;
  containerPurpose: 'notes' | 'links';
  onCreateSuccess?: (item: NoteItem | LinkItem) => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
}

const CreateItemForm: React.FC<CreateItemFormProps> = ({
  boardId,
  containerId,
  containerPurpose,
  onCreateSuccess,
  onCancel,
  loading = false,
  error = null,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#fef3c7');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // URL validation function
  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) return false;
    
    try {
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

  // Handle URL change
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    
    if (newUrl.trim()) {
      const isValid = validateUrl(newUrl);
      setUrlError(isValid ? null : 'Please enter a valid URL');
    } else {
      setUrlError(null);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    // Validate required fields
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    if (containerPurpose === 'links' && !url.trim()) {
      alert('URL is required for links');
      return;
    }

    if (containerPurpose === 'links' && urlError) {
      alert('Please enter a valid URL');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let newItem: NoteItem | LinkItem;

      if (containerPurpose === 'notes') {
        newItem = await itemService.createNote(boardId, containerId, title.trim(), content.trim(), color);
      } else {
        // For links, add protocol if missing
        let urlToSave = url.trim();
        if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
          urlToSave = 'https://' + urlToSave;
        }
        
        newItem = await itemService.createLink(boardId, containerId, title.trim(), urlToSave, description.trim());
      }

      // Call success callback
      onCreateSuccess?.(newItem);

      // Reset form
      setTitle('');
      setContent('');
      setUrl('');
      setDescription('');
      setColor('#fef3c7');
      setUrlError(null);
    } catch (error) {
      console.error('[CreateItemForm] Error creating item:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (isSubmitting) return;
    onCancel?.();
  };

  return (
    <div className="create-item-form">
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
        Add New {containerPurpose === 'notes' ? 'Note' : 'Link'}
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Title field */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Enter ${containerPurpose === 'notes' ? 'note' : 'link'} title...`}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              outline: 'none',
            }}
            required
          />
        </div>

        {/* URL field (for links only) */}
        {containerPurpose === 'links' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>
              URL *
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: urlError ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                outline: 'none',
              }}
              required
            />
            {urlError && (
              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                {urlError}
              </div>
            )}
          </div>
        )}

        {/* Content field (for notes only) */}
        {containerPurpose === 'notes' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note content here..."
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {/* Description field (for links only) */}
        {containerPurpose === 'links' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description (optional)..."
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {/* Color picker (for notes only) */}
        {containerPurpose === 'notes' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setColor(colorOption.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: colorOption.value,
                    border: color === colorOption.value ? '2px solid #2563eb' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {(error || submitError) && (
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px 12px', 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fecaca', 
            borderRadius: '6px',
            fontSize: '13px',
            color: '#dc2626'
          }}>
            {submitError || error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (containerPurpose === 'links' && (!!urlError || !url.trim()))}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: isSubmitting ? '#9ca3af' : '#2563eb',
              color: 'white',
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Creating...' : `Create ${containerPurpose === 'notes' ? 'Note' : 'Link'}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateItemForm; 