# ORB Digital Ecosystem Assessment Report (HIPAA + GDPR)

Report Generated: May 22, 2026
Pipeline Mode: full_pipeline (prototype_required: false)

---

## 1. Executive Summary

ORB is a cross-platform (iOS/Android/Web) training and rehabilitation product connecting patients/athletes with trainers/physiotherapists. The solution must process health data and therefore must comply with both GDPR and HIPAA. This assessment designs a compliance-first architecture using React Native (mobile) and React (web) with a HIPAA-eligible backend on AWS, offline-first clients, AI insights with de-identification, and global data residency controls.

Key capabilities
- Multi-role onboarding (patient/athlete/trainer/physio) and consent workflows
- Training planner (drag & drop), calendar, timers (EMOM/AMRAP/Tabata)
- Exercise library (video streaming, biomechanics content)
- Progress tracking (grip strength tests, asymmetry, diary, charts)
- Real-time chat and push notifications (no PHI in payloads)
- Subscriptions and activation codes
- AI insights (weekly summaries, training suggestions) with PHI minimization
- Accessibility (WCAG 2.1 AA) and multi-language (PL, EN, DE, UK, ES, AR, SV)

High-level timeline: ~270 days (5 phases) • Team: 7.0 FTE avg • Total effort: 3,060 hours (incl. 10% contingency)

---

## 2. Compliance Posture (GDPR + HIPAA)

- Governance
  - Data Protection Impact Assessment (DPIA) before production; update on major changes
  - Data Processing Agreements (DPAs) with all subprocessors; Business Associate Agreements (BAAs) for HIPAA services
- Data residency
  - Regional deployments: EU (e.g., eu-central-1) for GDPR; US (us-east-1) for HIPAA workloads
  - Tenant-to-region mapping; no cross-region PHI replication by default
- Privacy & consent
  - Consent service with versioned policies; per-purpose consent tracking; downloadable audit trail
  - DSAR endpoints: export, rectification, deletion; retention schedules by data category
- HIPAA specifics
  - ePHI scope: training logs, grip tests, vitals, user identifiers linked to health context
  - BAAs: AWS (covered services), logging pipeline, on-prem/BAA analytics; avoid GA4/Mixpanel for PHI
  - PHI minimization: de-identify before any external AI calls; no PHI in logs, metrics, crash reports, notifications, or URLs
- Security controls
  - Encryption: TLS 1.2+, at-rest AES-256 (KMS), client-side encrypted local stores on devices
  - IAM: least-privilege RBAC/ABAC; short-lived credentials; no shared accounts
  - Audit: immutable audit logs of PHI access and admin actions; retention per policy; tamper-evident storage
  - Monitoring: GuardDuty/Security Hub/CloudWatch; anomaly alerts; incident runbooks and breach notification workflows

---

## 3. Technology Stack & Architecture

- Mobile: React Native (bare workflow)
  - Secure storage: react-native-keychain + SQLite (SQLCipher or WatermelonDB with encryption)
  - i18next for localization; RN Accessibility APIs; Detox/E2E tests
- Web: React (Next.js 14 with App Router)
  - SSR for auth screens; static for marketing; strict CSP; i18n routing
- Backend (HIPAA-eligible on AWS)
  - API Layer: Amazon API Gateway (REST + WebSocket) → AWS Lambda (Node.js/TypeScript) or ECS Fargate (NestJS) for long-lived services
  - Auth: Amazon Cognito (OIDC, Google, Apple); fine-grained app roles; device revocation; risk-based challenges
  - Data: Amazon RDS PostgreSQL (KMS, TLS) with row-level access patterns; S3 (SSE-KMS) for media; pre-signed URLs with short TTL
  - Real-time: API Gateway WebSocket or AppSync GraphQL subscriptions (HIPAA-eligible)
  - Notifications: SNS + Pinpoint → FCM/APNs (no PHI in payloads)
  - Secrets/Config: AWS Secrets Manager + SSM Parameter Store
  - Networking: VPC, private subnets, NAT, WAF, Shield, CloudFront for web assets, ALB as needed
