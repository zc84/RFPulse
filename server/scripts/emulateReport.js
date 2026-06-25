import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import { runAgent, buildReportFromOutputs, coordinatorReviewStep, coordinatorStep } from '../services/aiOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function extractDocx(filePath) {
  const result = await mammoth.convertToHtml({ path: filePath });
  return (result.value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
}

async function main() {
  const docPath = path.join(__dirname, '../../test/2_SOWA_OWE_CP_Tender FinalMar9.docx');
  console.log('Extracting tender document…');
  const rawText = await extractDocx(docPath);
  const contextBundle = `--- 2_SOWA_OWE_CP_Tender FinalMar9.docx ---\n${rawText}`;

  console.log('Running coordinator step…');
  const fakeMessages = [{ role: 'user', content: 'Please analyse this tender and produce the assessment report.', created_at: new Date().toISOString() }];
  const coordResult = await coordinatorStep(contextBundle, fakeMessages, {});
  const agentContext = coordResult.context || contextBundle;
  console.log('Coordinator status:', coordResult.status);

  console.log('Running Legal agent…');
  const legalOutput = await runAgent('legal', agentContext, fakeMessages, {});

  console.log('Running Architect agent…');
  const architectOutput = await runAgent('architect', agentContext, fakeMessages, { legal: legalOutput });

  console.log('Running Estimator agent…');
  const estimatorOutput = await runAgent('estimator', agentContext, fakeMessages, { legal: legalOutput, architect: architectOutput });

  const agentOutputs = { legal: legalOutput, architect: architectOutput, estimator: estimatorOutput };

  console.log('Assembling report…');
  const draftReport = buildReportFromOutputs('SOWA — Offshore Wind Career Pathway Platform', agentContext, agentOutputs);

  console.log('Running Coordinator Review…');
  const finalReport = await coordinatorReviewStep(contextBundle, draftReport);

  const outPath = path.join(__dirname, '../../test/emulated-assessment-report.md');
  fs.writeFileSync(outPath, finalReport, 'utf-8');
  console.log('Report written to', outPath);
  console.log('Size:', (Buffer.byteLength(finalReport) / 1024).toFixed(1), 'KB');
}

main().catch(err => { console.error(err); process.exit(1); });
