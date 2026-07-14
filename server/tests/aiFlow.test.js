import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as XLSX from '@e965/xlsx';
import {
  buildEstimatorReportSummary,
  isEstimatorAccuracyPolicyError,
  validateEstimatorResult,
} from '../services/aiSchemas.js';
import { renderArchitectureDiagram } from '../services/architectureDiagram.js';
import { renderMermaidBlocksInMarkdown } from '../services/mermaidBlocks.js';
import { buildTimelineDiagramFromMarkdown, buildTimelineMermaidScript, extractTimelinePhasesFromMarkdown } from '../services/timelineDiagram.js';
import { writeWbsWorkbook } from '../services/wbsWorkbook.js';
import { DEFAULT_PROMPT_TEMPLATES, getDefaultAgent } from '../services/aiPrompts.js';
import {
  buildReportFromOutputs,
  buildSpecialistMessages,
  buildArchitectureDiagramPromptInput,
  applyEstimatorOnePassCorrection,
  extractEstimatorPolicyContext,
  requireCoordinatorContext,
  resolveRequestedSpecialists,
  splitCoordinatorSourceContext,
} from '../services/aiOrchestrator.js';
import { splitProposalMarkdown } from '../services/proposalDocument.js';

function validEstimate() {
  return {
    implementationTeam: ['Architect', 'Backend Engineer'],
    workBreakdown: [
      { phase: '1. Preparation', workstream: 'Solution foundation', title: 'Define solution architecture', efforts: 16, assigned: 'Architect', notes: 'Includes architecture research and decision records.' },
      { phase: '2. Delivery', workstream: 'Core API', title: 'Implement core API capability', efforts: 32, assigned: 'Backend Engineer', notes: 'Includes AI-assisted scaffolding, integration and validation.' },
    ],
    contingencyPercent: 15,
    estimatedDuration: '4 weeks',
    basisOfEstimate: ['Scope is limited to the stated deliverables.'],
    estimateConfidence: 'medium',
    confidenceRationale: 'Confidence is moderate due to a compact but partially assumption-based scope.',
    topUncertaintyDrivers: ['Dependency timing with client systems'],
    commercialProposal: 'We propose a lean, delivery-focused engagement that balances speed, quality, and commercial realism. The estimate is structured for transparency, with clearly scoped work packages, disciplined contingency, and a pragmatic team mix designed to minimize risk while maximizing value.',
    phasePricing: [
      { phase: '1. Preparation', scopeSummary: 'Discovery and architecture definition.', effortHours: 16, amount: 1440, pricingBasis: 'Time and materials based on task-level effort.' },
      { phase: '2. Delivery', scopeSummary: 'Core API implementation and validation.', effortHours: 32, amount: 1760, pricingBasis: 'Time and materials based on task-level effort.' },
    ],
    softwareLicenses: [
      { item: 'Cloud productivity and development licences', amount: 0, pricingBasis: 'Client-provided / not separately priced in this estimate.', included: false, notes: 'No additional software licence cost is required for the scoped delivery.' },
    ],
    hardware: [
      { item: 'Server or endpoint hardware', amount: 0, pricingBasis: 'Not required for the scoped software-only delivery.', included: false, notes: 'No hardware procurement is included.' },
    ],
    assumptions: ['Client provides access on time.'],
    exclusions: ['Third-party licence costs.'],
    risks: [{ risk: 'Delayed access', impact: 'Schedule delay', mitigation: 'Confirm access before kickoff' }],
  };
}

test('estimator enforces grouped 8-40 hour delivery work packages', () => {
  const estimate = validateEstimatorResult(validEstimate());
  assert.equal(estimate.baseEffort, 48);
  assert.equal(estimate.qaEffort, 14.5);
  assert.equal(estimate.pmEffort, 9.5);
  assert.equal(estimate.totalEffort, 72);
  assert.deepEqual(estimate.teamComposition.map(item => item.team), ['Architect', 'Backend Engineer', 'QA', 'PM']);
  assert.throws(() => validateEstimatorResult({ ...validEstimate(), workBreakdown: [{ phase: 'A', workstream: 'B', title: 'Tiny task', efforts: 4, assigned: 'BA', notes: '' }] }));
  assert.throws(() => validateEstimatorResult({ ...validEstimate(), workBreakdown: [{ phase: 'A', workstream: 'B', title: 'Oversized task', efforts: 41, assigned: 'Backend Engineer', notes: '' }] }));
  assert.throws(() => validateEstimatorResult({ ...validEstimate(), workBreakdown: [{ phase: 'A', workstream: 'B', title: 'QA task', efforts: 8, assigned: 'QA', notes: '' }] }));
});

