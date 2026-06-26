import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, RefreshCw, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FileText, Filter, Lock } from 'lucide-react';
import { useDeals } from '../context/DealsContext';
import { useAuth } from '../context/AuthContext';
import { Deal, DealStatus, User } from '../types';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';

type SortField = 'id' | 'name' | 'status' | 'dueDate' | 'budget' | 'domain' | 'clientName' | 'classification' | 'assigneeName';
type SortDir = 'asc' | 'desc';

const ALL_STATUSES: DealStatus[] = ['New', 'In Progress', 'Won', 'Lost', 'TBC'];
const PAGE_SIZE = 10;

const STATUS_ORDER: Record<DealStatus, number> = { New: 0, 'In Progress': 1, Won: 2, Lost: 3, TBC: 4 };

function formatBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DealsListPage() {
  const { deals, updateDeal } = useDeals();
  const { isRole, users } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<DealStatus[]>(ALL_STATUSES);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(() => [
    ...users.map(u => u.id),
    'unassigned',
  ]);
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canEdit = isRole('Superadmin', 'Editor');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1200));
    setRefreshKey(k => k + 1);
    setRefreshing(false);
  }, []);

  const toggleStatus = (s: DealStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
    setPage(1);
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssignees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = deals;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.domain.toLowerCase().includes(q)
      );
    }
    if (selectedStatuses.length > 0) {
      result = result.filter(d => selectedStatuses.includes(d.status));
    }
    if (selectedAssignees.length > 0) {
      result = result.filter(d => {
        if (!d.assigneeId) return selectedAssignees.includes('unassigned');
        return selectedAssignees.includes(d.assigneeId);
      });
    }
    return result;
  }, [deals, search, selectedStatuses, selectedAssignees, refreshKey]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortField) {
      arr.sort((a, b) => {
        let va: string | number = a[sortField] as string | number;
        let vb: string | number = b[sortField] as string | number;
        if (sortField === 'budget') {
          va = a.budget; vb = b.budget;
        } else if (sortField === 'status') {
          va = STATUS_ORDER[a.status]; vb = STATUS_ORDER[b.status];
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      arr.sort((a, b) => {
        const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (sd !== 0) return sd;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, display: 'flex', alignItems: 'center' }}><ChevronUp size={12} /></span>;
    return sortDir === 'asc' ? <ChevronUp size={12} style={{ color: '#2563EB' }} /> : <ChevronDown size={12} style={{ color: '#2563EB' }} />;
  };

  const colHeader = (label: string, field: SortField) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        padding: '10px 16px',
        textAlign: 'left',
        fontSize: 12,
        fontWeight: 600,
        color: sortField === field ? '#2563EB' : '#64748B',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        background: '#F8FAFC',
        borderBottom: '1px solid #E2E8F0',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label} <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>Deals & Tenders</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />}
              loading={false}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            {canEdit && (
              <Button icon={<Plus size={14} />} onClick={() => navigate('/deals/new')}>
                Add Deal
              </Button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, ID, or domain…"
              style={{
                width: '100%', padding: '8px 12px 8px 32px',
                border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13,
                color: '#0F172A', background: '#F8FAFC', outline: 'none',
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Filter size={13} />}
              onClick={() => setShowStatusFilter(p => !p)}
            >
              Status {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}
            </Button>
            {showStatusFilter && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
                padding: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 160,
              }}>
                {ALL_STATUSES.map(s => (
                  <label key={s} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', cursor: 'pointer', borderRadius: 5,
                    fontSize: 13, color: '#374151',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(s)}
                      onChange={() => toggleStatus(s)}
                      style={{ cursor: 'pointer' }}
                    />
                    <StatusBadge status={s} size="sm" />
                  </label>
                ))}
                {selectedStatuses.length > 0 && (
                  <button
                    onClick={() => { setSelectedStatuses([]); setShowStatusFilter(false); }}
                    style={{
                      width: '100%', marginTop: 4, padding: '5px 8px',
                      border: 'none', background: 'none', color: '#DC2626',
                      fontSize: 12, cursor: 'pointer', textAlign: 'left', borderRadius: 5,
                    }}
                  >Clear filters</button>
                )}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Filter size={13} />}
              onClick={() => setShowAssigneeFilter(p => !p)}
            >
              Assigned {selectedAssignees.length > 0 && `(${selectedAssignees.length})`}
            </Button>
            {showAssigneeFilter && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
                padding: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 160,
              }}>
                {users.map(u => (
                  <label key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', cursor: 'pointer', borderRadius: 5,
                    fontSize: 13, color: '#374151',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssignees.includes(u.id)}
                      onChange={() => toggleAssignee(u.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    {u.name}
                  </label>
                ))}
                <label key="unassigned" style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', cursor: 'pointer', borderRadius: 5,
                    fontSize: 13, color: '#374151',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssignees.includes('unassigned')}
                      onChange={() => toggleAssignee('unassigned')}
                      style={{ cursor: 'pointer' }}
                    />
                    Unassigned
                  </label>
                {selectedAssignees.length > 0 && (
                  <button
                    onClick={() => { setSelectedAssignees([]); setShowAssigneeFilter(false); }}
                    style={{
                      width: '100%', marginTop: 4, padding: '5px 8px',
                      border: 'none', background: 'none', color: '#DC2626',
                      fontSize: 12, cursor: 'pointer', textAlign: 'left', borderRadius: 5,
                    }}
                  >Clear filters</button>
                )}
              </div>
            )}
          </div>

          {(search || selectedStatuses.length > 0 || selectedAssignees.length > 0) && (
            <button
              onClick={() => { setSearch(''); setSelectedStatuses([]); setSelectedAssignees([]); setPage(1); }}
              style={{
                background: 'none', border: 'none', color: '#94A3B8',
                fontSize: 12, cursor: 'pointer', padding: '4px 8px',
              }}
            >
              Clear all
            </button>
          )}

          <div style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 12 }}>
            {sorted.length} deal{sorted.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {refreshing ? (
            <div style={{ padding: 64, textAlign: 'center' }}>
              <div style={{
                display: 'inline-block', width: 32, height: 32, borderRadius: '50%',
                border: '3px solid #E2E8F0', borderTopColor: '#2563EB',
                animation: 'spin 0.8s linear infinite', marginBottom: 12,
              }} />
              <div style={{ color: '#64748B', fontSize: 13 }}>Refreshing deals…</div>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: 64, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <FileText size={24} color="#94A3B8" />
              </div>
              <p style={{ color: '#374151', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                {search || selectedStatuses.length > 0 || selectedAssignees.length > 0 ? 'No deals match your criteria.' : 'No deals added yet.'}
              </p>
              <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>
                {search || selectedStatuses.length > 0 || selectedAssignees.length > 0
                  ? 'Try adjusting your filters or search query.'
                  : 'Get started by adding your first deal.'}
              </p>
              {canEdit && (
                <Button icon={<Plus size={14} />} onClick={() => navigate('/deals/new')} size="sm">
                  Add your first deal
                </Button>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {colHeader('ID', 'id')}
                      {colHeader('Name', 'name')}
                      {colHeader('Status', 'status')}
                      {colHeader('Due Date', 'dueDate')}
                      {colHeader('Budget', 'budget')}
                      {colHeader('Domain', 'domain')}
                      {colHeader('Client', 'clientName')}
                      {colHeader('Assignee', 'assigneeName')}
                      {colHeader('Class', 'classification')}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((deal, i) => (
                      <TableRow key={deal.id} deal={deal} i={i} onClick={() => navigate(`/deals/${deal.id}`)} users={users} canEdit={canEdit} onAssigneeChange={async (dealId, userId) => { await updateDeal(dealId, { assigneeId: userId || undefined }); }} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderTop: '1px solid #F1F5F9',
                color: '#64748B', fontSize: 13,
              }}>
                <span>
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} deal{sorted.length !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
                      background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
                      color: page === 1 ? '#CBD5E1' : '#374151', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p =>
                    p === 1 || p === totalPages || Math.abs(p - page) <= 1
                  ).reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, []).map((p, idx) => (
                    typeof p === 'string' ? (
                      <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8' }}>{p}</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        style={{
                          width: 30, height: 30, borderRadius: 6, border: '1px solid',
                          borderColor: page === p ? '#2563EB' : '#E2E8F0',
                          background: page === p ? '#2563EB' : '#fff',
                          color: page === p ? '#fff' : '#374151',
                          fontSize: 12, fontWeight: page === p ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    )
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{
                      padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
                      background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                      color: page === totalPages ? '#CBD5E1' : '#374151', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

    </div>
  );
}

function TableRow({ deal, i, onClick, users, canEdit, onAssigneeChange }: { deal: Deal; i: number; onClick: () => void; users: User[]; canEdit: boolean; onAssigneeChange: (dealId: string, userId: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const isLocked = !!deal.lock;

  const isFinal = deal.status === 'Won' || deal.status === 'Lost';
  const dueDay = new Date(deal.dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let dateColor = '#374151';
  let dateWeight = 400;
  if (!isFinal) {
    if (daysUntil <= 0) {
      dateColor = '#DC2626';
      dateWeight = 500;
    } else if (daysUntil <= 2) {
      dateColor = '#CA8A04';
      dateWeight = 500;
    }
  }

  return (
    <tr
      onClick={isLocked ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#F8FAFC' : i % 2 === 0 ? '#fff' : '#FAFAFA',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.7 : 1,
        borderBottom: '1px solid #F1F5F9',
        transition: 'background 0.1s',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B', fontFamily: 'monospace', fontWeight: 500 }}>
        {deal.id}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#0F172A', fontWeight: 500, maxWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.name}</span>
          {isLocked && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
              padding: '2px 6px', borderRadius: 999,
              background: '#FEF3C7', color: '#B45309', fontSize: 10, fontWeight: 600,
            }}>
              <Lock size={10} />
              {deal.lock?.userName}
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <StatusBadge status={deal.status} size="sm" />
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: dateColor, fontWeight: dateWeight, whiteSpace: 'nowrap' }}>
        {formatDate(deal.dueDate)}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {formatBudget(deal.budget)}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
          background: '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 500,
        }}>
          {deal.domain}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
        {deal.clientName || '-'}
      </td>
      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
        {canEdit && !isLocked ? (
          <select
            value={deal.assigneeId || ''}
            onChange={e => onAssigneeChange(deal.id, e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0',
              fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer',
              outline: 'none', maxWidth: 120,
            }}
          >
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 13, color: '#374151' }}>{deal.assigneeName || '-'}</span>
        )}
      </td>
      <td style={{ padding: '12px 16px' }}>
        {deal.classification && (
          <span style={{
            display: 'inline-block', padding: '3px 8px', borderRadius: 6,
            background: deal.classification === 'A' ? '#DCFCE7' : deal.classification === 'B' ? '#FEF3C7' : '#FEE2E2',
            color: deal.classification === 'A' ? '#166534' : deal.classification === 'B' ? '#92400E' : '#991B1B',
            fontSize: 11, fontWeight: 600,
          }}>
            {deal.classification}
          </span>
        )}
      </td>
    </tr>
  );
}
