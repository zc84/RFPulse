import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText, BrainCircuit, Lock } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { useAuth } from '../context/AuthContext';
import { DealStatus, DealDomain, DealClassification, Document, DealLock } from '../types';
import { dealsApi } from '../api';
import Header from '../components/Header';
import Button from '../components/Button';
import FormField, { Input, Select, Textarea } from '../components/FormField';
import DocumentSection from '../components/DocumentSection';

const STATUSES: DealStatus[] = ['New', 'In Progress', 'Won', 'Lost', 'TBC'];
const DOMAINS: DealDomain[] = ['Healthcare', 'Fintech', 'Retail', 'Education', 'Government', 'Manufacturing', 'Technology', 'TBC'];
const CLASSIFICATIONS: DealClassification[] = ['A', 'B', 'C'];

interface FormErrors {
  name?: string;
  dueDate?: string;
  budget?: string;
  domain?: string;
}

export default function EditDealPage() {
  const { id } = useParams<{ id: string }>();
  const { getDeal, updateDeal, refreshDeals } = useDeals();
  const { users } = useAuth();
  const navigate = useNavigate();

  const deal = getDeal(id!);

  const [form, setForm] = useState({
    name: deal?.name ?? '',
    status: deal?.status ?? 'New' as DealStatus,
    dueDate: deal?.dueDate ?? '',
    budget: deal?.budget?.toString() ?? '',
    domain: deal?.domain ?? '' as DealDomain | '',
    clientName: deal?.clientName ?? '',
    classification: deal?.classification ?? '' as DealClassification | '',
    description: deal?.description ?? '',
    assigneeId: deal?.assigneeId ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<Document[]>(deal?.documents ?? []);
  const [lockStatus, setLockStatus] = useState<'loading' | 'locked' | 'blocked' | 'error'>('loading');
  const [lockInfo, setLockInfo] = useState<DealLock | null>(null);

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
          <p style={{ color: '#64748B' }}>{lockStatus === 'error' ? 'Unable to open this deal.' : 'Deal not found.'}</p>
          <Link to="/deals" style={{ color: '#2563EB', fontSize: 13, display: 'inline-block', marginTop: 12 }}>← Back to deals</Link>
        </div>
      </div>
    );
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: undefined }));
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Deal name is required';
    if (!form.dueDate) e.dueDate = 'Due date is required';
    if (!form.budget) e.budget = 'Budget is required';
    else if (isNaN(Number(form.budget)) || Number(form.budget) <= 0) e.budget = 'Enter a valid positive number';
    if (!form.domain) e.domain = 'Domain is required';
    return e;
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await dealsApi.deleteDocument(docId);
      setDocs(p => p.filter(d => d.id !== docId));
      toast.success('Document removed.');
    } catch {
      toast.error('Failed to remove document.');
    }
  };

  const handleFileUpload = async (files: FileList | null, source: 'user' | 'ai' = 'user') => {
    if (!files || files.length === 0) return;
    try {
      const uploaded = await dealsApi.uploadDocuments(deal.id, Array.from(files), source);
      setDocs(p => [...p, ...uploaded]);
      toast.success(`${uploaded.length} file(s) uploaded to ${source === 'ai' ? 'AI' : 'User'} documents.`);
    } catch {
      toast.error('Failed to upload files.');
    }
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await updateDeal(deal.id, {
        name: form.name.trim(),
        status: form.status,
        dueDate: form.dueDate,
        budget: Number(form.budget),
        domain: form.domain as DealDomain,
        clientName: form.clientName.trim() || undefined,
        classification: form.classification || undefined,
        description: form.description.trim() || undefined,
        assigneeId: form.assigneeId || undefined,
      });
      toast.success('Deal updated successfully.');
      await refreshDeals();
      navigate(`/deals/${deal.id}`);
    } catch {
      toast.error('Failed to update deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <Link to={`/deals/${deal.id}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', fontSize: 13, marginBottom: 20,
          textDecoration: 'none', fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748B'}
        >
          <ArrowLeft size={14} /> Back to deal
        </Link>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>Edit Deal</h1>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>{deal.id}</span>
            {' '}· {deal.name}
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Deal Information</h2>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FormField label="Deal Name" error={errors.name} required>
              <Input value={form.name} onChange={set('name')} error={!!errors.name} />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Status" required>
                <Select value={form.status} onChange={set('status')}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>

              <FormField label="Due Date" error={errors.dueDate} required>
                <Input type="date" value={form.dueDate} onChange={set('dueDate')} error={!!errors.dueDate} />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Budget (USD)" error={errors.budget} required>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: '#94A3B8', fontSize: 14, fontWeight: 500, pointerEvents: 'none',
                  }}>$</span>
                  <Input type="number" value={form.budget} onChange={set('budget')} error={!!errors.budget} min="0" style={{ paddingLeft: 24 }} />
                </div>
              </FormField>

              <FormField label="Domain" error={errors.domain} required>
                <Select value={form.domain} onChange={set('domain')} error={!!errors.domain}>
                  <option value="">Select domain…</option>
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Client Name" hint="Name of the client organization">
                <Input value={form.clientName} onChange={set('clientName')} placeholder="e.g. NHS" />
              </FormField>

              <FormField label="Classification" hint="Priority level (A=Highest, C=Lowest)">
                <Select value={form.classification} onChange={set('classification')}>
                  <option value="">Select classification</option>
                  {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
            </div>

            <FormField label="Assignee" hint="Person responsible for this deal">
              <Select value={form.assigneeId} onChange={set('assigneeId')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </FormField>

            <FormField label="Description / Notes">
              <Textarea value={form.description} onChange={set('description')} rows={4} />
            </FormField>
          </div>

          {/* Documents — side by side */}
          <div style={{ borderTop: '1px solid #F1F5F9', padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <DocumentSection
                title="User Documents"
                icon={<FileText size={14} color="#64748B" />}
                documents={docs.filter(d => d.source === 'user' || !d.source)}
                source="user"
                canEdit={true}
                canUpload={true}
                onUpload={files => handleFileUpload(files, 'user')}
                onDownload={doc => doc.filename && dealsApi.downloadDocument(doc.id, doc.name)}
                onShare={() => {}}
                onDelete={doc => handleDeleteDoc(doc.id)}
                emptyText="No user documents attached to this deal."
              />
              <DocumentSection
                title="AI Documents"
                icon={<BrainCircuit size={14} color="#4F46E5" />}
                documents={docs.filter(d => d.source === 'ai')}
                source="ai"
                canEdit={true}
                canUpload={true}
                onUpload={files => handleFileUpload(files, 'ai')}
                onDownload={doc => doc.filename && dealsApi.downloadDocument(doc.id, doc.name)}
                onShare={() => {}}
                onDelete={doc => handleDeleteDoc(doc.id)}
                badge="AI Context"
                emptyText="No AI documents yet. Upload documents here to add them as AI context."
              />
            </div>
          </div>

          <div style={{
            padding: '16px 24px', borderTop: '1px solid #E2E8F0',
            display: 'flex', gap: 10, justifyContent: 'flex-end',
            background: '#FAFAFA',
          }}>
            <Button variant="secondary" onClick={() => navigate(`/deals/${deal.id}`)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </main>

    </div>
  );
}
