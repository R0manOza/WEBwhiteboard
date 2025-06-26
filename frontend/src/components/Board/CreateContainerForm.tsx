// frontend/src/components/Board/CreateContainerForm.tsx
import React, { useState } from 'react';
import type { ContainerPurpose } from '../../../../shared/types'; // Ensure this path is correct for your shared types

interface CreateContainerFormProps {
  boardId: string; // Keep if needed for any local logic, or remove if truly unused by this dumb component
  onCreateSuccess: (formData: { title: string; purpose: ContainerPurpose }) => void; // Parent will make API call
  onCancel?: () => void;
  loading?: boolean; // Prop from parent to indicate API call is in progress
  error?: string | null;   // Prop from parent to display API call errors
}

const CreateContainerForm: React.FC<CreateContainerFormProps> = ({
  // boardId, // You can remove boardId from props if it's not used in this component anymore
  onCreateSuccess,
  onCancel,
  loading = false, // Default to false, controlled by parent
  error = null,    // Default to null, controlled by parent
}) => {
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState<ContainerPurpose>('notes'); // Default purpose

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
       alert('Title is required'); // Simple client-side validation
       // Alternatively, you could have an internal error state for form validation,
       // or the parent could pass down a way to set a form-specific error.
       // For now, alert is the simplest.
       return;
    }

    // Pass the collected form data to the parent component's handler.
    // The parent (BoardViewPage) will be responsible for making the API call.
    onCreateSuccess({ title: title.trim(), purpose });

    // Reset form fields after attempting submission.
    // The parent will manage closing the modal.
    setTitle('');
    setPurpose('notes');
  };

  return (
    <div className="create-container-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="container-title-input">Container Title:</label> {/* Changed id for clarity */}
          <input
            id="container-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter container title..."
            required
            disabled={loading} // Use loading prop from parent
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="container-purpose-select">Purpose:</label> {/* Changed id for clarity */}
          <select
            id="container-purpose-select"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as ContainerPurpose)}
            required
            disabled={loading} // Use loading prop from parent
             style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          >
            <option value="notes">📝 Notes</option>
            <option value="links">🔗 Links</option>
            
          </select>
        </div>

        {/* Display error passed down from parent (API call error) */}
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
            disabled={loading} // Use loading prop from parent
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
              disabled={loading} // Use loading prop from parent
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