import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorProposalSections,
  buildCanonicalProposalModel,
  buildProposalStructure,
  buildRepairTasksFromFindings,
  evaluateConsistencyGate,
  evaluateCoverageGate,
  evaluateEvidenceGate,
  evaluateEstimationReconciliationGate,
  evaluateFrameworkCompanyAccuracyGate,
  evaluateReleaseReadiness,
  evaluateStyleUsabilityGate,
  evaluateSubmissionComplianceGate,
  extractClaimsFromProposalModel,
  linkClaimsToEvidence,
  renderCanonicalProposalMarkdown,
  runPhase5QualityRepairLoop,
} from '../ai-runtime/quality/phase5QualityService.js';

test('phase5 proposal structure adapts to requirements mix', () => {
  const result = buildProposalStructure({
    requirementInventory: [
      { obligation_level: 'mandatory', response_type: 'commercial' },
      { obligation_level: 'mandatory', response_type: 'attachment' },
    ],
    contextSummary: 'Test context',
  });

  assert.ok(Array.isArray(result.sections));
  assert.ok(result.sections.some(section => section.key === 'commercial'));
  assert.ok(result.sections.some(section => section.key === 'attachments'));
  assert.equal(result.summary.mandatoryRequirementCount, 2);
});

test('phase5 proposal structure captures file split and manual content placeholders', () => {
  const structure = buildProposalStructure({
    requirementInventory: [
      {
        id: 21,
        obligation_level: 'mandatory',
        response_type: 'commercial',
        text: 'Submit signed pricing form in the commercial proposal.',
      },
      {
        id: 22,
        obligation_level: 'mandatory',
        response_type: 'attachment',
        text: 'Include case study annex and company reference template.',
      },
    ],
    contextSummary: 'The technical proposal and commercial proposal must be submitted as separate volumes using the client template.',
  });

  assert.equal(structure.files.length, 2);
  assert.equal(structure.responseInstructions.hasExplicitFileSplit, true);
  assert.ok(structure.manualContentItems.some(item => /signed pricing form/i.test(item.topic)));

  const model = buildCanonicalProposalModel('## Executive Summary\nOverview of the proposed engagement.', structure);
  assert.match(model.markdown, /proposal-file: filename=technical-proposal\.docx/);
  assert.match(model.markdown, /proposal-file: filename=commercial-proposal\.docx/);
  assert.match(model.markdown, /\[TBC - Andersen content:|\[TBC — Andersen content:/);
});

test('phase5 removes internal requirement inventory sections from client proposal output', () => {
  const model = buildCanonicalProposalModel([
    '# Executive Summary',
    'A concise proposal overview.',
    '# Requirement Inventory',
    '| ID | Requirement | Status |',
    '| 1 | Signed quotation | Missing |',
    '# Delivery Approach',
    'The delivery approach is described here.',
  ].join('\n\n'));

  assert.doesNotMatch(model.markdown, /Requirement Inventory/i);
  assert.match(model.markdown, /Executive Summary/);
  assert.match(model.markdown, /Delivery Approach/);
});

test('phase5 section author scopes requirements and evidence per structure section', () => {
  const result = authorProposalSections({
    proposalStructure: {
      sections: [
        { key: 'security', title: 'Security Controls', rationale: 'security compliance controls' },
      ],
    },
    requirements: [
      { id: 7, text: 'Provide security compliance controls', category: 'security' },
      { id: 8, text: 'Provide payment gateway details', category: 'payments' },
    ],
    evidenceItems: [
      { id: 3, content: 'Security compliance controls include access review and audit logging.' },
    ],
    frameworkSections: [
      { id: 'sec-08', title: 'Security Engineering', summary: 'Secure delivery controls.' },
    ],
  });

  assert.equal(result.sections.length, 1);
  assert.deepEqual(result.sections[0].requirementIds, [7]);
  assert.deepEqual(result.sections[0].evidenceIds, [3]);
  assert.match(result.markdown, /Security Controls/);
});

test('phase5 claim extraction and evidence linking produce grounded links', () => {
  const model = buildCanonicalProposalModel(`# Intro\nWe will deliver the platform in 12 weeks.`);
  const claims = extractClaimsFromProposalModel(model);
  const links = linkClaimsToEvidence(claims, [
    { id: 1, content: 'Delivery platform timeline includes 12 weeks implementation.' },
  ]);

  assert.ok(claims.length > 0);
  assert.ok(links.length > 0);
  assert.equal(links[0].evidenceId, 1);
});

test('phase5 quality gates detect coverage, evidence, and consistency issues', () => {
  const model = buildCanonicalProposalModel('# Scope\nThis is in scope. This is not in scope.');
  const coverage = evaluateCoverageGate(
    [{ id: 10, obligation_level: 'mandatory', text: 'Provide SOC2 certification details' }],
    model
  );
  const evidence = evaluateEvidenceGate(
    [{ tempId: 'c1', claimText: 'We will provide SOC2 certification.', classification: 'commitment' }],
    []
  );
  const consistency = evaluateConsistencyGate(model);

  assert.equal(coverage.status, 'fail');
  assert.equal(evidence.status, 'fail');
  assert.equal(consistency.status, 'fail');
});

test('phase5 extended quality gates detect estimation, submission, framework, and style issues', () => {
  const model = buildCanonicalProposalModel('# Scope\nWe will deliver the platform. TBD.');
  const estimation = evaluateEstimationReconciliationGate(model);
  const submission = evaluateSubmissionComplianceGate(
    [{ id: 11, obligation_level: 'mandatory', text: 'Submit signed pricing form as XLSX attachment.' }],
    model
  );
  const framework = evaluateFrameworkCompanyAccuracyGate(
    [{ tempId: 'c2', claimText: 'Andersen has global ISO certified delivery centers.', classification: 'source_fact' }],
    []
  );
  const style = evaluateStyleUsabilityGate(model);

  assert.equal(estimation.status, 'fail');
  assert.equal(submission.status, 'fail');
  assert.equal(framework.status, 'fail');
  assert.equal(style.status, 'fail');
});

test('phase5 normalizes faux headings, bullets, and blank-line runs into canonical markdown structure', () => {
  const model = buildCanonicalProposalModel([
    '**Executive Summary**',
    '',
    '',
    '• First value point',
    '— Second value point',
    '',
    '',
    '**Delivery Approach:**',
    '1) Kickoff and plan',
    '2) Build and validate',
    '',
    '',
    '',
    'Final paragraph.',
  ].join('\n'));

  assert.match(model.markdown, /^## Executive Summary/m);
  assert.match(model.markdown, /^## Delivery Approach/m);
  assert.match(model.markdown, /^- First value point/m);
  assert.match(model.markdown, /^- Second value point/m);
  assert.match(model.markdown, /^1\. Kickoff and plan/m);
  assert.match(model.markdown, /^2\. Build and validate/m);
  assert.doesNotMatch(model.markdown, /\n{3,}/);
});

test('phase5 style usability gate flags unresolved template placeholders and boilerplate marketing sections', () => {
  const model = buildCanonicalProposalModel([
    '# Proposal',
    'PROJECT_NAME',
    'CLIENT_NAME',
    'YYYY',
    '## About Andersen',
    'General marketing message and value proposition.',
  ].join('\n\n'));

  const style = evaluateStyleUsabilityGate(model);
  assert.equal(style.status, 'fail');
  assert.ok(style.findings.some(finding => /unresolved template placeholders/i.test(finding.issue)));
  assert.ok(style.findings.some(finding => /boilerplate marketing\/template sections/i.test(finding.issue)));
});

test('phase5 blocks release on unresolved TBC placeholders and mandatory submission findings', () => {
  const model = buildCanonicalProposalModel('# Proposal\n[TBC — Andersen content: signed power of attorney]');
  const style = evaluateStyleUsabilityGate(model);
  assert.equal(style.status, 'fail');

  const readiness = evaluateReleaseReadiness([
    ...style.findings,
    { gateKey: 'quality.submission', severity: 'critical', issue: 'Format 2 quotation is missing.' },
  ]);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockingFindings.length >= 2);
});

test('phase5 release gate blocks mandatory coverage and non-persistable evidence links', () => {
  const readiness = evaluateReleaseReadiness([
    { gateKey: 'quality.coverage', severity: 'high', issue: 'Mandatory requirement is missing.' },
  ]);
  assert.equal(readiness.ready, false);

  const evidence = evaluateEvidenceGate(
    [{ tempId: 'claim-1', claimText: 'Andersen holds the required certification.', classification: 'source_fact' }],
    [{ claimTempId: 'claim-1', evidenceId: null }]
  );
  assert.equal(evidence.status, 'fail');
});

test('phase5 repair planner produces one repair task per finding', () => {
  const repairTasks = buildRepairTasksFromFindings([
    { gateKey: 'quality.coverage', severity: 'high', requiredFix: 'Add missing section.' },
    { gateKey: 'quality.evidence', severity: 'critical', requiredFix: 'Ground commitment in evidence.' },
  ]);

  assert.equal(repairTasks.length, 2);
  assert.ok(repairTasks.every(task => task.id.startsWith('repair-')));
});

test('phase5 quality repair loop converges with bounded cycles', async () => {
  const seenCycles = [];
  let regenerationCalls = 0;

  const result = await runPhase5QualityRepairLoop({
    sessionId: 1,
    dealId: 1,
    initialProposalMarkdown: '# Proposal\nWe will deliver advanced security controls.',
    requirements: [
      { id: 1, obligation_level: 'mandatory', text: 'Provide advanced security controls' },
    ],
    evidenceItems: [
      { id: 1, content: 'Advanced security controls are provided in our implementation approach.' },
    ],
    maxRepairCycles: 2,
    regenerateProposal: async ({ cycle, proposalMarkdown }) => {
      regenerationCalls += 1;
      return `${proposalMarkdown}\n\n# Repair ${cycle + 1}\nCoverage and evidence improved.`;
    },
    onCycle: async ({ cycle }) => {
      seenCycles.push(cycle);
    },
    queryFn: async () => ({ rows: [] }),
  });

  assert.ok(Array.isArray(result.claims));
  assert.ok(Array.isArray(result.findings));
  assert.ok(Array.isArray(result.repairTasks));
  assert.ok(seenCycles.length >= 1);
  assert.ok(regenerationCalls <= 2);
});

test('phase5 quality repair loop prefers targeted section reruns before full regeneration', async () => {
  let fullRegenerationCalls = 0;
  const rerunTargets = [];

  const result = await runPhase5QualityRepairLoop({
    sessionId: 1,
    dealId: 1,
    initialProposalMarkdown: '# Executive Summary\nWe will deliver advanced security controls.',
    requirements: [
      { id: 1, obligation_level: 'mandatory', text: 'Provide advanced security controls' },
    ],
    evidenceItems: [
      { id: 1, content: 'Advanced security controls are included in the proposal scope and include access review and audit logging.' },
      { id: 2, content: 'Implementation estimate reconciles the delivery timeline with effort and milestones.' },
    ],
    maxRepairCycles: 2,
    rerunProposalSections: async ({ proposalStructure, targetSectionKeys }) => {
      rerunTargets.push([...targetSectionKeys]);
      const repairedModel = {
        structure: proposalStructure,
        sections: [
          {
            key: 'exec-summary',
            title: 'Executive Summary',
            fileKey: proposalStructure.files[0].key,
            requirementIds: [1],
            content: 'Advanced security controls are included in the proposal scope.',
          },
          {
            key: 'solution-overview',
            title: 'Solution Overview',
            fileKey: proposalStructure.files[0].key,
            requirementIds: [1],
            content: 'Advanced security controls include access review and audit logging.',
          },
          {
            key: 'delivery-approach',
            title: 'Delivery Approach',
            fileKey: proposalStructure.files[0].key,
            content: 'Implementation estimate reconciles the delivery timeline with effort and milestones.',
          },
        ],
      };
      return {
        proposalModel: {
          ...repairedModel,
          markdown: renderCanonicalProposalMarkdown(repairedModel),
        },
        targetSectionKeys,
      };
    },
    regenerateProposal: async () => {
      fullRegenerationCalls += 1;
      return '# Full Regeneration';
    },
    queryFn: async () => ({ rows: [] }),
  });

  assert.equal(fullRegenerationCalls, 0);
  assert.ok(rerunTargets.length >= 1);
  assert.ok(rerunTargets[0].includes('delivery-approach'));
  assert.equal(result.qualityStatus, 'pass');
  assert.match(result.proposalMarkdown, /## Delivery Approach/);
});
