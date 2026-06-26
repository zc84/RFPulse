import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const DEMO_DEAL_NAME = 'Demo: Healthcare Patient Portal RFP';

const DEMO_CONTEXT = `Client: Regional Health Network (RHN)
Domain: Healthcare
Budget signal: $180k-$240k
Due date: 2026-08-15

RFP Summary:
RHN is seeking a vendor to design and deliver a secure, HIPAA-compliant patient portal that integrates with their existing Epic EHR via HL7 FHIR. The portal must support appointment scheduling, secure messaging, lab results, medication lists, and visit summaries. A mobile-responsive web app is required; native mobile apps are optional.

Key Requirements:
- HIPAA compliance, BAAs, encryption at rest and in transit, audit logs
- SSO via SAML 2.0 with existing identity provider
- Data residency: United States only
- Accessibility: WCAG 2.1 AA
- 99.9% uptime SLA, business-hours support
- Integration: HL7 FHIR R4 read/write for appointments, observations, and documents
- Offline access to recent visit summaries and medication list
- Analytics dashboard for clinic administrators (de-identified, PHI-safe)

Submission Requirements:
- Executive summary and proposed approach
- Technical architecture and data model
- Implementation plan and timeline
- Detailed effort estimate (hours)
- Security and compliance posture
- Team composition and relevant project examples
- Risk register and mitigation plan`;

const DEMO_EXTRACTED_DOCS = [
  { id: 'doc-1', name: 'RHN_Patient_Portal_RFP.md', size: '24 KB', success: true },
  { id: 'doc-2', name: 'Technical_Requirements_Appendix.pdf', size: '18 KB', success: true },
  { id: 'doc-3', name: 'Security_Questionnaire.xlsx', size: '12 KB', success: true },
];