- AI/Recommender
  - Option A (preferred for HIPAA): Azure OpenAI or AWS Bedrock under BAA, via a de-identification proxy
  - Option B: Self-hosted model (e.g., Llama 3) within VPC; no data leaves boundary
  - De-identification gateway strips identifiers before model call; store prompts/responses without PHI
- Analytics/Telemetry (PHI-safe)
  - Self-hosted PostHog/Matomo within VPC; event schemas exclude PHI/PII; IP anonymization; DPA in place
  - Crash reporting with PII scrubbing (Sentry On-Prem or self-hosted alternative)

Data flow summary
1) Client (RN/Next) → API Gateway (REST) → Lambdas → RDS/S3
2) Chat/Realtime: WebSocket/AppSync subscriptions
3) AI insights: Client → AI Proxy (Lambda/ECS) → HIPAA-eligible model → return de-identified summary

---

## 4. Data Residency & Tenancy

- Tenancy model: per-organization tenants with user-level roles; PHI isolated at tenant and region boundary
- Region binding: users/tenants hard-bound to EU or US at creation; cross-region access blocked by policy
- Backups: regional, encrypted; cross-region disaster recovery without PHI unless lawful basis and consent

---

## 5. Security Controls (Detailed)

- Access control: RBAC (patient, athlete, trainer, physio, admin); support multi-role users; attribute checks at API and SQL layer
- Audit logging: read/write of ePHI, consent changes, admin actions; immutable store (e.g., S3 + Glacier + integrity checks)
- Key management: AWS KMS with CMKs; key rotation; envelope encryption
- Device security: 
  - iOS Keychain + Data Protection; Android Keystore-backed keys; jailbreak/root detection hooks
  - Local DB encrypted; app PIN/biometric gate for PHI screens (configurable)
- SDLC: SAST/DAST; dependencies scanned; IaC policies (cfn-nag/Checkov); secrets scanning; signed releases (CI)

---

## 6. AI & Recommendation Engine

- Weekly insight generation and training suggestions using de-identified aggregates: adherence, grip trends, asymmetry, fatigue proxies
- Safety prompt: disclaimers, scope limits, avoid medical advice; human-in-the-loop approval for AI-suggested plans
- Caching layer (24h) for insights; user opt-out controls; full audit trace of AI recommendations and approvals

---

## 7. Analytics & Product Insights

- Self-hosted analytics only; event dictionary excludes PHI
- Funnels: onboarding → first workout → subscription; retention cohorts; crash-free sessions
- Privacy: consent gating for analytics; regional data storage; opt-out honored per region

---

## 8. Offline-First Strategy (Mobile)

- Local encrypted store (SQLCipher/WatermelonDB); background sync when online
- Conflict resolution: last-writer-wins for non-PHI metadata, per-field merge for logs; clinician approval queue for plan conflicts
- Sync filters by tenant/user; sync tokens per collection; exponential backoff; resumable uploads for videos

---

## 9. Core Data Model (Outline)

- profiles(id, role[], locale, goals, trainer_id, consent_state, region)
- training_plans(id, owner_id, assignee_id, start_date, end_date, template)
- plan_workouts(id, plan_id, exercise_id, position, sets, reps, weight, rest_s)
- exercises(id, title, category, difficulty, video_url, biomechanics)
- workout_logs(id, user_id, plan_id, start_ts, end_ts, notes, rpe)
- exercise_logs(id, workout_id, exercise_id, reps, sets, weight, duration)
- grip_tests(id, user_id, left_kg, right_kg, hold_s, asymm_pct, ts)
- messages(id, room_id, sender_id, content, created_at, read)
- subscriptions(id, user_id, plan, status, renewal_date, activation_code)
- consents(id, user_id, policy_ver, granted_at, scopes[])
- audit_events(id, actor, action, target, ts, metadata)

All tables encrypted at rest; strict API policies enforce tenant and role scoping.

---

## 10. Implementation Plan (270 days)

