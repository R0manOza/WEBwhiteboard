import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Assuming token needed
import type { ContainerPurpose } from '../../../../shared/types'; // Assuming you'll add this type

// You might want to add ContainerPurpose type to shared/types/index.ts
// export type ContainerPurpose = "links" | "notes";

interface CreateContainerFormProps {
  boardId: string;
  onCreateSuccess?: (container: any) => void; // Optional callback
}

const CreateContainerForm: React.FC<CreateContainerFormProps> = ({ boardId, onCreateSuccess }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState<ContainerPurpose>('notes'); // Default to notes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !boardId || loading) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();

      // Define initial position and size (can be refined later)
      const initialPosition = { x: 50, y: 50 }; // Example starting position
      const initialSize = { width: 250, height: 150 }; // Example starting size

      const response = await fetch(`/api/boards/${boardId}/containers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId, // Include boardId in the payload
          title,
          purpose,
          position: initialPosition,
          size: initialSize,
          // Add other default fields if needed (e.g., style)
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to create container: ${response.status}`);
      }

      console.log('Container created successfully:', responseData);
      // Reset form
      setTitle('');
      setPurpose('notes');
      // Call success callback if provided
      onCreateSuccess?.(responseData);

    } catch (err: any) {
      console.error('Error creating container:', err);
      setError(err.message || 'Failed to create container.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '4px', backgroundColor: '#fff' }}>
      <h3>Create New Container</h3>
      <div>
        <label htmlFor="container-title">Container Title:</label>
        <input
          id="container-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div style={{ marginTop: '10px' }}>
        <label htmlFor="container-purpose">Purpose:</label>
        <select
          id="container-purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as ContainerPurpose)}
          required
          disabled={loading}
        >
          <option value="notes">Notes</option>
          <option value="links">Links</option>
          {/* Add more purposes later */}
        </select>
      </div>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <button type="submit" disabled={loading} style={{ marginTop: '15px' }}>
        {loading ? 'Creating...' : 'Create Container'}
      </button>
    </form>
  );
};

export default CreateContainerForm;