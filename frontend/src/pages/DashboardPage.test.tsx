/// <reference types="vitest" />
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
  const mockUser = { 
    uid: 'user1', 
    displayName: 'Current User',
    getIdToken: vi.fn().mockResolvedValue('mock-token') 
  };
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
      { id: '1', name: 'Alpha', description: 'First', visibility: 'public', ownerId: 'owner1' },
      { id: '2', name: 'Beta', description: 'Second', visibility: 'private', ownerId: 'owner2' },
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

  it('displays owner names instead of IDs', async () => {
    const boards = [
      { id: '1', name: 'Alpha', description: 'First', visibility: 'public', ownerId: 'owner1' },
      { id: '2', name: 'Beta', description: 'Second', visibility: 'private', ownerId: 'user1' }, // Current user
    ];
    
    // Mock the boards fetch
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => boards })
      // Mock the userInfo fetch for owner1
      .mockResolvedValueOnce({ ok: true, json: async () => ({ displayName: 'John Doe' }) })
      // Mock the userInfo fetch for user1 (current user)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ displayName: 'Current User' }) });
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
    
    // Check that owner names are displayed
    await waitFor(() => {
      expect(screen.getByText(/Owner: John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Owner: Me/)).toBeInTheDocument(); // Current user should show as "Me"
    });
  });

  it('shows "Unknown" for owners that cannot be fetched', async () => {
    const boards = [
      { id: '1', name: 'Alpha', description: 'First', visibility: 'public', ownerId: 'unknown-owner' },
    ];
    
    // Mock the boards fetch
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => boards })
      // Mock the userInfo fetch to fail
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'User not found' }) });
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
    
    // Check that "Unknown" is displayed for failed owner fetch
    await waitFor(() => {
      expect(screen.getByText(/Owner: Unknown/)).toBeInTheDocument();
    });
  });
}); 