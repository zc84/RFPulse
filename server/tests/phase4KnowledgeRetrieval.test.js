import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureDefaultCapabilities } from '../ai-runtime/capabilities/capabilityRegistry.js';
import {
  EVIDENCE_CLASSIFICATION,
  normalizeClassifiedEvidence,
} from '../ai-runtime/capabilities/agentCapabilityAdapters.js';
import { retrieveCompanyProfileSections } from '../ai-runtime/knowledge/companyProfileRetriever.js';
import { retrieveFrameworkSections } from '../ai-runtime/knowledge/frameworkRetriever.js';
import { parseFrameworkSemanticDocument } from '../ai-runtime/knowledge/knowledgeParser.js';
import { compileWorkflowPlan } from '../ai-runtime/planner/planCompiler.js';

function createKnowledgeQueryMock() {
  const knowledgeRows = [];

  return async function queryMock(text, params = []) {
    if (/INSERT INTO knowledge_sections/i.test(text)) {
      if (/VALUES \(\s*'framework'/i.test(text)) {
        const [sectionId, title, summary, tagsJson, rfpQuestionsJson, relatedJson, engagementModelsJson, content, , sourceVersion, metadataJson] = params;
        const row = {
          source_type: 'framework',
          section_id: sectionId,
          title,
          summary,
          tags: JSON.parse(tagsJson || '[]'),
          rfp_questions: JSON.parse(rfpQuestionsJson || '[]'),
          related_sections: JSON.parse(relatedJson || '[]'),
          engagement_models: JSON.parse(engagementModelsJson || '[]'),
          content,
          source_version: sourceVersion,
          metadata: JSON.parse(metadataJson || '{}'),
          active: true,
        };
        const existingIndex = knowledgeRows.findIndex(item => item.source_type === 'framework' && item.section_id === sectionId);
        if (existingIndex >= 0) knowledgeRows[existingIndex] = row;
        else knowledgeRows.push(row);
      } else if (/VALUES \(\s*'company'/i.test(text)) {
        const [sectionId, title, summary, tagsJson, content, , sourceVersion] = params;
        const row = {
          source_type: 'company',
          section_id: sectionId,
          title,
          summary,
          tags: JSON.parse(tagsJson || '[]'),
          rfp_questions: [],
          related_sections: [],
          engagement_models: ['all'],
          content,
          source_version: sourceVersion,
          metadata: {},
          active: true,
        };
        const existingIndex = knowledgeRows.findIndex(item => item.source_type === 'company' && item.section_id === sectionId);
        if (existingIndex >= 0) knowledgeRows[existingIndex] = row;
        else knowledgeRows.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (/FROM knowledge_sections/i.test(text)) {
      const sourceType = /source_type\s*=\s*'company'/i.test(text) ? 'company' : 'framework';
      const limitMatch = /LIMIT\s+\$1/i.test(text);
      const limit = limitMatch ? Number(params[0] || 1000) : 1000;
      return {
        rows: knowledgeRows
          .filter(row => row.source_type === sourceType && row.active)
          .sort((a, b) => String(a.section_id).localeCompare(String(b.section_id)))
          .slice(0, limit),
        rowCount: Math.min(knowledgeRows.length, limit),
      };
    }

    return { rows: [], rowCount: 0 };
  };
}

test('phase4 parser extracts semantic framework sections by metadata id', () => {
  const parsed = parseFrameworkSemanticDocument(`
<!--META
id: sec-a
title: "Section A"
-->
## Section A
Body A.

<!--META
id: sec-b
title: "Section B"
-->
## Section B
Body B.
`);

  assert.equal(parsed.size, 2);
  assert.equal(parsed.get('sec-a')?.title, 'Section A');
  assert.match(parsed.get('sec-b')?.content || '', /Body B/);
});

test('phase4 capability registry seeds knowledge retrieval capabilities', async () => {
  const insertedCapabilityKeys = [];
  await ensureDefaultCapabilities(async (text, params = []) => {
    if (/INSERT INTO ai_capabilities/i.test(text)) {
      insertedCapabilityKeys.push(params[0]);
    }
    return { rows: [], rowCount: 1 };
  });

  assert.ok(insertedCapabilityKeys.includes('knowledge.retrieve.framework'));
  assert.ok(insertedCapabilityKeys.includes('knowledge.retrieve.company'));
});

test('phase4 framework retrieval returns relevant sections with trace and related expansion', async () => {
  const queryMock = createKnowledgeQueryMock();

  const retrieval = await retrieveFrameworkSections({
    queryText: 'security compliance data residency',
    intents: ['security governance'],
    limit: 3,
    includeRelated: true,
    relatedLimit: 2,
  }, queryMock);

  assert.ok(Array.isArray(retrieval.sections));
  assert.ok(retrieval.sections.length > 0);
  assert.ok(retrieval.sections.some(section => /security|compliance|data/i.test(`${section.title} ${section.summary}`)));
  assert.ok(Array.isArray(retrieval.candidates));
  assert.ok(retrieval.candidates.length > 0);
  assert.ok(retrieval.candidates[0].score >= 1);
});

test('phase4 company retrieval returns relevant profile sections', async () => {
  const queryMock = createKnowledgeQueryMock();

  const retrieval = await retrieveCompanyProfileSections({
    queryText: 'UAE local representative and capacity',
    intents: ['local presence', 'delivery capacity'],
    limit: 4,
  }, queryMock);

  assert.ok(Array.isArray(retrieval.sections));
  assert.ok(retrieval.sections.length > 0);
  assert.ok(retrieval.sections.some(section => /uae|presence|capacity/i.test(`${section.title} ${section.content}`)));
});

test('phase4 classified evidence normalizer keeps only supported classes', () => {
  const normalized = normalizeClassifiedEvidence([
    {
      sourceType: 'client-document',
      sourceId: 'req-1',
      title: 'Mandatory appendix',
      classification: EVIDENCE_CLASSIFICATION.CLIENT_REQUIREMENT,
      rationale: 'Client attachment requirement',
    },
    {
      sourceType: 'framework',
      sourceId: 'sec-06-architecture',
      title: 'Architecture governance',
      classification: EVIDENCE_CLASSIFICATION.ANDERSEN_CAPABILITY_FRAMEWORK_CONTENT,
      rationale: 'Methodology reference',
    },
    {
      sourceType: 'planner',
      sourceId: 'rec-1',
      title: 'Recommended sequencing',
      classification: EVIDENCE_CLASSIFICATION.RECOMMENDATION,
    },
    {
      sourceType: 'planner',
      sourceId: 'assumption-1',
      title: 'Assumed kickoff date',
      classification: EVIDENCE_CLASSIFICATION.ASSUMPTION,
    },
    {
      sourceType: 'unknown',
      sourceId: 'drop-me',
      classification: 'legacy_framework_content',
    },
  ]);

  assert.equal(normalized.length, 4);
  assert.deepEqual(
    normalized.map(item => item.classification),
    [
      EVIDENCE_CLASSIFICATION.CLIENT_REQUIREMENT,
      EVIDENCE_CLASSIFICATION.ANDERSEN_CAPABILITY_FRAMEWORK_CONTENT,
      EVIDENCE_CLASSIFICATION.RECOMMENDATION,
      EVIDENCE_CLASSIFICATION.ASSUMPTION,
    ]
  );
});

test('phase4 plan compiler accepts retrieval query refs as external inputs', () => {
  const compiled = compileWorkflowPlan({
    objective: 'Retrieve framework evidence for compliance section drafting',
    clarificationRequired: false,
    clarifications: [],
    tasks: [
      {
        id: 'retrieve-framework',
        capability: 'knowledge.retrieve.framework',
        dependsOn: [],
        inputs: ['framework_retrieval_query'],
        outputs: ['framework_sections'],
        tools: ['knowledge.framework.search'],
        acceptanceCriteria: ['Relevant framework sections are returned with source metadata.'],
        priority: 'high',
      },
    ],
    qualityGates: [],
    artifactIntent: [],
    budgets: {
      maxTasks: 10,
      maxRepairCycles: 1,
      maxParallelTasks: 2,
    },
  }, {
    capabilityCatalogue: [
      {
        capabilityKey: 'knowledge.retrieve.framework',
        inputSchema: { type: 'object', required: ['framework_retrieval_query'] },
        outputSchema: { type: 'object', required: ['framework_sections'] },
        permittedTools: ['knowledge.framework.search'],
      },
    ],
    budgets: { maxTasks: 10 },
  });

  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.errors, []);
});
