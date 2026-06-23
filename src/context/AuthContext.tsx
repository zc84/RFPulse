import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole } from '../types';
import { mockUsers } from '../data/mockData';

const SESSION_KEY = 'rfpulse_user_id';
const USERS_KEY = 'rfpulse_users';

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as User[];
  } catch { /* ignore */ }
  return mockUsers;
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(loadUsers);

  const resolveUser = (all: User[]): User | null => {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id ? (all.find(u => u.id === id) ?? null) : null;
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => resolveUser(loadUsers()));

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(r => setTimeout(r, 900));
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) return { success: false, error: 'email_not_found' };
    if (found.password !== password) return { success: false, error: 'wrong_password' };
    sessionStorage.setItem(SESSION_KEY, found.id);
    setCurrentUser(found);
    return { success: true };
  }, [users]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }, []);

  const addUser = useCallback((user: Omit<User, 'id'>) => {
    const newUser: User = { ...user, id: `U-${Date.now()}` };
    setUsers(prev => { const next = [...prev, newUser]; saveUsers(next); return next; });
  }, []);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => { const next = prev.map(u => u.id === id ? { ...u, ...updates } : u); saveUsers(next); return next; });
    setCurrentUser(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => { const next = prev.filter(u => u.id !== id); saveUsers(next); return next; });
  }, []);

  const isRole = useCallback((...roles: UserRole[]) => {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, updateUser, deleteUser, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