test('estimator rejects non-contiguous workstream groups and long notes', () => {
  const input = validEstimate();
  input.workBreakdown.push({ phase: '1. Preparation', workstream: 'Solution foundation', title: 'Reopened group', efforts: 8, assigned: 'Architect', notes: '' });
  const estimate = validateEstimatorResult(input);
  assert.equal(estimate.workBreakdown[0].title, 'Define solution architecture');
  assert.equal(estimate.workBreakdown[1].title, 'Reopened group');
  assert.equal(estimate.workBreakdown[0].phase, estimate.workBreakdown[1].phase);
  assert.equal(estimate.workBreakdown[0].workstream, estimate.workBreakdown[1].workstream);
  const long = validEstimate();
  long.workBreakdown[0].notes = 'x'.repeat(241);
  assert.throws(() => validateEstimatorResult(long));
});

test('legacy estimator output is normalized without AI-prefixed rows', () => {
  const input = validEstimate();
  input.implementationTeam = ['Backend Engineer'];
  input.workBreakdown = [{ title: 'AI: Generate API foundation', efforts: 8, assigned: 'Backend Engineer', aiAssisted: true }];
  input.estimatedDuration = '1 week';
  input.phasePricing = [
    { phase: 'Legacy', scopeSummary: 'Legacy normalized task.', effortHours: 8, amount: 800, pricingBasis: 'Time and materials based on task-level effort.' },
  ];
  const estimate = validateEstimatorResult(input);
  assert.equal(estimate.workBreakdown[0].phase, 'Legacy');
  assert.equal(estimate.workBreakdown[0].title, 'Generate API foundation');
  assert.match(estimate.workBreakdown[0].notes, /AI-assisted/);
});

test('estimator accepts AI-defined custom delivery roles and keeps fixed default rate card', () => {
  const input = validEstimate();
  input.implementationTeam = ['Tech Lead', 'Platform Engineer'];
  input.workBreakdown = [
    { phase: '1. Preparation', workstream: 'Planning', title: 'Architecture and delivery planning', efforts: 16, assigned: 'Tech Lead', notes: 'Scope shaping and architecture alignment.' },
    { phase: '2. Delivery', workstream: 'Platform', title: 'Platform enablement and automation', efforts: 24, assigned: 'Platform Engineer', notes: 'Environment setup and CI/CD baseline.' },
  ];
  input.phasePricing = [
    { phase: '1. Preparation', scopeSummary: 'Planning and solution definition.', effortHours: 16, amount: 800, pricingBasis: 'Time and materials based on task-level effort.' },
    { phase: '2. Delivery', scopeSummary: 'Platform build and validation.', effortHours: 24, amount: 1200, pricingBasis: 'Time and materials based on task-level effort.' },
  ];
  const estimate = validateEstimatorResult(input);
  assert.deepEqual(estimate.teamComposition.map(item => item.team), ['Tech Lead', 'Platform Engineer', 'QA', 'PM']);
  assert.ok(estimate.teamComposition.every(item => item.rate === 50));
});

test('estimator rejects PM/QA as explicit implementation or task roles', () => {
  const withPmInTeam = validEstimate();
  withPmInTeam.implementationTeam = ['Architect', 'PM'];
  assert.throws(() => validateEstimatorResult(withPmInTeam), /delivery roles only/i);

  const withQaTask = validEstimate();
  withQaTask.workBreakdown = [{ phase: 'A', workstream: 'B', title: 'Manual QA row', efforts: 8, assigned: 'QA', notes: '' }];
  withQaTask.implementationTeam = ['Architect'];
  withQaTask.phasePricing = [{ phase: 'A', scopeSummary: 'Single-row test.', effortHours: 8, amount: 400, pricingBasis: 'Time and materials based on task-level effort.' }];
  assert.throws(() => validateEstimatorResult(withQaTask), /reserved for automatic overhead rows/i);
});