const DEMO_AGENT_OUTPUTS = {
  legal: `## Legal & Compliance Notes

### Mandatory Requirements
| Requirement | Source | Risk if Missing |
|-------------|--------|-----------------|
| HIPAA compliance & BAAs | RFP Section 3.1 | High — disqualifying |
| SAML 2.0 SSO | RFP Section 4.2 | Medium — integration failure |
| WCAG 2.1 AA | RFP Section 5.3 | Medium — legal/ADA exposure |
| US data residency | RFP Section 3.4 | High — breach of contract |
| 99.9% uptime SLA | RFP Section 6.1 | Medium — financial penalties |

### Compliance Posture
- **Governance**: DPIA, BAAs with RHN and any subcontractors, risk register, change-control board
- **Data Residency**: AWS us-east-1 / us-west-2; no cross-border replication of PHI
- **Privacy & Consent**: Consent versioning, DSAR workflow, audit trail of all access to PHI
- **HIPAA/GDPR specifics**: ePHI scoped to patient record; BAAs in place; no PHI in logs/notifications
- **Security Controls**: AES-256 encryption, TLS 1.3, IAM with RBAC, SIEM, MDM for admin devices

### Contractual Risks
| Risk | Level | Mitigation |
|------|-------|------------|
| Uptime SLA penalties | Medium | redundant infrastructure, monitoring, runbook |
| HIPAA breach liability | High | minimum-necessary access, encryption, audit logs |
| Scope creep on native mobile apps | Low | explicitly mark as optional/out-of-scope |

### Recommended Response Clauses
- Limitation of liability tied to contract value
- Change-control clause for FHIR API scope changes
- Right to audit for HIPAA compliance`,
  architect: `## Proposed Architecture

### Overview
A cloud-native, API-first patient portal built on a React frontend and Node.js/TypeScript backend, backed by a PostgreSQL database and integrated with Epic via an HL7 FHIR R4 gateway. The architecture is designed for HIPAA compliance, US data residency, and 99.9% availability.

### Requirements Addressed
| Requirement | Architectural Decision |
|-------------|------------------------|
| Epic integration | FHIR R4 gateway with OAuth2 + SMART on FHIR |
| HIPAA audit | Immutable audit log store, SIEM integration |
| US data residency | AWS us-east-1 primary, us-west-2 DR |
| Offline access | Encrypted local PWA cache for recent records |
| Admin analytics | De-identified event pipeline with PHI scrubbing |

### Components
| Component | Role | Technology | Rationale |
|-----------|------|------------|-----------|
| Web App | Patient UI | React + TypeScript | Modern, accessible, mobile-responsive |
| API Gateway | Auth/routing | AWS API Gateway | Centralized auth, rate limiting |
| App Service | Business logic | Node.js + Express | Mature, fast, FHIR libraries |
| Database | Structured data | PostgreSQL | ACID, JSONB for FHIR resources |
| Audit Store | Compliance logs | AWS S3 + DynamoDB | Immutable, scalable |
| FHIR Gateway | EHR integration | Custom Node.js adapter | SMART on FHIR auth |
| Identity | SSO | SAML 2.0 via Auth0 | Matches RHN IdP |

### Data Flow
Patient logs in via SAML, receives a session token, and calls the API Gateway. The App Service validates permissions, reads/writes FHIR resources through the FHIR Gateway, and logs all access to the Audit Store. Offline-capable data is cached in the browser via a PWA service worker.

### Architecture Diagram
\`\`\`mermaid
graph TD
    A[Patient Browser] --> B[CloudFront CDN]
    B --> C[API Gateway]
    C --> D[App Service]
    D --> E[(PostgreSQL)]
    D --> F[Audit Store]
    D --> G[FHIR Gateway]
    G --> H[Epic EHR]
    I[Admin Dashboard] --> C
\`\`\`

### Data Model (Outline)
- User: id, external_id, role, last_login, consent_version
- PatientRecord: id, user_id, fhir_patient_id, created_at
- Appointment: id, patient_record_id, fhir_appointment_id, status, datetime
- Observation: id, patient_record_id, fhir_observation_id, category, value
- AuditEvent: id, actor_id, resource_type, resource_id, action, timestamp

### Implementation Plan
**Phase I (Weeks 1-3)**: Setup, SSO, FHIR gateway skeleton, database schema
**Phase II (Weeks 4-7)**: Core features: appointments, messages, results, medications
**Phase III (Weeks 8-10)**: Offline PWA, admin analytics, accessibility audit
**Phase IV (Weeks 11-12)**: Security review, penetration test, go-live prep

### Security & Compliance Notes
- All PHI encrypted at rest (AES-256) and in transit (TLS 1.3)
- Role-based access control aligned with HIPAA minimum-necessary
- Automated vulnerability scanning in CI/CD

### Analytics & Offline Strategy
- Analytics: PHI-safe event dictionary, redaction before aggregation
- Offline: encrypted IndexedDB cache, sync on reconnect, conflict resolution per timestamp`,
  estimator: `## Effort & Cost Estimate

### Work Breakdown Structure (granular tasks)
| Task ID | Work Package | Task | Description | Effort (hours) | Assumptions | Dependencies | Confidence |
|---------|--------------|------|-------------|----------------|-------------|--------------|------------|
| T-001 | Discovery | RFP analysis & workshops | 3 workshops with RHN | 24 | RHN available | None | High |
| T-002 | Discovery | SSO integration design | SAML mapping, token flow | 16 | IdP metadata provided | None | High |
| T-003 | Discovery | FHIR schema mapping | Resource mapping for appointments, observations, docs | 20 | Epic FHIR sandbox access | None | Medium |
| T-004 | Foundation | Project setup & CI/CD | Repo, pipelines, environments | 24 | AWS accounts ready | T-001 | High |
| T-005 | Foundation | Database schema | PostgreSQL + migrations | 24 | Schema approved | T-003 | High |
| T-006 | Foundation | Auth & RBAC | JWT, roles, policies | 32 | SSO design complete | T-002 | High |
| T-007 | Core | Appointments module | List, book, cancel | 40 | FHIR mapping ready | T-005 | High |
| T-008 | Core | Secure messaging | Threaded, encrypted | 40 | Auth ready | T-006 | High |
| T-009 | Core | Results & medications | Display, history | 40 | FHIR mapping ready | T-005 | High |
| T-010 | Core | Visit summaries | PDF generation | 24 | Results module | T-009 | Medium |
| T-011 | Compliance | Audit logging | Immutable events | 24 | Auth ready | T-006 | High |
| T-012 | Compliance | Security hardening | Encryption, scanning | 32 | Foundation complete | T-006 | High |
| T-013 | Analytics | Admin dashboard | De-identified metrics | 32 | Schema ready | T-005 | Medium |
| T-014 | Offline | PWA cache & sync | IndexedDB, conflict resolution | 32 | Core modules | T-010 | Medium |
| T-015 | QA | Test automation & UAT | Unit, integration, accessibility | 40 | Modules complete | T-014 | High |
| T-016 | Deployment | Staging, prod, DR | Infrastructure as code | 32 | AWS accounts ready | T-012 | High |

### Work Package Summary
| Work Package | Total Effort (hours) | Confidence |
|--------------|----------------------|------------|
| Discovery | 60 | High |
| Foundation | 80 | High |
| Core | 144 | High |
| Compliance | 56 | High |
| Analytics | 32 | Medium |
| Offline | 32 | Medium |
| QA | 40 | High |
| Deployment | 32 | High |

### Team Composition
| Role | Count / FTE | Responsibilities |
|------|-------------|------------------|
| Tech Lead | 1.0 | Architecture, Epic integration, code review |
| Backend Engineer | 2.0 | API, FHIR gateway, database, security |
| Frontend Engineer | 1.0 | React app, PWA, accessibility |
| QA/Tester | 0.5 | Test automation, UAT, accessibility validation |
| PM/Scrum Master | 0.5 | Sprint planning, stakeholder sync, risk tracking |
| DevOps | 0.25 | CI/CD, infrastructure, monitoring |

### Summary
- **Total Effort:** 476 hours
- **Recommended Contingency:** 15% (adds ~72 hours)
- **Estimated Duration:** 12 weeks with the recommended team size

### Basis of Estimate
The estimate reflects a lean, competitive delivery using proven technologies and clear FHIR integration. Hours are conservative for discovery and compliance while keeping core feature work realistic.

### Hidden Complexity, Dependencies & Exclusions
| Risk / Dependency | Impact | Exclusion / Mitigation |
|-------------------|--------|------------------------|
| Epic FHIR sandbox availability | High | Assumes RHN provides access by week 1 |
| Native mobile apps | High | Explicitly out-of-scope (optional) |
| 3rd-party SSO certificate rotation | Medium | Document process, monitor expiry |
| Accessibility audit fixes | Medium | Budget 1 week buffer in QA |`,
};

