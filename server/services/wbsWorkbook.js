import * as XLSX from '@e965/xlsx';
import fs from 'fs';
import {
  DEFAULT_PM_OVERHEAD_PERCENT,
  DEFAULT_QA_OVERHEAD_PERCENT,
  DEFAULT_ROLE_RATES,
  TEAM_ROLES,
  parseEstimatorOutput,
} from './aiSchemas.js';

export function buildWbsWorkbook(estimatorOutput) {
  const estimate = parseEstimatorOutput(estimatorOutput);
  const workbook = XLSX.utils.book_new();
  const tasks = estimate.workBreakdown;
  const rows = [
    ['Detailed Work Breakdown Structure', null, null, null, null, null, null, null, 'Active Team', null, null, null, 'Overhead', null],
    [],
    ['Phase', 'Feature / Workstream', 'Task', 'Effort (h)', 'Assigned Role', 'Notes', 'Task Cost'],
    ...tasks.map(task => [task.phase, task.workstream, task.title, task.efforts, task.assigned, task.notes, null]),
  ];
  const first = 4;
  const last = first + tasks.length - 1;
  const qaRow = last + 1;
  const pmRow = qaRow + 1;
  const totalRow = pmRow + 1;
  rows[qaRow - 1] = ['Cross-cutting', 'Quality Assurance', 'Ongoing QA allocation', null, 'QA', 'Automatically calculated from delivery effort.', null];
  rows[pmRow - 1] = ['Cross-cutting', 'Delivery Governance', 'Ongoing PM allocation', null, 'PM', 'Automatically calculated from delivery and QA effort.', null];
  rows[totalRow - 1] = ['', '', 'Total', null, '', '', null];

  const activeRoles = estimate.teamComposition.map(item => item.team);
  activeRoles.forEach((role, index) => {
    const row = 3 + index;
    if (!rows[row]) rows[row] = [];
    rows[row][8] = role;
    rows[row][9] = { f: `VLOOKUP(I${row + 1},'Rate Card'!$A$2:$B$${TEAM_ROLES.length + 1},2,FALSE)`, v: DEFAULT_ROLE_RATES[role] };
    rows[row][10] = { f: `SUMIF($E$${first}:$E$${pmRow},I${row + 1},$D$${first}:$D$${pmRow})`, v: role === 'QA' ? estimate.qaEffort : role === 'PM' ? estimate.pmEffort : tasks.filter(t => t.assigned === role).reduce((s, t) => s + t.efforts, 0) };
  });
  rows[3][12] = 'QA effort'; rows[3][13] = DEFAULT_QA_OVERHEAD_PERCENT / 100;
  rows[4][12] = 'PM effort'; rows[4][13] = DEFAULT_PM_OVERHEAD_PERCENT / 100;

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const cost = row => `IFERROR(D${row}*VLOOKUP(E${row},'Rate Card'!$A$2:$B$${TEAM_ROLES.length + 1},2,FALSE),"[TBC]")`;
  tasks.forEach((task, index) => {
    const row = first + index;
    sheet[`G${row}`] = { f: cost(row), t: 'n', v: task.efforts * DEFAULT_ROLE_RATES[task.assigned], z: '#,##0.00' };
  });
  sheet[`D${qaRow}`] = { f: `ROUND(SUM(D${first}:D${last})*$N$4*4,0)/4`, t: 'n', v: estimate.qaEffort, z: '#,##0.00' };
  sheet[`G${qaRow}`] = { f: cost(qaRow), t: 'n', v: estimate.qaEffort * DEFAULT_ROLE_RATES.QA, z: '#,##0.00' };
  sheet[`D${pmRow}`] = { f: `ROUND(SUM(D${first}:D${qaRow})*$N$5*4,0)/4`, t: 'n', v: estimate.pmEffort, z: '#,##0.00' };
  sheet[`G${pmRow}`] = { f: cost(pmRow), t: 'n', v: estimate.pmEffort * DEFAULT_ROLE_RATES.PM, z: '#,##0.00' };
  sheet[`D${totalRow}`] = { f: `SUM(D${first}:D${pmRow})`, t: 'n', v: estimate.totalEffort, z: '#,##0.00' };
  sheet[`G${totalRow}`] = { f: `SUM(G${first}:G${pmRow})`, t: 'n', v: estimate.totalCost, z: '#,##0.00' };
  sheet.N4.z = '0%'; sheet.N5.z = '0%';
  sheet['!merges'] = [XLSX.utils.decode_range('A1:G1'), XLSX.utils.decode_range('I1:K1'), XLSX.utils.decode_range('M1:N1')];
  sheet['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 42 }, { wch: 12 }, { wch: 22 }, { wch: 52 }, { wch: 16 }, { wch: 3 }, { wch: 22 }, { wch: 12 }, { wch: 15 }, { wch: 3 }, { wch: 18 }, { wch: 12 }];
  sheet['!autofilter'] = { ref: `A3:G${pmRow}` };
  sheet['!freeze'] = { xSplit: 0, ySplit: 3 };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Detailed WBS');

  const rateRows = [['Role', 'Hourly Rate'], ...TEAM_ROLES.map(role => [role, DEFAULT_ROLE_RATES[role]])];
  const rateSheet = XLSX.utils.aoa_to_sheet(rateRows);
  rateSheet['!cols'] = [{ wch: 28 }, { wch: 16 }];
  rateSheet['!autofilter'] = { ref: `A1:B${rateRows.length}` };
  XLSX.utils.book_append_sheet(workbook, rateSheet, 'Rate Card');
  workbook.Workbook = { CalcPr: { calcMode: 'auto', fullCalcOnLoad: true, forceFullCalc: true } };
  return { workbook, estimate };
}

export function writeWbsWorkbook(filePath, estimatorOutput) {
  const { workbook, estimate } = buildWbsWorkbook(estimatorOutput);
  fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }));
  return estimate;
}
