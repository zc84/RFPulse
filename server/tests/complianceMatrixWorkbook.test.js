import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComplianceMatrixWorkbook } from '../services/complianceMatrixWorkbook.js';

test('builds an auditable compliance matrix from structured requirements', () => {
  const { workbook, rowCount } = buildComplianceMatrixWorkbook({
    requirements: [{ id: 7, text: 'The supplier must provide an implementation timeline', category: 'delivery', obligation_level: 'mandatory', priority: 'high', response_type: 'deliverable', source_document_name: 'RFP.pdf', source_locator: 'p. 4' }],
    proposalMarkdown: '# Delivery\nThe supplier will provide an implementation timeline with milestones.',
  });
  assert.equal(rowCount, 1);
  assert.ok(workbook.Sheets['Compliance Matrix']);
  assert.equal(workbook.Sheets['Compliance Matrix']['H4'].v, 'Covered');
});
