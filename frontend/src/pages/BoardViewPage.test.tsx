import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import BoardViewPage from './BoardViewPage';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock useSocket
vi.mock('../hooks/useSocket', () => ({
  useSocket: vi.fn(),
}));

describe('BoardViewPage', () => {
  const mockNavigate = vi.fn();
  const SAMPLE_BOARD_ID = 'sample-solo-board';

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
    (useSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ socket: null, isConnected: false });
  });

  it('renders loading state when auth is loading', () => {
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ boardId: SAMPLE_BOARD_ID });
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: true });
    render(<BoardViewPage />);
    expect(screen.getByText(/Loading Board/i)).toBeInTheDocument();
  });

  it('renders error if user is not authenticated', async () => {
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ boardId: 'some-real-board' });
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false });
    render(<BoardViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/You must be logged in to view this board/i)).toBeInTheDocument();
    });
  });

  it('renders access denied if hasAccess is false', async () => {
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ boardId: 'some-board' });
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: { uid: 'user1', getIdToken: vi.fn() }, loading: false });
    // Force hasAccess to false by mocking fetch
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Access Denied' }) });
    render(<BoardViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    });
  });

  it('renders the sample board when boardId is sample-solo-board', () => {
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ boardId: SAMPLE_BOARD_ID });
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: { uid: 'sample-user-id', displayName: 'Sample User', getIdToken: vi.fn() }, loading: false });
    render(<BoardViewPage />);
    expect(screen.getByText(/Sample Solo Board/i)).toBeInTheDocument();
    expect(screen.getByText(/A static board to explore features/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner:/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome!/i)).toBeInTheDocument();
    expect(screen.getByText(/Example Links/i)).toBeInTheDocument();
  });

  // Add more tests for container creation, error states, and mode toggling as needed
}); 