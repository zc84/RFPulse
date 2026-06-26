import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, X, FileText } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { useAuth } from '../context/AuthContext';
import { DealStatus, DealDomain, DealClassification, Document, PlatformConfigOption } from '../types';
import { dealsApi, platformApi } from '../api';
import Header from '../components/Header';
import Button from '../components/Button';
import FormField, { Input, Select, Textarea } from '../components/FormField';

const FALLBACK_STATUSES: DealStatus[] = ['New', 'In Progress', 'Won', 'Lost', 'TBC'];
const FALLBACK_DOMAINS: DealDomain[] = ['Healthcare', 'Fintech', 'Retail', 'Education', 'Government', 'Manufacturing', 'Technology', 'TBC'];
const CLASSIFICATIONS: DealClassification[] = ['A', 'B', 'C'];

interface FormData {
  name: string;
  status: DealStatus;
  dueDate: string;
  budgetMode: 'unknown' | 'known';
  budget: string;
  domain: DealDomain | '';
  clientName: string;
  classification: DealClassification | '';
  description: string;
  assigneeId: string;
}

interface FormErrors {
  name?: string;
  dueDate?: string;
  budget?: string;
  domain?: string;
}

interface PendingDoc {
  file: File;
  document: Document;
}

export default function AddDealPage() {
  const { addDeal, refreshDeals } = useDeals();
  const { currentUser, users } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    name: '', status: 'New', dueDate: '', budgetMode: 'unknown', budget: '', domain: '', clientName: '', classification: '', description: '', assigneeId: currentUser?.id || '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [configOptions, setConfigOptions] = useState<PlatformConfigOption[]>([]);

  useEffect(() => {
    platformApi.getOptions().then(setConfigOptions).catch(() => setConfigOptions([]));
  }, []);

  const statuses = useMemo(() => {
    const values = configOptions.filter(o => o.type === 'status').map(o => o.value);
    return values.length ? values : FALLBACK_STATUSES;
  }, [configOptions]);

  const domains = useMemo(() => {
    const values = configOptions.filter(o => o.type === 'domain').map(o => o.value);
    return values.length ? values : FALLBACK_DOMAINS;
  }, [configOptions]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: undefined }));
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Deal name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    if (!form.dueDate) e.dueDate = 'Due date is required';
    if (form.budgetMode === 'known' && (!form.budget || isNaN(Number(form.budget)) || Number(form.budget) <= 0)) {
      e.budget = 'Enter a valid positive number';
    }
    if (!form.domain) e.domain = 'Domain is required';
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const newDeal = await addDeal({
        name: form.name.trim(),
        status: form.status,
        dueDate: form.dueDate,
        budget: form.budgetMode === 'unknown' ? null : Number(form.budget),
        domain: form.domain as DealDomain,
        clientName: form.clientName.trim() || undefined,
        classification: form.classification || undefined,
        description: form.description.trim() || undefined,
        assigneeId: form.assigneeId || null,
        documents: [],
      });
      if (pendingDocs.length > 0) {
        await dealsApi.uploadDocuments(newDeal.id, pendingDocs.map(p => p.file), 'user');
        await refreshDeals();
      }
      toast.success('Deal created successfully.');
      navigate('/deals');
    } catch {
      toast.error('Failed to create deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPending: PendingDoc[] = files.map(f => ({
      file: f,
      document: {
        id: `doc-${Date.now()}-${Math.random()}`,
        name: f.name,
        size: `${(f.size / 1024).toFixed(0)} KB`,
        source: 'user',
        uploadedAt: new Date().toISOString().split('T')[0],
      } as Document,
    }));
    setPendingDocs(p => [...p, ...newPending]);
    e.target.value = '';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
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

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>Add New Deal</h1>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Fill in the details below to create a new RFP or tender record.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Deal Information</h2>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FormField label="Deal Name" error={errors.name} required>
              <Input
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. NHS Digital Transformation Initiative"
                error={!!errors.name}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Status" required>
                <Select value={form.status} onChange={set('status')}>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>

              <FormField label="Due Date" error={errors.dueDate} required>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={set('dueDate')}
                  error={!!errors.dueDate}
                  min={new Date().toISOString().split('T')[0]}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Budget" error={errors.budget} hint="Enter amount in USD when known">
                <div style={{ display: 'grid', gridTemplateColumns: form.budgetMode === 'known' ? '132px 1fr' : '1fr', gap: 8 }}>
                  <Select value={form.budgetMode} onChange={set('budgetMode')}>
                    <option value="unknown">Unknown</option>
                    <option value="known">Known</option>
                  </Select>
                  {form.budgetMode === 'known' && (
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        color: '#94A3B8', fontSize: 14, fontWeight: 500, pointerEvents: 'none',
                      }}>$</span>
                      <Input
                        type="number"
                        value={form.budget}
                        onChange={set('budget')}
                        placeholder="0.00"
                        error={!!errors.budget}
                        min="0"
                        style={{ paddingLeft: 24 }}
                      />
                    </div>
                  )}
                </div>
              </FormField>

              <FormField label="Domain" error={errors.domain} required>
                <Select value={form.domain} onChange={set('domain')} error={!!errors.domain}>
                  <option value="">Select domain</option>
                  {domains.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Client Name" hint="Name of the client organization">
                <Input
                  value={form.clientName}
                  onChange={set('clientName')}
                  placeholder="e.g. NHS"
                />
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

            <FormField label="Description / Notes" hint="Optional — additional context about this deal">
              <Textarea
                value={form.description}
                onChange={set('description')}
                placeholder="Brief description of the deal scope, requirements, or notes…"
                rows={4}
              />
            </FormField>
          </div>

          {/* Documents section */}
          <div style={{ borderTop: '1px solid #F1F5F9' }}>
            <div style={{ padding: '16px 24px', background: '#FAFAFA', borderBottom: pendingDocs.length > 0 ? '1px solid #F1F5F9' : undefined }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Documents</h2>
            </div>
            <div style={{ padding: 24 }}>
              {pendingDocs.length > 0 && (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingDocs.map(pd => (
                    <div key={pd.document.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#F8FAFC', borderRadius: 7,
                      border: '1px solid #E2E8F0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={14} color="#64748B" />
                        <span style={{ fontSize: 13, color: '#374151' }}>{pd.document.name}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{pd.document.size}</span>
                      </div>
                      <button
                        onClick={() => setPendingDocs(p => p.filter(d => d.document.id !== pd.document.id))}
                        style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 24, border: '2px dashed #E2E8F0', borderRadius: 8, cursor: 'pointer',
                background: '#FAFAFA', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2563EB';
                (e.currentTarget as HTMLElement).style.background = '#EFF6FF';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
                (e.currentTarget as HTMLElement).style.background = '#FAFAFA';
              }}
              >
                <Upload size={20} color="#94A3B8" />
                <span style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                  <span style={{ color: '#2563EB', fontWeight: 500 }}>Click to upload</span> or drag & drop
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>PDF, DOCX, XLSX up to 20MB</span>
                <input type="file" multiple accept=".pdf,.docx,.xlsx,.doc,.ppt,.pptx" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #E2E8F0',
            display: 'flex', gap: 10, justifyContent: 'flex-end',
            background: '#FAFAFA',
          }}>
            <Button variant="secondary" onClick={() => navigate('/deals')} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={loading}>
              {loading ? 'Saving…' : 'Save Deal'}
            </Button>
          </div>
        </div>
      </main>

    </div>
  );
}
