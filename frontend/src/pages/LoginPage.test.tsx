import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import LoginPage from './LoginPage';
import { auth } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import type { User, UserCredential, IdTokenResult } from 'firebase/auth';

// --- MOCK NAVIGATION & FIREBASE ---
const mockNavigate = vi.fn();
let onAuthStateChangedCallback: (user: User | null) => void;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../firebase/config', () => ({
  auth: {}, // Mock auth object
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    onAuthStateChangedCallback = callback;
    return vi.fn(); // unsubscribe
  }),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

const { signInWithPopup } = await import('firebase/auth');
const mockSignInWithPopup = signInWithPopup as vi.Mock;

describe('LoginPage', () => {
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('renders the login page correctly', () => {
    render(<LoginPage />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
  });

  it('handles successful Google sign-in and navigates to dashboard', async () => {
    const mockUser = {
      getIdTokenResult: () => Promise.resolve({ token: 'mock-token' } as IdTokenResult),
    } as unknown as User;
    mockSignInWithPopup.mockResolvedValue({ user: mockUser } as UserCredential);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    
    render(<LoginPage />);
    
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));

    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'mock-token' }),
      });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
  
  it('displays an error message if Google sign-in fails', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('Sign-in failed'));
    
    render(<LoginPage />);
    
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Sign-in failed/i)).toBeInTheDocument();
    });
  });

  it('redirects to dashboard if user is already authenticated', () => {
    render(<LoginPage />);
    // Simulate onAuthStateChanged firing with an authenticated user
    act(() => {
      onAuthStateChangedCallback({} as User); // Pass a mock user object
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
}); 