test('estimator summary excludes detailed tasks and derives active team', () => {
  const summary = buildEstimatorReportSummary(JSON.stringify(validEstimate()));
  assert.doesNotMatch(summary, /Implement core API capability/);
  assert.match(summary, /AI Detailed WBS\.xlsx/);
  assert.match(summary, /commercialProposal/);
  assert.match(summary, /phasePricing/);
  assert.match(summary, /softwareLicenses/);
  assert.match(summary, /hardware/);
  assert.match(summary, /"totalEffort": 72/);
  assert.match(summary, /"implementationTeam": \[/);
  assert.match(summary, /"estimateConfidence": "medium"/);
  assert.match(summary, /"topUncertaintyDrivers": \[/);
});

test('accuracy policy flags unrealistic duration versus effort', () => {
  const input = validEstimate();
  input.estimatedDuration = '0.4 week';
  assert.throws(
    () => validateEstimatorResult(input),
    err => isEstimatorAccuracyPolicyError(err) && err.violations.some(v => v.code === 'effort_duration_unrealistic')
  );
});

test('accuracy policy flags phase pricing effort drift', () => {
  const input = validEstimate();
  input.phasePricing = [
    { phase: '1. Preparation', scopeSummary: 'Discovery and architecture definition.', effortHours: 8, amount: 1440, pricingBasis: 'Time and materials based on task-level effort.' },
    { phase: '2. Delivery', scopeSummary: 'Core API implementation and validation.', effortHours: 8, amount: 1760, pricingBasis: 'Time and materials based on task-level effort.' },
  ];
  assert.throws(
    () => validateEstimatorResult(input),
    err => isEstimatorAccuracyPolicyError(err) && err.violations.some(v => v.code === 'phase_pricing_effort_drift')
  );
});

test('accuracy policy requires assumptions under high uncertainty', () => {
  const input = validEstimate();
  input.assumptions = ['Access will be provided'];
  assert.throws(
    () => validateEstimatorResult(input, { policyContext: { sourceUncertaintyLevel: 'high' } }),
    err => isEstimatorAccuracyPolicyError(err) && err.violations.some(v => v.code === 'assumptions_coverage_missing')
  );
});

test('one-pass estimator correction succeeds on first invalid response', async () => {
  const invalid = validEstimate();
  invalid.estimatedDuration = '0.4 week';

  const corrected = validEstimate();
  corrected.estimatedDuration = '4 weeks';

  const result = await applyEstimatorOnePassCorrection(invalid, {
    requestCorrection: async violations => {
      assert.ok(Array.isArray(violations));
      assert.ok(violations.some(v => v.code === 'effort_duration_unrealistic'));
      return corrected;
    },
  });

  assert.equal(result.corrected, true);
  assert.equal(result.value.estimatedDuration, '4 weeks');
  assert.equal(result.value.totalEffort, 72);
});

test('proposal fallback and diagram prompt helper stay aligned', () => {
  const report = buildReportFromOutputs('Acme Deal', '## Deal Context\nBrief', {
    legal: '# Legal',
    architect: '# Architecture',
    estimator: '# Estimator',
  });
  assert.match(report, /# Proposal: Acme Deal/);
  const diagramPrompt = buildArchitectureDiagramPromptInput(report);
  assert.match(diagramPrompt, /## Architecture Diagram Prompt/);
  assert.match(diagramPrompt, /proposal above as the source of truth/);
  assert.match(diagramPrompt, /tech-stack-native icons/);
  assert.match(diagramPrompt, /Treat WBS content, implementation plans, timelines, schedules, roadmaps, pricing, and effort tables as out of scope/i);
  assert.match(diagramPrompt, /Do not embed a Gantt chart, delivery plan, WBS table, calendar strip, dates row, or pricing table/i);
});

test('proposal fallback includes the specialist outputs', () => {
  const report = buildReportFromOutputs('Acme Deal', '## Deal Context\nBrief', {
    legal: '# Legal',
    architect: '# Architecture',
    estimator: '# Estimator',
  });
  assert.match(report, /# Proposal: Acme Deal/);
  assert.match(report, /# Legal/);
  assert.match(report, /# Architecture/);
  assert.match(report, /# Estimator/);
});

test('proposal markdown markers split into multiple output files', () => {
  const parts = splitProposalMarkdown(`<!-- proposal-file: filename=overview.docx; title=Overview; diagrams=true -->
# Overview
<!-- proposal-file: filename=appendix.docx; title=Appendix -->
# Appendix`);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].filename, 'overview.docx');
  assert.equal(parts[0].title, 'Overview');
  assert.equal(parts[0].diagrams, true);
  assert.equal(parts[1].filename, 'appendix.docx');
  assert.equal(parts[1].title, 'Appendix');
});

test('WBS workbook contains grouped columns, formulas, and separate rate card', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfpulse-wbs-'));
  const outputPath = path.join(outputDir, 'AI Detailed WBS.xlsx');
  writeWbsWorkbook(outputPath, JSON.stringify(validEstimate()));
  const workbook = XLSX.read(fs.readFileSync(outputPath), { type: 'buffer', cellFormula: true });
  const sheet = workbook.Sheets['Detailed WBS'];
  const rateSheet = workbook.Sheets['Rate Card'];
  assert.equal(sheet.A3.v, 'Phase');
  assert.equal(sheet.B3.v, 'Feature / Workstream');
  assert.equal(sheet.C3.v, 'Task');
  assert.equal(sheet.F3.v, 'Notes');
  assert.equal(sheet.A4.v, '1. Preparation');
  assert.match(sheet.G4.f, /'Rate Card'/);
  assert.ok(rateSheet);
  const rateRows = XLSX.utils.sheet_to_json(rateSheet, { header: 1 });
  assert.deepEqual(rateRows.slice(0, 5), [
    ['Role', 'Hourly Rate'],
    ['Architect', 50],
    ['Backend Engineer', 50],
    ['QA', 50],
    ['PM', 50],
  ]);
});

test('architecture renderer emits safe, styled SVG with groups', async () => {
  const svg = await renderArchitectureDiagram({
    id: 'overview',
    type: 'overview',
    title: 'Solution Overview',
    description: 'High-level components.',
    direction: 'RIGHT',
    groups: [{ id: 'cloud', label: 'Cloud Boundary', parentId: null, kind: 'cloud' }],
    nodes: [
      { id: 'user', label: 'User', purpose: 'Uses the service', technology: 'Browser', icon: 'user', groupId: null, kind: 'actor' },
      { id: 'api', label: 'API', purpose: 'Serves requests', technology: 'Node.js', icon: 'api', groupId: 'cloud', kind: 'service' },
    ],
    edges: [{ source: 'user', target: 'api', label: 'HTTPS', interaction: 'sync' }],
  });
  assert.match(svg, /Solution Overview/);
  assert.match(svg, /Cloud Boundary/);
  assert.doesNotMatch(svg, /<script|foreignObject|(?:href|src)=["']https?:/i);
});

test('timeline renderer emits Mermaid source and a separate PNG image', async () => {
  const markdown = `# Proposal

## Implementation Plan
- Phase I: Discovery and setup - 2 weeks
- Phase II: Delivery and validation - 5 weeks
`;
  const extracted = extractTimelinePhasesFromMarkdown(markdown);
  assert.ok(extracted);
  assert.equal(extracted.phases.length, 2);
  const mermaid = buildTimelineMermaidScript(extracted);
  assert.match(mermaid, /^%%\{init:/);
  assert.match(mermaid, /\ngantt\n/);
  assert.match(mermaid, /Phase I \(2 weeks\)/);
  assert.match(mermaid, /after phase-i-1, 5w/);
  const diagram = await buildTimelineDiagramFromMarkdown(markdown);
  assert.ok(diagram);
  assert.equal(diagram.format, 'png');
  assert.equal(diagram.mermaid, mermaid);
  assert.ok(Buffer.isBuffer(diagram.png));
  assert.ok(diagram.png.length > 1000);
  assert.match(diagram.svg, /<svg/i);
  assert.doesNotMatch(diagram.svg, /<script|foreignObject|(?:href|src)=["']https?:/i);
});

test('embedded Mermaid fences are replaced with inline rendered images', async () => {
  const markdown = `# Proposal

\`\`\`mermaid
flowchart LR
  A[Discovery] --> B[Build]
\`\`\`

## Architecture Overview
Body.
`;
  const rendered = await renderMermaidBlocksInMarkdown(markdown);
  assert.match(rendered.markdown, /@@RFPULSE-MERMAID@@mermaid-1/);
  assert.equal(rendered.diagrams.length, 1);
  assert.equal(rendered.diagrams[0].title, 'WBS Diagram 1');
  assert.ok(Buffer.isBuffer(rendered.diagrams[0].png));
  assert.ok(rendered.diagrams[0].png.length > 1000);
});

test('strict validator prompt is current and coordinator review prompt is removed', () => {
  const validator = getDefaultAgent('validator');
  assert.match(validator.system_prompt, /Explicit evidence only/i);
  assert.match(validator.system_prompt, /PASS is exactly >= 90\.0%/);
  assert.match(validator.system_prompt, /Accepted Andersen manual-content item/);
  assert.match(validator.system_prompt, /Key Exclusions|equivalent language/i);
  assert.match(validator.system_prompt, /software licence pricing and hardware pricing/i);
  assert.match(validator.system_prompt, /\| Requirement ID \| Client Requirement \| Status \| Proposal Reference \| Evidence Summary \| Gap \/ Notes \| Proposed Improvement \|/);
  assert.match(validator.system_prompt, /For Proposed Improvement:/);
  assert.match(validator.system_prompt, /Assign Full status/);
  assert.doesNotMatch(validator.system_prompt, /Terminology Consistency/);
  assert.doesNotMatch(validator.system_prompt, /Language and Spelling Quality/);
  assert.equal(DEFAULT_PROMPT_TEMPLATES.some(prompt => prompt.key === 'coordinator.report-review'), false);
  assert.equal(DEFAULT_PROMPT_TEMPLATES.some(prompt => prompt.key === 'coordinator.final-report'), true);
});

test('tender prompts require deep coordinator capture and reject scope-cutting exclusions', () => {
  const coordinator = getDefaultAgent('coordinator');
  const estimator = getDefaultAgent('estimator');
  assert.match(coordinator.system_prompt, /Read the RFP deeply/i);
  assert.match(coordinator.system_prompt, /final proposal owner/i);
  assert.match(coordinator.system_prompt, /requested client scope as unacceptable proposal behavior/i);
  assert.match(estimator.system_prompt, /phased pricing/i);
  assert.match(estimator.system_prompt, /high-level WBS/i);
  assert.match(estimator.system_prompt, /Define delivery roles dynamically based on project scope/i);
  assert.match(estimator.system_prompt, /software licence pricing/i);
  assert.match(estimator.system_prompt, /USD only/i);
  assert.match(estimator.system_prompt, /do not hide them behind "key exclusions"/i);
  assert.equal(getDefaultAgent('copywriter'), undefined);
});

test('architect prompt makes a single best-fit technology recommendation', () => {
  const architect = getDefaultAgent('architect');
  assert.match(architect.system_prompt, /one best-fit technology option per layer/i);
  assert.match(architect.system_prompt, /single, decisive technology recommendation/i);
  assert.match(architect.system_prompt, /Alternatives Considered \(up to 2\)/i);
  assert.match(architect.system_prompt, /0 to 2 realistic rejected options/i);
  assert.match(architect.system_prompt, /selected option is better than that alternative/i);
  assert.match(architect.system_prompt, /None materially better for this scope/i);
  assert.match(architect.system_prompt, /do not ask for vendor shortlist sign-off/i);
});

test('specialist input boundary excludes raw conversation and requires Coordinator context', () => {
  const messages = buildSpecialistMessages('ROLE-SPECIFIC-BRIEF', { architect: 'ARCHITECT-OUTPUT' });
  const serialized = JSON.stringify(messages);
  assert.match(serialized, /ROLE-SPECIFIC-BRIEF/);
  assert.match(serialized, /ARCHITECT-OUTPUT/);
  assert.doesNotMatch(serialized, /Conversation so far|Extracted source context|client_documents/);
  assert.throws(() => requireCoordinatorContext(''), /Coordinator context is required/);
  assert.equal(requireCoordinatorContext('  approved summary  '), 'approved summary');
});

test('large raw source is chunked only for Coordinator processing', () => {
  const chunks = splitCoordinatorSourceContext('A'.repeat(100001), 45000);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every(chunk => chunk.length <= 45000));
  assert.equal(chunks.join('').length, 100001);
});

test('specialist routing plan is normalized to supported required specialists', () => {
  assert.deepEqual([...resolveRequestedSpecialists(['legal'])], ['legal']);
  assert.deepEqual([...resolveRequestedSpecialists(['architect', 'unknown', 'architect'])], ['architect']);
  assert.deepEqual([...resolveRequestedSpecialists(['frontend-dev'])], ['legal', 'architect', 'estimator']);
  assert.deepEqual([...resolveRequestedSpecialists(null)], ['legal', 'architect', 'estimator']);
});

test('a valid specialist subset survives normalization instead of being forced to all three', () => {
  // The Coordinator can genuinely drop a specialist; a legal+architect plan must stay reduced.
  assert.deepEqual([...resolveRequestedSpecialists(['legal', 'architect'])], ['legal', 'architect']);
  assert.deepEqual([...resolveRequestedSpecialists(['architect'])], ['architect']);
});

test('the Estimator dependency pulls in the Architect and output is canonically ordered', () => {
  // The Estimator sizes a design, so requesting it must also run the Architect.
  assert.deepEqual([...resolveRequestedSpecialists(['estimator'])], ['architect', 'estimator']);
  assert.deepEqual([...resolveRequestedSpecialists(['estimator', 'legal'])], ['legal', 'architect', 'estimator']);
  // Regardless of input order, the result is canonical [legal, architect, estimator].
  assert.deepEqual([...resolveRequestedSpecialists(['estimator', 'architect', 'legal'])], ['legal', 'architect', 'estimator']);
});

test('coordinator routing allows conditional specialists while blocking scope cuts', () => {
  const coordinator = getDefaultAgent('coordinator');
  const decision = DEFAULT_PROMPT_TEMPLATES.find(prompt => prompt.key === 'coordinator.decision');
  // Conditional routing is now expressible...
  assert.match(coordinator.system_prompt, /Omit a specialist only when it is genuinely inapplicable/i);
  assert.match(coordinator.system_prompt, /Estimator depends on the Architect/i);
  assert.match(decision.content, /select which specialists to run in the plan field/i);
  // ...but the anti-scope-cutting guardrail is preserved and the old absolute rule is gone.
  assert.match(coordinator.system_prompt, /Never drop a specialist to reduce/i);
  assert.doesNotMatch(coordinator.system_prompt, /Never decide that a partial set of specialist outputs is sufficient/i);
});

test('final proposal prompt is AI-driven by RFP submission structure instead of canned sections', () => {
  const coordinator = getDefaultAgent('coordinator');
  const finalReport = DEFAULT_PROMPT_TEMPLATES.find(prompt => prompt.key === 'coordinator.final-report');

  assert.ok(finalReport);
  assert.match(coordinator.system_prompt, /final document structure follow the actual RFP response format/i);
  assert.match(finalReport.content, /Build the section hierarchy from the RFP's explicit submission instructions/i);
  assert.match(finalReport.content, /Do not force a canned section set/i);

  assert.doesNotMatch(finalReport.content, /delivery approach/i);
  assert.doesNotMatch(finalReport.content, /commercial basis/i);
  assert.doesNotMatch(finalReport.content, /Andersen Credentials & Company Profile \(Manual Content\)/i);
});

test('estimator policy context parsing is null-safe for partial or malformed labels', () => {
  const context = extractEstimatorPolicyContext(`
Estimation Basis Pack
- source uncertainty level: high
- dependencyCriticality - medium
- integrationComplexity: low
- non-functional load and security: medium

scope certainty level
`);

  assert.equal(context.sourceUncertaintyLevel, 'high');
  assert.equal(context.dependencyCriticality, 'medium');
  assert.equal(context.integrationComplexity, 'low');
  assert.equal(context.nonFunctionalLoadAndSecurity, 'medium');
  assert.equal(context.highRiskScope, true);
});
