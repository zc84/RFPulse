import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyDocumentRole,
  buildRequirementInventorySummary,
  buildEvidenceItemsFromExtractedDocs,
  extractRequirementsFromEvidence,
  persistRunEvidenceAndRequirements,
  listRequirementInventory,
} from '../services/evidenceInventory.js';

test('phase1 evidence builder keeps provenance and chunk locators', () => {
  const extractedDocs = [
    {
      id: 101,
      name: 'RFP.pdf',
      success: true,
      text: [
        '## Page 1',
        'The supplier must submit a signed proposal by the deadline.',
        '',
        '## Page 2',
        'Security compliance evidence should be attached in Annex A.',
      ].join('\n'),
    },
  ];

  const evidence = buildEvidenceItemsFromExtractedDocs(extractedDocs);
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].sourceDocumentId, 101);
  assert.match(String(evidence[0].locator), /Page 1/i);
  assert.ok(evidence[0].contentHash);
  assert.equal(evidence[0].metadata.documentName, 'RFP.pdf');
  assert.equal(evidence[0].documentRole, 'rfp');
});

test('phase1 classifies document roles and links contradictory requirements', () => {
  assert.equal(classifyDocumentRole({ name: 'Pricing BOQ.xlsx', text: 'Commercial pricing and rates' }), 'pricing_template');
  const requirements = extractRequirementsFromEvidence([
    { sourceDocumentId: 1, locator: 'p1', contentHash: 'h1', content: 'The supplier must provide support within 2 days.' },
    { sourceDocumentId: 2, locator: 'p4', contentHash: 'h2', content: 'The supplier must not provide support within 2 days.' },
  ]);
  assert.equal(requirements.length, 2);
  assert.ok(requirements.every(requirement => requirement.conflictGroup));
});

test('phase1 requirement extraction classifies obligation and response type', () => {
  const evidence = [
    {
      sourceDocumentId: 101,
      locator: 'Page 3',
      contentHash: 'abc',
      content: [
        'The bidder must submit pricing in USD.',
        'Optional attachment: include reference certificates.',
      ].join('\n'),
    },
  ];

  const requirements = extractRequirementsFromEvidence(evidence);
  assert.ok(requirements.length >= 2);

  const pricingReq = requirements.find(req => /pricing/i.test(req.text));
  assert.ok(pricingReq);
  assert.equal(pricingReq.obligationLevel, 'mandatory');
  assert.equal(pricingReq.responseType, 'commercial');

  const attachmentReq = requirements.find(req => /attachment/i.test(req.text));
  assert.ok(attachmentReq);
  assert.equal(attachmentReq.responseType, 'attachment');
});

test('phase1 keeps noun-phrase scope items visible even without must/required wording', () => {
  const requirements = extractRequirementsFromEvidence([{
    sourceDocumentId: 404,
    locator: 'SOW 5.6',
    contentHash: 'scope-404',
    content: 'The website includes a dealer locator with maps, filters, geolocation, and per-dealer pages.',
  }]);

  assert.equal(requirements.length, 1);
  assert.match(requirements[0].text, /dealer locator/i);
  assert.ok(requirements[0].metadata.keywordMatches.some(item => item.startsWith('scope:')));
});

test('phase1 requirement reconciliation preserves duplicate source references', () => {
  const shared = 'The supplier must submit a signed proposal by the deadline.';
  const evidence = [
    {
      sourceDocumentId: 101,
      locator: 'Page 1',
      contentHash: 'hash-1',
      content: shared,
    },
    {
      sourceDocumentId: 102,
      locator: 'Page 7',
      contentHash: 'hash-2',
      content: shared,
    },
  ];

  const requirements = extractRequirementsFromEvidence(evidence);
  assert.equal(requirements.length, 1);
  assert.ok(Array.isArray(requirements[0].metadata.sourceRefs));
  assert.equal(requirements[0].metadata.sourceRefs.length, 2);
  assert.deepEqual(
    requirements[0].metadata.sourceRefs.map(ref => ref.sourceDocumentId).sort((a, b) => a - b),
    [101, 102]
  );
});

test('phase1 requirement inventory summary aggregates key dimensions', () => {
  const summary = buildRequirementInventorySummary([
    { obligation_level: 'mandatory', priority: 'critical', status: 'gap', response_type: 'form', category: 'submission', source_document_id: 1, metadata: { gapType: 'missing-appendix-reference' } },
    { obligation_level: 'mandatory', priority: 'high', response_type: 'commercial', category: 'commercial', source_document_id: 1 },
    { obligation_level: 'should', priority: 'medium', response_type: 'narrative', category: 'technical', source_document_id: 2 },
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.coveredDocuments, 2);
  assert.equal(summary.byObligationLevel.mandatory, 2);
  assert.equal(summary.byStatus.gap, 1);
  assert.equal(summary.byPriority.critical, 1);
  assert.equal(summary.byResponseType.form, 1);
  assert.equal(summary.byCategory.commercial, 1);
  assert.equal(summary.missingAppendixGapCount, 1);
});

test('phase1 extraction marks missing appendix references as critical gaps', () => {
  const evidence = [{
    sourceDocumentId: 301,
    locator: 'Page 12',
    contentHash: 'gap-hash',
    content: 'Appendix B is missing and not attached to this tender package.',
  }];

  const requirements = extractRequirementsFromEvidence(evidence);
  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].status, 'gap');
  assert.equal(requirements[0].priority, 'critical');
  assert.equal(requirements[0].metadata.gapType, 'missing-appendix-reference');
});

test('phase1 persistence returns graceful skip when tables are missing', async () => {
  const fakeQuery = async () => {
    const err = new Error('missing relation');
    err.code = '42P01';
    throw err;
  };

  const result = await persistRunEvidenceAndRequirements({
    sessionId: 1,
    dealId: 1,
    extractedDocs: [],
    queryFn: fakeQuery,
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'phase1_tables_missing');
});

test('phase1 requirement inventory returns empty array when tables are missing', async () => {
  const fakeQuery = async () => {
    const err = new Error('missing relation');
    err.code = '42P01';
    throw err;
  };

  const rows = await listRequirementInventory({
    dealId: 1,
    sessionId: 2,
    queryFn: fakeQuery,
  });

  assert.deepEqual(rows, []);
});
