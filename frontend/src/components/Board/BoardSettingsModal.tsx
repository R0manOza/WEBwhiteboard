import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Assuming you need token for fetch
import type { Board } from '../../../../shared/types' 

// Define props for the modal
interface BoardSettingsModalProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({ boardId, isOpen, onClose }) => {
  const { user } = useAuth(); // Get user to include token in headers
  const [boardData, setBoardData] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    visibility: 'public' as 'public' | 'private',
    password: '', // For setting/changing private password
  });

  // Effect to fetch board data when the modal opens
  useEffect(() => {
    if (!isOpen || !boardId || !user) {
        if (!isOpen) {
             // Reset state when closed
             setBoardData(null);
             setLoading(true);
             setSaving(false);
             setError(null);
              setFormState({
                name: '', description: '', visibility: 'public', password: ''
             });
        }
      return; // Don't fetch if modal is closed or missing data
    }

    const fetchBoardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/boards/${boardId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json', // Add if your GET requires it
          },
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Failed to fetch board data.' }));
          throw new Error(errData.message);
        }

        const data: Board = await response.json();
        setBoardData(data);
        // Populate form state with fetched data
        setFormState({
          name: data.name,
          description: data.description || '', // Handle optional description
          visibility: data.visibility,
          password: '', // Never pre-fill password
        });

      } catch (err: any) {
        console.error('Error fetching board data:', err);
        setError(err.message || 'Failed to load board settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoardData();

  }, [isOpen, boardId, user]); // Re-run effect if these change

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSave = async () => {
      if (!user || !boardId || saving || loading) return; // Prevent saving if not ready

      setSaving(true);
      setError(null);

      try {
          const token = await user.getIdToken();
          const { name, description, visibility, password } = formState;

          // Construct payload - only include password if visibility is private AND password is not empty
          const payload: any = { name, description, visibility };
          if (visibility === 'private' && password) {
              payload.password = password;
          }

          const response = await fetch(`/api/boards/${boardId}`, {
              method: 'PUT',
              headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
          });

          if (!response.ok) {
               const errData = await response.json().catch(() => ({ message: 'Failed to save board settings.' }));
               throw new Error(errData.message);
          }

          // Assuming backend responds with updated board or success
          console.log('Board settings saved successfully.');
           // Optionally refetch boardData or rely on WebSocket events (future)
           // For now, just close the modal
          onClose(); // Close modal on success

      } catch (err: any) {
           console.error('Error saving board settings:', err);
           setError(err.message || 'Failed to save settings. Please try again.');
      } finally {
           setSaving(false);
      }
  };


  // Simple modal structure (you'll want more robust modal styling)
  if (!isOpen) return null;

  // Basic modal backdrop
  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Ensure it's on top
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    minWidth: '300px',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflowY: 'auto',
    position: 'relative', // Needed for absolute positioning of loading/error overlays
  };


  return (
    <div style={modalStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}> {/* Prevent clicks inside from closing */}
        <h2>Board Settings: {boardData?.name || boardId}</h2>

        {loading ? (
          <p>Loading settings...</p>
        ) : error && !saving ? ( // Show fetch error only if not currently trying to save
            <p style={{ color: 'red' }}>Error: {error}</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div>
              <label htmlFor="board-name">Board Name:</label>
              <input
                id="board-name"
                name="name"
                type="text"
                value={formState.name}
                onChange={handleInputChange}
                required
                disabled={saving}
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <label htmlFor="board-description">Description:</label>
              <textarea
                id="board-description"
                name="description"
                value={formState.description}
                onChange={handleInputChange}
                disabled={saving}
                rows={3}
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <label htmlFor="board-visibility">Visibility:</label>
              <select
                id="board-visibility"
                name="visibility"
                value={formState.visibility}
                onChange={handleInputChange}
                required
                disabled={saving}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            {/* Conditional Password Field */}
            {formState.visibility === 'private' && (
                 <div style={{ marginTop: '10px' }}>
                   <label htmlFor="board-password">Password (Set/Change):</label>
                   <input
                     id="board-password"
                     name="password"
                     type="password"
                     value={formState.password}
                     onChange={handleInputChange}
                     placeholder="Leave blank to keep current"
                     disabled={saving}
                   />
                   <p><small>Enter a new password to change it, or leave blank.</small></p>
                 </div>
            )}


            {/* Saving indicator */}
            {saving && <p>Saving...</p>}
             {/* Save error (show regardless if saving attempt failed) */}
            {error && saving && <p style={{ color: 'red' }}>Error: {error}</p>}


            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button type="button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" style={{ marginLeft: '10px' }} disabled={saving || loading}>
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BoardSettingsModal;