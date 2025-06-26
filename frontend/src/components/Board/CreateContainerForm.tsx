import React, { useState } from 'react';
// Import ContainerPurpose type
import type { ContainerPurpose } from '../../../../shared/types';

interface CreateContainerFormProps {
  boardId: string; // The ID of the board the container is for
  // Updated signature to pass form data object
  onCreateSuccess?: (formData: { title: string; purpose: ContainerPurpose }) => void;
  onCancel?: () => void;
  // Added loading and error props for API call feedback
  loading?: boolean;
  error?: string | null;
}

const CreateContainerForm: React.FC<CreateContainerFormProps> = ({
  boardId, // Keep boardId prop if needed for local logic (e.g., default position calc)
  onCreateSuccess,
  onCancel,
  loading = false, // Default to false
  error = null,    // Default to null
}) => {
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState<ContainerPurpose>('notes'); // Use imported type
  // Removed internal loading/error state, now controlled by props from parent


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      // Use parent error state or handle validation visually
      // For now, simple validation message (could improve UI later)
       alert('Title is required');
       return;
    }

    // Call the parent-provided function to handle the actual creation (API call)
    // Pass the necessary form data
    onCreateSuccess?.({ title: title.trim(), purpose });

    // Note: Resetting form fields here is okay. The parent handles closing the modal
    // and displaying loading/error states based on the API call outcome.
    // If you wanted to keep the form open on error, you wouldn't reset here.
    setTitle('');
    setPurpose('notes');
  };

  return (
    <div className="create-container-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="container-title">Container Title:</label>
          <input
            id="container-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter container title..."
            required
            disabled={loading} // Use loading prop
            style={{
              width: '100%', /* Fixed width */
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box', /* Added for padding */
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="container-purpose">Purpose:</label>
          <select
            id="container-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as ContainerPurpose)} // Cast value to type
            required
            disabled={loading} // Use loading prop
             style={{
              width: '100%', /* Fixed width */
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box', /* Added for padding */
            }}
          >
            <option value="notes">📝 Notes</option>
            <option value="links">🔗 Links</option>
          </select>
        </div>

        {/* Display error from parent prop */}
        {error && (
          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
            Error: {error}
          </div>
        )}

        <div className="form-actions" style={{
          display: 'flex',
          gap: '8px',
          marginTop: '16px'
        }}>
          <button
            type="submit"
            disabled={loading} // Use loading prop
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              flex: 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Container'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading} // Use loading prop
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateContainerForm;