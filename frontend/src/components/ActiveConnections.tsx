import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ActiveConnections.css';

interface ActiveConnectionsProps {
  className?: string;
}

const ActiveConnections: React.FC<ActiveConnectionsProps> = ({ className = '' }) => {
  const [activeConnections, setActiveConnections] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchActiveConnections = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/stats/connections', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active connections');
      }

      const data = await response.json();
      setActiveConnections(data.activeConnections);
    } catch (err) {
      console.error('Error fetching active connections:', err);
      setError('Failed to load active connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveConnections();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveConnections, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <div className={`active-connections ${className}`}>
      <div className="active-connections-content">
        <span className="active-connections-icon">🟢</span>
        <span className="active-connections-text">
          {loading ? (
            'Loading...'
          ) : error ? (
            'Connection info unavailable'
          ) : (
            `${activeConnections || 0} people online`
          )}
        </span>
      </div>
    </div>
  );
};

export default ActiveConnections; 