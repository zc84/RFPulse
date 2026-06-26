import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, Play, FileText, Download } from 'lucide-react';
import { debugApi } from '../api';
import { AIMessage } from '../types';
import Header from '../components/Header';
import Button from '../components/Button';
import AIChatPanel from '../components/AIChatPanel';

export default function AIDebugPage() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [extractedDocs, setExtractedDocs] = useState<{ id: string; name: string; size: string; success: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningAgents, setRunningAgents] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadDemo = async () => {
    setLoading(true);
    try {
      const data = await debugApi.startAIDemo();
      setMessages(data.messages);
      setExtractedDocs(data.extractedDocs);
      setFinalReport(null);
      if (data.status === 'routing' && data.plan?.length) {
        setRunningAgents(data.plan);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load AI demo');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    setLoading(true);
    setRunningAgents([]);
    try {
      const data = await debugApi.sendDemoMessage(content);
      setMessages(prev => [...prev, ...data.messages]);
      if (data.agentOutputs && Object.keys(data.agentOutputs).length > 0) {
        setRunningAgents(Object.keys(data.agentOutputs));
      }
      if (data.finalReport) {
        setFinalReport(data.finalReport);
        toast.success('Demo assessment report generated');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send demo message');
    } finally {
      setLoading(false);
      setRunningAgents([]);
    }
  };

  useEffect(() => {
    loadDemo();
  }, []);

  useEffect(() => {
    if (finalReport && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [finalReport]);

  const handleDownloadReport = () => {
    if (!finalReport) return;
    const blob = new Blob([finalReport], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'demo-assessment-report.md';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <Link to="/deals" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', fontSize: 13, marginBottom: 20,
          textDecoration: 'none', fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748B'}
        >
          <ArrowLeft size={14} /> Back to deals
        </Link>

        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={16} color="#fff" />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>
                  AI Assistant Debug Demo
                </h1>
              </div>
              <p style={{ color: '#64748B', fontSize: 14, maxWidth: 640, lineHeight: 1.6 }}>
                This page showcases the AI assistant workflow without requiring an OpenAI API key.
                The data below is a fully synthetic demo. Configure a real API key in AI Settings to run the assistant on actual deals.
              </p>
            </div>
            <Button
              variant="primary"
              icon={<Play size={13} />}
              onClick={loadDemo}
              loading={loading && messages.length === 0}
              disabled={loading}
            >
              Restart Demo
            </Button>
          </div>
        </div>

        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
            background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bot size={16} color="#2563EB" />
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>AI Assistant</h2>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '4px 8px', borderRadius: 4 }}>
              Demo Mode
            </span>
          </div>
          <div style={{ height: 520 }}>
            <AIChatPanel
              messages={messages}
              loading={loading}
              runningAgents={runningAgents}
              extractedDocs={extractedDocs}
              onSend={handleSendMessage}
            />
          </div>
        </div>

        {finalReport && (
          <div ref={reportRef} style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
              background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} color="#2563EB" />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Demo Assessment Report</h2>
              </div>
              <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={handleDownloadReport}>
                Download .md
              </Button>
            </div>
            <div style={{ padding: 20 }}>
              <pre style={{
                margin: 0, fontSize: 13, lineHeight: 1.6, color: '#374151',
                whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16,
              }}>
                {finalReport}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
