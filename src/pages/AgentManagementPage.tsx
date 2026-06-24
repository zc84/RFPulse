import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, Edit2, KeyRound, HelpCircle, Save, Loader2 } from 'lucide-react';
import { Agent, GlobalAISettings } from '../types';
import { agentsApi } from '../api';
import Header from '../components/Header';
import Button from '../components/Button';
import Modal from '../components/Modal';
import FormField, { Input, Select } from '../components/FormField';

const MODEL_OPTIONS = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini', 'gpt-4.5-preview'];

const LLM_PARAM_HINTS: Record<string, { text: string; range: string }> = {
  temperature: { text: 'Lower = more focused answers. Higher = more creative answers.', range: '0 – 2' },
  max_tokens: { text: 'Maximum length of the agent response.', range: '1 – 32000' },
  top_p: { text: 'How many word choices the agent considers. Usually leave at 1.0.', range: '0 – 1' },
  presence_penalty: { text: 'Higher values make the agent avoid repeating topics.', range: '-2 – 2' },
  frequency_penalty: { text: 'Higher values reduce repeated words.', range: '-2 – 2' },
};

function InfoTooltip({ text, range }: { text: string; range: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <HelpCircle size={14} color="#94A3B8" style={{ cursor: 'help' }} />
      {visible && (
        <span style={{
          position: 'absolute',
          top: '50%',
          left: '120%',
          transform: 'translateY(-50%)',
          width: 220,
          background: '#0F172A',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <strong style={{ display: 'block', marginBottom: 4, color: '#94A3B8' }}>Range: {range}</strong>
          {text}
        </span>
      )}
    </span>
  );
}

export default function AgentManagementPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GlobalAISettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<Partial<Agent>>({});
  const [savingAgent, setSavingAgent] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [agentsData, settingsData] = await Promise.all([agentsApi.getAll(), agentsApi.getSettings()]);
      setAgents(agentsData);
      setSettings(settingsData);
      setApiKey('');
    } catch (err) {
      toast.error('Failed to load agents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey) return;
    setSavingKey(true);
    try {
      await agentsApi.updateSettings({ openai_api_key: apiKey });
      toast.success('OpenAI API key saved.');
      setApiKey('');
      await load();
    } catch (err) {
      toast.error('Failed to save API key.');
    } finally {
      setSavingKey(false);
    }
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({ ...agent });
  };

  const handleSaveAgent = async () => {
    if (!editingAgent) return;
    setSavingAgent(true);
    try {
      const updated = await agentsApi.update(editingAgent.slug, {
        name: form.name,
        model: form.model,
        system_prompt: form.system_prompt,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
        top_p: form.top_p,
        presence_penalty: form.presence_penalty,
        frequency_penalty: form.frequency_penalty,
        is_enabled: form.is_enabled,
        sort_order: form.sort_order,
      });
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success('Agent updated.');
      setEditingAgent(null);
    } catch (err) {
      toast.error('Failed to save agent.');
    } finally {
      setSavingAgent(false);
    }
  };

  const setField = (field: keyof Agent) => (value: any) => {
    setForm(p => ({ ...p, [field]: value }));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
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

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>AI Agent Configuration</h1>
            <p style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>Configure agents, models, and the global OpenAI API key.</p>
          </div>
        </div>

        {/* Global API key */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <KeyRound size={16} color="#2563EB" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Global OpenAI API Key</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={settings?.has_key ? '••••••••••••••••••••••••••' : 'sk-...'}
              />
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                {settings?.has_key ? 'A key is already saved. Enter a new one to replace it.' : 'Enter your OpenAI API key to enable AI agents.'}
              </p>
            </div>
            <Button onClick={handleSaveKey} loading={savingKey} disabled={!apiKey} icon={<Save size={14} />}>
              Save Key
            </Button>
          </div>
        </div>

        {/* Agents table */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Loader2 size={28} color="#94A3B8" style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: '#64748B', fontSize: 13 }}>Loading agents…</p>
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Bot size={32} color="#94A3B8" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ color: '#374151', fontWeight: 600, fontSize: 15 }}>No agents configured</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Agent', 'Model', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: h === 'Actions' ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, color: '#64748B',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={agent.id} style={{
                    borderBottom: i < agents.length - 1 ? '1px solid #F1F5F9' : undefined,
                  }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{agent.slug}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>{agent.model}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" icon={<Edit2 size={12} />} onClick={() => openEdit(agent)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Edit modal */}
      {editingAgent && (
        <Modal
          open={!!editingAgent}
          onClose={() => !savingAgent && setEditingAgent(null)}
          title={`Edit Agent · ${editingAgent.name}`}
          width={560}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflow: 'auto' }}>
            <FormField label="Name" required>
              <Input value={form.name || ''} onChange={e => setField('name')(e.target.value)} />
            </FormField>

            <FormField label="Model" required>
              <Select value={form.model || ''} onChange={e => setField('model')(e.target.value)}>
                {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </FormField>

            <FormField label="System Prompt / Skill" required>
              <textarea
                value={form.system_prompt || ''}
                onChange={e => setField('system_prompt')(e.target.value)}
                rows={8}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid #E2E8F0',
                  fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical',
                }}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label={<>Temperature <InfoTooltip text={LLM_PARAM_HINTS.temperature.text} range={LLM_PARAM_HINTS.temperature.range} /></>}>
                <Input type="number" step={0.1} min={0} max={2} value={form.temperature ?? ''} onChange={e => setField('temperature')(parseFloat(e.target.value))} />
              </FormField>

              <FormField label={<>Max Tokens <InfoTooltip text={LLM_PARAM_HINTS.max_tokens.text} range={LLM_PARAM_HINTS.max_tokens.range} /></>}>
                <Input type="number" min={1} max={32000} value={form.max_tokens ?? ''} onChange={e => setField('max_tokens')(parseInt(e.target.value))} />
              </FormField>

              <FormField label={<>Top P <InfoTooltip text={LLM_PARAM_HINTS.top_p.text} range={LLM_PARAM_HINTS.top_p.range} /></>}>
                <Input type="number" step={0.1} min={0} max={1} value={form.top_p ?? ''} onChange={e => setField('top_p')(parseFloat(e.target.value))} />
              </FormField>

              <FormField label={<>Presence Penalty <InfoTooltip text={LLM_PARAM_HINTS.presence_penalty.text} range={LLM_PARAM_HINTS.presence_penalty.range} /></>}>
                <Input type="number" step={0.1} min={-2} max={2} value={form.presence_penalty ?? ''} onChange={e => setField('presence_penalty')(parseFloat(e.target.value))} />
              </FormField>

              <FormField label={<>Frequency Penalty <InfoTooltip text={LLM_PARAM_HINTS.frequency_penalty.text} range={LLM_PARAM_HINTS.frequency_penalty.range} /></>}>
                <Input type="number" step={0.1} min={-2} max={2} value={form.frequency_penalty ?? ''} onChange={e => setField('frequency_penalty')(parseFloat(e.target.value))} />
              </FormField>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <Button variant="secondary" onClick={() => setEditingAgent(null)} disabled={savingAgent}>Cancel</Button>
              <Button onClick={handleSaveAgent} loading={savingAgent}>
                {savingAgent ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
