import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, Database, Edit2, Plus, Save, Settings, Trash2, Users } from 'lucide-react';
import Header from '../components/Header';
import Button from '../components/Button';
import FormField, { Input } from '../components/FormField';
import UserManagementPage from './UserManagementPage';
import AgentManagementPage from './AgentManagementPage';
import { PlatformConfigOption } from '../types';
import { platformApi } from '../api';

type Tab = 'users' | 'ai' | 'cms';
type OptionType = 'status' | 'domain';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'users', label: 'User Management', icon: <Users size={14} /> },
  { id: 'ai', label: 'AI Settings', icon: <Bot size={14} /> },
  { id: 'cms', label: 'CMS', icon: <Database size={14} /> },
];

function CmsOptionsSection({
  title,
  type,
  options,
  onReload,
}: {
  title: string;
  type: OptionType;
  options: PlatformConfigOption[];
  onReload: () => Promise<void>;
}) {
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!newValue.trim()) return;
    setBusy(true);
    try {
      await platformApi.createOption({ type, value: newValue.trim() });
      setNewValue('');
      await onReload();
      toast.success(`${title.slice(0, -1)} added.`);
    } catch (err: any) {
      toast.error(err.message || `Failed to add ${type}.`);
    } finally {
      setBusy(false);
    }
  };

  const save = async (option: PlatformConfigOption) => {
    if (!editingValue.trim()) return;
    setBusy(true);
    try {
      await platformApi.updateOption(option.id, { value: editingValue.trim(), sort_order: option.sort_order });
      setEditingId(null);
      await onReload();
      toast.success(`${title.slice(0, -1)} updated.`);
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${type}.`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (option: PlatformConfigOption) => {
    if (!window.confirm(`Delete "${option.value}" from ${title.toLowerCase()}? This is allowed only when no deals use it.`)) return;
    setBusy(true);
    try {
      await platformApi.deleteOption(option.id);
      await onReload();
      toast.success(`${title.slice(0, -1)} deleted.`);
    } catch (err: any) {
      toast.error(err.message || `Failed to delete ${type}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{title}</h2>
        <span style={{ color: '#94A3B8', fontSize: 12 }}>{options.length} item{options.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder={`Add ${type}`} />
          <Button size="md" icon={<Plus size={13} />} onClick={add} disabled={busy || !newValue.trim()}>
            Add
          </Button>
        </div>
        {options.map(option => (
          <div key={option.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
            padding: 10, border: '1px solid #F1F5F9', borderRadius: 8, background: '#F8FAFC',
          }}>
            {editingId === option.id ? (
              <Input value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{option.value}</span>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              {editingId === option.id ? (
                <Button size="sm" icon={<Save size={12} />} onClick={() => save(option)} disabled={busy || !editingValue.trim()}>
                  Save
                </Button>
              ) : (
                <Button size="sm" variant="ghost" icon={<Edit2 size={12} />} onClick={() => { setEditingId(option.id); setEditingValue(option.value); }}>
                  Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => remove(option)} disabled={busy} style={{ color: '#DC2626' }}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CmsTab() {
  const [options, setOptions] = useState<PlatformConfigOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setOptions(await platformApi.getOptions());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load CMS options.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => ({
    status: options.filter(o => o.type === 'status'),
    domain: options.filter(o => o.type === 'domain'),
  }), [options]);

  if (loading) return <div style={{ color: '#64748B', fontSize: 13 }}>Loading CMS options...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      <CmsOptionsSection title="Statuses" type="status" options={grouped.status} onReload={load} />
      <CmsOptionsSection title="Domains" type="domain" options={grouped.domain} onReload={load} />
    </div>
  );
}

export default function PlatformConfigPage() {
  const [params, setParams] = useSearchParams();
  const selected = (params.get('tab') as Tab) || 'users';
  const activeTab = tabs.some(tab => tab.id === selected) ? selected : 'users';

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, padding: 24, maxWidth: 1120, margin: '0 auto', width: '100%' }}>
        <Link to="/deals" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', fontSize: 13, marginBottom: 20,
          textDecoration: 'none', fontWeight: 500,
        }}>
          <ArrowLeft size={14} /> Back to deals
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Settings size={18} color="#2563EB" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>Platform Configuration</h1>
            <p style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>Manage users, AI settings, statuses, and domains.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #E2E8F0' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setParams({ tab: tab.id })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '10px 12px', marginBottom: -1,
                borderBottom: activeTab === tab.id ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === tab.id ? '#2563EB' : '#64748B',
                fontSize: 13, fontWeight: 700,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && <UserManagementPage embedded />}
        {activeTab === 'ai' && <AgentManagementPage embedded />}
        {activeTab === 'cms' && <CmsTab />}
      </main>
    </div>
  );
}
