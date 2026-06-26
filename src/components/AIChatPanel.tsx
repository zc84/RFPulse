import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User as UserIcon, Loader2, FileText, CheckCircle } from 'lucide-react';
import { AIMessage, AIChatMessage } from '../types';
import Button from './Button';

interface AIChatPanelProps {
  messages: Array<AIMessage | AIChatMessage>;
  loading: boolean;
  runningAgents?: string[];
  extractedDocs?: { id: string; name: string; size: string; success: boolean }[];
  onSend: (content: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
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
  runningAgents,
  extractedDocs,
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
  }, [messages, runningAgents]);

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

        {runningAgents && runningAgents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 12, marginTop: 8 }}>
            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
            Running: {runningAgents.join(', ')}…
          </div>
        )}
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
