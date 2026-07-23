import * as XLSX from '@e965/xlsx';
import fs from 'fs';
import {
  DEFAULT_PM_OVERHEAD_PERCENT,
  DEFAULT_QA_OVERHEAD_PERCENT,
  parseEstimatorOutput,
} from './aiSchemas.js';

export function buildWbsWorkbook(estimatorOutput) {
  const estimate = parseEstimatorOutput(estimatorOutput);
  const policy = estimate.estimationPolicy || {};
  const qaOverheadPercent = Number(policy.qaOverheadPercent ?? DEFAULT_QA_OVERHEAD_PERCENT);
  const pmOverheadPercent = Number(policy.pmOverheadPercent ?? DEFAULT_PM_OVERHEAD_PERCENT);
  const workbook = XLSX.utils.book_new();
  const tasks = estimate.workBreakdown;
  const roleRateMap = new Map((estimate.teamComposition || []).map(item => [item.team, item.rate]));

  // Team composition is estimator-owned (implementationTeam + automatic QA/PM overhead roles)
  // and is validated in aiSchemas. Reuse that normalized output directly here.
  const teamComposition = estimate.teamComposition;
  const rateRows = [['Role', 'Hourly Rate'], ...teamComposition.map(item => [item.team, item.rate])];

  const rows = [
    ['Detailed Work Breakdown Structure', null, null, null, null, null, null],
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

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const rateCardLastRow = Math.max(2, rateRows.length);
  const cost = row => `IFERROR(D${row}*VLOOKUP(E${row},'Rate Card'!$A$2:$B$${rateCardLastRow},2,FALSE),"[TBC]")`;
  tasks.forEach((task, index) => {
    const row = first + index;
    const roleRate = roleRateMap.get(task.assigned);
    sheet[`G${row}`] = { f: cost(row), t: 'n', v: roleRate == null ? null : task.efforts * roleRate, z: '#,##0.00' };
  });
  sheet[`D${qaRow}`] = { f: `ROUND(SUM(D${first}:D${last})*${qaOverheadPercent / 100}*4,0)/4`, t: 'n', v: estimate.qaEffort, z: '#,##0.00' };
  const qaRate = roleRateMap.get('QA');
  sheet[`G${qaRow}`] = { f: cost(qaRow), t: 'n', v: qaRate == null ? null : estimate.qaEffort * qaRate, z: '#,##0.00' };
  sheet[`D${pmRow}`] = { f: `ROUND(SUM(D${first}:D${qaRow})*${pmOverheadPercent / 100}*4,0)/4`, t: 'n', v: estimate.pmEffort, z: '#,##0.00' };
  const pmRate = roleRateMap.get('PM');
  sheet[`G${pmRow}`] = { f: cost(pmRow), t: 'n', v: pmRate == null ? null : estimate.pmEffort * pmRate, z: '#,##0.00' };
  sheet[`D${totalRow}`] = { f: `SUM(D${first}:D${pmRow})`, t: 'n', v: estimate.totalEffort, z: '#,##0.00' };
  sheet[`G${totalRow}`] = { f: `SUM(G${first}:G${pmRow})`, t: 'n', v: estimate.totalCost, z: '#,##0.00' };
  sheet['!merges'] = [XLSX.utils.decode_range('A1:G1')];
  sheet['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 42 }, { wch: 12 }, { wch: 22 }, { wch: 52 }, { wch: 16 }];
  sheet['!autofilter'] = { ref: `A3:G${pmRow}` };
  sheet['!freeze'] = { xSplit: 0, ySplit: 3 };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Detailed WBS');

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