function buildDemoReport() {
  const parts = [`# Assessment Report: ${DEMO_DEAL_NAME}`, ''];
  parts.push('## Deal Context', '', DEMO_CONTEXT.trim(), '');
  for (const [slug, content] of Object.entries(DEMO_AGENT_OUTPUTS)) {
    parts.push('---', '', content.trim(), '');
  }
  return parts.join('\n');
}

const DEMO_REVIEW = `## Coordinator Review

**Confidence Win Score:** 78%

**Score Explanation:** The deal context is clear and the specialist agents produced complete legal, architecture, and estimate sections. The report addresses all stated requirements. Confidence is reduced slightly because the RFP does not explicitly confirm Epic FHIR sandbox availability and native mobile scope is marked optional, creating minor assumptions.

### Findings & Gaps
- The FHIR gateway dependency on RHN's Epic sandbox should be confirmed in writing.
- Native mobile apps are optional; scope should be explicitly excluded unless client confirms.
- The accessibility audit timing assumes WCAG 2.1 AA tooling; budget should include a small remediation buffer.

### Submission Requirements

| # | Item (exact wording from RFP) | Section | Status |
|---|---|---|---|
| 1 | Executive summary and proposed approach | Submission checklist | Included in this report |
| 2 | Technical architecture and data model | Submission checklist | Included in this report |
| 3 | Implementation plan and timeline | Submission checklist | Included in this report |
| 4 | Detailed effort estimate (hours) | Submission checklist | Included in this report |
| 5 | Security and compliance posture | Submission checklist | Included in this report |
| 6 | Team composition and relevant project examples | Submission checklist | Must be supplied as a separate attachment |
| 7 | Risk register and mitigation plan | Submission checklist | Included in this report |`;

