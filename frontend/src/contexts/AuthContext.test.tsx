import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { User, UserCredential } from 'firebase/auth';

// A stable, mockable representation of the auth state listener
const mockAuthListener = {
  callback: (user: User | null) => {},
  trigger: (user: User | null) => {
    act(() => {
      mockAuthListener.callback(user);
    });
  },
};

const mockUser = {
    uid: 'test-user-123',
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
} as unknown as User;

// --- MOCK firebase/auth ---
vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn((_auth, callback) => {
      mockAuthListener.callback = callback;
      return vi.fn(); // Return mock unsubscribe
    }),
    signOut: vi.fn(() => {
      // The component's logout function calls this.
      // This mock will then trigger the listener to simulate the auth state changing.
      mockAuthListener.trigger(null);
      return Promise.resolve();
    }),
    signInWithPopup: vi.fn(() => {
        // This is not called by the provider directly, but by tests to simulate a login event.
        return Promise.resolve({ user: mockUser } as UserCredential);
    }),
    GoogleAuthProvider: vi.fn(),
}));


// --- MOCK firebase/config ---
vi.mock('../firebase/config', () => ({
  auth: {},
}));

// --- MOCK fetch ---
const mockFetch = vi.fn();
global.fetch = mockFetch;

// --- TEST COMPONENT ---
const TestComponent = () => {
  const { user, login, logout, loading } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.uid : 'no-user'}</div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);
  });

  it('initializes with a loading state, then shows no user', async () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    
    // Initially, it's loading
    expect(screen.getByTestId('loading').textContent).toBe('true');
    
    // Trigger the initial "no user" state from the listener
    mockAuthListener.trigger(null);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
  });

  it('handles user login and sets user state after backend verification', async () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    
    // Trigger the auth state change to a new user
    mockAuthListener.trigger(mockUser);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.any(Object));
      expect(screen.getByTestId('user').textContent).toBe('test-user-123');
    });
  });

  it('handles user logout and clears user state', async () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    
    // 1. Log in first
    mockAuthListener.trigger(mockUser);
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('test-user-123');
    });

    // 2. Trigger logout by clicking the button
    await act(async () => {
      screen.getByText('Logout').click();
    });

    // The click calls the component's logout > which calls the mocked signOut > which triggers the listener
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
  });

  it('signs out user if backend verification fails', async () => {
    mockFetch.mockResolvedValue({
        ok: false,
    } as Response);

    render(<AuthProvider><TestComponent /></AuthProvider>);
    
    // Trigger login, which will now fail verification
    mockAuthListener.trigger(mockUser);

    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.any(Object));
        expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
  });
});