import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import './FriendsPage.css';

interface FriendUser {
  uid: string;
  displayName: string;
  photoURL?: string;
}

const FriendsPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket(user?.uid || 'friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<FriendUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendUser[]>([]);
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<FriendUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

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
      fetchFriendsAndRequests();
    };
    // Listen for friend request accepted
    const onAccepted = () => {
      fetchFriendsAndRequests();
    };
    socket.on('friendRequestReceived', onRequest);
    socket.on('friendRequestAccepted', onAccepted);
    return () => {
      socket.off('friendRequestReceived', onRequest);
      socket.off('friendRequestAccepted', onAccepted);
    };
  }, [socket, fetchFriendsAndRequests]);

  // --- ONLINE FRIENDS FUNCTIONALITY ---
  useEffect(() => {
    if (!socket || !user || friends.length === 0) return;
    // Ask backend for online friends
    socket.emit('getOnlineFriends', { friendUids: friends.map(f => f.uid) });
    // Listen for onlineFriends event
    const handleOnlineFriends = (data: { online: string[] }) => {
      setOnlineFriends(friends.filter(f => data.online.includes(f.uid)));
    };
    socket.on('onlineFriends', handleOnlineFriends);
    // Clean up
    return () => {
      socket.off('onlineFriends', handleOnlineFriends);
    };
  }, [socket, user, friends]);

  // Improved search: non-case sensitive and better debouncing
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
        // Filter out current user and apply case-insensitive filtering
        const filteredData = data.filter((u: FriendUser) => 
          u.uid !== user.uid && 
          u.displayName.toLowerCase().includes(addFriendUsername.trim().toLowerCase())
        );
        setUserSearchResults(filteredData);
      } catch (err: any) {
        setSearchError('Failed to search users');
        setUserSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400); // Increased debounce time for better UX
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [addFriendUsername, user]);

  // Add friend handler
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddFriendError(null);
    setAddFriendLoading(true);
    try {
      if (!addFriendUsername.trim()) throw new Error('Enter a username');
      // Try to find the user in the search results for a more robust match
      const selectedUser = userSearchResults.find(u => 
        u.displayName.toLowerCase() === addFriendUsername.trim().toLowerCase()
      );
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
      setUserSearchResults([]);
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

  return (
    <div className="friends-page-container">
      {/* Header Section */}
      <div className="friends-header">
        <h1 className="friends-page-title">Friends</h1>
        <p className="friends-page-subtitle">Connect and collaborate with your friends</p>
      </div>

      {/* Tab Navigation */}
      <div className="friends-tabs">
        <button 
          className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          <span className="tab-icon">👥</span>
          <span className="tab-text">Friends</span>
          {friends.length > 0 && <span className="tab-badge">{friends.length}</span>}
        </button>
        <button 
          className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <span className="tab-icon">📨</span>
          <span className="tab-text">Requests</span>
          {friendRequests.length > 0 && <span className="tab-badge">{friendRequests.length}</span>}
        </button>
        <button 
          className={`friends-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <span className="tab-icon">🔍</span>
          <span className="tab-text">Find Friends</span>
        </button>
      </div>

      {/* Content Sections */}
      <div className="friends-content">
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <div className="friends-section">
            <div className="section-header">
              <h2 className="section-title">My Friends</h2>
              <div className="online-indicator">
                <span className="online-dot"></span>
                <span className="online-text">{onlineFriends.length} online</span>
              </div>
            </div>
            
            {friends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3 className="empty-title">No friends yet</h3>
                <p className="empty-description">
                  Start building your network by finding and adding friends!
                </p>
                <button 
                  className="empty-action-btn"
                  onClick={() => setActiveTab('search')}
                >
                  Find Friends
                </button>
              </div>
            ) : (
              <div className="friends-grid">
                {friends.map(friend => (
                  <div key={friend.uid} className="friend-card">
                    <div className="friend-avatar-container">
                      {friend.photoURL ? (
                        <img src={friend.photoURL} alt={friend.displayName} className="friend-avatar" />
                      ) : (
                        <div className="friend-avatar-placeholder">
                          {friend.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {onlineFriends.some(f => f.uid === friend.uid) && (
                        <span className="friend-online-indicator" title="Online"></span>
                      )}
                    </div>
                    <div className="friend-info">
                      <h3 className="friend-name">{friend.displayName}</h3>
                      <span className="friend-status">
                        {onlineFriends.some(f => f.uid === friend.uid) ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="friends-section">
            <div className="section-header">
              <h2 className="section-title">Friend Requests</h2>
              <span className="section-subtitle">People who want to connect with you</span>
            </div>
            
            {friendRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📨</div>
                <h3 className="empty-title">No pending requests</h3>
                <p className="empty-description">
                  When someone sends you a friend request, it will appear here.
                </p>
              </div>
            ) : (
              <div className="requests-list">
                {friendRequests.map(request => (
                  <div key={request.uid} className="request-card">
                    <div className="request-avatar-container">
                      {request.photoURL ? (
                        <img src={request.photoURL} alt={request.displayName} className="request-avatar" />
                      ) : (
                        <div className="request-avatar-placeholder">
                          {request.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="request-info">
                      <h3 className="request-name">{request.displayName}</h3>
                      <p className="request-message">wants to be your friend</p>
                    </div>
                    <div className="request-actions">
                      <button 
                        className="accept-btn"
                        onClick={() => handleAcceptFriend(request.uid)}
                        disabled={requestsLoading}
                      >
                        {requestsLoading ? 'Accepting...' : 'Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="friends-section">
            <div className="section-header">
              <h2 className="section-title">Find Friends</h2>
              <span className="section-subtitle">Search for users to add as friends</span>
            </div>
            
            <form onSubmit={handleAddFriend} className="search-form">
              <div className="search-input-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by username..."
                  value={addFriendUsername}
                  onChange={e => setAddFriendUsername(e.target.value)}
                  disabled={addFriendLoading}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                />
                <button type="submit" className="search-btn" disabled={addFriendLoading}>
                  {addFriendLoading ? 'Sending...' : 'Add Friend'}
                </button>
              </div>
              
              {addFriendError && (
                <div className="error-message">{addFriendError}</div>
              )}
              
              {/* Search Results */}
              {inputFocused && (userSearchResults.length > 0 || searchLoading || searchError) && (
                <div className="search-results">
                  {searchLoading && (
                    <div className="search-loading">
                      <div className="loading-spinner"></div>
                      <span>Searching...</span>
                    </div>
                  )}
                  
                  {searchError && (
                    <div className="search-error">
                      <span>⚠️</span>
                      <span>{searchError}</span>
                    </div>
                  )}
                  
                  {!searchLoading && !searchError && userSearchResults.length === 0 && addFriendUsername.trim() && (
                    <div className="no-results">
                      <span>🔍</span>
                      <span>No users found matching "{addFriendUsername}"</span>
                    </div>
                  )}
                  
                  {userSearchResults.length > 0 && (
                    <div className="search-results-list">
                      {userSearchResults.map(u => {
                        const alreadyFriend = friends.some(f => f.uid === u.uid);
                        const requestSent = sentRequests.includes(u.uid);
                        return (
                          <div
                            key={u.uid}
                            className={`search-result-item ${alreadyFriend || requestSent ? 'disabled' : ''}`}
                            onClick={() => {
                              if (alreadyFriend || requestSent) return;
                              setAddFriendUsername(u.displayName);
                              setInputFocused(false);
                            }}
                          >
                            <div className="result-avatar-container">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.displayName} className="result-avatar" />
                              ) : (
                                <div className="result-avatar-placeholder">
                                  {u.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="result-info">
                              <span className="result-name">{u.displayName}</span>
                              {alreadyFriend && <span className="result-status already-friend">Already friends</span>}
                              {requestSent && <span className="result-status request-sent">Request sent</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage; 