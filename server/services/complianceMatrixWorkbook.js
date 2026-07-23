import * as XLSX from '@e965/xlsx';
import fs from 'fs';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value) {
  return new Set(normalize(value).split(' ').filter(token => token.length >= 4));
}

function coverageFor(requirement, proposalText) {
  const requirementTokens = tokens(`${requirement.text || ''} ${requirement.normalized_text || ''}`);
  const proposalTokens = tokens(proposalText);
  let matches = 0;
  for (const token of requirementTokens) if (proposalTokens.has(token)) matches += 1;
  const strongCoverage = requirementTokens.size > 0
    && matches >= Math.min(3, requirementTokens.size)
    && matches / requirementTokens.size >= 0.6;
  return strongCoverage
    ? 'Covered'
    : requirement.obligation_level === 'mandatory' ? 'Missing' : 'Needs manual review';
}

export function buildComplianceMatrixWorkbook({ requirements = [], proposalMarkdown = '' } = {}) {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ['Requirement Compliance Matrix'],
    [],
    ['ID', 'Requirement', 'Category', 'Obligation', 'Priority', 'Response Type', 'Source', 'Coverage', 'Proposal Response / Notes'],
    ...requirements.map((requirement, index) => {
      const coverage = coverageFor(requirement, proposalMarkdown);
      return [
        requirement.id ?? index + 1,
        requirement.text || requirement.normalized_text || '',
        requirement.category || '',
        requirement.obligation_level || '',
        requirement.priority || '',
        requirement.response_type || '',
        [requirement.source_document_name, requirement.source_locator].filter(Boolean).join(' — '),
        coverage,
        coverage === 'Covered' ? 'Strong textual response found in generated proposal; verify against source evidence.' : coverage === 'Missing' ? 'Mandatory requirement needs an explicit response or artifact.' : 'Review during presales completion.',
      ];
    }),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = [XLSX.utils.decode_range('A1:I1')];
  sheet['!cols'] = [{ wch: 10 }, { wch: 68 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 48 }];
  if (requirements.length > 0) sheet['!autofilter'] = { ref: `A3:I${requirements.length + 3}` };
  sheet['!freeze'] = { xSplit: 0, ySplit: 3 };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Compliance Matrix');
  return { workbook, rowCount: requirements.length };
}

export function writeComplianceMatrixWorkbook(filePath, options) {
  const { workbook, rowCount } = buildComplianceMatrixWorkbook(options);
  fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }));
  return rowCount;
}
