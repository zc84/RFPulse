import fs from 'fs';
import path from 'path';

import { retrieveCompanyProfileSections } from '../ai-runtime/knowledge/companyProfileRetriever.js';
import { retrieveFrameworkSections } from '../ai-runtime/knowledge/frameworkRetriever.js';
import { loadFrameworkSeedDocuments } from '../ai-runtime/knowledge/frameworkRepository.js';
import { loadCompanyProfileSeedDocument } from '../ai-runtime/knowledge/companyProfileRepository.js';

const benchmarkPath = path.resolve('server/tests/fixtures/phase4KnowledgeRetrievalBenchmark.json');

function isMissingKnowledgeTableError(error) {
  return error?.code === '42P01' || /knowledge_sections/i.test(String(error?.message || ''));
}

async function createInMemoryKnowledgeQuery() {
  const frameworkSeed = await loadFrameworkSeedDocuments();
  const companySeed = await loadCompanyProfileSeedDocument();

  const frameworkRows = (frameworkSeed.sections || []).map(section => {
    const sectionId = String(section.id || '').trim();
    const semantic = frameworkSeed.semanticSectionsById.get(sectionId);
    const title = String(section.title || semantic?.title || sectionId);
    const summary = section.summary ? String(section.summary) : null;
    const content = semantic?.content || summary || title;
    return {
      source_type: 'framework',
      section_id: sectionId,
      title,
      summary,
      tags: Array.isArray(section.tags) ? section.tags : [],
      rfp_questions: Array.isArray(section.rfp_questions) ? section.rfp_questions : [],
      related_sections: Array.isArray(section.related_sections) ? section.related_sections : [],
      engagement_models: Array.isArray(section.engagement_models) ? section.engagement_models : [],
      content,
      source_version: frameworkSeed.version,
      metadata: {},
      active: true,
    };
  });

  const companyRows = (companySeed.sections || []).map(section => ({
    source_type: 'company',
    section_id: section.sectionId,
    title: section.title,
    summary: section.summary,
    tags: Array.isArray(section.tags) ? section.tags : [],
    rfp_questions: [],
    related_sections: [],
    engagement_models: ['all'],
    content: section.content,
    source_version: companySeed.sourceVersion,
    metadata: {},
    active: true,
  }));

  const allRows = [...frameworkRows, ...companyRows];

  return async function queryMock(text, params = []) {
    if (/FROM knowledge_sections/i.test(text)) {
      const sourceType = /source_type\s*=\s*'company'/i.test(text) ? 'company' : 'framework';
      const limit = /LIMIT\s+\$1/i.test(text)
        ? Number(params[0] || 1000)
        : 1000;

      const rows = allRows
        .filter(row => row.source_type === sourceType && row.active)
        .sort((a, b) => String(a.section_id).localeCompare(String(b.section_id)))
        .slice(0, limit);

      return {
        rows,
        rowCount: rows.length,
      };
    }

    if (/INSERT INTO knowledge_sections/i.test(text)) {
      // Sync no-op in benchmark fallback mode.
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  };
}

function precisionAtK(resultIds = [], expectedIds = [], k = 5) {
  const top = resultIds.slice(0, k);
  if (top.length === 0) return 0;
  const expected = new Set(expectedIds);
  const relevant = top.filter(id => expected.has(id)).length;
  return relevant / top.length;
}

async function runScenario(scenario) {
  const inMemoryQuery = await createInMemoryKnowledgeQuery();
  const source = scenario.source === 'company' ? 'company' : 'framework';
  let retrieval;
  let fallbackUsed = false;

  try {
    retrieval = source === 'company'
      ? await retrieveCompanyProfileSections({
        queryText: scenario.queryText,
        intents: scenario.intents || [],
        limit: 5,
      })
      : await retrieveFrameworkSections({
        queryText: scenario.queryText,
        intents: scenario.intents || [],
        limit: 5,
        includeRelated: true,
        relatedLimit: 2,
      });
  } catch (error) {
    if (!isMissingKnowledgeTableError(error)) throw error;
    fallbackUsed = true;
    retrieval = source === 'company'
      ? await retrieveCompanyProfileSections({
        queryText: scenario.queryText,
        intents: scenario.intents || [],
        limit: 5,
      }, inMemoryQuery)
      : await retrieveFrameworkSections({
        queryText: scenario.queryText,
        intents: scenario.intents || [],
        limit: 5,
        includeRelated: true,
        relatedLimit: 2,
      }, inMemoryQuery);
  }

  const retrievedIds = (retrieval.sections || []).map(section => section.sectionId);
  const pAt5 = precisionAtK(retrievedIds, scenario.expectedSectionIds || [], 5);

  return {
    id: scenario.id,
    source,
    precisionAt5: Number(pAt5.toFixed(3)),
    expectedSectionIds: scenario.expectedSectionIds || [],
    retrievedTop5: retrievedIds.slice(0, 5),
    fallbackUsed,
    pass: pAt5 >= 0.85,
  };
}

async function run() {
  const scenarios = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  const rows = [];

  for (const scenario of scenarios) {
    rows.push(await runScenario(scenario));
  }

  const avgPrecision = rows.length
    ? rows.reduce((sum, item) => sum + item.precisionAt5, 0) / rows.length
    : 0;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalScenarios: rows.length,
      averagePrecisionAt5: Number(avgPrecision.toFixed(3)),
      threshold: 0.85,
      pass: avgPrecision >= 0.85,
    },
    scenarios: rows,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.summary.pass) {
    process.exitCode = 1;
  }
}

run();