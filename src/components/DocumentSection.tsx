import { FileText, Download, Share2, Trash2, Upload, X } from 'lucide-react';
import { Document } from '../types';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DocumentSectionProps {
  title: string;
  icon: React.ReactNode;
  documents: Document[];
  source: 'user' | 'ai';
  canEdit: boolean;
  canUpload?: boolean;
  onUpload?: (files: FileList | null) => void;
  onDownload: (doc: Document) => void;
  onShare: (docId: string) => void;
  onDelete: (doc: Document) => void;
  badge?: string;
  emptyText?: string;
  accepted?: string;
}

export default function DocumentSection({
  title,
  icon,
  documents,
  source,
  canEdit,
  canUpload,
  onUpload,
  onDownload,
  onShare,
  onDelete,
  badge,
  emptyText = 'No documents.',
  accepted = '.pdf,.docx,.xlsx,.doc,.ppt,.pptx',
}: DocumentSectionProps) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
        background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {icon}
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          {title} ({documents.length})
        </h2>
        {badge && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: source === 'ai' ? '#2563EB' : '#64748B', background: source === 'ai' ? '#EFF6FF' : '#F1F5F9',
            padding: '2px 8px', borderRadius: 12,
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: 16 }}>
        {documents.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            {emptyText}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: canUpload ? 16 : 0 }}>
            {documents.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#F8FAFC',
                border: '1px solid #E2E8F0', borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: source === 'ai' ? '#E0E7FF' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FileText size={16} color={source === 'ai' ? '#4F46E5' : '#2563EB'} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }} title={doc.name}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      {doc.size} · Uploaded {formatDate(doc.uploadedAt)}
                      {doc.source === 'ai' && <span style={{ marginLeft: 8, color: '#4F46E5', fontWeight: 600 }}>AI</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
                    onClick={() => doc.filename && onDownload(doc)}
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
                    onClick={() => onShare(doc.id)}
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
                      onClick={() => onDelete(doc)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {canUpload && onUpload && (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: 20, border: '2px dashed #E2E8F0', borderRadius: 8, cursor: 'pointer',
            background: '#FAFAFA', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = source === 'ai' ? '#4F46E5' : '#2563EB';
            (e.currentTarget as HTMLElement).style.background = source === 'ai' ? '#EEF2FF' : '#EFF6FF';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
            (e.currentTarget as HTMLElement).style.background = '#FAFAFA';
          }}
          >
            <Upload size={18} color={source === 'ai' ? '#4F46E5' : '#94A3B8'} />
            <span style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>
              <span style={{ color: source === 'ai' ? '#4F46E5' : '#2563EB', fontWeight: 500 }}>Click to upload</span> or drag & drop
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>PDF, DOCX, XLSX up to 20MB</span>
            <input
              type="file"
              multiple
              accept={accepted}
              onChange={e => { onUpload(e.target.files); e.target.value = ''; }}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
