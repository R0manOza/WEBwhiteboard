import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate for redirect
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import './DashboardPage.css'; // Add this for custom styles
import { useSocket } from '../hooks/useSocket';


// Define a basic type for a board based on your shared types
interface SimpleBoard {
  id: string;
  name: string;
  description?: string;
  visibility?: string;
  ownerId: string;
}

// Add interface for owner names mapping
interface OwnerNames {
  [ownerId: string]: string;
}

// Add types for friends
interface FriendUser {
  uid: string;
  displayName: string;
  photoURL?: string;
}

function DashboardPage() {
  const [boards, setBoards] = useState<SimpleBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState(''); // New state for the search term
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', visibility: 'public' });
  const navigate = useNavigate();
  const [editBoard, setEditBoard] = useState<SimpleBoard | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', visibility: 'public' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null); // board id being deleted
  const [boardFilter, setBoardFilter] = useState<'all' | 'public' | 'private'>('all');
  const [ownerNames, setOwnerNames] = useState<OwnerNames>({}); // New state for owner names
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendUser[]>([]);
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const { socket } = useSocket(user?.uid || 'dashboard');
  const [userSearchResults, setUserSearchResults] = useState<FriendUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);

  const fetchOwnerNames = useCallback(async (boardsData: SimpleBoard[], token: string) => {
    console.log('🔍 fetchOwnerNames called with boards:', boardsData);
    const uniqueOwnerIds = [...new Set(boardsData.map(board => board.ownerId))];
    console.log('🔍 Unique owner IDs:', uniqueOwnerIds);
    const ownerNamesMap: OwnerNames = {};
    
    // Fetch owner names for each unique owner ID
    for (const ownerId of uniqueOwnerIds) {
      try {
        console.log(`🔍 Processing owner ID: ${ownerId}, current user UID: ${user?.uid}`);
        // If it's the current user, use their display name
        if (ownerId === user?.uid) {
          ownerNamesMap[ownerId] = user.displayName || 'Me';
          console.log(`🔍 Current user board - setting to: ${ownerNamesMap[ownerId]}`);
        } else {
          console.log(`🔍 Fetching user info for UID: ${ownerId}`);
          const response = await fetch(`/api/auth/userInfo?uid=${ownerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const userInfo = await response.json();
            ownerNamesMap[ownerId] = userInfo.displayName || 'Unknown';
            console.log(`🔍 Fetched user info for ${ownerId}:`, userInfo);
            console.log(`🔍 Setting display name to: ${ownerNamesMap[ownerId]}`);
          } else {
            ownerNamesMap[ownerId] = 'Unknown';
            console.log(`🔍 Failed to fetch user info for ${ownerId}, setting to Unknown`);
          }
        }
      } catch (error) {
        console.error(`🔍 Failed to fetch owner name for ${ownerId}:`, error);
        ownerNamesMap[ownerId] = 'Unknown';
      }
    }
    
    console.log('🔍 Final owner names map:', ownerNamesMap);
    setOwnerNames(ownerNamesMap);
  }, [user]);

  useEffect(() => {
    const fetchBoards = async () => {
      if (!user) return;
      const token = await user.getIdToken();
      try {
        const response = await fetch(`/api/boards`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(`Failed to fetch boards: ${response.status} ${response.statusText} - ${errorData.message}`);
        }
        const data = await response.json();
        setBoards(data);
        
        // Fetch owner names for all boards
        await fetchOwnerNames(data, token);
      } catch (err: any) {
        setError(err.message || 'Failed to load boards.');
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchBoards();
  }, [user, fetchOwnerNames]);

  // This is a test to see if the user is authenticated
  useEffect(() => {
    if (user) {
      user.getIdToken().then(token => {
        console.log("Your Firebase ID token:", token);
      });
    }
  }, [user]);

  // Helper function to get owner display name
  const getOwnerDisplayName = useCallback((ownerId: string): string => {
    console.log(`🎯 getOwnerDisplayName called for ownerId: ${ownerId}`);
    console.log(`🎯 Current user UID: ${user?.uid}`);
    console.log(`🎯 Current ownerNames state:`, ownerNames);
    
    if (ownerId === user?.uid) {
      const result = user.displayName || 'Me';
      console.log(`🎯 Current user board - returning: ${result}`);
      return result;
    }
    const result = ownerNames[ownerId] || 'Unknown';
    console.log(`🎯 Other user board - returning: ${result}`);
    return result;
  }, [user, ownerNames]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          visibility: form.visibility,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create board');
      setShowCreateModal(false);
      setForm({ name: '', description: '', visibility: 'public' });
      // Refresh board list
      setBoards(prev => [...prev, data]);
      // Fetch owner names for the new board
      await fetchOwnerNames([data], token);
      // Optionally redirect to the new board
      navigate(`/board/${data.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create board');
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit handlers
  const openEditModal = (board: SimpleBoard) => {
    setEditBoard(board);
    setEditForm({
      name: board.name,
      description: board.description || '',
      visibility: board.visibility || 'public',
    });
    setEditError(null);
  };
  const closeEditModal = () => {
    setEditBoard(null);
    setEditError(null);
  };
  const handleEditBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editBoard) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/boards/${editBoard.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update board');
      setBoards(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
      closeEditModal();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update board');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete handler
  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm('Are you sure you want to delete this board?')) return;
    if (!user) return;
    setDeleteLoading(boardId);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete board');
      }
      setBoards(prev => prev.filter(b => b.id !== boardId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete board');
    } finally {
      setDeleteLoading(null);
    }
  };
  const filteredBoards = useMemo(() => {
    let filtered = boards;
    if (boardFilter === 'public') {
      filtered = filtered.filter(board => board.visibility === 'public');
    } else if (boardFilter === 'private') {
      filtered = filtered.filter(board => board.visibility === 'private');
    }
    if (!searchTerm.trim()) {
      return filtered;
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return filtered.filter(board =>
      (board.name.toLowerCase().includes(lowercasedSearchTerm)) ||
      (board.description && board.description.toLowerCase().includes(lowercasedSearchTerm))
    );
  }, [boards, searchTerm, boardFilter]);

  // Fetch friends and requests
  const fetchFriendsAndRequests = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch('/api/friends/list', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/friends/requests', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (friendsRes.ok) setFriends(await friendsRes.json());
      if (requestsRes.ok) setFriendRequests(await requestsRes.json());
      // Fetch sentRequests from user info
      const userInfoRes = await fetch(`/api/auth/userInfo?uid=${user.uid}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        setSentRequests(userInfo.sentRequests || []);
      } else {
        setSentRequests([]);
      }
    } catch (err) {
      // ignore
    }
  }, [user]);

  useEffect(() => { if (user) fetchFriendsAndRequests(); }, [user, fetchFriendsAndRequests]);

  // Use socket for real-time friend updates
  useEffect(() => {
    if (!socket) return;
    // Listen for friend request received
    const onRequest = () => {
      console.log('Received friendRequestReceived event');
      fetchFriendsAndRequests();
    };
    // Listen for friend request accepted
    const onAccepted = () => {
      console.log('Received friendRequestAccepted event');
      fetchFriendsAndRequests();
    };
    socket.on('friendRequestReceived', onRequest);
    socket.on('friendRequestAccepted', onAccepted);
    return () => {
      socket.off('friendRequestReceived', onRequest);
      socket.off('friendRequestAccepted', onAccepted);
    };
  }, [socket, fetchFriendsAndRequests]);

  // Autocomplete: search users as you type
  useEffect(() => {
    if (!addFriendUsername.trim()) {
      setUserSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch(`/api/auth/users/search?query=${encodeURIComponent(addFriendUsername.trim())}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to search users');
        const data = await res.json();
        setUserSearchResults(data);
      } catch (err: any) {
        setSearchError('Failed to search users');
        setUserSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300); // debounce
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [addFriendUsername, user]);

  // Debug logs for friends and search
  useEffect(() => {
    if (inputFocused && userSearchResults.length > 0) {
      console.log('My UID:', user?.uid);
      console.log('Friends:', friends.map(f => f.uid));
      userSearchResults.forEach(u => {
        console.log('Search user:', u.uid, u.displayName);
      });
    }
  }, [inputFocused, userSearchResults, user, friends]);

  // Add friend handler
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddFriendError(null);
    setAddFriendLoading(true);
    try {
      if (!addFriendUsername.trim()) throw new Error('Enter a username');
      // Try to find the user in the search results for a more robust match
      const selectedUser = userSearchResults.find(u => u.displayName.toLowerCase() === addFriendUsername.trim().toLowerCase());
      const usernameToSend = selectedUser ? selectedUser.displayName : addFriendUsername.trim();
      const token = await user.getIdToken();
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameToSend })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send request');
      setAddFriendUsername('');
      fetchFriendsAndRequests();
    } catch (err: any) {
      setAddFriendError(err.message || 'Failed to send request');
    } finally {
      setAddFriendLoading(false);
    }
  };

  // Accept friend handler
  const handleAcceptFriend = async (fromUid: string) => {
    if (!user) return;
    setRequestsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUid })
      });
      if (!res.ok) throw new Error('Failed to accept request');
      fetchFriendsAndRequests();
    } catch (err) {
      // ignore
    } finally {
      setRequestsLoading(false);
    }
  };

  // Render logic based on state
  return (
    <div className="page dashboard-page"> {/* Use existing CSS class */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Your Boards</h1>
        <button
          className="create-board-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <svg className="create-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Create Board
        </button>
      </div>

      <div className="search-container">
        <div className="search-wrapper">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search boards by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Board Filter Buttons */}
      <div className="board-filter-container">
        <button
          className={`board-filter-btn${boardFilter === 'all' ? ' active' : ''}`}
          onClick={() => setBoardFilter('all')}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/></svg>
          All
        </button>
        <button
          className={`board-filter-btn${boardFilter === 'public' ? ' active' : ''}`}
          onClick={() => setBoardFilter('public')}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10C22 6.477 17.523 2 12 2Zm0 0v20M2 12h20" stroke="currentColor" strokeWidth="2"/></svg>
          Public
        </button>
        <button
          className={`board-filter-btn${boardFilter === 'private' ? ' active' : ''}`}
          onClick={() => setBoardFilter('private')}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2"/></svg>
          Private
        </button>
      </div>

      <div className="dashboard-actions" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      </div>

      {showCreateModal && (
        <div
          className="modal-overlay create-modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className="modal-container create-modal">
            <div className="modal-header">
              <div className="modal-title-section">
                <div className="modal-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 1V5M8 1V5M3 9H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="modal-title">Create New Board</h2>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
                type="button"
                disabled={createLoading}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="red" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="16" height="16" fill="red"/>
                </svg>
                <span style={{color: '#fff', fontWeight: 'bold', fontSize: '18px', position: 'absolute'}}>X</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateBoard} className="modal-form-content">
              <div className="form-group">
                <label className="form-label">
                  <svg className="label-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Board Name
                </label>
                <input 
                  type="text" 
                  className="form-input"
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  required 
                  disabled={createLoading}
                  placeholder="Enter board name..."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <svg className="label-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Description
                </label>
                <textarea 
                  className="form-textarea"
                  value={form.description} 
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                  disabled={createLoading}
                  placeholder="Describe your board (optional)..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <svg className="label-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Visibility
                </label>
                <select 
                  className="form-select"
                  value={form.visibility} 
                  onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} 
                  disabled={createLoading}
                >
                  <option value="public">🌍 Public - Anyone can view</option>
                  <option value="private">🔒 Private - Only you and invited members</option>
                </select>
              </div>
              
              {createError && (
                <div className="error-message">
                  <svg className="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {createError}
                </div>
              )}
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)} 
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <>
                      <svg className="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Create Board
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editBoard && (
        <div className="modal-overlay">
          <form onSubmit={handleEditBoard} className="modal-form">
            <h2>Edit Board</h2>
            <div>
              <label>Board Name:</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required disabled={editLoading} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Description:</label>
              <input type="text" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} disabled={editLoading} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Visibility:</label>
              <select value={editForm.visibility} onChange={e => setEditForm(f => ({ ...f, visibility: e.target.value }))} disabled={editLoading}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            {editError && <p style={{ color: 'red' }}>{editError}</p>}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button type="submit" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={closeEditModal} disabled={editLoading}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading && <p>Loading boards...</p>}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!loading && !error && (
      <>
        {/* Case 1: No boards fetched initially AND no search term active */}
        {boards.length === 0 && !searchTerm.trim() && (
          <p>No boards found. Create one!</p>
        )}
        {/* Case 2: No boards match the search term */}
        {boards.length > 0 && filteredBoards.length === 0 && searchTerm.trim() && (
          <p>No boards match your search term "{searchTerm}".</p>
        )}
        {/* Case 3: There are boards to display (either all boards, or filtered results) */}
       {filteredBoards.length > 0 &&(

        <div className="board-list-cards">
          {filteredBoards.map((board) =>  (
            <div className="board-card" key={board.id}>
              <div className="board-card-header">
                <span className="board-title">{board.name}</span>
                <div className="board-card-actions">
                  <button className="edit-btn" onClick={() => openEditModal(board)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDeleteBoard(board.id)} disabled={deleteLoading === board.id}>{deleteLoading === board.id ? 'Deleting...' : 'Delete'}</button>
                </div>
              </div>
              <div className="board-card-body">
                <div className="board-description">{board.description}</div>
                <div className="board-owner"><b>Owner:</b> {getOwnerDisplayName(board.ownerId)}</div>
                <div className="board-visibility">Visibility: {board.visibility}</div>
              </div>
              <button className="open-btn" onClick={() => navigate(`/board/${board.id}`)}>Open Board</button>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default DashboardPage;