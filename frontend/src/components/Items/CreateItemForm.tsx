import React, { useState } from 'react';
import type { NoteItem, LinkItem } from '../../../../shared/types';

interface CreateItemFormProps {
  containerId: string;
  containerPurpose: 'notes' | 'links';
  onCreateSuccess?: (item: NoteItem | LinkItem) => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
}

const CreateItemForm: React.FC<CreateItemFormProps> = ({
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;

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

    // Create item object
    const baseItem = {
      id: Math.random().toString(36).substr(2, 9), // Temporary ID
      containerId,
      title: title.trim(),
      createdBy: 'current-user', // This should come from auth context
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let newItem: NoteItem | LinkItem;

    if (containerPurpose === 'notes') {
      newItem = {
        ...baseItem,
        content: content.trim(),
        color,
      } as NoteItem;
    } else {
      // For links, add protocol if missing
      let urlToSave = url.trim();
      if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
        urlToSave = 'https://' + urlToSave;
      }
      
      newItem = {
        ...baseItem,
        url: urlToSave,
        description: description.trim(),
      } as LinkItem;
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
  };

  // Handle cancel
  const handleCancel = () => {
    if (loading) return;
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
            disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
                  disabled={loading}
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
        {error && (
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px 12px', 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fecaca', 
            borderRadius: '6px',
            fontSize: '13px',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || (containerPurpose === 'links' && (!!urlError || !url.trim()))}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : `Create ${containerPurpose === 'notes' ? 'Note' : 'Link'}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateItemForm; 