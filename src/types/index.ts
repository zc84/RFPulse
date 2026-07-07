export type DealStatus = string;
export type DealDomain = string;
export type DealClassification = 'A' | 'B' | 'C';
export type UserRole = 'Superadmin' | 'Editor' | 'Viewer';

export interface Document {
  id: string;
  name: string;
  size: string;
  filename?: string;
  source?: 'user' | 'ai';
  uploadedAt: string;
  artifactType?: string | null;
  reviewStatus?: 'draft' | 'approved' | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
}

export interface PromptTemplate {
  id: number;
  prompt_key: string;
  agent_slug: string | null;
  name: string;
  kind: 'shared' | 'task';
  content: string;
  prompt_version: number;
}

export interface DealLock {
  userId: string;
  userName: string;
  lockedAt: string;
  lastHeartbeatAt: string;
}

export interface Deal {
  id: string;
  name: string;
  status: DealStatus;
  dueDate: string;
  budget: number | null;
  domain: DealDomain;
  clientName?: string;
  classification?: DealClassification;
  description?: string;
  aiNotes?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  lock?: DealLock | null;
  documents: Document[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  password?: string;
}

export interface PlatformConfigOption {
  id: number;
  type: 'status' | 'domain';
  value: string;
  sort_order: number;
  prompt_version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Agent {
  id: number;
  slug: string;
  name: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  is_enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AIMessage {
  id: number;
  session_id: number;
  role: 'coordinator' | 'user' | 'agent';
  agent_slug?: string;
  content: string;
  created_at?: string;
}

export interface AISession {
  id: number;
  deal_id: number;
  status: 'active' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_agent_plan?: string[] | null;
  extracted_context?: string;
  final_report_document_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface AIAgentOutput {
  agent_slug: string;
  content: string;
}

export interface AIChatMessage {
  id: number;
  deal_id: number;
  role: 'user' | 'agent';
  content: string;
  created_at?: string;
}

export interface AIWorkflowStep {
  id: number;
  session_id: number;
  deal_id: number;
  step_key: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  artifact?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AISessionResponse {
  session: AISession | null;
  messages: AIMessage[];
  agentOutputs?: Record<string, string>;
  workflowSteps?: AIWorkflowStep[];
}

export interface AIStartResponse {
  sessionId: number;
  status: string;
  plan?: string[];
  reasoning?: string;
  messages: AIMessage[];
  extractedDocs: { id: string; name: string; size: string; success: boolean }[];
  hasExistingAiDocs?: boolean;
  aiDocs?: { id: string; name: string }[];
  error?: string;
}

export interface AIMessageResponse {
  sessionId: number;
  status: string;
  messages: AIMessage[];
  finalReportDocumentId?: number;
  wbsDocumentId?: number;
  proposedUpdates?: ProposedDealUpdates;
  agentOutputs?: Record<string, string>;
}

export interface AIValidateRequest {
  userDocumentIds: string[];
  aiDocumentIds: string[];
}

export interface AIValidateResponse {
  documentId: number;
  documentName: string;
  dealId: string;
}

export interface ProposedDealUpdates {
  dueDate?: string | null;
  budget?: number | null;
  clientName?: string | null;
  description?: string | null;
}

export interface GlobalAISettings {
  openai_api_key: string;
  has_key: boolean;
  proposal_template_name?: string;
  proposal_template_uploaded_at?: string | null;
  has_proposal_template?: boolean;
}

export interface OpenAIModel {
  id: string;
  created?: number | null;
  owned_by?: string | null;
}
