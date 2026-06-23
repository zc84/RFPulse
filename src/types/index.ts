export type DealStatus = 'New' | 'In Progress' | 'Won' | 'Lost' | 'TBC';
export type DealDomain = 'Healthcare' | 'Fintech' | 'Retail' | 'Education' | 'Government' | 'Manufacturing' | 'Technology' | 'TBC';
export type UserRole = 'Superadmin' | 'Editor' | 'Viewer';

export interface Document {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
}

export interface Deal {
  id: string;
  name: string;
  status: DealStatus;
  dueDate: string;
  budget: number;
  domain: DealDomain;
  description?: string;
  documents: Document[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
}
