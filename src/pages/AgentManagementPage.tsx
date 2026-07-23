import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, Edit2, KeyRound, HelpCircle, Save, Loader2, RefreshCw, Upload, Trash2, FileText } from 'lucide-react';
import { Agent, AICapability, AIKnowledgeRetrieveResponse, AIRuntimeSettings, GlobalAISettings, OpenAIModel, PromptTemplate } from '../types';
import { agentsApi, aiApi, capabilityApi } from '../api';
import Header from '../components/Header';
import Button from '../components/Button';
import Modal from '../components/Modal';
import FormField, { Input, Select } from '../components/FormField';

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

export default function AgentManagementPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GlobalAISettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [proposalTemplateFile, setProposalTemplateFile] = useState<File | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<Partial<Agent>>({});
  const [savingAgent, setSavingAgent] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [knowledgeDealId, setKnowledgeDealId] = useState('');
  const [knowledgeSource, setKnowledgeSource] = useState<'framework' | 'company'>('framework');
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeIntents, setKnowledgeIntents] = useState('');
  const [knowledgeLimit, setKnowledgeLimit] = useState(5);
  const [knowledgeIncludeRelated, setKnowledgeIncludeRelated] = useState(true);
  const [knowledgeRelatedLimit, setKnowledgeRelatedLimit] = useState(2);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeResult, setKnowledgeResult] = useState<AIKnowledgeRetrieveResponse | null>(null);
  const [capabilities, setCapabilities] = useState<AICapability[]>([]);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [capabilitySaving, setCapabilitySaving] = useState<number | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<AIRuntimeSettings | null>(null);
  const [runtimeSaving, setRuntimeSaving] = useState(false);

  const handleKnowledgeRetrieve = async () => {
    if (!knowledgeDealId.trim()) {
      toast.error('Enter a deal ID (for example D-12) to run retrieval test.');
      return;
    }
    if (!knowledgeQuery.trim()) {
      toast.error('Enter a retrieval query.');
      return;
    }

    setKnowledgeLoading(true);
    try {
      const response = await aiApi.retrieveKnowledge(knowledgeDealId.trim(), {
        source: knowledgeSource,
        queryText: knowledgeQuery.trim(),
        intents: knowledgeIntents
          .split(',')
          .map(intent => intent.trim())
          .filter(Boolean),
        limit: knowledgeLimit,
        includeRelated: knowledgeSource === 'framework' ? knowledgeIncludeRelated : false,
        relatedLimit: knowledgeSource === 'framework' ? knowledgeRelatedLimit : 0,
      });
      setKnowledgeResult(response);
      toast.success('Knowledge retrieval completed.');
    } catch (err: any) {
      toast.error(err.message || 'Knowledge retrieval failed.');
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setCapabilitiesLoading(true);
    try {
      const [agentsData, settingsData, promptsData, capabilityData, runtimeData] = await Promise.all([
        agentsApi.getAll(), agentsApi.getSettings(), agentsApi.getPrompts(), capabilityApi.getAll(), agentsApi.getRuntimeSettings(),
      ]);
      setAgents(agentsData);
      setCapabilities(capabilityData.capabilities);
      setPromptTemplates(promptsData);
      setRuntimeSettings(runtimeData);
      setSettings(settingsData);
      setApiKey('');
      if (settingsData.has_key) {
        await loadModels();
      } else {
        setModels([]);
        setModelsError(null);
      }
    } catch (err) {
      toast.error('Failed to load agents.');
    } finally {
      setLoading(false);
      setCapabilitiesLoading(false);
    }
  };

  const updateRuntime = async (patch: Partial<AIRuntimeSettings>) => {
    if (!runtimeSettings) return;
    const next = { ...runtimeSettings, ...patch };
    setRuntimeSaving(true);
    try {
      await agentsApi.updateRuntimeSettings(patch);
      setRuntimeSettings(next);
      toast.success('Runtime settings saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save runtime settings.');
    } finally {
      setRuntimeSaving(false);
    }
  };

  const updatePolicyNumber = (path: 'defaultRoleRate' | 'qaOverheadPercent' | 'pmOverheadPercent' | 'taskMinHours' | 'taskMaxHours' | 'highRiskMinimumPercent', value: number) => {
    if (!runtimeSettings || !Number.isFinite(value)) return;
    const policy = runtimeSettings.ai_estimation_policy || {};
    const nextPolicy = path === 'taskMinHours' || path === 'taskMaxHours'
      ? { ...policy, taskSizing: { ...(policy.taskSizing || {}), [path === 'taskMinHours' ? 'minHours' : 'maxHours']: value } }
      : path === 'highRiskMinimumPercent'
        ? { ...policy, contingency: { ...(policy.contingency || {}), highRiskMinimumPercent: value } }
        : { ...policy, [path]: value };
    setRuntimeSettings({ ...runtimeSettings, ai_estimation_policy: nextPolicy });
  };

  const savePolicy = () => runtimeSettings && updateRuntime({ ai_estimation_policy: runtimeSettings.ai_estimation_policy });

  const handleCapabilityToggle = async (capability: AICapability) => {
    setCapabilitySaving(capability.id);
    try {
      const response = await capabilityApi.update(capability.id, !capability.enabled);
      setCapabilities(current => current.map(item => item.id === capability.id ? { ...item, enabled: response.capability.enabled } : item));
      toast.success(`${capability.name} ${response.capability.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update capability.');
    } finally {
      setCapabilitySaving(null);
    }
  };

  const loadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await agentsApi.getModels();
      setModels(data.models);
    } catch (err: any) {
      const message = err.message || 'Failed to load OpenAI models.';
      setModels([]);
      setModelsError(message);
    } finally {
      setModelsLoading(false);
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

  const handleUploadProposalTemplate = async () => {
    if (!proposalTemplateFile) return;
    setSavingTemplate(true);
    try {
      await agentsApi.uploadProposalTemplate(proposalTemplateFile);
      toast.success('Proposal template saved.');
      setProposalTemplateFile(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload proposal template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteProposalTemplate = async () => {
    if (!window.confirm('Remove the active proposal template? The system will use the built-in fallback layout.')) return;
    setSavingTemplate(true);
    try {
      await agentsApi.deleteProposalTemplate();
      toast.success('Proposal template removed.');
      setProposalTemplateFile(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove proposal template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({ ...agent });
    setPromptDrafts(Object.fromEntries(
      promptTemplates.filter(prompt => prompt.agent_slug === agent.slug || prompt.kind === 'shared').map(prompt => [prompt.prompt_key, prompt.content])
    ));
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
      const relevantPrompts = promptTemplates.filter(prompt => prompt.agent_slug === editingAgent.slug || prompt.kind === 'shared');
      const savedPrompts = await Promise.all(relevantPrompts.map(prompt => agentsApi.updatePrompt(prompt.prompt_key, promptDrafts[prompt.prompt_key] ?? prompt.content)));
      setPromptTemplates(prev => prev.map(prompt => savedPrompts.find(saved => saved.id === prompt.id) || prompt));
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

  const modelOptions = Array.from(new Set([
    ...(form.model ? [form.model] : []),
    ...agents.map(agent => agent.model).filter(Boolean),
    ...models.map(model => model.id),
  ])).sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ minHeight: embedded ? undefined : '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {!embedded && <Header />}

      <main style={{ flex: 1, padding: embedded ? 0 : '24px', maxWidth: embedded ? 'none' : 1000, margin: '0 auto', width: '100%' }}>
        {!embedded && <Link to="/deals" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', fontSize: 13, marginBottom: 20,
          textDecoration: 'none', fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748B'}
        >
          <ArrowLeft size={14} /> Back to deals
        </Link>}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>AI Settings</h1>
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
              {settings?.has_key && (
                <p style={{ fontSize: 11, color: modelsError ? '#B91C1C' : '#64748B', marginTop: 6 }}>
                  {modelsLoading
                    ? 'Loading available OpenAI models…'
                    : modelsError
                      ? modelsError
                      : `${models.length} model${models.length === 1 ? '' : 's'} available for the saved key.`}
                </p>
              )}
            </div>
            <Button onClick={handleSaveKey} loading={savingKey} disabled={!apiKey} icon={<Save size={14} />}>
              Save Key
            </Button>
            <Button
              variant="secondary"
              onClick={loadModels}
              loading={modelsLoading}
              disabled={!settings?.has_key || savingKey}
              icon={<RefreshCw size={14} />}
            >
              Refresh Models
            </Button>
          </div>
        </div>

        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Bot size={16} color="#7C3AED" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Runtime capabilities</h2>
          </div>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            Enabled capabilities are available to the AI planner. Changes apply to new runs and are recorded in the run plan.
          </p>
          {capabilitiesLoading ? <p style={{ color: '#64748B', fontSize: 13 }}>Loading capabilities…</p> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {capabilities.map(capability => (
                <div key={capability.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{capability.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{capability.capability_key} · v{capability.version} · {capability.concurrency_class || 'default'}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{capability.description}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={capability.enabled ? 'secondary' : 'ghost'}
                    loading={capabilitySaving === capability.id}
                    onClick={() => handleCapabilityToggle(capability)}
                  >
                    {capability.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Planner and estimation policy */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={16} color="#059669" />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Planner & estimation policy</h2>
            </div>
            <Button size="sm" variant="secondary" onClick={savePolicy} loading={runtimeSaving} disabled={!runtimeSettings}>Save policy</Button>
          </div>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
            Control runtime rollout and versioned estimation values. Changes apply to new runs; each run keeps its own policy snapshot.
          </p>
          {runtimeSettings ? (
            <>
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                {[
                  ['ai_runtime_v2_enabled', 'Enable v2 runtime', 'Use the dynamic planner and DAG executor for new runs.'],
                  ['ai_runtime_v2_shadow_mode', 'Shadow mode', 'Generate and store v2 plans while legacy execution remains user-visible.'],
                  ['ai_framework_retrieval_enabled', 'Framework retrieval', 'Allow planner capabilities to retrieve approved framework knowledge.'],
                ].map(([key, label, help]) => {
                  const settingKey = key as keyof Pick<AIRuntimeSettings, 'ai_runtime_v2_enabled' | 'ai_runtime_v2_shadow_mode' | 'ai_framework_retrieval_enabled'>;
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
                      <span><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{label}</span><span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 3 }}>{help}</span></span>
                      <input type="checkbox" checked={runtimeSettings[settingKey]} disabled={runtimeSaving} onChange={event => updateRuntime({ [settingKey]: event.target.checked })} />
                    </label>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Estimation policy v{runtimeSettings.ai_estimation_policy.version || 1}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  ['defaultRoleRate', 'Default rate', runtimeSettings.ai_estimation_policy.defaultRoleRate],
                  ['qaOverheadPercent', 'QA overhead %', runtimeSettings.ai_estimation_policy.qaOverheadPercent],
                  ['pmOverheadPercent', 'PM overhead %', runtimeSettings.ai_estimation_policy.pmOverheadPercent],
                  ['taskMinHours', 'Min task hours', runtimeSettings.ai_estimation_policy.taskSizing?.minHours],
                  ['taskMaxHours', 'Max task hours', runtimeSettings.ai_estimation_policy.taskSizing?.maxHours],
                  ['highRiskMinimumPercent', 'High-risk contingency %', runtimeSettings.ai_estimation_policy.contingency?.highRiskMinimumPercent],
                ].map(([key, label, value]) => (
                  <FormField key={key as string} label={label as string}>
                    <Input type="number" value={value ?? ''} onChange={event => updatePolicyNumber(key as any, Number(event.target.value))} />
                  </FormField>
                ))}
              </div>
            </>
          ) : <p style={{ color: '#64748B', fontSize: 13 }}>Loading runtime settings…</p>}
        </div>

        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileText size={16} color="#4F46E5" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Proposal Template</h2>
          </div>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            Upload a DOCX template for the final proposal. If no template is uploaded, the system uses a built-in fallback layout.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 8, border: '1px dashed #CBD5E1',
              background: '#FAFAFA', cursor: 'pointer', fontSize: 13, color: '#334155',
            }}>
              <Upload size={14} />
              <span>{proposalTemplateFile ? proposalTemplateFile.name : 'Choose DOCX file'}</span>
              <input
                type="file"
                accept=".docx"
                onChange={e => setProposalTemplateFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
            </label>
            <Button
              onClick={handleUploadProposalTemplate}
              loading={savingTemplate}
              disabled={!proposalTemplateFile}
              icon={<Save size={14} />}
            >
              Save Template
            </Button>
            <Button
              variant="secondary"
              onClick={handleDeleteProposalTemplate}
              disabled={!settings?.has_proposal_template || savingTemplate}
              icon={<Trash2 size={14} />}
            >
              Remove Template
            </Button>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#64748B' }}>
            {settings?.has_proposal_template
              ? `Active template: ${settings.proposal_template_name || 'proposal-template.docx'}${settings.proposal_template_uploaded_at ? ` · uploaded ${new Date(settings.proposal_template_uploaded_at).toLocaleString()}` : ''}`
              : 'No active proposal template. The fallback DOCX layout will be used.'}
          </div>
        </div>

        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Bot size={16} color="#0EA5E9" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Knowledge Retrieval Test Console</h2>
          </div>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            Test framework/company retrieval behavior for a specific deal context and inspect ranked candidates and selected sections.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
            <FormField label="Deal ID" required>
              <Input
                value={knowledgeDealId}
                onChange={event => setKnowledgeDealId(event.target.value)}
                placeholder="D-12"
              />
            </FormField>
            <FormField label="Knowledge Source" required>
              <Select value={knowledgeSource} onChange={event => setKnowledgeSource(event.target.value as 'framework' | 'company')}>
                <option value="framework">Framework</option>
                <option value="company">Company Profile</option>
              </Select>
            </FormField>
            <FormField label="Limit">
              <Input
                type="number"
                min={1}
                max={10}
                value={knowledgeLimit}
                onChange={event => setKnowledgeLimit(Math.max(1, Math.min(10, Number(event.target.value) || 5)))}
              />
            </FormField>
          </div>
          <FormField label="Query" required>
            <textarea
              value={knowledgeQuery}
              onChange={event => setKnowledgeQuery(event.target.value)}
              rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
              placeholder="security compliance data residency"
            />
          </FormField>
          <FormField label="Intents (comma-separated, optional)">
            <Input
              value={knowledgeIntents}
              onChange={event => setKnowledgeIntents(event.target.value)}
              placeholder="security governance, delivery governance"
            />
          </FormField>
          {knowledgeSource === 'framework' && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 10, marginTop: 2 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={knowledgeIncludeRelated}
                  onChange={event => setKnowledgeIncludeRelated(event.target.checked)}
                />
                Include related sections
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                Related limit
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={knowledgeRelatedLimit}
                  onChange={event => setKnowledgeRelatedLimit(Math.max(0, Math.min(5, Number(event.target.value) || 0)))}
                  style={{ width: 72, padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </label>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <Button onClick={handleKnowledgeRetrieve} loading={knowledgeLoading} icon={<RefreshCw size={14} />}>
              Run Retrieval Test
            </Button>
          </div>
          {knowledgeResult && (
            <div style={{ marginTop: 14, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 12, color: '#334155' }}>
                <strong>Result:</strong> {knowledgeResult.source} · intents: {knowledgeResult.retrieval.intents.join(', ') || 'none'} · source version: {knowledgeResult.retrieval.sourceVersion || 'n/a'}
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Top Candidates</div>
                  {knowledgeResult.retrieval.candidates.slice(0, 5).map(candidate => (
                    <div key={`candidate-${candidate.sectionId}`} style={{ fontSize: 12, color: '#475569', padding: '4px 0' }}>
                      <strong>{candidate.sectionId}</strong> — {candidate.title} (score: {candidate.score})
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Selected Sections</div>
                  {knowledgeResult.retrieval.sections.map(section => (
                    <div key={`section-${section.sectionId}`} style={{ fontSize: 12, color: '#334155', padding: '6px 0', borderTop: '1px solid #F1F5F9' }}>
                      <strong>{section.sectionId}</strong> · {section.title}
                      {section.summary ? <div style={{ color: '#64748B', marginTop: 2 }}>{section.summary}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
                {modelsLoading && <option value={form.model || ''}>{form.model || 'Loading models…'}</option>}
                {!modelsLoading && modelOptions.length === 0 && <option value="">No models available</option>}
                {!modelsLoading && modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
              <div style={{ fontSize: 11, color: modelsError ? '#B91C1C' : '#94A3B8', marginTop: 6 }}>
                {modelsError
                  ? modelsError
                  : settings?.has_key
                    ? 'Model list is loaded from the saved OpenAI API key.'
                    : 'Save an OpenAI API key to load available models automatically.'}
              </div>
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

            {promptTemplates
              .filter(prompt => prompt.agent_slug === editingAgent.slug || prompt.kind === 'shared')
              .map(prompt => (
                <FormField key={prompt.prompt_key} label={`${prompt.kind === 'shared' ? 'Shared Policy' : 'Task Prompt'} · ${prompt.name}`}>
                  <textarea
                    value={promptDrafts[prompt.prompt_key] ?? prompt.content}
                    onChange={event => setPromptDrafts(prev => ({ ...prev, [prompt.prompt_key]: event.target.value }))}
                    rows={6}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
                  />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{prompt.prompt_key} · version {prompt.prompt_version}</div>
                </FormField>
              ))}

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
