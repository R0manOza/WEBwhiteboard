import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import '../App.css';

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

  return (
    <section className="friends-section beautiful-friends-section">
      <div className="friends-header-row">
        <h2 className="friends-title">Friends</h2>
      </div>
      {addFriendError && <div className="error-message friend-error-message">{addFriendError}</div>}
      <div className="friends-lists-row">
        <div className="friends-list-card">
          <h3 className="friends-list-title">Online Friends</h3>
          {onlineFriends.length === 0 ? (
            <div className="empty-friends-message">No friends are online right now.</div>
          ) : (
            <ul className="friends-list">
              {onlineFriends.map(friend => (
                <li key={friend.uid} className="friend-list-item online">
                  <span className="online-dot" title="Online"></span>
                  {friend.photoURL && <img src={friend.photoURL} alt={friend.displayName} className="friend-avatar" />}
                  <span className="friend-name">{friend.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="friends-list-card">
          <h3 className="friends-list-title">Your Friends</h3>
          <form onSubmit={handleAddFriend} className="add-friend-form" autoComplete="off">
            <div className="add-friend-input-wrapper">
              <input
                type="text"
                className="add-friend-input"
                placeholder="Add friend by username..."
                value={addFriendUsername}
                onChange={e => setAddFriendUsername(e.target.value)}
                disabled={addFriendLoading}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 150)}
              />
              {/* Autocomplete dropdown */}
              {inputFocused && userSearchResults.length > 0 && (
                <ul className="add-friend-autocomplete">
                  {userSearchResults
                    .filter(u => u.uid !== user?.uid)
                    .map(u => {
                      const alreadyFriend = friends.some(f => f.uid === u.uid);
                      const requestSent = sentRequests.includes(u.uid);
                      let label = '';
                      if (alreadyFriend) label = 'Already friends';
                      else if (requestSent) label = 'Request sent';
                      return (
                        <li
                          key={u.uid}
                          className={`autocomplete-item${alreadyFriend || requestSent ? ' disabled' : ''}`}
                          onMouseDown={() => {
                            if (alreadyFriend || requestSent) return;
                            setAddFriendUsername(u.displayName);
                            setInputFocused(false);
                          }}
                        >
                          {u.photoURL && <img src={u.photoURL} alt={u.displayName} className="autocomplete-avatar" />}
                          <span className="autocomplete-name">{u.displayName}</span>
                          {label && <span className="autocomplete-label">({label})</span>}
                        </li>
                      );
                    })}
                </ul>
              )}
              {searchLoading && <div className="autocomplete-loading">Searching...</div>}
              {searchError && <div className="autocomplete-error">{searchError}</div>}
            </div>
            <button type="submit" className="btn-primary add-friend-btn" disabled={addFriendLoading}>
              {addFriendLoading ? 'Sending...' : 'Add Friend'}
            </button>
          </form>
          {friends.length === 0 ? <div className="friends-empty">No friends yet.</div> : (
            <ul className="friends-list">
              {friends.map(f => (
                <li key={f.uid} className="friend-list-item">
                  {f.photoURL && <img src={f.photoURL} alt={f.displayName} className="friend-avatar" />}
                  <span className="friend-name">{f.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="friends-list-card">
          <h3 className="friends-list-title">Pending Requests</h3>
          {friendRequests.length === 0 ? <div className="friends-empty">No requests.</div> : (
            <ul className="friends-list">
              {friendRequests.map(r => (
                <li key={r.uid} className="friend-list-item">
                  {r.photoURL && <img src={r.photoURL} alt={r.displayName} className="friend-avatar" />}
                  <span className="friend-name">{r.displayName}</span>
                  <button className="btn-primary accept-friend-btn" disabled={requestsLoading} onClick={() => handleAcceptFriend(r.uid)}>
                    Accept
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default FriendsPage; 