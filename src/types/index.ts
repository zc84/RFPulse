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
  runtime_version?: string | null;
  planner_model?: string | null;
  planner_prompt_version?: number | null;
  workflow_plan_version?: number | null;
  quality_status?: string | null;
  repair_cycle?: number | null;
  artifact_plan?: { artifacts?: Array<{ key?: string; enabled?: boolean }> } | null;
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

export interface AICapability {
  id: number;
  capability_key: string;
  version: number;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  permitted_tools: string[];
  default_model?: string | null;
  concurrency_class?: string | null;
  retry_policy?: Record<string, unknown>;
  requires_human_approval: boolean;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}

export interface AITelemetryResponse {
  session: AISession | null;
  summary: {
    taskCount: number;
    completedCount: number;
    failedCount: number;
    cancelledCount: number;
    runningCount: number;
    retryCount: number;
    totalDurationMs: number;
    qualityStatus: string | null;
    repairCycles: number;
    artifactCount: number;
  } | null;
  tasks: Array<AIWorkflowStep & {
    task_id?: string | null;
    capability_key?: string | null;
    capability_version?: number | null;
    attempt?: number;
    metrics?: Record<string, unknown> | null;
  }>;
  findings: Array<{
    id: number;
    gate_key: string;
    severity: string;
    requirement_id?: number | null;
    issue: string;
    required_fix?: string | null;
    status: string;
    repair_task_id?: string | null;
  }>;
  retrievalSources: Array<{
    source: 'framework' | 'company';
    taskId: string;
    trace: {
      query?: string;
      intents?: string[];
      sourceVersion?: string | null;
      retrievalMode?: string;
      candidates?: AIKnowledgeCandidate[];
      rationale?: Array<{ sectionId: string; rationale: string }>;
    };
  }>;
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

export interface AIRequirementInventorySummary {
  total: number;
  byObligationLevel: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byResponseType: Record<string, number>;
  byCategory: Record<string, number>;
  missingAppendixGapCount: number;
  coveredDocuments: number;
}

export interface AIRequirementInventoryItem {
  id: number;
  session_id: number;
  deal_id: number;
  source_document_id: number | null;
  source_document_name?: string | null;
  source_locator: string | null;
  text: string;
  normalized_text: string;
  category: string;
  obligation_level: string;
  response_type: string;
  priority: string;
  status: string;
  conflict_group: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface AIRequirementInventoryResponse {
  sessionId: number | null;
  count: number;
  summary: AIRequirementInventorySummary;
  strategy: {
    qualification: {
      recommendation: 'go' | 'conditional-go' | 'no-go';
      profile: {
        profile: 'solution-build' | 'service-team' | 'rfi';
        label: string;
        confidence: 'low' | 'medium' | 'high';
        ambiguous: boolean;
        rationale: string;
        mandatoryOverrides: { architecture: boolean; pricing: boolean; wbs: boolean };
      };
      counts: Record<string, number>;
      blockers: string[];
      conditions: string[];
    };
    competitiveness: {
      applicable: boolean;
      verdict: string;
      separateFromCompliance?: boolean;
      missingInputs?: string[];
      reasons: string[];
    };
  };
  requirements: AIRequirementInventoryItem[];
}

export interface AIKnowledgeRetrieveRequest {
  source: 'framework' | 'company';
  queryText: string;
  intents?: string[];
  limit?: number;
  includeRelated?: boolean;
  relatedLimit?: number;
}

export interface AIKnowledgeSection {
  sectionId: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  score?: number;
  reasons?: string[];
  sourceVersion?: string | null;
  tags?: string[];
  rfpQuestions?: string[];
  relatedSections?: string[];
}

export interface AIKnowledgeCandidate {
  sectionId: string;
  title: string;
  score: number;
  reasons: string[];
}

export interface AIKnowledgeRetrieveResult {
  query: string;
  intents: string[];
  sourceVersion: string | null;
  retrievalMode?: string;
  candidates: AIKnowledgeCandidate[];
  sections: AIKnowledgeSection[];
  rationale?: Array<{ sectionId: string; rationale: string }>;
}

export interface AIKnowledgeRetrieveResponse {
  source: 'framework' | 'company';
  retrieval: AIKnowledgeRetrieveResult;
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

export interface AIRuntimeSettings {
  ai_runtime_v2_enabled: boolean;
  ai_runtime_v2_shadow_mode: boolean;
  ai_framework_retrieval_enabled: boolean;
  ai_estimation_policy: {
    version?: number;
    currency?: string;
    defaultRoleRate?: number;
    qaOverheadPercent?: number;
    pmOverheadPercent?: number;
    taskSizing?: { minHours?: number; maxHours?: number; incrementHours?: number };
    contingency?: { highRiskMinimumPercent?: number };
    plausibility?: { maxCapacityMultiplier?: number; minCapacityMultiplier?: number; effortDriftTolerancePercent?: number; minimumDriftHours?: number };
  };
}

export interface OpenAIModel {
  id: string;
  created?: number | null;
  owned_by?: string | null;
}
