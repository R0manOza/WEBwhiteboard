import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface JoinPrivateBoardFormProps {
  boardId: string;
  onSuccessfulJoin: () => void; // Callback to notify parent on success
}

const JoinPrivateBoardForm: React.FC<JoinPrivateBoardFormProps> = ({ boardId, onSuccessfulJoin }) => {
  const { user } = useAuth(); // Get user to include token in headers
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!user || !boardId || loading) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/boards/${boardId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to join board.' }));
        throw new Error(errData.error || errData.message || `Error ${response.status}`);
      }

      console.log('Successfully joined board.');
      // Notify parent component that joining was successful
      onSuccessfulJoin();

    } catch (err: any) {
      console.error('Error joining board:', err);
      setError(err.message || 'Failed to join board. Incorrect password?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin}>
      <div>
        <label htmlFor="private-board-password">Password:</label>
        <input
          id="private-board-password"
          type="password"
          value={password}
          onChange={handleInputChange}
          required
          disabled={loading}
        />
      </div>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <button type="submit" disabled={loading} style={{ marginTop: '10px' }}>
        {loading ? 'Joining...' : 'Join'}
      </button>
    </form>
  );
};

export default JoinPrivateBoardForm;