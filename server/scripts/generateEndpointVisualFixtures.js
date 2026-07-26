import fs from 'node:fs/promises';
import path from 'node:path';
import { extractDocumentText } from '../services/documentExtractor.js';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const tenderPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(rootDir, 'test', '2_SOWA_OWE_CP_Tender FinalMar9.docx');
const outputDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(rootDir, 'test', 'generated-endpoint-visuals');
const endpointBaseUrl = process.env.ENDPOINT_BASE_URL || 'http://127.0.0.1:3100';

function buildRelevantTenderContext(text) {
  const lines = text.split(/\r?\n/);
  const introduction = lines.slice(0, 32);
  const solutionRequirements = lines.slice(245, 405);
  return [
    '# Extracted tender context',
    ...introduction,
    '# Platform, architecture, delivery, and security requirements',
    ...solutionRequirements,
  ].join('\n').slice(0, 95_000);
}

function structuredProposalData() {
  return {
    architecture: {
      boundaries: [
        { id: 'experience', label: 'Experience layer' },
        { id: 'application', label: 'Application and content layer' },
        { id: 'data-integration', label: 'Data and integration layer' },
      ],
      components: [
        { id: 'web', label: 'OWE careers web application', technology: 'React / Next.js', boundaryId: 'experience' },
        { id: 'cms', label: 'Editorial CMS', technology: 'Headless CMS', boundaryId: 'application' },
        { id: 'api', label: 'Platform API', technology: 'Node.js', boundaryId: 'application' },
        { id: 'search', label: 'Course and career search', technology: 'OpenSearch', boundaryId: 'application' },
        { id: 'integration', label: 'Integration adapters', technology: 'REST APIs', boundaryId: 'data-integration' },
        { id: 'database', label: 'Platform database', technology: 'PostgreSQL', boundaryId: 'data-integration' },
        { id: 'analytics', label: 'Analytics and monitoring', technology: 'GA4 / Cloud monitoring', boundaryId: 'data-integration' },
      ],
      relationships: [
        { from: 'web', to: 'api', label: 'Uses platform services', protocol: 'HTTPS/JSON' },
        { from: 'cms', to: 'api', label: 'Publishes content', protocol: 'HTTPS/JSON' },
        { from: 'api', to: 'search', label: 'Searches courses and roles', protocol: 'HTTPS' },
        { from: 'api', to: 'database', label: 'Reads and writes platform data', protocol: 'SQL/TLS' },
        { from: 'api', to: 'integration', label: 'Synchronizes external data', protocol: 'REST/OAuth2' },
        { from: 'web', to: 'analytics', label: 'Sends consented usage events', protocol: 'HTTPS' },
      ],
    },
    cloudArchitecture: {
      provider: 'aws',
      boundaries: [
        { id: 'edge', label: 'AWS edge and protection', kind: 'edge' },
        { id: 'public', label: 'Public subnets', kind: 'network' },
        { id: 'private', label: 'Private application subnets', kind: 'network' },
        { id: 'data', label: 'Private data subnets', kind: 'network' },
      ],
      resources: [
        { id: 'cloudfront', label: 'Content delivery', service: 'Amazon CloudFront', boundaryId: 'edge' },
        { id: 'waf', label: 'Web application firewall', service: 'AWS WAF', boundaryId: 'edge' },
        { id: 'alb', label: 'Application load balancer', service: 'Elastic Load Balancing', boundaryId: 'public' },
        { id: 'ecs-web', label: 'Web and API services', service: 'Amazon ECS Fargate', boundaryId: 'private' },
        { id: 'ecs-worker', label: 'Integration workers', service: 'Amazon ECS Fargate', boundaryId: 'private' },
        { id: 'rds', label: 'Platform database', service: 'Amazon RDS for PostgreSQL', boundaryId: 'data' },
        { id: 'opensearch', label: 'Course and career search', service: 'Amazon OpenSearch Service', boundaryId: 'data' },
        { id: 's3', label: 'Media and document storage', service: 'Amazon S3', boundaryId: 'data' },
      ],
      relationships: [
        { from: 'cloudfront', to: 'waf', label: 'Protected requests', protocol: 'HTTPS' },
        { from: 'waf', to: 'alb', label: 'Allowed traffic', protocol: 'HTTPS' },
        { from: 'alb', to: 'ecs-web', label: 'Routes requests', protocol: 'HTTPS' },
        { from: 'ecs-web', to: 'rds', label: 'Application data', protocol: 'PostgreSQL/TLS' },
        { from: 'ecs-web', to: 'opensearch', label: 'Search queries', protocol: 'HTTPS' },
        { from: 'ecs-web', to: 's3', label: 'Media access', protocol: 'HTTPS' },
        { from: 'ecs-worker', to: 'rds', label: 'Synchronized records', protocol: 'PostgreSQL/TLS' },
      ],
    },
    c4: {
      level: 'container',
      boundaries: [{ id: 'owe-platform', label: 'OWE careers platform' }],
      elements: [
        { id: 'job-seeker', label: 'Learner / job seeker', kind: 'person' },
        { id: 'editor', label: 'Content editor', kind: 'person' },
        { id: 'web-app', label: 'Careers web application', kind: 'container', technology: 'React / Next.js', boundaryId: 'owe-platform' },
        { id: 'cms-app', label: 'Editorial CMS', kind: 'container', technology: 'Headless CMS', boundaryId: 'owe-platform' },
        { id: 'api-app', label: 'Platform API', kind: 'container', technology: 'Node.js', boundaryId: 'owe-platform' },
        { id: 'integration-worker', label: 'Integration worker', kind: 'container', technology: 'Node.js', boundaryId: 'owe-platform' },
        { id: 'platform-db', label: 'Platform database', kind: 'container', technology: 'PostgreSQL', boundaryId: 'owe-platform' },
        { id: 'external-providers', label: 'Training and event providers', kind: 'software-system' },
      ],
      relationships: [
        { from: 'job-seeker', to: 'web-app', label: 'Explores careers and training' },
        { from: 'editor', to: 'cms-app', label: 'Manages content' },
        { from: 'web-app', to: 'api-app', label: 'Uses', technology: 'HTTPS/JSON' },
        { from: 'cms-app', to: 'api-app', label: 'Publishes', technology: 'HTTPS/JSON' },
        { from: 'api-app', to: 'platform-db', label: 'Reads and writes', technology: 'SQL/TLS' },
        { from: 'integration-worker', to: 'external-providers', label: 'Synchronizes courses and events', technology: 'REST/OAuth2' },
        { from: 'integration-worker', to: 'platform-db', label: 'Stores normalized records', technology: 'SQL/TLS' },
      ],
    },
    timeline: [
      { id: 'discovery', label: 'Discovery and kickoff workshops', start: '2026-08-03', end: '2026-08-14', group: 'Design', dependencies: [], milestone: false },
      { id: 'experience-design', label: 'Information architecture and UX design', start: '2026-08-17', end: '2026-09-11', group: 'Design', dependencies: ['discovery'], milestone: false },
      { id: 'design-approval', label: 'Design approval', start: '2026-09-14', end: '2026-09-14', group: 'Design', dependencies: ['experience-design'], milestone: true },
      { id: 'development', label: 'Platform and integration development', start: '2026-09-15', end: '2026-11-13', group: 'Development', dependencies: ['design-approval'], milestone: false },
      { id: 'testing', label: 'Accessibility, security, and acceptance testing', start: '2026-11-16', end: '2026-12-04', group: 'Testing', dependencies: ['development'], milestone: false },
      { id: 'launch', label: 'Production deployment and launch', start: '2026-12-07', end: '2026-12-07', group: 'Deployment', dependencies: ['testing'], milestone: true },
      { id: 'aftercare', label: 'Post-launch aftercare', start: '2026-12-08', end: '2027-02-07', group: 'Aftercare', dependencies: ['launch'], milestone: false },
    ],
  };
}