function buildFinalReport() {
  const draft = buildDemoReport();
  const titleLineEnd = draft.indexOf('\n');
  if (titleLineEnd === -1) return DEMO_REVIEW + '\n\n' + draft;
  const titleLine = draft.slice(0, titleLineEnd);
  const reportBody = draft.slice(titleLineEnd);
  return titleLine + '\n\n' + DEMO_REVIEW.trim() + '\n' + reportBody;
}

let nextSessionId = 1;

router.post('/ai-demo/start', authenticate, requireRole('Superadmin'), (req, res) => {
  const sessionId = nextSessionId++;
  const messages = [
    {
      id: 1,
      session_id: sessionId,
      role: 'coordinator',
      agent_slug: null,
      content: `I have reviewed the extracted deal context for **${DEMO_DEAL_NAME}**. I have enough information to route the work to the specialist agents.\n\n**Plan:** legal, architect, estimator\n\nPlease reply with "Proceed with the analysis." to continue the demo.`,
      created_at: new Date().toISOString(),
    },
  ];

  res.json({
    sessionId,
    status: 'routing',
    plan: ['legal', 'architect', 'estimator'],
    reasoning: 'Demo: context is sufficient to route to legal, architect, and estimator agents.',
    messages,
    extractedDocs: DEMO_EXTRACTED_DOCS,
  });
});

router.post('/ai-demo/message', authenticate, requireRole('Superadmin'), (req, res) => {
  const { content } = req.body;
  const sessionId = nextSessionId++;
  const lower = (content || '').toLowerCase();
  const isProceed = lower.includes('proceed') || lower.includes('continue') || lower.includes('run') || lower.includes('start');

  if (!isProceed) {
    return res.json({
      sessionId,
      status: 'active',
      messages: [
        {
          id: 2,
          session_id: sessionId,
          role: 'user',
          agent_slug: null,
          content,
          created_at: new Date().toISOString(),
        },
        {
          id: 3,
          session_id: sessionId,
          role: 'coordinator',
          agent_slug: null,
          content: 'This is a demo session. Please reply with "Proceed with the analysis." to simulate the agent workflow.',
          created_at: new Date().toISOString(),
        },
      ],
    });
  }

  const messages = [
    {
      id: 2,
      session_id: sessionId,
      role: 'user',
      agent_slug: null,
      content,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      session_id: sessionId,
      role: 'agent',
      agent_slug: 'coordinator',
      content: 'Running agents: legal, architect, estimator',
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      session_id: sessionId,
      role: 'agent',
      agent_slug: 'coordinator',
      content: 'Agent legal completed.',
      created_at: new Date().toISOString(),
    },
    {
      id: 5,
      session_id: sessionId,
      role: 'agent',
      agent_slug: 'coordinator',
      content: 'Agent architect completed.',
      created_at: new Date().toISOString(),
    },
    {
      id: 6,
      session_id: sessionId,
      role: 'agent',
      agent_slug: 'coordinator',
      content: 'Agent estimator completed.',
      created_at: new Date().toISOString(),
    },
    {
      id: 7,
      session_id: sessionId,
      role: 'agent',
      agent_slug: 'coordinator',
      content: 'Assessment report generated and reviewed.',
      created_at: new Date().toISOString(),
    },
  ];

  res.json({
    sessionId,
    status: 'completed',
    messages,
    agentOutputs: DEMO_AGENT_OUTPUTS,
    finalReport: buildFinalReport(),
  });
});

router.get('/ai-demo/session', authenticate, requireRole('Superadmin'), (req, res) => {
  res.json({
    session: {
      id: 0,
      deal_id: 0,
      status: 'active',
      extracted_context: DEMO_CONTEXT,
      final_report_document_id: null,
    },
    messages: [],
    agentOutputs: {},
  });
});

export default router;
