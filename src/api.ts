import { User, Agent, GlobalAISettings, AIMessage, AIStartResponse, AIMessageResponse, AISessionResponse, AIChatMessage } from './types';

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
  login: (username: string, password: string) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
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
  uploadDocuments: (dealId: string, files: File[], source: 'user' | 'ai' = 'user') => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('source', source);
    const token = getToken();
    return fetch(`${API_BASE_URL}/deals/${dealId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    });
  },
  downloadDocument: async (docId: string, filename: string) => {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}/deals/documents/${docId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  },
  deleteDocument: (docId: string) =>
    apiFetch(`/deals/documents/${docId}`, { method: 'DELETE' }),
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

export const agentsApi = {
  getAll: () => apiFetch('/ai/agents') as Promise<Agent[]>,
  getBySlug: (slug: string) => apiFetch(`/ai/agents/${slug}`) as Promise<Agent>,
  update: (slug: string, updates: Partial<Agent>) =>
    apiFetch(`/ai/agents/${slug}`, { method: 'PUT', body: JSON.stringify(updates) }) as Promise<Agent>,
  getSettings: () => apiFetch('/ai/agents/settings') as Promise<GlobalAISettings>,
  updateSettings: (settings: { openai_api_key: string }) =>
    apiFetch('/ai/agents/settings', { method: 'POST', body: JSON.stringify(settings) }) as Promise<GlobalAISettings>,
  validateKey: () => apiFetch('/ai/agents/validate') as Promise<{ valid: boolean; error: string | null }>,
};

export const aiApi = {
  start: (dealId: string, force = false) =>
    apiFetch(`/deals/${dealId}/ai/start`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }) as Promise<AIStartResponse>,
  sendMessage: (dealId: string, content: string) =>
    apiFetch(`/deals/${dealId}/ai/message`, { method: 'POST', body: JSON.stringify({ content }) }) as Promise<AIMessageResponse>,
  getSession: (dealId: string) =>
    apiFetch(`/deals/${dealId}/ai/session`) as Promise<AISessionResponse>,
  getChat: (dealId: string) =>
    apiFetch(`/deals/${dealId}/ai/chat`) as Promise<{ messages: AIChatMessage[] }>,
  sendChat: (dealId: string, content: string) =>
    apiFetch(`/deals/${dealId}/ai/chat`, { method: 'POST', body: JSON.stringify({ content }) }) as Promise<{ messages: AIChatMessage[] }>,
};

export interface AIDemoStartResponse {
  sessionId: number;
  status: string;
  plan?: string[];
  reasoning?: string;
  messages: AIMessage[];
  extractedDocs: { id: string; name: string; size: string; success: boolean }[];
}

export interface AIDemoMessageResponse {
  sessionId: number;
  status: string;
  messages: AIMessage[];
  agentOutputs?: Record<string, string>;
  finalReport?: string;
}

export const debugApi = {
  startAIDemo: () =>
    apiFetch('/debug/ai-demo/start', { method: 'POST' }) as Promise<AIDemoStartResponse>,
  sendDemoMessage: (content: string) =>
    apiFetch('/debug/ai-demo/message', { method: 'POST', body: JSON.stringify({ content }) }) as Promise<AIDemoMessageResponse>,
  getDemoSession: () =>
    apiFetch('/debug/ai-demo/session') as Promise<AISessionResponse>,
};