function requestFor(types, tenderContext) {
  return {
    mode: 'source',
    source: {
      proposal_markdown: tenderContext,
      architecture_markdown: [
        '# Proposed response architecture',
        'The proposal uses a modular, API-first careers platform with a managed cloud deployment.',
        'It supports secure structured-data export, external-provider integrations, editorial content, search, analytics, privacy by design, encryption, monitoring, and independent scaling.',
      ].join('\n\n'),
      structured_data: structuredProposalData(),
    },
    context: {
      proposal_type: 'public-sector-digital-platform',
      audience: ['executive', 'technical'],
      stage: 'proposal',
      goals: [
        'Explain the proposed modular solution',
        'Show the cloud deployment and security boundaries',
        'Document the C4 container responsibilities',
        'Communicate the requested delivery phases and milestones',
      ],
      customer_priorities: [
        'Accessibility',
        'Privacy by design',
        'Secure API integration',
        'Scalability',
        'Two months of aftercare',
      ],
    },
    selection: {
      mode: 'explicit',
      types,
      excluded_types: [],
      max_visuals: types.length,
    },
    request: {
      intent: 'Generate proposal-ready diagrams grounded in the supplied tender and structured response design.',
      language: 'en',
    },
    render: {
      format: 'png',
      delivery: 'base64',
      failure_policy: 'atomic',
      style_preset: 'professional-light-v1',
    },
    include_plan: true,
  };
}

async function renderBatch(types, tenderContext, batchIndex) {
  const response = await fetch(`${endpointBaseUrl}/v1/visuals/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `tender-visuals-${Date.now()}-${batchIndex}`,
    },
    body: JSON.stringify(requestFor(types, tenderContext)),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Visual endpoint returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

const extracted = await extractDocumentText(tenderPath);
if (!extracted.success) throw new Error(`Tender extraction failed: ${extracted.error}`);
const tenderContext = buildRelevantTenderContext(extracted.text);
await fs.mkdir(outputDir, { recursive: true });

const batches = [
  ['architecture-overview'],
  ['architecture-details', 'cloud-architecture'],
  ['architecture-c4', 'gantt'],
];
const manifest = {
  tender: tenderPath,
  endpoint: endpointBaseUrl,
  generatedAt: new Date().toISOString(),
  artifacts: [],
  plans: [],
};

for (let index = 0; index < batches.length; index += 1) {
  const payload = await renderBatch(batches[index], tenderContext, index);
  manifest.plans.push(payload.plan);
  for (const artifact of payload.artifacts) {
    const filename = `${artifact.type}.png`;
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, Buffer.from(artifact.image_base64, 'base64'));
    manifest.artifacts.push({
      type: artifact.type,
      file: filename,
      width: artifact.width,
      height: artifact.height,
      renderer: artifact.renderer,
      status: artifact.status,
      bytes: Buffer.byteLength(artifact.image_base64, 'base64'),
    });
  }
}

await fs.writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(manifest.artifacts, null, 2));