Phase I (Day 1–30): Analysis, Architecture, UX/UI
- Workshops, SRS, DPIA draft, ACR test plan (24h)
- Next.js + RN project setup, monorepo, env management, CI/CD, SAST (40h)
- AWS baseline (VPC, Cognito, API GW, RDS, S3, KMS, WAF, CloudFront) (40h)
- DB schema/migrations + seed (24h)
- Design system + key flows in Figma (32h)
- Accessibility pass and localization scaffolding (16h)

Phase II (Day 31–90): Core Features
- Auth & onboarding (email, Google, Apple; roles; consent) (32h)
- Planner: plan CRUD + DnD + calendar + timers (EMOM/AMRAP/Tabata) (40h)
- Exercise library: upload, streaming, search, filters (40h)
- Progress: grip tests, charts, diary (32h)
- API Lambdas + RDS integration, RLS patterns (40h)
- Unit/widget/integration tests; QA gates (24h)

Phase III (Day 91–120): Advanced + AI + Comms
- Education module (lessons, quizzes, badges, certificates) (40h)
- Chat (WebSocket/AppSync), typing indicators, read receipts (32h)
- Push notifications (SNS→FCM/APNs), category policies (24h)
- AI proxy + de-identification + insights widget + approval flow (40h)
- Security hardening, PII scrubbing, log redaction (24h)

Phase IV (Day 121–180): Monetization & UAT
- Stripe Checkout/web + native sheets; webhook handlers (40h)
- Activation codes admin + redemption flows (24h)
- Analytics instrumentation (self-hosted), funnels, dashboards (32h)
- UAT recruitment, test cycles, bug triage/fixes (120h)
- Performance profiling & optimization (40h)

Phase V (Day 181–270): Launch & Compliance
- Production AWS environment, IaC, disaster recovery runbook (24h)
- Load testing (1,000 concurrent users), DB indexes, caching (32h)
- App Store + Play Store submissions (privacy, age rating) (72h)
- Web production deploy (CloudFront) + WAF tuning (24h)
- Final DPIA, ACR publication, security audit report (40h)
- Documentation & handover; on-site acceptance meetings (32h)

Note: All tasks capped at ≤40h and may be split further during sprint planning.

---

## 11. Effort & Cost Estimate

- Phase I: 176h
- Phase II: 208h
- Phase III: 160h
- Phase IV: 256h
- Phase V: 176h
- QA/PM/DevOps overhead (cross-cutting): 480h
- Contingency (10%): 280h

Total: 3,060 hours (9 months, ~7.0 FTE average)

---

## 12. Team Composition

- React Native Engineers: 2
- React/Next.js Engineer: 1
- Backend (Node.js/AWS) Engineer: 1
- DevOps/Security Engineer: 1
- QA Engineer: 1
- Product/Project Manager: 1
- AI Engineer (part-time): 0.5

---

## 13. Risks & Mitigations

- HIPAA analytics constraints → Self-hosted analytics, PHI-free events, DPA/BAA
- AI vendor policy shifts → De-identification proxy; switchable provider (Azure OpenAI/Bedrock/self-hosted)
- App Store review delays → Early TestFlight betas; privacy compliance checklist
- Performance under realtime load → Backpressure, pagination, regional endpoints
- Global data residency → Tenant-region binding; separate US/EU stacks; lawful basis review for cross-border needs

---

## 14. Deliverables

- SRS, Architecture Document, Planning Package (internal artifacts)
- This Assessment Report (persisted)
- DPIA template and initial risk register
- Accessibility Conformance Report (post-QA)
- IaC for AWS baseline; deployment runbooks

---

## 15. Appendices

- DPIA Outline: processing purposes, data categories, access matrix, risks, mitigations, residual risk
- Audit Event Catalog: login, consent grant/withdraw, PHI read/write/delete, admin changes, AI recommendation issued/approved
- Data Retention Matrix: consents (indefinite), logs (12–24 months), PHI (per policy), backups (35 days), analytics (90 days, PHI-free)

---

Saved to: /Users/dondimon/git/proposer/orb-digital-ecosystem_assessment_report.md
