import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit2, Trash2, Download, FileText, Calendar, DollarSign, Tag, AlignLeft, Hash, Share2, Copy, X, Building } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { useAuth } from '../context/AuthContext';
import { dealsApi } from '../api';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Modal from '../components/Modal';

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

  const deal = getDeal(id!);
  const canEdit = isRole('Superadmin', 'Editor');

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

  const handleShare = (docId: string) => {
    const apiBase = import.meta.env.VITE_API_URL || (window.location.origin + '/api');
    const url = `${apiBase}/deals/documents/${docId}/share`;
    navigator.clipboard.writeText(url);
    toast.success('Share URL copied to clipboard');
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

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <InfoCard icon={<Hash size={13} />} label="ID" value={deal.id} />
          <InfoCard icon={<Calendar size={13} />} label="Due Date" value={
            <span style={{ color: isOverdue ? '#DC2626' : '#0F172A' }}>{formatDate(deal.dueDate)}</span>
          } />
          <InfoCard icon={<DollarSign size={13} />} label="Budget" value={formatBudget(deal.budget)} />
          <InfoCard icon={<Tag size={13} />} label="Domain" value={deal.domain} />
          {deal.clientName && <InfoCard icon={<Building size={13} />} label="Client" value={deal.clientName} />}
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

        {/* Documents */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} color="#64748B" />
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Documents ({deal.documents.length})
            </h2>
          </div>
          <div style={{ padding: 16 }}>
            {deal.documents.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                No documents attached to this deal.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deal.documents.map(doc => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: '#F8FAFC',
                    border: '1px solid #E2E8F0', borderRadius: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FileText size={16} color="#2563EB" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{doc.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{doc.size} · Uploaded {formatDate(doc.uploadedAt)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        disabled={!doc.filename}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '6px 10px', borderRadius: 6,
                          border: '1px solid #E2E8F0', background: '#fff',
                          color: doc.filename ? '#374151' : '#94A3B8', fontSize: 12, cursor: doc.filename ? 'pointer' : 'not-allowed',
                          fontWeight: 500,
                        }}
                        onMouseEnter={e => {
                          if (!doc.filename) return;
                          (e.currentTarget as HTMLElement).style.background = '#EFF6FF';
                          (e.currentTarget as HTMLElement).style.color = '#2563EB';
                          (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = '#fff';
                          (e.currentTarget as HTMLElement).style.color = doc.filename ? '#374151' : '#94A3B8';
                          (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
                        }}
                        onClick={() => {
                          if (!doc.filename) return;
                          dealsApi.downloadDocument(doc.id, doc.name);
                        }}
                      >
                        <Download size={12} />
                      </button>
                      <button
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '6px 10px', borderRadius: 6,
                          border: '1px solid #E2E8F0', background: '#fff',
                          color: '#374151', fontSize: 12, cursor: 'pointer',
                          fontWeight: 500,
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = '#EFF6FF';
                          (e.currentTarget as HTMLElement).style.color = '#2563EB';
                          (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = '#fff';
                          (e.currentTarget as HTMLElement).style.color = '#374151';
                          (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
                        }}
                        onClick={() => handleShare(doc.id)}
                      >
                        <Share2 size={12} />
                      </button>
                      {canEdit && doc.filename && (
                        <button
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 10px', borderRadius: 6,
                            border: '1px solid #E2E8F0', background: '#fff',
                            color: '#DC2626', fontSize: 12, cursor: 'pointer',
                            fontWeight: 500,
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#FEF2F2';
                            (e.currentTarget as HTMLElement).style.borderColor = '#FECACA';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = '#fff';
                            (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
                          }}
                          onClick={() => setDocToDelete({ id: doc.id, name: doc.name })}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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

    </div>
  );
}
