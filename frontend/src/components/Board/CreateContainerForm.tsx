import React, { useState } from 'react';
import type { ContainerPurpose } from '../../../../shared/types';
import { useAuth } from '../../contexts/AuthContext';
interface CreateContainerFormProps {
  boardId: string;
  onCreateSuccess?: (container: any) => void;
  onCancel?: () => void;
}

const CreateContainerForm: React.FC<CreateContainerFormProps> = ({ 
  boardId, 
  onCreateSuccess, 
  onCancel 
}) => {
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState<ContainerPurpose>('notes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!user) {
      setError('You must be logged in to create a container.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // For now, we'll create a container with default position and size
      // Later we'll integrate with the backend 
      // already am doing it brother 
      const token = await user.getIdToken(); // Get the Firebase ID token
      // Data to send to the backend

      const containerDataForBackend = {
        name: title.trim(), // Backend expects 'name'
        type: purpose,      // Backend expects 'type'
        position: { x: Math.floor(Math.random() * 500) + 50, y: Math.floor(Math.random() * 200) + 50 }, // Random initial position
        size: {
          width: 300,
          height: purpose === 'links' ? 300 : 200
        }
      };
      console.log('[CreateContainerForm] Sending to backend:', `/api/boards/${boardId}/containers`, containerDataForBackend);
      console.log('[CreateContainerForm] Data being sent to backend:', containerDataForBackend);
      const response = await fetch(`/api/boards/${boardId}/containers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(containerDataForBackend),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to create container: ${response.status}`);
      }
      console.log('[CreateContainerForm] Container created successfully by backend:', responseData);
      onCreateSuccess?.(responseData as ContainerPurpose);
      setTitle('');
      setPurpose('notes');
    } catch (err: any) {
      console.error('[CreateContainerForm] Error:', err);
      setError(err.message || 'Failed to create container');
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="container-purpose">Purpose:</label>
          <select
            id="container-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as ContainerPurpose)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          >
            <option value="notes">📝 Notes</option>
            <option value="links">🔗 Links</option>
          </select>
        </div>

        {error && (
          <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
            {error}
          </div>
        )}

        <div className="form-actions" style={{ 
          display: 'flex', 
          gap: '8px', 
          marginTop: '16px' 
        }}>
          <button
            type="submit"
            disabled={loading}
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
              disabled={loading}
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