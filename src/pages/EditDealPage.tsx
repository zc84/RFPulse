import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText, X } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { DealStatus, DealDomain, Document } from '../types';
import Header from '../components/Header';
import Button from '../components/Button';
import FormField, { Input, Select, Textarea } from '../components/FormField';

const STATUSES: DealStatus[] = ['New', 'In Progress', 'Won', 'Lost', 'TBC'];
const DOMAINS: DealDomain[] = ['Healthcare', 'Fintech', 'Retail', 'Education', 'Government', 'Manufacturing', 'Technology', 'TBC'];

interface FormErrors {
  name?: string;
  dueDate?: string;
  budget?: string;
  domain?: string;
}

export default function EditDealPage() {
  const { id } = useParams<{ id: string }>();
  const { getDeal, updateDeal } = useDeals();
  const navigate = useNavigate();

  const deal = getDeal(id!);

  const [form, setForm] = useState({
    name: deal?.name ?? '',
    status: deal?.status ?? 'New' as DealStatus,
    dueDate: deal?.dueDate ?? '',
    budget: deal?.budget?.toString() ?? '',
    domain: deal?.domain ?? '' as DealDomain | '',
    description: deal?.description ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<Document[]>(deal?.documents ?? []);

  if (!deal) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <Header />
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#64748B' }}>Deal not found.</p>
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
        description: form.description.trim() || undefined,
        documents: docs,
      });
      toast.success('Deal updated successfully.');
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

            <FormField label="Description / Notes">
              <Textarea value={form.description} onChange={set('description')} rows={4} />
            </FormField>
          </div>

          {/* Documents */}
          <div style={{ borderTop: '1px solid #F1F5F9' }}>
            <div style={{ padding: '16px 24px', background: '#FAFAFA', borderBottom: docs.length > 0 ? '1px solid #F1F5F9' : undefined }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Documents ({docs.length})</h2>
            </div>
            <div style={{ padding: 16 }}>
              {docs.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map(doc => (
                    <div key={doc.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #E2E8F0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={14} color="#64748B" />
                        <span style={{ fontSize: 13, color: '#374151' }}>{doc.name}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{doc.size}</span>
                      </div>
                      <button onClick={() => setDocs(p => p.filter(d => d.id !== doc.id))}
                        style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: '#94A3B8' }}>
                {docs.length === 0 ? 'No documents attached.' : `${docs.length} document(s) attached.`}
              </p>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
