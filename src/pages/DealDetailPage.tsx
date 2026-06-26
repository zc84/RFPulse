import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit2, Trash2, Download, FileText, Calendar, DollarSign, Tag, AlignLeft, Hash, Share2, Copy, X, Building, Sparkles, Bot, BrainCircuit, UserCircle, ShieldCheck, Lock } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { useAuth } from '../context/AuthContext';
import { dealsApi, aiApi, agentsApi } from '../api';
import { AIMessage, Document, AIChatMessage, ProposedDealUpdates, DealLock } from '../types';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import AIChatPanel from '../components/AIChatPanel';
import DocumentSection from '../components/DocumentSection';

function formatBudget(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px', background: '#fff', border: '1px solid #E2E8F0',
      borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8' }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{value}</div>
    </div>
  );
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getDeal, deleteDeal, refreshDeals } = useDeals();
  const { isRole } = useAuth();
  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<number | null>(null);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRunningAgents, setAiRunningAgents] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [aiExtractedDocs, setAiExtractedDocs] = useState<{ id: string; name: string; size: string; success: boolean }[]>([]);
  const [aiKeyMissing, setAiKeyMissing] = useState(false);
  const [aiKeyValid, setAiKeyValid] = useState<boolean | null>(null);
  const [aiKeyError, setAiKeyError] = useState<string | null>(null);

  const [aiChatMessages, setAiChatMessages] = useState<AIChatMessage[]>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatKeyMissing, setAiChatKeyMissing] = useState(false);

  const [proposedUpdates, setProposedUpdates] = useState<ProposedDealUpdates | null>(null);

  const [aiDocConfirm, setAiDocConfirm] = useState<{ show: boolean; names: string[] }>({ show: false, names: [] });
  const [lockStatus, setLockStatus] = useState<'loading' | 'locked' | 'blocked' | 'error'>('loading');
  const [lockInfo, setLockInfo] = useState<DealLock | null>(null);

  const deal = getDeal(id!);
  const canEdit = isRole('Superadmin', 'Editor');
  const canRunAI = canEdit && aiKeyValid === true;
  const hasAiDocs = deal ? deal.documents.some(d => d.source === 'ai') : false;

  const loadAISession = async () => {
    if (!id) return;
    try {
      const data = await aiApi.getSession(id);
      if (data.session) {
        setAiSessionId(data.session.id);
        setAiMessages(data.messages);
      }
    } catch {
      // No existing session is fine.
    }
  };

  const loadAIChat = async () => {
    if (!id) return;
    try {
      const data = await aiApi.getChat(id);
      setAiChatMessages(data.messages);
    } catch {
      // No chat history is fine.
    }
  };

  useEffect(() => {
    if (id) loadAISession();
    validateAIKey();
  }, [id]);

  useEffect(() => {
    if (hasAiDocs && id) loadAIChat();
  }, [hasAiDocs, id]);

  useEffect(() => {
    if (!id) return;

    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let hasLock = false;

    const acquireLock = async () => {
      try {
        const data = await dealsApi.lock(id);
        hasLock = true;
        setLockStatus('locked');
        setLockInfo(data.lock);
        heartbeatInterval = setInterval(() => {
          dealsApi.heartbeat(id).catch((err: any) => {
            if (err.status === 409) {
              setLockStatus('blocked');
              setLockInfo(err.data?.lock || null);
              if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
              }
            }
          });
        }, 2 * 60 * 1000);
      } catch (err: any) {
        if (err.status === 409) {
          setLockStatus('blocked');
          setLockInfo(err.data?.lock || null);
        } else if (err.status === 404) {
          setLockStatus('error');
        } else {
          setLockStatus('error');
        }
      }
    };

    acquireLock();

    const handleBeforeUnload = () => {
      if (!hasLock) return;
      const apiBase = import.meta.env.VITE_API_URL || (window.location.origin + '/api');
      const token = localStorage.getItem('rfpulse_token');
      fetch(`${apiBase}/deals/${id}/unlock`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (hasLock) {
        dealsApi.unlock(id).catch(() => {});
      }
    };
  }, [id]);

  const validateAIKey = async () => {
    try {
      const result = await agentsApi.validateKey();
      setAiKeyValid(result.valid);
      setAiKeyError(result.error);
      if (!result.valid) setAiKeyMissing(true);
    } catch {
      setAiKeyValid(false);
      setAiKeyError('Could not verify OpenAI API key.');
      setAiKeyMissing(true);
    }
  };

  if (lockStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <Header />
        <div style={{ padding: 64, textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #E2E8F0', borderTopColor: '#2563EB',
            animation: 'spin 0.8s linear infinite', marginBottom: 12,
          }} />
          <div style={{ color: '#64748B', fontSize: 13 }}>Checking deal availability…</div>
        </div>
      </div>
    );
  }

  if (lockStatus === 'blocked') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <Header />
        <main style={{ flex: 1, padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
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
            padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Lock size={24} color="#B45309" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
              Deal is currently blocked
            </h2>
            <p style={{ color: '#64748B', fontSize: 14 }}>
              {lockInfo?.userName ? `Opened by ${lockInfo.userName}.` : 'Opened by another user.'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (lockStatus === 'error' || !deal) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <Header />
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#64748B', fontSize: 15 }}>{lockStatus === 'error' ? 'Unable to open this deal.' : 'Deal not found.'}</p>
          <Link to="/deals" style={{ color: '#2563EB', fontSize: 13, marginTop: 12, display: 'inline-block' }}>
            ← Back to deals
          </Link>
        </div>
      </div>
    );
  }

  const isOverdue = new Date(deal.dueDate) < new Date() && deal.status !== 'Won' && deal.status !== 'Lost';

  const handleDelete = async () => {
    setDeleting(true);
    await deleteDeal(deal.id);
    toast.success('Deal deleted.');
    navigate('/deals');
  };

  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      await dealsApi.deleteDocument(docToDelete.id);
      await refreshDeals();
      toast.success('Document deleted.');
    } catch {
      toast.error('Failed to delete document.');
    } finally {
      setDeletingDoc(false);
      setDocToDelete(null);
    }
  };

  const handleShare = (docId: string) => {
    const apiBase = import.meta.env.VITE_API_URL || (window.location.origin + '/api');
    const url = `${apiBase}/deals/documents/${docId}/share`;
    navigator.clipboard.writeText(url);
    toast.success('Share URL copied to clipboard');
  };

  const startAIWithForce = async (force: boolean) => {
    if (!id || !canRunAI) return;
    setShowAIPanel(true);
    setAiLoading(true);
    setAiKeyMissing(false);
    try {
      const data = await aiApi.start(id, force);
      setAiSessionId(data.sessionId);
      setAiMessages(data.messages);
      setAiExtractedDocs(data.extractedDocs);
      if (data.status === 'routing' && data.plan?.length) {
        setAiRunningAgents(data.plan);
      }
      if (data.status === 'ready_to_write') {
        setAiRunningAgents(['coordinator']);
      }
      // If the coordinator already routed, we need to trigger a message to run agents.
      if (data.status === 'routing' || data.status === 'ready_to_write') {
        await handleSendMessage('Proceed with the analysis.', true);
      }
    } catch (err: any) {
      if (err.message?.includes('AI documents already exist')) {
        const names = err.aiDocs?.map((d: any) => d.name) || [];
        setAiDocConfirm({ show: true, names });
        toast.error('AI documents already exist. Please confirm to replace them.');
        return;
      }
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiKeyMissing(true);
      }
      toast.error(err.message || 'Failed to start AI assistant');
    } finally {
      setAiLoading(false);
    }
  };

  const handleStartAI = async () => startAIWithForce(false);

  const handleValidate = async () => {
    if (!id || !canRunAI) return;
    setShowAIPanel(true);
    setValidating(true);
    setAiRunningAgents(['validator']);
    setAiKeyMissing(false);
    const aiPanel = document.getElementById('ai-assistant-panel');
    if (aiPanel) aiPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const result = await aiApi.validate(id);
      await refreshDeals();
      toast.success(`Validation report saved: ${result.documentName}`);
    } catch (err: any) {
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiKeyMissing(true);
      }
      toast.error(err.message || 'Failed to validate deal');
    } finally {
      setValidating(false);
      setAiRunningAgents([]);
    }
  };

  const handleConfirmAiDocRestart = async () => {
    setAiDocConfirm({ show: false, names: [] });
    await startAIWithForce(true);
  };

  const handleSendMessage = async (content: string, silent: boolean = false) => {
    if (!id || !canRunAI) return;
    setAiLoading(true);
    setAiRunningAgents([]);
    try {
      const data = await aiApi.sendMessage(id, content);
      setAiSessionId(data.sessionId);
      setAiMessages(data.messages);
      if (data.agentOutputs && Object.keys(data.agentOutputs).length > 0) {
        setAiRunningAgents(Object.keys(data.agentOutputs));
      }
      if (data.finalReportDocumentId) {
        await refreshDeals();
        toast.success('Assessment report generated and saved to documents.');
        if (data.proposedUpdates && Object.values(data.proposedUpdates).some(v => v !== null && v !== undefined)) {
          setProposedUpdates(data.proposedUpdates);
        }
      }
      if (!silent) {
        toast.success(data.finalReportDocumentId ? 'Report saved.' : 'Message sent.');
      }
    } catch (err: any) {
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiKeyMissing(true);
      }
      toast.error(err.message || 'Failed to send message');
    } finally {
      setAiLoading(false);
      setAiRunningAgents([]);
    }
  };

  const handleSendChatMessage = async (content: string) => {
    if (!id || !canRunAI) return;
    setAiChatLoading(true);
    setAiChatKeyMissing(false);
    try {
      const data = await aiApi.sendChat(id, content);
      setAiChatMessages(data.messages);
    } catch (err: any) {
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiChatKeyMissing(true);
      }
      toast.error(err.message || 'Failed to send chat message');
    } finally {
      setAiChatLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null, source: 'user' | 'ai') => {
    if (!id || !files || files.length === 0) return;
    try {
      const uploaded = await dealsApi.uploadDocuments(id, Array.from(files), source);
      await refreshDeals();
      toast.success(`${uploaded.length} file(s) uploaded to ${source === 'ai' ? 'AI' : 'User'} documents.`);
    } catch {
      toast.error('Failed to upload files.');
    }
  };

  const handleDownload = (doc: Document) => {
    if (doc.filename) dealsApi.downloadDocument(doc.id, doc.name);
  };

  const handleUpdateField = async (field: keyof ProposedDealUpdates, value: unknown) => {
    if (!id || !proposedUpdates) return;
    try {
      const updates: Partial<Record<string, unknown>> = {};
      updates[field] = value;
      await dealsApi.update(id, updates);
      await refreshDeals();
      toast.success(`${field} updated.`);
      setProposedUpdates(p => p ? { ...p, [field]: null } : null);
    } catch {
      toast.error(`Failed to update ${field}.`);
    }
  };

  const handleSkipField = (field: keyof ProposedDealUpdates) => {
    setProposedUpdates(p => p ? { ...p, [field]: null } : null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
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

        {/* Deal header */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 4 }}>
                  {deal.id}
                </span>
                <StatusBadge status={deal.status} />
                {isOverdue && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 4 }}>
                    OVERDUE
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px', maxWidth: 600 }}>
                {deal.name}
              </h1>
              <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>
                Created {formatDate(deal.createdAt)}
              </p>
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <span title={aiKeyValid === false ? (aiKeyError || 'OpenAI API key is not configured') : ''}>
                  <Button
                    variant="outline"
                    icon={<Sparkles size={13} />}
                    onClick={handleStartAI}
                    loading={aiLoading && !showAIPanel}
                    disabled={aiLoading || aiKeyValid === false}
                    style={{ width: '100%' }}
                  >
                    {aiSessionId ? 'Continue AI' : 'Execute AI'}
                  </Button>
                </span>
                <span title={aiKeyValid === false ? (aiKeyError || 'OpenAI API key is not configured') : ''}>
                  <Button
                    variant="outline"
                    icon={<ShieldCheck size={13} />}
                    onClick={handleValidate}
                    loading={validating}
                    disabled={validating || aiKeyValid === false}
                    style={{ width: '100%' }}
                  >
                    Validate
                  </Button>
                </span>
                <Button
                  variant="secondary"
                  icon={<Edit2 size={13} />}
                  onClick={() => navigate(`/deals/${deal.id}/edit`)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  icon={<Trash2 size={13} />}
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* AI assistant panel */}
        {showAIPanel && (
          <div id="ai-assistant-panel" style={{
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
              <button
                onClick={() => setShowAIPanel(false)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ height: 420 }}>
              <AIChatPanel
                messages={aiMessages}
                loading={aiLoading || validating}
                runningAgents={aiRunningAgents}
                extractedDocs={aiExtractedDocs}
                onSend={handleSendMessage}
                disabled={aiKeyMissing || validating}
                emptyMessage="Run Execute AI to generate an assessment report, or Validate to generate a fit-gap validation report against Andersen Lab capabilities."
              />
            </div>
            {aiKeyMissing && (
              <div style={{
                padding: '10px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA',
                fontSize: 12, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Sparkles size={12} />
                {aiKeyError || 'OpenAI API key is not configured.'} Ask a Superadmin to add it in AI Agent Configuration.
              </div>
            )}
          </div>
        )}

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <InfoCard icon={<Hash size={13} />} label="ID" value={deal.id} />
          <InfoCard icon={<Calendar size={13} />} label="Due Date" value={
            <span style={{ color: isOverdue ? '#DC2626' : '#0F172A' }}>{formatDate(deal.dueDate)}</span>
          } />
          <InfoCard icon={<DollarSign size={13} />} label="Budget" value={formatBudget(deal.budget)} />
          <InfoCard icon={<Tag size={13} />} label="Domain" value={deal.domain} />
          {deal.clientName && <InfoCard icon={<Building size={13} />} label="Client" value={deal.clientName} />}
          <InfoCard icon={<UserCircle size={13} />} label="Assignee" value={deal.assigneeName || 'Unassigned'} />
          {deal.classification && <InfoCard icon={<Tag size={13} />} label="Class" value={
            <span style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 6,
              background: deal.classification === 'A' ? '#DCFCE7' : deal.classification === 'B' ? '#FEF3C7' : '#FEE2E2',
              color: deal.classification === 'A' ? '#166534' : deal.classification === 'B' ? '#92400E' : '#991B1B',
              fontSize: 12, fontWeight: 600,
            }}>
              {deal.classification}
            </span>
          } />}
        </div>

        {/* Description */}
        {deal.description && (
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', marginBottom: 10 }}>
              <AlignLeft size={14} />
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</span>
            </div>
            <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7 }}>{deal.description}</p>
          </div>
        )}

        {/* Documents — side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <DocumentSection
            title="User Documents"
            icon={<FileText size={14} color="#64748B" />}
            documents={deal.documents.filter(d => d.source === 'user' || !d.source)}
            source="user"
            canEdit={canEdit}
            canUpload={canEdit}
            onUpload={files => handleUpload(files, 'user')}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={doc => setDocToDelete({ id: doc.id, name: doc.name })}
            emptyText="No user documents attached to this deal."
          />
          <DocumentSection
            title="AI Documents"
            icon={<BrainCircuit size={14} color="#4F46E5" />}
            documents={deal.documents.filter(d => d.source === 'ai')}
            source="ai"
            canEdit={canEdit}
            canUpload={canEdit}
            onUpload={files => handleUpload(files, 'ai')}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={doc => setDocToDelete({ id: doc.id, name: doc.name })}
            badge="AI Context"
            emptyText="No AI documents yet. Run Execute AI to generate an assessment report, or click Validate to generate a validation report against Andersen Lab capabilities. You can also upload documents here to add them as AI context."
          />
        </div>

        {/* AI Chat panel — permanently visible when AI docs exist */}
        {hasAiDocs && (
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
              background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BrainCircuit size={16} color="#4F46E5" />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>AI Chat</h2>
              </div>
            </div>
            <div style={{ height: 420 }}>
              <AIChatPanel
                messages={aiChatMessages}
                loading={aiChatLoading}
                onSend={handleSendChatMessage}
                disabled={aiChatKeyMissing}
                emptyMessage="Ask questions about the deal's AI documents. Type a message below to start."
              />
            </div>
            {aiChatKeyMissing && (
              <div style={{
                padding: '10px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA',
                fontSize: 12, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Sparkles size={12} />
                {aiKeyError || 'OpenAI API key is not configured.'} Ask a Superadmin to add it in AI Agent Configuration.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete modal */}
      <Modal open={showDeleteModal} onClose={() => !deleting && setShowDeleteModal(false)} title="Delete Deal">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Trash2 size={22} color="#DC2626" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
            Delete this deal?
          </h3>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: '#374151' }}>{deal.name}</strong>?
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} icon={<Trash2 size={13} />}>
              {deleting ? 'Deleting…' : 'Delete Deal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document delete modal */}
      <Modal open={!!docToDelete} onClose={() => !deletingDoc && setDocToDelete(null)} title="Delete Document">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Trash2 size={22} color="#DC2626" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
            Delete this document?
          </h3>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: '#374151' }}>{docToDelete?.name}</strong>?
            The file will be removed from the server. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="secondary" onClick={() => setDocToDelete(null)} disabled={deletingDoc}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteDoc} loading={deletingDoc} icon={<Trash2 size={13} />}>
              {deletingDoc ? 'Deleting…' : 'Delete Document'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI doc restart confirmation */}
      <Modal open={aiDocConfirm.show} onClose={() => setAiDocConfirm({ show: false, names: [] })} title="Replace AI documents?">
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            Re-running <strong>Execute AI</strong> will delete the existing AI documents for this deal and generate new ones.
          </p>
          {aiDocConfirm.names.length > 0 && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: 12, marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#991B1B', marginBottom: 8 }}>Documents to be deleted:</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#7F1D1D', fontSize: 12, lineHeight: 1.6 }}>
                {aiDocConfirm.names.map((name, i) => <li key={i}>{name}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setAiDocConfirm({ show: false, names: [] })}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmAiDocRestart} icon={<Trash2 size={13} />}>
              Replace & Restart
            </Button>
          </div>
        </div>
      </Modal>

      {/* Proposed deal updates */}
      <Modal open={!!proposedUpdates && Object.values(proposedUpdates).some(v => v !== null && v !== undefined)} onClose={() => setProposedUpdates(null)} title="Update deal details?">
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            The AI found the following deal details in the documents. Update the deal or skip each one.
          </p>
          {proposedUpdates && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {proposedUpdates.dueDate && (
                <ProposedField
                  label="Due Date"
                  current={deal.dueDate}
                  proposed={proposedUpdates.dueDate}
                  onUpdate={() => handleUpdateField('dueDate', proposedUpdates.dueDate)}
                  onSkip={() => handleSkipField('dueDate')}
                />
              )}
              {proposedUpdates.budget && (
                <ProposedField
                  label="Budget"
                  current={formatBudget(deal.budget)}
                  proposed={formatBudget(proposedUpdates.budget)}
                  onUpdate={() => handleUpdateField('budget', proposedUpdates.budget)}
                  onSkip={() => handleSkipField('budget')}
                />
              )}
              {proposedUpdates.clientName && (
                <ProposedField
                  label="Client"
                  current={deal.clientName || 'Not set'}
                  proposed={proposedUpdates.clientName}
                  onUpdate={() => handleUpdateField('clientName', proposedUpdates.clientName)}
                  onSkip={() => handleSkipField('clientName')}
                />
              )}
              {proposedUpdates.description && (
                <ProposedField
                  label="Description"
                  current={deal.description || 'Not set'}
                  proposed={proposedUpdates.description}
                  onUpdate={() => handleUpdateField('description', proposedUpdates.description)}
                  onSkip={() => handleSkipField('description')}
                />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setProposedUpdates(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

function ProposedField({ label, current, proposed, onUpdate, onSkip }: {
  label: string;
  current: React.ReactNode;
  proposed: React.ReactNode;
  onUpdate: () => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#FAFAFA' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Current</div>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{current}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Proposed</div>
          <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{proposed}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onSkip}>Skip</Button>
        <Button size="sm" onClick={onUpdate}>Update</Button>
      </div>
    </div>
  );
}
