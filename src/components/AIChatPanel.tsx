import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User as UserIcon, Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { AIMessage, AIChatMessage, AIWorkflowStep, AISession } from '../types';
import Button from './Button';

interface AIChatPanelProps {
  messages: Array<AIMessage | AIChatMessage>;
  loading: boolean;
  extractedDocs?: { id: string; name: string; size: string; success: boolean }[];
  workflowSteps?: AIWorkflowStep[];
  sessionStatus?: AISession['status'] | null;
  streamStatus?: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  onSend: (content: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

type WorkflowStage = {
  label: string;
  stepKeys: string[];
  detail?: (steps: Map<string, AIWorkflowStep>) => string | null;
};

const EXECUTE_STAGES: WorkflowStage[] = [
  {
    label: 'Documents read',
    stepKeys: ['extracted-context'],
    detail: steps => {
      const docs = steps.get('extracted-context')?.metadata?.documents;
      if (!Array.isArray(docs) || docs.length === 0) return null;
      const readable = docs.filter(doc => doc && typeof doc === 'object' && (doc as { success?: unknown }).success === true).length;
      return `${readable}/${docs.length} readable`;
    },
  },
  {
    label: 'Coordinator plan created',
    stepKeys: ['coordinator-context', 'agent-plan'],
  },
  {
    label: 'Legal & architecture',
    stepKeys: ['legal-brief', 'architect-brief', 'legal', 'architect'],
    detail: steps => formatAgentPairDetail(steps, 'legal', 'architect'),
  },
  {
    label: 'Estimation',
    stepKeys: ['estimator-brief', 'estimator'],
  },
  {
    label: 'Draft package',
    stepKeys: ['copywriter', 'draft-report'],
  },
  {
    label: 'Generate diagrams',
    stepKeys: ['generate-architecture-diagrams'],
  },
  {
    label: 'Save deliverables',
    stepKeys: ['save-wbs-workbook', 'save-final-report'],
  },
];

const VALIDATION_STAGES: WorkflowStage[] = [
  {
    label: 'Client documents read',
    stepKeys: ['validation-client-context'],
  },
  {
    label: 'Supplier package read',
    stepKeys: ['validation-supplier-context'],
  },
  {
    label: 'Validation review',
    stepKeys: ['validation-report'],
  },
  {
    label: 'Save validation report',
    stepKeys: ['save-validation-report'],
  },
];

function formatAgentPairDetail(steps: Map<string, AIWorkflowStep>, first: string, second: string) {
  const firstStatus = formatAgentStatus(steps.get(first)?.status);
  const secondStatus = formatAgentStatus(steps.get(second)?.status);
  if (!firstStatus && !secondStatus) return null;
  return [firstStatus ? `${labelizeStep(first)} ${firstStatus}` : null, secondStatus ? `${labelizeStep(second)} ${secondStatus}` : null]
    .filter(Boolean)
    .join(' · ');
}

function formatAgentStatus(status?: AIWorkflowStep['status']) {
  if (status === 'completed') return 'done';
  if (status === 'running') return 'running';
  if (status === 'failed') return 'failed';
  return null;
}

function labelizeStep(stepKey: string) {
  if (stepKey === 'legal') return 'Legal';
  if (stepKey === 'architect') return 'Architecture';
  return stepKey;
}

function getWorkflowMode(workflowSteps: AIWorkflowStep[]) {
  const latest = [...workflowSteps].sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  })[0];
  const latestKey = latest?.step_key || '';
  if (latestKey.startsWith('validation-') || latestKey === 'save-validation-report') {
    return 'validation';
  }
  return 'execute';
}

function getStageStatus(steps: Map<string, AIWorkflowStep>, stepKeys: string[]) {
  const stageSteps = stepKeys.map(stepKey => steps.get(stepKey)).filter(Boolean) as AIWorkflowStep[];
  if (stageSteps.some(step => step.status === 'failed')) return 'failed';
  if (stepKeys.every(stepKey => steps.get(stepKey)?.status === 'completed')) return 'completed';
  if (stageSteps.some(step => step.status === 'running') || stageSteps.some(step => step.status === 'completed')) return 'running';
  return 'pending';
}

