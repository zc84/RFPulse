import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authApi, usersApi } from '../api';

const TOKEN_KEY = 'rfpulse_token';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  isRole: (...roles: UserRole[]) => boolean;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const user = await authApi.me();
          setCurrentUser(user);
          await loadUsers();
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    };
    init();
  }, [loadUsers]);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { user, token } = await authApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, token);
      setCurrentUser(user);
      await loadUsers();
      return { success: true };
    } catch (err: any) {
      const error = err.message === 'username_not_found' ? 'username_not_found' : 'wrong_password';
      return { success: false, error };
    }
  }, [loadUsers]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
    setUsers([]);
  }, []);

  const addUser = useCallback(async (user: Omit<User, 'id'>) => {
    await usersApi.create(user);
    await loadUsers();
  }, [loadUsers]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    await usersApi.update(id, updates);
    await loadUsers();
    setCurrentUser(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, ...updates };
    });
  }, [loadUsers]);

  const deleteUser = useCallback(async (id: string) => {
    await usersApi.delete(id);
    await loadUsers();
  }, [loadUsers]);

  const isRole = useCallback((...roles: UserRole[]) => {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, users, loading, login, logout, addUser, updateUser, deleteUser, isRole, refreshUsers: loadUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
