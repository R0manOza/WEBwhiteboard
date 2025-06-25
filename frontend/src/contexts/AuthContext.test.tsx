//import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { UserCredential, User } from 'firebase/auth';

// --- MOCK firebase/auth ---
// Define mocks directly inside the factory function to avoid hoisting issues
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  
  const mockUser = {
    uid: 'test-user-123',
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
  } as unknown as User;

  const mockSignInWithPopup = vi.fn().mockResolvedValue({
    user: mockUser,
  } as UserCredential);

  const mockSignOut = vi.fn();
  
  const mockOnAuthStateChanged = vi.fn((_auth, callback) => {
    callback(null); // Simulate no user logged in initially
    return () => {}; // mock unsubscribe function
  });

  return {
    ...actual,
    signInWithPopup: mockSignInWithPopup,
    signOut: mockSignOut,
    onAuthStateChanged: mockOnAuthStateChanged,
  };
});

// --- MOCK firebase/config ---
vi.mock('../firebase/config', () => ({
  auth: {},
  googleProvider: {},
}));

// --- MOCK fetch ---
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  })
) as any;

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
  });

  it('handles login and logout', async () => {
    const { getByText, getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial state
    expect(getByTestId('user').textContent).toBe('no-user');

    // Trigger login
    getByText('Login').click();

    await waitFor(() => {
      expect(getByTestId('user').textContent).toBe('test-user-123');
    });

    // Trigger logout
    getByText('Logout').click();

    await waitFor(() => {
      expect(getByTestId('user').textContent).toBe('no-user');
    });
  });

  it('handles authentication state changes', async () => {
    // Import the mocked modules to access their functions
    const { onAuthStateChanged } = await import('firebase/auth');
    const mockOnAuthStateChanged = onAuthStateChanged as any;

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Verify onAuthStateChanged was called during initialization
    expect(mockOnAuthStateChanged).toHaveBeenCalled();
    
    // Initial state should show no user
    expect(getByTestId('user').textContent).toBe('no-user');
  });

  it('handles backend verification during login', async () => {
    const { signInWithPopup } = await import('firebase/auth');
    const mockSignInWithPopup = signInWithPopup as any;

    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Trigger login
    getByText('Login').click();

    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken: 'mock-id-token' }),
        })
      );
    });
  });
});