import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import DashboardPage from './DashboardPage';
import { useAuth } from '../contexts/AuthContext';

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock useNavigate from react-router-dom
vi.mock('react-router-dom', () => {
  const actual = vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('DashboardPage', () => {
  const mockUser = { uid: 'user1', getIdToken: vi.fn().mockResolvedValue('mock-token') };
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as unknown as vi.Mock).mockReturnValue({ user: mockUser });
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('shows loading state initially', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<DashboardPage />);
    expect(screen.getByText(/Loading boards/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('shows error if fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'fail' }) });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    });
  });

  it('shows no boards message if none are returned', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/No boards found/i)).toBeInTheDocument();
    });
  });

  it('shows boards and filters by search', async () => {
    const boards = [
      { id: '1', name: 'Alpha', description: 'First', visibility: 'public' },
      { id: '2', name: 'Beta', description: 'Second', visibility: 'private' },
    ];
    fetchMock.mockResolvedValue({ ok: true, json: async () => boards });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
    // Search for Beta
    fireEvent.change(screen.getByPlaceholderText(/search boards/i), { target: { value: 'Beta' } });
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    // Search for nothing
    fireEvent.change(screen.getByPlaceholderText(/search boards/i), { target: { value: '' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
}); 