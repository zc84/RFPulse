import { User } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('rfpulse_token');
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const error = data?.error || `HTTP ${response.status}`;
    throw new Error(error);
  }

  return data;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }) as Promise<{ user: User; token: string }>,
  me: () =>
    apiFetch('/auth/me') as Promise<User>,
};

export const dealsApi = {
  getAll: () => apiFetch('/deals') as Promise<any[]>,
  getById: (id: string) => apiFetch(`/deals/${id}`),
  create: (deal: any) =>
    apiFetch('/deals', { method: 'POST', body: JSON.stringify(deal) }),
  update: (id: string, updates: any) =>
    apiFetch(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  delete: (id: string) =>
    apiFetch(`/deals/${id}`, { method: 'DELETE' }),
};

export const usersApi = {
  getAll: () => apiFetch('/users') as Promise<User[]>,
  create: (user: any) =>
    apiFetch('/users', { method: 'POST', body: JSON.stringify(user) }),
  update: (id: string, updates: any) =>
    apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  delete: (id: string) =>
    apiFetch(`/users/${id}`, { method: 'DELETE' }),
};