function formatElapsed(workflowSteps: AIWorkflowStep[]) {
  const runningStarts = workflowSteps
    .filter(step => step.status === 'running' && step.started_at)
    .map(step => new Date(step.started_at as string).getTime())
    .filter(Boolean);
  if (runningStarts.length === 0) return null;
  const startedAt = Math.min(...runningStarts);
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function getLastWorkflowUpdate(workflowSteps: AIWorkflowStep[], messages: Array<AIMessage | AIChatMessage>, sessionStatus?: AISession['status'] | null) {
  const timestamps = [
    ...workflowSteps.map(step => step.updated_at || step.completed_at || step.started_at || step.created_at).filter(Boolean),
    ...messages.map(message => message.created_at).filter(Boolean),
  ].map(value => new Date(value as string).getTime()).filter(Boolean);

  if (timestamps.length === 0 || !sessionStatus) return null;
  return Math.max(...timestamps);
}

function formatRelativeTime(timestamp: number | null, now: number) {
  if (!timestamp) return null;
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getStreamBadge(streamStatus: AIChatPanelProps['streamStatus']) {
  if (streamStatus === 'connected') return { label: 'Live', color: '#166534', background: '#F0FDF4', border: '#BBF7D0' };
  if (streamStatus === 'reconnecting') return { label: 'Reconnecting', color: '#92400E', background: '#FFFBEB', border: '#FDE68A' };
  if (streamStatus === 'connecting') return { label: 'Connecting', color: '#1D4ED8', background: '#EFF6FF', border: '#BFDBFE' };
  return { label: 'Offline', color: '#64748B', background: '#F8FAFC', border: '#CBD5E1' };
}

function WorkflowStatusPanel({
  workflowSteps,
  messages,
  sessionStatus,
  streamStatus,
  loading,
}: {
  workflowSteps: AIWorkflowStep[];
  messages: Array<AIMessage | AIChatMessage>;
  sessionStatus?: AISession['status'] | null;
  streamStatus?: AIChatPanelProps['streamStatus'];
  loading: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [showCompletedStages, setShowCompletedStages] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (workflowSteps.length === 0) return null;

  const stepsByKey = new Map(workflowSteps.map(step => [step.step_key, step]));
  const mode = getWorkflowMode(workflowSteps);
  const stages = mode === 'validation' ? VALIDATION_STAGES : EXECUTE_STAGES;
  const failedStep = workflowSteps.find(step => step.status === 'failed');
  const elapsed = formatElapsed(workflowSteps);
  const hasRunningSteps = workflowSteps.some(step => step.status === 'running');
  const lastUpdatedAt = getLastWorkflowUpdate(workflowSteps, messages, sessionStatus);
  const lastUpdatedLabel = formatRelativeTime(lastUpdatedAt, now);
  const runFinished = !hasRunningSteps && !loading;
  const completedStages = stages.filter(stage => getStageStatus(stepsByKey, stage.stepKeys) === 'completed');
  const visibleStages = runFinished && !failedStep && !showCompletedStages
    ? stages.filter(stage => getStageStatus(stepsByKey, stage.stepKeys) !== 'completed').length > 0
      ? stages.filter(stage => getStageStatus(stepsByKey, stage.stepKeys) !== 'completed')
      : stages.slice(-2)
    : stages;
  const streamBadge = getStreamBadge(streamStatus);
  const title = hasRunningSteps || loading
    ? mode === 'validation' ? 'Validation running' : 'Workflow running'
    : mode === 'validation' ? 'Latest validation run' : 'Latest workflow run';

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid #E2E8F0',
      background: '#FCFCFD',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasRunningSteps || loading
            ? <Loader2 size={14} color="#2563EB" style={{ animation: 'spin 0.8s linear infinite' }} />
            : failedStep
              ? <AlertCircle size={14} color="#DC2626" />
              : <CheckCircle size={14} color="#16A34A" />}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: streamBadge.color,
            background: streamBadge.background,
            border: `1px solid ${streamBadge.border}`,
            borderRadius: 999,
            padding: '3px 7px',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
          >
            {streamBadge.label}
          </span>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            {elapsed || (lastUpdatedLabel ? `Updated ${lastUpdatedLabel}` : sessionStatus ? sessionStatus.replace('_', ' ') : '')}
          </div>
        </div>
      </div>

      {runFinished && completedStages.length > 2 && !failedStep && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            {completedStages.length} stages completed
          </div>
          <button
            type="button"
            onClick={() => setShowCompletedStages(prev => !prev)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 11,
              fontWeight: 600,
              color: '#2563EB',
              cursor: 'pointer',
            }}
          >
            {showCompletedStages ? 'Collapse completed' : 'Show full run'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {visibleStages.map(stage => {
          const status = getStageStatus(stepsByKey, stage.stepKeys);
          const detail = stage.detail?.(stepsByKey) || null;
          return (
            <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: status === 'completed' ? '#16A34A' : status === 'running' ? '#2563EB' : status === 'failed' ? '#DC2626' : '#CBD5E1',
              }}
              />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{stage.label}</span>
                {detail && (
                  <span style={{ fontSize: 11, color: '#64748B' }}>{detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {failedStep?.error && (
        <div style={{ fontSize: 11, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>
          {failedStep.error}
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="ai-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({ message }: { message: AIMessage | AIChatMessage }) {
  const isCoordinator = message.role === 'coordinator';
  const isAgent = message.role === 'agent';
  const isUser = message.role === 'user';

  const bubbleStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
  };

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '80%' }}>
          <div style={{ ...bubbleStyle, background: '#2563EB', color: '#fff', borderBottomRightRadius: 4 }}>
            {message.content}
          </div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserIcon size={13} color="#64748B" />
          </div>
        </div>
      </div>
    );
  }

  const bg = isCoordinator ? '#F8FAFC' : '#F0FDF4';
  const borderColor = isCoordinator ? '#E2E8F0' : '#BBF7D0';
  const color = '#0F172A';
  const agentSlug = 'agent_slug' in message ? message.agent_slug : undefined;
  const label = isCoordinator ? 'Coordinator' : agentSlug || 'AI Assistant';

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: '90%' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: isAgent ? '#DCFCE7' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={13} color={isAgent ? '#166534' : '#2563EB'} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>{label}</div>
          <div style={{ ...bubbleStyle, background: bg, color, border: `1px solid ${borderColor}`, borderBottomLeftRadius: 4 }}>
            <MarkdownContent content={message.content} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIChatPanel({
  messages,
  loading,
  extractedDocs,
  workflowSteps = [],
  sessionStatus = null,
  streamStatus = 'offline',
  onSend,
  disabled,
  emptyMessage,
}: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .ai-markdown {
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }
        .ai-markdown > :first-child {
          margin-top: 0;
        }
        .ai-markdown > :last-child {
          margin-bottom: 0;
        }
        .ai-markdown p {
          margin: 0 0 10px;
        }
        .ai-markdown h1,
        .ai-markdown h2,
        .ai-markdown h3 {
          margin: 14px 0 8px;
          color: #0F172A;
          line-height: 1.3;
        }
        .ai-markdown h1 {
          font-size: 17px;
        }
        .ai-markdown h2 {
          font-size: 15px;
        }
        .ai-markdown h3 {
          font-size: 14px;
        }
        .ai-markdown ul,
        .ai-markdown ol {
          margin: 0 0 10px;
          padding-left: 20px;
        }
        .ai-markdown li {
          margin: 3px 0;
        }
        .ai-markdown blockquote {
          margin: 10px 0;
          padding-left: 10px;
          border-left: 3px solid #CBD5E1;
          color: #475569;
        }
        .ai-markdown code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          background: rgba(15, 23, 42, 0.06);
          padding: 1px 4px;
          border-radius: 4px;
        }
        .ai-markdown pre {
          margin: 10px 0;
          padding: 10px;
          background: #0F172A;
          color: #E2E8F0;
          border-radius: 8px;
          overflow-x: auto;
        }
        .ai-markdown pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border-radius: 0;
          font-size: 12px;
        }
        .ai-markdown a {
          color: #2563EB;
          text-decoration: none;
          font-weight: 500;
        }
        .ai-markdown a:hover {
          text-decoration: underline;
        }
        .ai-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 12px;
          display: block;
          overflow-x: auto;
        }
        .ai-markdown th,
        .ai-markdown td {
          border: 1px solid #CBD5E1;
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
        }
        .ai-markdown th {
          background: #F1F5F9;
          font-weight: 600;
        }
      `}</style>
      {/* Extracted docs summary */}
      {extractedDocs && extractedDocs.length > 0 && (
        <div style={{
          padding: '12px 16px', background: '#FAFAFA', borderBottom: '1px solid #E2E8F0',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            <FileText size={14} /> Documents analysed
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {extractedDocs.map(doc => (
              <span key={doc.id} style={{
                fontSize: 11, padding: '4px 8px', borderRadius: 6,
                background: doc.success ? '#F0FDF4' : '#FEF2F2',
                color: doc.success ? '#166534' : '#991B1B',
                border: `1px solid ${doc.success ? '#BBF7D0' : '#FECACA'}`,
              }}>
                {doc.name} {doc.success ? <CheckCircle size={10} style={{ marginLeft: 4, display: 'inline' }} /> : '(unreadable)'}
              </span>
            ))}
          </div>
        </div>
      )}

      <WorkflowStatusPanel workflowSteps={workflowSteps} messages={messages} sessionStatus={sessionStatus} streamStatus={streamStatus} loading={loading} />

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 200 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '32px 0' }}>
            <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>{emptyMessage || 'Press Start to analyse the deal and begin the conversation.'}</p>
          </div>
        )}
        {messages.map((message, index) => (
          <MessageBubble key={`${message.role}-${message.id}-${index}`} message={message} />
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '12px 16px', borderTop: '1px solid #E2E8F0', background: '#fff',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={disabled ? 'Configure OpenAI API key to start' : 'Type your answer…'}
          disabled={disabled || loading}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
            fontSize: 13, outline: 'none', background: disabled ? '#F8FAFC' : '#fff',
          }}
        />
        <Button
          type="submit"
          size="md"
          icon={loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
          disabled={!input.trim() || loading || disabled}
        >
          {loading ? 'Working…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
