import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { ArrowLeft, Trash2, FileText, Calendar, DollarSign, Tag, AlignLeft, Hash, Building, Sparkles, BrainCircuit, UserCircle, ShieldCheck } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { useAuth } from '../context/AuthContext';
import { dealsApi, aiApi, agentsApi, platformApi } from '../api';
import { AIMessage, Document, AIChatMessage, ProposedDealUpdates, PlatformConfigOption, AIWorkflowStep, AISession, AIRequirementInventoryResponse } from '../types';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import AIChatPanel from '../components/AIChatPanel';
import DocumentSection from '../components/DocumentSection';
import { Input, Select, Textarea } from '../components/FormField';

function formatBudget(n: number | null) {
  if (n === null) return 'Unknown';
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
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{value}</div>
    </div>
  );
}

function DealDescriptionMarkdown({ content }: { content: string }) {
  return (
    <div className="deal-description-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function DealDetailPage() {
  const validationToastId = 'validation-report-toast';
  const { id } = useParams<{ id: string }>();
  const { getDeal, deleteDeal, refreshDeals } = useDeals();
  const { isRole, users } = useAuth();
  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<number | null>(null);
  const [aiSessionStatus, setAiSessionStatus] = useState<AISession['status'] | null>(null);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiWorkflowSteps, setAiWorkflowSteps] = useState<AIWorkflowStep[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStopping, setAiStopping] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedValidationUserDocIds, setSelectedValidationUserDocIds] = useState<string[]>([]);
  const [selectedValidationAiDocIds, setSelectedValidationAiDocIds] = useState<string[]>([]);
  const [aiExtractedDocs, setAiExtractedDocs] = useState<{ id: string; name: string; size: string; success: boolean }[]>([]);
  const [aiKeyMissing, setAiKeyMissing] = useState(false);
  const [aiKeyValid, setAiKeyValid] = useState<boolean | null>(null);
  const [aiKeyError, setAiKeyError] = useState<string | null>(null);

  const [aiChatMessages, setAiChatMessages] = useState<AIChatMessage[]>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatKeyMissing, setAiChatKeyMissing] = useState(false);
  const [aiTransientMessages, setAiTransientMessages] = useState<Array<AIMessage | AIChatMessage>>([]);
  const [aiStreamStatus, setAiStreamStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');
  const [showClearAiHistoryModal, setShowClearAiHistoryModal] = useState(false);
  const [clearingAiHistory, setClearingAiHistory] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [savingField, setSavingField] = useState(false);
  const [configOptions, setConfigOptions] = useState<PlatformConfigOption[]>([]);

  const [proposedUpdates, setProposedUpdates] = useState<ProposedDealUpdates | null>(null);
  const [requirementInventory, setRequirementInventory] = useState<AIRequirementInventoryResponse | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);

  const [aiDocConfirm, setAiDocConfirm] = useState<{ show: boolean; names: string[] }>({ show: false, names: [] });
  const aiPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiStreamConnectedRef = useRef(false);
  const aiLoadingRef = useRef(false);
  const validatingRef = useRef(false);
  const aiSessionStatusRef = useRef<AISession['status'] | null>(null);
  const deal = getDeal(id!);
  const canEdit = isRole('Superadmin', 'Editor');
  const canRunAI = canEdit && aiKeyValid === true;
  const userDocuments = useMemo(() => deal?.documents.filter(d => d.source === 'user' || !d.source) || [], [deal]);
  const aiDocuments = useMemo(() => deal?.documents.filter(d => d.source === 'ai') || [], [deal]);
  const hasUserDocs = userDocuments.length > 0;
  const hasAiDocs = aiDocuments.length > 0;
  const validationReady = hasAiDocs;
  const aiWorkspaceMessages = [...aiMessages, ...aiChatMessages, ...aiTransientMessages].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
  const aiWorkspaceKeyMissing = aiKeyMissing || aiChatKeyMissing;
  const statuses = useMemo(() => {
    return configOptions.filter(o => o.type === 'status').map(o => o.value);
  }, [configOptions]);
  const domains = useMemo(() => {
    return configOptions.filter(o => o.type === 'domain').map(o => o.value);
  }, [configOptions]);
  const isAiBusy = aiLoading || validating || aiChatLoading || aiStopping || aiSessionStatus === 'running';

  const isAiCancelledError = (err: any) => err?.data?.code === 'AI_RUN_CANCELLED' || err?.message === 'AI run cancelled.';

  const readExtractedDocsFromWorkflow = (steps: AIWorkflowStep[]) => {
    const extractedStep = steps.find(step => step.step_key === 'extracted-context');
    const docs = extractedStep?.metadata?.documents;
    if (!Array.isArray(docs)) return [];
    return docs
      .filter((doc): doc is { id: string; name: string; success: boolean } => (
        !!doc && typeof doc === 'object'
        && typeof (doc as { id?: unknown }).id === 'string'
        && typeof (doc as { name?: unknown }).name === 'string'
        && typeof (doc as { success?: unknown }).success === 'boolean'
      ))
      .map(doc => ({
        id: doc.id,
        name: doc.name,
        success: doc.success,
        size: '',
      }));
  };

  const stopAISessionPolling = () => {
    if (aiPollingRef.current) {
      clearInterval(aiPollingRef.current);
      aiPollingRef.current = null;
    }
  };

  const startAISessionPolling = () => {
    if (aiStreamConnectedRef.current) return;
    stopAISessionPolling();
    aiPollingRef.current = setInterval(() => {
      loadAISession();
    }, 1500);
  };

  const applyAISessionSnapshot = (data: { session: AISession | null; messages: AIMessage[]; workflowSteps?: AIWorkflowStep[] }) => {
    if (data.session) {
      setAiSessionId(data.session.id);
      setAiSessionStatus(data.session.status);
      setAiMessages(data.messages);
      setAiWorkflowSteps(data.workflowSteps || []);
      setAiExtractedDocs(readExtractedDocsFromWorkflow(data.workflowSteps || []));
      if (data.session.status !== 'running' && !aiLoadingRef.current && !validatingRef.current) {
        stopAISessionPolling();
      }
    } else {
      setAiSessionId(null);
      setAiSessionStatus(null);
      setAiMessages([]);
      setAiWorkflowSteps([]);
      setAiExtractedDocs([]);
      if (!aiLoadingRef.current && !validatingRef.current) stopAISessionPolling();
    }
  };

  const loadAISession = async () => {
    if (!id) return;
    try {
      const data = await aiApi.getSession(id);
      applyAISessionSnapshot(data);
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

  const loadRequirementInventory = async (sessionIdOverride?: number | null) => {
    if (!id || !canEdit) return;
    setRequirementsLoading(true);
    setRequirementsError(null);
    try {
      const data = await aiApi.getRequirements(id, sessionIdOverride ?? aiSessionId ?? undefined);
      setRequirementInventory(data);
    } catch (err: any) {
      setRequirementsError(err?.message || 'Failed to load requirement inventory.');
    } finally {
      setRequirementsLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadAISession();
    validateAIKey();
    platformApi.getOptions().then(setConfigOptions).catch(() => setConfigOptions([]));
  }, [id]);

  useEffect(() => {
    if (!id || !canEdit) return;
    loadRequirementInventory(aiSessionId);
  }, [id, canEdit, aiSessionId]);

  useEffect(() => () => stopAISessionPolling(), []);

  useEffect(() => {
    aiStreamConnectedRef.current = aiStreamStatus === 'connected';
  }, [aiStreamStatus]);

  useEffect(() => {
    aiLoadingRef.current = aiLoading;
  }, [aiLoading]);

  useEffect(() => {
    validatingRef.current = validating;
  }, [validating]);

  useEffect(() => {
    aiSessionStatusRef.current = aiSessionStatus;
  }, [aiSessionStatus]);

  useEffect(() => {
    if (!id || !canEdit) return;

    const controller = new AbortController();
    let cancelled = false;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runStreamLoop = async () => {
      let attempt = 0;
      while (!cancelled) {
        setAiStreamStatus(attempt === 0 ? 'connecting' : 'reconnecting');
        try {
          await aiApi.streamSession(id, {
            signal: controller.signal,
            onOpen: () => {
              if (cancelled) return;
              setAiStreamStatus('connected');
              stopAISessionPolling();
            },
            onSession: payload => {
              if (cancelled) return;
              applyAISessionSnapshot(payload);
            },
            onError: () => {
              if (cancelled) return;
              setAiStreamStatus('reconnecting');
            },
          });
        } catch {
          if (cancelled) return;
          setAiStreamStatus('reconnecting');
          if (aiLoadingRef.current || validatingRef.current || aiSessionStatusRef.current === 'running') {
            startAISessionPolling();
          }
        }

        attempt += 1;
        if (!cancelled) {
          await sleep(Math.min(5000, 1000 * attempt));
        }
      }
    };

    runStreamLoop();

    return () => {
      cancelled = true;
      setAiStreamStatus('offline');
      controller.abort();
    };
  }, [id, canEdit]);

  useEffect(() => {
    if (hasAiDocs && id) loadAIChat();
  }, [hasAiDocs, id]);

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

  if (!deal) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <Header />
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#64748B', fontSize: 15 }}>Deal not found.</p>
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

  const handleShare = async (docId: string) => {
    try {
      const { sharePath } = await dealsApi.createShareLink(docId);
      const apiBase = import.meta.env.VITE_API_URL || (window.location.origin + '/api');
      await navigator.clipboard.writeText(`${apiBase}${sharePath}`);
      toast.success('Share link copied to clipboard (expires in 7 days)');
    } catch {
      toast.error('Failed to create share link.');
    }
  };

  const beginEdit = (field: string, value: unknown) => {
    if (!canEdit || !deal) return;
    setEditingField(field);
    setDraftValue(value === null || value === undefined ? '' : String(value));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setDraftValue('');
  };

  const saveInlineField = async (field: string) => {
    if (!deal) return;
    let value: any = draftValue;
    if ((field === 'name' || field === 'dueDate' || field === 'status' || field === 'domain') && !draftValue.trim()) {
      toast.error('This field is required.');
      return;
    }
    if (field === 'budget') value = draftValue.trim() ? Number(draftValue) : null;
    if (field === 'budget' && value !== null && (Number.isNaN(value) || value < 0)) {
      toast.error('Enter a valid budget amount.');
      return;
    }
    if (field === 'clientName' || field === 'classification' || field === 'description' || field === 'aiNotes' || field === 'assigneeId') {
      value = draftValue.trim() || null;
    }
    setSavingField(true);
    try {
      await dealsApi.update(deal.id, { [field]: value });
      await refreshDeals();
      cancelEdit();
      toast.success('Deal updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update deal.');
    } finally {
      setSavingField(false);
    }
  };

  const editableShell = (field: string, value: React.ReactNode, rawValue: unknown, editor: React.ReactNode) => {
    if (!canEdit) return value;
    if (editingField === field) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {editor}
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => saveInlineField(field)} loading={savingField}>Save</Button>
            <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={savingField}>Cancel</Button>
          </div>
        </div>
      );
    }
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => beginEdit(field, rawValue)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') beginEdit(field, rawValue);
        }}
        title="Click to edit"
        style={{
          border: 'none', background: 'transparent', padding: 0, color: 'inherit',
          font: 'inherit', fontWeight: 'inherit', textAlign: 'left', cursor: 'pointer',
          textDecoration: 'underline dotted #CBD5E1 1px', textUnderlineOffset: 3,
        }}
      >
        {value}
      </div>
    );
  };

  const startAIWithForce = async (force: boolean) => {
    if (!id || !canRunAI) return;
    setShowAIPanel(true);
    setAiLoading(true);
    setAiKeyMissing(false);
    setAiTransientMessages([]);
    startAISessionPolling();
    try {
      const data = await aiApi.start(id, force);
      setAiSessionId(data.sessionId);
      setAiMessages(data.messages);
      setAiExtractedDocs(data.extractedDocs);
      await loadAISession();
      // If the coordinator already routed, we need to trigger a message to run agents.
      if (data.status === 'routing' || data.status === 'ready_to_write') {
        await handleSendMessage('Proceed with the analysis.', true);
      }
    } catch (err: any) {
      if (isAiCancelledError(err)) {
        await loadAISession();
        return;
      }
      if (err.message?.includes('proposal already exists') || err.message?.includes('AI documents already exist')) {
        const names = err.data?.aiDocs?.map((d: any) => d.name) || [];
        setAiDocConfirm({ show: true, names });
        toast.error('AI proposal already exists. Please confirm to replace it.');
        return;
      }
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiKeyMissing(true);
      }
      toast.error(err.message || 'Failed to start AI assistant');
    } finally {
      setAiLoading(false);
      stopAISessionPolling();
      loadAISession();
    }
  };

  const handleStartAI = async () => startAIWithForce(false);

  const openValidationModal = () => {
    if (!validationReady) return;
    setSelectedValidationUserDocIds(userDocuments.map(doc => doc.id));
    setSelectedValidationAiDocIds(aiDocuments.map(doc => doc.id));
    setShowValidationModal(true);
  };

  const handleValidate = async () => {
    if (!id || !canRunAI) return;
    if (selectedValidationUserDocIds.length === 0 || selectedValidationAiDocIds.length === 0) {
      toast.error('Select at least one user document and one AI document.');
      return;
    }
    toast.dismiss(validationToastId);
    setShowAIPanel(true);
    setValidating(true);
    setAiKeyMissing(false);
    startAISessionPolling();
    try {
      const result = await aiApi.validate(id, {
        userDocumentIds: selectedValidationUserDocIds,
        aiDocumentIds: selectedValidationAiDocIds,
      });
      await refreshDeals();
      await loadAISession();
      setShowValidationModal(false);
      toast.success(`Validation report saved: ${result.documentName}`, {
        id: validationToastId,
        duration: 4000,
      });
    } catch (err: any) {
      if (isAiCancelledError(err)) {
        toast.dismiss(validationToastId);
        await loadAISession();
        return;
      }
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiKeyMissing(true);
      }
      toast.error(err.message || 'Failed to validate deal', {
        id: validationToastId,
        duration: 5000,
      });
    } finally {
      setValidating(false);
      stopAISessionPolling();
      loadAISession();
    }
  };

  const handleConfirmAiDocRestart = async () => {
    setAiDocConfirm({ show: false, names: [] });
    await startAIWithForce(true);
  };

  const handleSendMessage = async (content: string, silent: boolean = false) => {
    if (!id || !canRunAI) return;
    setAiLoading(true);
    startAISessionPolling();
    try {
      const data = await aiApi.sendMessage(id, content);
      setAiSessionId(data.sessionId);
      setAiMessages(data.messages);
      await loadAISession();
      if (data.finalReportDocumentId) {
        await refreshDeals();
        toast.success(data.wbsDocumentId
          ? 'Assessment report and detailed WBS workbook saved.'
          : 'Assessment report generated and saved to documents.');
        if (data.proposedUpdates && Object.values(data.proposedUpdates).some(v => v !== null && v !== undefined)) {
          setProposedUpdates(data.proposedUpdates);
        }
      }
      if (!silent) {
        toast.success(data.finalReportDocumentId ? 'Report saved.' : 'Message sent.');
      }
    } catch (err: any) {
      if (isAiCancelledError(err)) {
        await loadAISession();
        return;
      }
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiKeyMissing(true);
      }
      toast.error(err.message || 'Failed to send message');
    } finally {
      setAiLoading(false);
      stopAISessionPolling();
      loadAISession();
    }
  };

  const handleStopAI = async () => {
    if (!id || !isAiBusy) return;
    setAiStopping(true);
    try {
      await aiApi.stop(id);
      setAiLoading(false);
      setValidating(false);
      setAiChatLoading(false);
      setAiTransientMessages([]);
      await loadAISession();
      toast.success('AI run stopped.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop AI run');
    } finally {
      setAiStopping(false);
      stopAISessionPolling();
      loadAISession();
    }
  };

  const handleSendChatMessage = async (content: string) => {
    if (!id || !canRunAI) return;
    setAiChatLoading(true);
    setAiChatKeyMissing(false);
    const createdAt = new Date().toISOString();
    const optimisticUserMessage: AIChatMessage = {
      id: -Date.now(),
      deal_id: Number(id.replace('D-', '')) || 0,
      role: 'user',
      content,
      created_at: createdAt,
    };
    const optimisticAssistantMessage: AIChatMessage = {
      id: optimisticUserMessage.id - 1,
      deal_id: optimisticUserMessage.deal_id,
      role: 'agent',
      content: '_Thinking…_',
      created_at: new Date(Date.now() + 1).toISOString(),
    };
    setAiTransientMessages([optimisticUserMessage, optimisticAssistantMessage]);
    try {
      const data = await aiApi.sendChat(id, content);
      setAiChatMessages(data.messages);
      setAiTransientMessages([]);
    } catch (err: any) {
      setAiTransientMessages([]);
      if (isAiCancelledError(err)) {
        return;
      }
      if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        setAiChatKeyMissing(true);
      }
      toast.error(err.message || 'Failed to send chat message');
    } finally {
      setAiChatLoading(false);
    }
  };

  const handleSendAIWorkspaceMessage = async (content: string) => {
    if (hasAiDocs) {
      await handleSendChatMessage(content);
      return;
    }
    await handleSendMessage(content);
  };

  const workspaceActionTabs = [
    {
      key: 'process',
      label: 'Process',
      onClick: handleStartAI,
      disabled: !hasUserDocs || !canRunAI || isAiBusy,
      title: !hasUserDocs
        ? 'Add at least one user document before processing.'
        : aiKeyValid === false
          ? (aiKeyError || 'OpenAI API key is not configured')
          : undefined,
    },
    {
      key: 'validate',
      label: 'Validate',
      onClick: openValidationModal,
      disabled: !hasAiDocs || !canRunAI || isAiBusy,
      title: !hasAiDocs
        ? 'Add at least one AI document before validating.'
        : aiKeyValid === false
          ? (aiKeyError || 'OpenAI API key is not configured')
          : undefined,
    },
  ];

  const handleClearAiHistory = async () => {
    if (!id) return;
    setClearingAiHistory(true);
    try {
      stopAISessionPolling();
      await aiApi.clearHistory(id);
      setAiSessionId(null);
      setAiSessionStatus(null);
      setAiMessages([]);
      setAiChatMessages([]);
      setAiTransientMessages([]);
      setAiWorkflowSteps([]);
      setAiExtractedDocs([]);
      setShowClearAiHistoryModal(false);
      toast.success('AI chat history cleared.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear AI chat history.');
    } finally {
      setClearingAiHistory(false);
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

  const handleReviewStatus = async (doc: Document, status: 'draft' | 'approved') => {
    try {
      await dealsApi.updateDocumentReviewStatus(doc.id, status);
      await refreshDeals();
      toast.success(status === 'approved' ? 'Assessment report approved.' : 'Assessment report returned to draft.');
    } catch {
      toast.error('Failed to update report status.');
    }
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
                {editableShell('name', deal.name, deal.name, (
                  <Input value={draftValue} onChange={e => setDraftValue(e.target.value)} autoFocus />
                ))}
              </h1>
              <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>
                Created {formatDate(deal.createdAt)}
              </p>
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <InfoCard icon={<Hash size={13} />} label="ID" value={deal.id} />
          <InfoCard icon={<Tag size={13} />} label="Status" value={editableShell('status', <StatusBadge status={deal.status} />, deal.status, (
            <Select value={draftValue} onChange={e => setDraftValue(e.target.value)} autoFocus>
              {Array.from(new Set([...statuses, deal.status].filter(Boolean))).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          ))} />
          <InfoCard icon={<Calendar size={13} />} label="Due Date" value={
            editableShell('dueDate', <span style={{ color: isOverdue ? '#DC2626' : '#0F172A' }}>{formatDate(deal.dueDate)}</span>, deal.dueDate, (
              <Input type="date" value={draftValue} onChange={e => setDraftValue(e.target.value)} autoFocus />
            ))
          } />
          <InfoCard icon={<DollarSign size={13} />} label="Budget" value={editableShell('budget', formatBudget(deal.budget), deal.budget ?? '', (
            <Input type="number" min="0" value={draftValue} onChange={e => setDraftValue(e.target.value)} placeholder="Unknown" autoFocus />
          ))} />
          <InfoCard icon={<Tag size={13} />} label="Domain" value={editableShell('domain', deal.domain, deal.domain, (
            <Select value={draftValue} onChange={e => setDraftValue(e.target.value)} autoFocus>
              {Array.from(new Set([...domains, deal.domain].filter(Boolean))).map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          ))} />
          <InfoCard icon={<Building size={13} />} label="Client" value={editableShell('clientName', deal.clientName || 'Not set', deal.clientName || '', (
            <Input value={draftValue} onChange={e => setDraftValue(e.target.value)} placeholder="Client name" autoFocus />
          ))} />
          <InfoCard icon={<UserCircle size={13} />} label="Assignee" value={editableShell('assigneeId', deal.assigneeName || 'Unassigned', deal.assigneeId || '', (
            <Select value={draftValue} onChange={e => setDraftValue(e.target.value)} autoFocus>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          ))} />
          <InfoCard icon={<Tag size={13} />} label="Class" value={editableShell('classification', deal.classification ? (
            <span style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 6,
              background: deal.classification === 'A' ? '#DCFCE7' : deal.classification === 'B' ? '#FEF3C7' : '#FEE2E2',
              color: deal.classification === 'A' ? '#166534' : deal.classification === 'B' ? '#92400E' : '#991B1B',
              fontSize: 12, fontWeight: 600,
            }}>
              {deal.classification}
            </span>
          ) : 'Not set', deal.classification || '', (
            <Select value={draftValue} onChange={e => setDraftValue(e.target.value)} autoFocus>
              <option value="">Not set</option>
              {['A', 'B', 'C'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          ))} />
        </div>

        {/* Description */}
        {(deal.description || canEdit) && (
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <style>{`
              .deal-description-markdown {
                color: #374151;
                font-size: 14px;
                line-height: 1.7;
                overflow-wrap: anywhere;
              }
              .deal-description-markdown > :first-child {
                margin-top: 0;
              }
              .deal-description-markdown > :last-child {
                margin-bottom: 0;
              }
              .deal-description-markdown p {
                margin: 0 0 10px;
              }
              .deal-description-markdown h1,
              .deal-description-markdown h2,
              .deal-description-markdown h3 {
                margin: 16px 0 8px;
                color: #0F172A;
                line-height: 1.3;
              }
              .deal-description-markdown h1 {
                font-size: 20px;
              }
              .deal-description-markdown h2 {
                font-size: 17px;
              }
              .deal-description-markdown h3 {
                font-size: 15px;
              }
              .deal-description-markdown ul,
              .deal-description-markdown ol {
                margin: 0 0 10px;
                padding-left: 22px;
              }
              .deal-description-markdown li {
                margin: 4px 0;
              }
              .deal-description-markdown blockquote {
                margin: 10px 0;
                padding-left: 12px;
                border-left: 3px solid #CBD5E1;
                color: #475569;
              }
              .deal-description-markdown code {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 13px;
                background: rgba(15, 23, 42, 0.06);
                padding: 1px 4px;
                border-radius: 4px;
              }
              .deal-description-markdown pre {
                margin: 10px 0;
                padding: 12px;
                background: #0F172A;
                color: #E2E8F0;
                border-radius: 8px;
                overflow-x: auto;
              }
              .deal-description-markdown pre code {
                background: transparent;
                color: inherit;
                padding: 0;
                border-radius: 0;
              }
              .deal-description-markdown a {
                color: #2563EB;
                text-decoration: none;
                font-weight: 500;
              }
              .deal-description-markdown a:hover {
                text-decoration: underline;
              }
              .deal-description-markdown table {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
                font-size: 13px;
                display: block;
                overflow-x: auto;
              }
              .deal-description-markdown th,
              .deal-description-markdown td {
                border: 1px solid #CBD5E1;
                padding: 6px 8px;
                text-align: left;
                vertical-align: top;
              }
              .deal-description-markdown th {
                background: #F1F5F9;
                font-weight: 600;
              }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', marginBottom: 10 }}>
              <AlignLeft size={14} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</span>
            </div>
            {editableShell('description', deal.description ? (
              <DealDescriptionMarkdown content={deal.description} />
            ) : (
              <span style={{ color: '#94A3B8', fontSize: 14 }}>Not set</span>
            ), deal.description || '', (
              <Textarea value={draftValue} onChange={e => setDraftValue(e.target.value)} rows={8} autoFocus />
            ))}
          </div>
        )}

        {/* AI notes */}
        {(deal.aiNotes || canEdit) && (
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', marginBottom: 10 }}>
              <BrainCircuit size={14} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Notes</span>
            </div>
            {editableShell('aiNotes', deal.aiNotes ? (
              <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{deal.aiNotes}</p>
            ) : (
              <span style={{ color: '#94A3B8', fontSize: 14 }}>Not set</span>
            ), deal.aiNotes || '', (
              <Textarea value={draftValue} onChange={e => setDraftValue(e.target.value)} rows={6} autoFocus />
            ))}
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
            documents={aiDocuments}
            source="ai"
            canEdit={canEdit}
            canUpload={canEdit}
            onUpload={files => handleUpload(files, 'ai')}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={doc => setDocToDelete({ id: doc.id, name: doc.name })}
            onPreview={doc => dealsApi.previewDocument(doc.id)}
            onReviewStatus={handleReviewStatus}
            badge="AI Context"
            emptyText="No AI documents yet. Run Process to generate the proposal, WBS, and diagrams. Validate lets you choose which AI files to audit."
          />
        </div>

        {/* Requirement inventory (Phase 1) */}
        {canEdit && (
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B' }}>
                <ShieldCheck size={14} />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Requirement Inventory
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => loadRequirementInventory(aiSessionId)} loading={requirementsLoading}>
                Refresh
              </Button>
            </div>

            {requirementsError ? (
              <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 10 }}>
                {requirementsError}
              </div>
            ) : requirementsLoading && !requirementInventory ? (
              <div style={{ fontSize: 12, color: '#64748B' }}>Loading requirement inventory…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <InfoCard icon={<Hash size={13} />} label="Requirements" value={String(requirementInventory?.summary.total || 0)} />
                  <InfoCard icon={<FileText size={13} />} label="Documents Covered" value={String(requirementInventory?.summary.coveredDocuments || 0)} />
                  <InfoCard icon={<ShieldCheck size={13} />} label="Critical" value={String(requirementInventory?.summary.byPriority?.critical || 0)} />
                  <InfoCard icon={<Sparkles size={13} />} label="Gaps" value={String(requirementInventory?.summary.missingAppendixGapCount || 0)} />
                </div>

                {requirementInventory && requirementInventory.requirements.length > 0 ? (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 90px 110px 1fr', gap: 10, padding: '8px 10px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <div>Priority</div>
                      <div>Status</div>
                      <div>Category</div>
                      <div>Requirement</div>
                    </div>
                    {requirementInventory.requirements.slice(0, 8).map(req => (
                      <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '110px 90px 110px 1fr', gap: 10, padding: '10px', borderTop: '1px solid #F1F5F9' }}>
                        <div style={{ fontSize: 12, color: '#0F172A', fontWeight: 600 }}>{req.priority}</div>
                        <div style={{ fontSize: 12, color: req.status === 'gap' ? '#B45309' : '#334155', fontWeight: 600 }}>{req.status}</div>
                        <div style={{ fontSize: 12, color: '#475569' }}>{req.category}</div>
                        <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                          {req.text}
                          <div style={{ marginTop: 4, color: '#94A3B8' }}>
                            {req.source_document_name || 'Unknown source'}{req.source_locator ? ` · ${req.source_locator}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                    {requirementInventory.requirements.length > 8 && (
                      <div style={{ padding: 10, borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#64748B', background: '#FAFAFA' }}>
                        Showing first 8 of {requirementInventory.requirements.length} requirements.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No extracted requirements yet. Run Process or Validate to generate inventory.</div>
                )}
              </>
            )}
          </div>
        )}

        {/* AI workspace */}
        {canEdit && (
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
                <BrainCircuit size={16} color="#4F46E5" />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>AI Workspace</h2>
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                {hasAiDocs ? 'Ask about AI documents, run validation, or continue analysis.' : 'Run analysis, validation, and coordinator follow-up here.'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={() => setShowClearAiHistoryModal(true)}
                  disabled={isAiBusy || aiWorkspaceMessages.length === 0}
                  title="Clear AI chat history"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div style={{ height: 420 }}>
              <AIChatPanel
                messages={aiWorkspaceMessages}
                loading={aiLoading || validating || aiChatLoading}
                extractedDocs={aiExtractedDocs}
                workflowSteps={aiWorkflowSteps}
                sessionStatus={aiSessionStatus}
                streamStatus={aiStreamStatus}
                actionTabs={workspaceActionTabs}
                onStop={handleStopAI}
                stopDisabled={!isAiBusy || aiStopping}
                stopLoading={aiStopping}
                onSend={handleSendAIWorkspaceMessage}
                disabled={aiWorkspaceKeyMissing || validating || aiStopping || (!hasUserDocs && !hasAiDocs)}
                emptyMessage="Run Process to generate the proposal package. Then click Validate to choose which AI files should be audited."
              />
            </div>
            {aiWorkspaceKeyMissing && (
              <div style={{
                padding: '10px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA',
                fontSize: 12, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Sparkles size={12} />
                {aiKeyError || 'OpenAI API key is not configured.'} Ask a Superadmin to add it in Platform Configuration.
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

      {/* AI proposal restart confirmation */}
      <Modal open={aiDocConfirm.show} onClose={() => setAiDocConfirm({ show: false, names: [] })} title="Replace AI proposal?">
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            Re-running <strong>Process</strong> will replace the current AI proposal package for this deal.
          </p>
          {aiDocConfirm.names.length > 0 && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: 12, marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#991B1B', marginBottom: 8 }}>AI package to be replaced:</div>
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
              Replace & Process
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showValidationModal} onClose={() => !validating && setShowValidationModal(false)} title="Select validation files">
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            Choose which user documents and AI documents should be included in this validation run.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>User Documents</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, background: '#F8FAFC' }}>
                {userDocuments.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No user documents available.</div>
                ) : userDocuments.map(doc => (
                  <label key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedValidationUserDocIds.includes(doc.id)}
                      onChange={e => {
                        setSelectedValidationUserDocIds(prev => e.target.checked
                          ? [...prev, doc.id]
                          : prev.filter(id => id !== doc.id));
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      {doc.name}
                      <span style={{ color: '#94A3B8' }}> · {doc.size} · {new Date(doc.uploadedAt).toLocaleDateString('en-GB')}{doc.artifactType ? ` · ${doc.artifactType}` : ''}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>AI Documents</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, background: '#F8FAFC' }}>
                {aiDocuments.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No AI documents available.</div>
                ) : aiDocuments.map(doc => (
                  <label key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedValidationAiDocIds.includes(doc.id)}
                      onChange={e => {
                        setSelectedValidationAiDocIds(prev => e.target.checked
                          ? [...prev, doc.id]
                          : prev.filter(id => id !== doc.id));
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      {doc.name}
                      <span style={{ color: '#94A3B8' }}> · {doc.size} · {new Date(doc.uploadedAt).toLocaleDateString('en-GB')}{doc.artifactType ? ` · ${doc.artifactType}` : ''}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setShowValidationModal(false)} disabled={validating}>
              Cancel
            </Button>
            <Button
              onClick={handleValidate}
              loading={validating}
              disabled={selectedValidationUserDocIds.length === 0 || selectedValidationAiDocIds.length === 0}
              icon={<ShieldCheck size={13} />}
            >
              Run Validation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear AI chat history confirmation */}
      <Modal
        open={showClearAiHistoryModal}
        onClose={() => !clearingAiHistory && setShowClearAiHistoryModal(false)}
        title="Clear AI chat history?"
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Trash2 size={22} color="#DC2626" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
            Clear this deal's AI history?
          </h3>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            This deletes the AI workspace messages, chat messages, coordinator context, and agent outputs from the database.
            Generated documents are not deleted. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="secondary" onClick={() => setShowClearAiHistoryModal(false)} disabled={clearingAiHistory}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClearAiHistory} loading={clearingAiHistory} icon={<Trash2 size={13} />}>
              {clearingAiHistory ? 'Clearing...' : 'Clear History'}
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
