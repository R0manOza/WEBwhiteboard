import React, { useState, useEffect , useMemo } from "react";
import { Link, useNavigate } from "react-router-dom"; // Import useNavigate for redirect
import { useAuth } from "../contexts/AuthContext"; // Import useAuth
import "./DashboardPage.css"; // Add this for custom styles

// Define a basic type for a board based on your shared types
interface SimpleBoard {
  id: string;
  name: string;
  description?: string;
  visibility?: string;
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
  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "public",
  });
  const navigate = useNavigate();
  const [editBoard, setEditBoard] = useState<SimpleBoard | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    visibility: "public",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null); // board id being deleted

  useEffect(() => {
    const fetchBoards = async () => {
      if (!user) return;
      const token = await user.getIdToken();
      try {
        const response = await fetch(`/api/boards`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Unknown error" }));
          throw new Error(
            `Failed to fetch boards: ${response.status} ${response.statusText} - ${errorData.message}`
          );
        }
        const data = await response.json();
        setBoards(data);
      } catch (err: any) {
        setError(err.message || "Failed to load boards.");
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchBoards();
  }, [user]);

  // This is a test to see if the user is authenticated
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token) => {
        console.log("Your Firebase ID token:", token);
      });
    }
  }, [user]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          visibility: form.visibility,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create board");
      setShowCreateModal(false);
      setForm({ name: "", description: "", visibility: "public" });
      // Refresh board list
      setBoards((prev) => [...prev, data]);
      // Optionally redirect to the new board
      navigate(`/board/${data.id}`);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create board");
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit handlers
  const openEditModal = (board: SimpleBoard) => {
    setEditBoard(board);
    setEditForm({
      name: board.name,
      description: board.description || "",
      visibility: board.visibility || "public",
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
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update board");
      setBoards((prev) =>
        prev.map((b) => (b.id === data.id ? { ...b, ...data } : b))
      );
      closeEditModal();
    } catch (err: any) {
      setEditError(err.message || "Failed to update board");
    } finally {
      setEditLoading(false);
    }
  };

  // Delete handler
  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm("Are you sure you want to delete this board?")) return;
    if (!user) return;
    setDeleteLoading(boardId);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/boards/${boardId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete board");
      }
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    } catch (err: any) {
      alert(err.message || "Failed to delete board");
    } finally {
      setDeleteLoading(null);
    }
  };
  const filteredBoards = useMemo(() => {
  if (!searchTerm.trim()) {
    return boards; 
  }
  const lowercasedSearchTerm = searchTerm.toLowerCase();
  return boards.filter(board =>
    (board.name.toLowerCase().includes(lowercasedSearchTerm)) ||
    (board.description && board.description.toLowerCase().includes(lowercasedSearchTerm))
    
  );
}, [boards, searchTerm]); 

  // Render logic based on state
  return (
    <div className="page dashboard-page">
      {" "}
      {/* Use existing CSS class */}
      <h1>Your Boards</h1>
      <div className="dashboard-actions" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="Search boards by name or description..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ padding: '0.5rem', fontSize: '1rem', width: '300px', marginRight: '1rem' }}
      />
      </div>
      <button
        className="create-board-btn"
        onClick={() => setShowCreateModal(true)}
        style={{ marginBottom: "1rem" }}
      >
        Create Board
      </button>
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleCreateBoard}
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              minWidth: 300,
            }}
          >
            <h2>Create Board</h2>
            <div>
              <label>Board Name:</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                disabled={createLoading}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Description:</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={createLoading}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Visibility:</label>
              <select
                value={form.visibility}
                onChange={(e) =>
                  setForm((f) => ({ ...f, visibility: e.target.value }))
                }
                disabled={createLoading}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            {createError && <p style={{ color: "red" }}>{createError}</p>}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button type="submit" disabled={createLoading}>
                {createLoading ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {editBoard && (
        <div className="modal-overlay">
          <form onSubmit={handleEditBoard} className="modal-form">
            <h2>Edit Board</h2>
            <div>
              <label>Board Name:</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                disabled={editLoading}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Description:</label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={editLoading}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Visibility:</label>
              <select
                value={editForm.visibility}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, visibility: e.target.value }))
                }
                disabled={editLoading}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            {editError && <p style={{ color: "red" }}>{editError}</p>}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button type="submit" disabled={editLoading}>
                {editLoading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editLoading}
              >
                Cancel
              </button>
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
                  <button
                    className="edit-btn"
                    onClick={() => openEditModal(board)}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteBoard(board.id)}
                    disabled={deleteLoading === board.id}
                  >
                    {deleteLoading === board.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
              <div className="board-card-body">
                <div className="board-description">{board.description}</div>
                <div className="board-visibility">
                  Visibility: {board.visibility}
                </div>
              </div>
              <button
                className="open-btn"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                Open Board
              </button>
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
