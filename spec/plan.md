# RFPulse AI-Native Framework — Implementation Plan

**Repository analyzed:** `RFPulse-feature-framework-inspired-ai-engine`  
**Plan version:** 1.0  
**Date:** 2026-07-14  
**Primary objective:** Convert the current partially AI-assisted, code-directed proposal workflow into an **AI-native, plan-driven workflow**, while keeping deterministic code only for runtime control, security, persistence, calculations, and artifact rendering.

---

## 1. Executive Decision

The current solution already contains useful AI building blocks: configurable agents and prompts, document extraction, resumable workflow state, structured estimator output, proposal generation, diagrams, WBS generation, validation, cancellation, and an Andersen Delivery Framework knowledge package.

However, the workflow is still fundamentally **code-based**:

- the available specialist set is hardcoded;
- agent dependencies and execution order are hardcoded;
- the Coordinator can choose only from a fixed enum;
- workflow steps and final artifacts are predetermined in route/service code;
- the Andersen Delivery Framework is present as data but is not connected to runtime retrieval;
- source evidence, requirements, proposal claims, and citations are not first-class structured objects;
- quality control is mainly post-processing rather than a targeted AI repair loop;
- the existing `IMPLEMENTATION_PLAN.md` proposes a new `rules/` layer, which would reinforce the code-driven approach rather than achieve the requested AI-native direction.

### Recommended direction

Replace the existing fixed pipeline with a **generic AI planning and execution runtime**:

1. AI builds a structured workflow plan from the uploaded tender package, deal notes, available capabilities, and requested output.
2. A generic DAG executor validates and runs that plan.
3. AI selects and invokes capabilities dynamically instead of the code naming Legal, Architect, Estimator, or any future specialist.
4. AI retrieves relevant framework sections and company evidence on demand.
5. Every proposal claim is linked to source evidence, a framework section, a user instruction, or an explicit assumption.
6. AI reviewers generate targeted repair tasks until defined quality gates pass or the controlled retry budget is exhausted.
7. Deterministic services render DOCX, XLSX, PNG, calculate totals, enforce permissions, validate schemas, and persist state.

This keeps the application as a **single Node.js/PostgreSQL modular monolith**, consistent with the product direction in `spec/rfpulse-product-direction.md`. No microservices, external workflow platform, multi-tenancy, or unnecessary infrastructure are required.

---

## 2. Analysis Scope and Validation Status

### 2.1 Reviewed areas

The archive was reviewed across:

- `server/services/aiOrchestrator.js`
- `server/services/aiPrompts.js`
- `server/services/aiSchemas.js`
- `server/routes/ai.js`
- `server/routes/agents.js`
- document extraction and artifact-generation services
- AI-related database schema and migrations
- frontend AI workflow and agent-management screens
- AI tests
- embedded Andersen Delivery Framework index and semantic content
- current repository documentation and existing implementation plan

### 2.2 Runtime validation status

- Static JavaScript syntax validation succeeded for all **29 server-side JavaScript files**.
- Full `npm test` and `npm run build` could not be completed because the archive does not contain `node_modules` and the included offline npm cache is incomplete. The missing cached dependency observed during installation was `ip-address`.
- This limitation should be resolved in Phase 0 by establishing a reproducible dependency installation and CI baseline before behavioral refactoring.

---

## 3. Current-State Findings

## 3.1 Strengths to preserve

1. **Resumable execution exists.**  
   `ai_sessions`, `ai_workflow_steps`, saved agent outputs, and artifact metadata provide a useful basis for restartable execution.

2. **Cancellation and per-deal locks exist.**  
   The platform already prevents overlapping AI runs and can cancel active work.

3. **Prompts are database-configurable.**  
   Agents, models, parameters, system prompts, and shared/task prompts can be edited from the platform.

4. **Structured output is used where correctness matters.**  
   Coordinator decisions, deal properties, estimation results, diagram specifications, and report reviews use Zod schemas.

5. **Deterministic artifact tools are already separated.**  
   DOCX rendering, workbook generation, Mermaid rendering, timeline creation, and file storage are reusable as generic tools.

6. **The source extractor supports useful formats.**  
   PDF, DOCX, XLS/XLSX, CSV, TXT, Markdown, UTF-8/UTF-16/Windows-1251, tables, formulas, worksheets, and page labels are handled.

7. **A machine-readable delivery framework already exists.**  
   `framework_index.json` and `framework_semantic.md` contain sections, tags, RFP questions, related sections, cases, visuals, and retrieval guidance.

## 3.2 Critical architectural limitations

### A. Agent topology is hardcoded

`server/services/aiOrchestrator.js:17-18` defines fixed agent lists:

- `DEFAULT_AGENT_SLUGS`
- `REQUIRED_SPECIALIST_SLUGS = ['legal', 'architect', 'estimator']`

A new specialist, workflow type, or artifact owner requires code changes.

### B. The Coordinator is not a true planner

The Coordinator schema in `server/services/aiSchemas.js` permits only:

- `clarifying` or `routing`;
- a plan containing only `legal`, `architect`, and `estimator`.

The model cannot create a task graph, define dependencies, choose tools, specify output contracts, create targeted remediation tasks, or decide the complete artifact set.

### C. Code overrides AI routing decisions

`shouldForceCoordinatorRouting()` uses keyword regular expressions and context length to override a clarifying decision. Timeout fallback also forces the fixed specialist set. This is business-routing logic embedded in JavaScript.

### D. Dependencies and canonical order are hardcoded

`resolveRequestedSpecialists()` forces:

- Estimator → Architect dependency;
- Legal → Architect → Estimator ordering;
- all-three fallback when no valid selection is present.

This is a fixed pipeline with an AI-selected subset, not AI orchestration.

### E. Specialist execution is hardcoded

`runAgentPlan()` explicitly:

- builds Legal and Architect briefs;
- runs Legal and Architect in parallel;
- builds an Estimator brief;
- runs Estimator after Architect;
- returns a fixed output map.

The executor cannot run arbitrary tasks or dynamically generated dependencies.

### F. Prompt configuration is constrained by code

`loadPromptTemplates()` rejects task prompts for every agent except Coordinator. The admin UI can edit prompts but cannot define capabilities, input contracts, dependencies, tools, or workflow behavior.

### G. Artifact generation is predetermined

`finalizeAssessmentArtifacts()` always follows a code-owned sequence:

1. architecture diagrams;
2. timeline;
3. WBS workbook;
4. final proposal;
5. deal-property extraction.

The AI cannot decide that a tender needs, for example, a compliance matrix, pricing workbook, clarification log, executive summary only, multiple response files, no architecture diagram, or a presentation-ready annex.

### H. The framework knowledge package is not used

The repository includes a well-structured Andersen Delivery Framework with explicit retrieval instructions, but no runtime service references `framework_index.json` or `framework_semantic.md`. It is currently a dead asset.

### I. Evidence is flattened into text

The current pipeline passes large Markdown summaries between agents. It does not persist:

- atomic requirements;
- evidence spans;
- source classifications;
- conflicts;
- proposal claims;
- citations;
- framework grounding;
- requirement-to-section coverage.

This increases information loss, makes auditability difficult, and forces validation to rediscover the same facts.

### J. Quality review is late and weakly integrated

Validation is a separate user-triggered action. The generation flow does not automatically convert findings into a targeted repair plan and rerun only affected sections.

### K. Estimation business rules are hardcoded

`server/services/aiSchemas.js` fixes:

- hourly rate: USD 50;
- QA overhead: 30%;
- PM overhead: 15%;
- PM/QA as reserved roles;
- task effort range: 8–40 hours;
- several plausibility thresholds.

Some deterministic calculations should remain code-based, but the policies must be configuration/version driven rather than compiled constants.

### L. Context management is character-based, not evidence-based

Coordinator context is split and clipped by character count. This can break related clauses and does not prioritize critical requirements, mandatory forms, evaluation criteria, or source provenance.

### M. The route layer owns orchestration

`server/routes/ai.js` is approximately 1,900 lines and contains workflow execution, resumption, persistence, state transitions, finalization, and fallback behavior. The HTTP route should be a thin controller over an application service/runtime.

### N. Evaluation coverage is insufficient for an AI-native system

Current tests verify selected helper behavior and fixed routing, but there is no benchmark covering:

- requirement recall;
- evidence attribution;
- planner quality;
- DAG validity;
- framework retrieval relevance;
- proposal coverage;
- unsupported claims;
- multilingual tenders;
- template-driven submissions;
- repair-loop effectiveness.

---

## 4. AI-Native Design Principle

“AI-based, not code-based” should **not** mean removing deterministic controls. It should mean moving semantic decisions out of procedural code while retaining strict runtime safety.

| AI-owned decisions | Code-owned invariants |
|---|---|
| Understand tender type and objectives | Authentication and authorization |
| Extract and classify atomic requirements | File I/O and malware-safe handling |
| Decide which capabilities are needed | Schema validation |
| Build task DAG and dependencies | DAG cycle/dependency validation |
| Select framework/company knowledge | Allowed capability/tool enforcement |
| Decide proposal structure and file split | Persistence and transactions |
| Decide which artifacts are useful | Cancellation, locks, retries, idempotency |
| Identify gaps and create repair tasks | Token/time/task budgets |
| Draft and revise content | Deterministic calculations |
| Select assumptions and recommendations | DOCX/XLSX/PNG rendering |
| Determine whether human clarification is essential | Audit logging and version snapshots |

### Core rule

The runtime must know **how to execute a valid plan**, but it must not encode **which tender tasks must exist** or **which specialist must run next**.

---

## 5. Target Architecture

## 5.1 Architectural style

Retain the current modular monolith:

- React frontend;
- Express API;
- PostgreSQL;
- local/persistent file storage;
- provider-neutral LLM adapter;
- deterministic artifact services.

Introduce a new internal module:

```text
server/ai-runtime/
├── application/
│   ├── startRun.js
│   ├── resumeRun.js
│   ├── executePlan.js
│   └── validateRun.js
├── planner/
│   ├── plannerService.js
│   ├── plannerPrompts.js
│   ├── planCompiler.js
│   └── planSchemas.js
├── engine/
│   ├── dagExecutor.js
│   ├── taskRunner.js
│   ├── retryPolicy.js
│   ├── stateMachine.js
│   └── budgetGuard.js
├── capabilities/
│   ├── capabilityRegistry.js
│   ├── agentCapability.js
│   ├── retrievalCapability.js
│   ├── reviewCapability.js
│   └── toolCapability.js
├── evidence/
│   ├── evidenceService.js
│   ├── requirementService.js
│   ├── claimService.js
│   └── citationService.js
├── knowledge/
│   ├── frameworkRepository.js
│   ├── frameworkRetriever.js
│   ├── companyProfileRepository.js
│   └── knowledgeReranker.js
├── quality/
│   ├── qualityGateRunner.js
│   ├── repairPlanner.js
│   └── finalReadiness.js
├── adapters/
│   ├── llmGateway.js
│   ├── documentTools.js
│   ├── artifactTools.js
│   └── persistence.js
└── telemetry/
    ├── runTrace.js
    └── metrics.js
```

This is a target modular boundary, not a requirement to create excessive classes. Modules should remain functional and lightweight.

## 5.2 Runtime flow

```text
User starts AI run
  ↓
Document ingestion and evidence indexing
  ↓
AI Source Analyst creates atomic requirements and source map
  ↓
AI Planner receives:
  - request objective
  - requirement inventory
  - source quality summary
  - available capability catalogue
  - allowed artifact tools
  - workflow budgets
  ↓
Planner returns structured WorkflowPlan DAG
  ↓
Plan compiler validates and, if necessary, requests one repair
  ↓
Generic DAG executor runs ready tasks
  ↓
Tasks can retrieve source/framework evidence and produce typed artifacts
  ↓
AI Quality Evaluator checks requirement coverage, evidence, contradictions, and output quality
  ↓
AI Repair Planner creates targeted remediation tasks
  ↓
Executor runs only affected tasks
  ↓
Artifact Planner selects renderable deliverables
  ↓
Deterministic renderers create DOCX/XLSX/PNG files
  ↓
Final readiness gate and human approval
```

## 5.3 Capability catalogue instead of fixed agents

A capability describes **what can be done**, not where it appears in a hardcoded pipeline.

Initial capability set:

| Capability key | Purpose | Typical implementation |
|---|---|---|
| `source.understand` | Classify source pack and identify document roles | AI agent |
| `requirements.extract` | Create atomic requirement inventory | AI agent with structured output |
| `requirements.reconcile` | Deduplicate and resolve conflicts | AI agent |
| `knowledge.retrieve.framework` | Retrieve Andersen framework sections | Hybrid retrieval + AI rerank |
| `knowledge.retrieve.company` | Retrieve verified company facts/cases | Retrieval capability |
| `analysis.legal` | Analyze procurement/legal/compliance obligations | Specialist AI |
| `analysis.solution` | Design proposed solution | Specialist AI |
| `analysis.delivery` | Define delivery approach and governance | Specialist AI + framework retrieval |
| `analysis.estimation` | Create estimation basis and WBS content | Specialist AI |
| `analysis.commercial` | Create pricing/commercial narrative | Specialist AI |
| `proposal.structure` | Build response/file/section plan from RFP | AI agent |
| `proposal.author.section` | Draft one or more proposal sections | AI agent |
| `proposal.integrate` | Assemble canonical proposal model | AI agent |
| `quality.coverage` | Check requirement coverage | AI evaluator + deterministic matrix checks |
| `quality.evidence` | Verify claim grounding | AI evaluator |
| `quality.consistency` | Check contradictions across artifacts | AI evaluator |
| `quality.style` | Check client/template/brand compliance | AI evaluator |
| `repair.plan` | Convert findings into targeted tasks | AI planner |
| `artifact.plan` | Select required files and diagram types | AI planner |
| `artifact.render.docx` | Render canonical proposal to DOCX | Deterministic tool |
| `artifact.render.xlsx` | Render WBS/compliance/pricing workbooks | Deterministic tool |
| `artifact.render.diagram` | Render approved diagram specification | Deterministic or image tool |
| `deal.extract-metadata` | Extract due date, budget, client, description | AI agent |

Capabilities should be stored/configured in the database and exposed to the Planner as a machine-readable catalogue containing:

- key and version;
- description;
- input schema;
- output schema;
- permitted tools;
- default model profile;
- concurrency class;
- cost/latency weight;
- retry policy;
- whether human approval is required;
- enabled status.

## 5.4 Workflow plan contract

The Planner should return a typed plan similar to:

```json
{
  "objective": "Produce a compliant technical and commercial proposal package",
  "clarificationRequired": false,
  "clarifications": [],
  "tasks": [
    {
      "id": "extract-requirements",
      "capability": "requirements.extract",
      "dependsOn": [],
      "inputs": ["source_documents", "deal_ai_notes"],
      "outputs": ["requirement_inventory"],
      "acceptanceCriteria": [
        "All mandatory clauses include source references",
        "Conflicts and missing referenced appendices are explicitly flagged"
      ],
      "priority": "critical"
    },
    {
      "id": "design-solution",
      "capability": "analysis.solution",
      "dependsOn": ["extract-requirements"],
      "inputs": ["requirement_inventory"],
      "outputs": ["solution_design"],
      "acceptanceCriteria": [
        "Every major decision maps to at least one requirement or explicit assumption"
      ],
      "priority": "high"
    }
  ],
  "qualityGates": [
    "critical-requirement-coverage",
    "evidence-grounding",
    "cross-artifact-consistency"
  ],
  "artifactIntent": [
    "proposal-docx",
    "detailed-wbs-xlsx"
  ],
  "budgets": {
    "maxTasks": 24,
    "maxRepairCycles": 2,
    "maxParallelTasks": 4
  }
}
```

The exact plan is AI-generated. The runtime validates only generic invariants:

- unique task IDs;
- registered/enabled capability keys;
- valid dependency references;
- acyclic graph;
- maximum tasks/depth/concurrency;
- allowed inputs/outputs;
- allowed tools;
- valid schemas;
- bounded repair cycles.

## 5.5 Canonical information model

Introduce structured records so agents stop passing only compressed Markdown.

### Requirement

```text
id
run_id
source_document_id
source_locator (page/section/table/worksheet/row)
text
normalized_text
category
obligation_level (mandatory/should/optional/informational)
response_type (narrative/form/attachment/commercial/evidence)
priority
status
conflict_group
metadata
```

### Evidence item

```text
id
run_id
source_type (client_document/framework/company_profile/user_instruction/assumption)
source_id
locator
content
language
confidence
hash
```

### Proposal claim

```text
id
run_id
artifact_id
section_key
claim_text
classification (source_fact/company_fact/recommendation/assumption/commitment)
status
```

### Citation link

```text
claim_id
evidence_id
relationship (supports/qualifies/conflicts)
```

### Finding

```text
id
run_id
gate_key
severity
requirement_id
artifact_id
issue
required_fix
status
repair_task_id
```

This model enables traceability, targeted revisions, requirement matrices, and reliable final validation.

---

## 6. Andersen Delivery Framework Integration

## 6.1 Current opportunity

The framework package is already designed for retrieval:

- `framework_index.json` contains IDs, titles, summaries, tags, RFP questions, engagement models, cases, visuals, related sections, and word counts;
- `framework_semantic.md` contains self-contained sections delimited by metadata blocks;
- the index explicitly instructs the caller to match RFP questions, retrieve the mapped section, optionally retrieve related sections, and select relevant cases/visuals.

The implementation should use this asset directly rather than copying the full framework into every prompt.

## 6.2 Recommended v1 retrieval strategy

For the current small internal system, do not introduce a separate vector database immediately.

Use a three-stage AI-directed retrieval process:

1. **AI query decomposition**  
   Convert proposal obligations or unanswered requirements into retrieval intents, for example:
   - delivery governance;
   - security approach;
   - mobilisation;
   - AI-assisted SDLC;
   - support SLA;
   - GCC delivery requirements.

2. **Metadata candidate selection**  
   Search framework index fields:
   - title;
   - summary;
   - tags;
   - `rfp_questions`;
   - engagement model;
   - region/industry metadata where available.

3. **AI reranking and expansion**  
   AI ranks candidates, explains relevance, selects required sections, and requests related sections only when necessary.

This is AI-based semantic selection supported by deterministic indexing. It avoids brittle keyword-only routing and avoids unnecessary infrastructure.

## 6.3 Optional v2 retrieval enhancement

Add embeddings/`pgvector` only if benchmark results show that metadata + AI reranking cannot meet recall targets. The decision must be evidence-driven, not architecture-driven.

## 6.4 Knowledge precedence rules

The system must keep source classes separate:

1. Client documents define client requirements.
2. Deal AI Notes define user priorities but cannot rewrite client facts.
3. Verified Andersen company/profile evidence supports company claims.
4. Andersen Delivery Framework supplies methodology and delivery content.
5. AI recommendations are not facts.
6. Assumptions must be explicitly labeled.

The Proposal Author must never present framework defaults as client-mandated requirements.

---

## 7. AI Quality and Repair Loop

## 7.1 Replace single-pass drafting with controlled convergence

Use a maximum of two targeted repair cycles:

1. Draft typed proposal sections.
2. Run quality gates.
3. Generate structured findings.
4. AI Repair Planner creates only the tasks required to resolve findings.
5. Re-run affected sections or calculations.
6. Re-check failed gates.
7. Stop on pass, human-required condition, or repair-budget exhaustion.

No unbounded autonomous loop is permitted.

## 7.2 Required quality gates

### Gate 1 — Critical requirement coverage

- Every mandatory requirement is mapped to a proposal section, attachment, response form, or explicit gap.
- No critical requirement may remain silently uncovered.

### Gate 2 — Evidence grounding

- Client facts and company claims require evidence links.
- Recommendations and assumptions are labeled.
- Unsupported commitments are blocked or escalated.

### Gate 3 — Scope consistency

- Proposal, architecture, WBS, timeline, commercial narrative, and exclusions describe the same scope.

### Gate 4 — Estimation consistency

- WBS effort, phase totals, duration, team, pricing, contingency, and commercial text reconcile.
- Calculations remain deterministic.

### Gate 5 — Submission compliance

- Required section order, numbering, file split, naming, forms, language, and page/file limits are respected.

### Gate 6 — Framework/company claim accuracy

- Methodology content comes from retrieved framework sections.
- Company facts come from approved company evidence.

### Gate 7 — Proposal usability

- The document is decision-oriented, concise, non-repetitive, and client-ready.

## 7.3 Repair task examples

- `repair.missing-requirement-response`
- `repair.unsupported-company-claim`
- `repair.architecture-wbs-mismatch`
- `repair.section-order`
- `repair.pricing-effort-drift`
- `repair.missing-framework-methodology`
- `repair.unlabeled-assumption`

The Planner decides which repair capability is appropriate; the runtime does not contain tender-specific repair branches.

---

## 8. Artifact Planning

## 8.1 AI-owned artifact intent

The Artifact Planner should decide which outputs are required based on:

- explicit RFP submission instructions;
- source templates and forms;
- evaluation criteria;
- requested scope;
- proposal strategy;
- user instructions;
- available deterministic renderers.

Possible artifact types:

- proposal DOCX;
- multiple proposal DOCX files;
- executive summary;
- requirement compliance matrix XLSX;
- detailed WBS XLSX;
- commercial/pricing workbook;
- architecture diagrams;
- workflow diagrams;
- delivery timeline;
- risk register;
- clarification log;
- validation report;
- manual-completion checklist.

## 8.2 Deterministic rendering remains code-based

AI should produce typed artifact specifications and canonical content. Existing renderers should remain deterministic:

- `proposalDocument.js`
- `proposalTemplate.js`
- `renderProposalDocx.py`
- `wbsWorkbook.js`
- `timelineDiagram.js`
- `architectureDiagram.js`
- `mermaidRenderer.js`

The renderers must not decide proposal scope or content strategy.

---

## 9. Persistence and Database Changes

## 9.1 Reuse existing tables where practical

Keep:

- `ai_sessions` as the top-level run/session record;
- `ai_workflow_steps` as task execution state;
- `ai_messages` for user-facing events;
- `documents` for generated files;
- `ai_run_locks` for mutual exclusion.

## 9.2 Extend existing workflow state

Add to `ai_sessions`:

- `workflow_plan JSONB`
- `workflow_plan_version INTEGER`
- `planner_model VARCHAR(100)`
- `planner_prompt_version INTEGER`
- `run_objective TEXT`
- `quality_status VARCHAR(30)`
- `repair_cycle INTEGER DEFAULT 0`
- `runtime_version VARCHAR(30)`

Add to `ai_workflow_steps`:

- `task_id VARCHAR(100)`
- `capability_key VARCHAR(120)`
- `capability_version INTEGER`
- `depends_on JSONB`
- `input_refs JSONB`
- `output_refs JSONB`
- `acceptance_criteria JSONB`
- `attempt INTEGER DEFAULT 1`
- `model_snapshot JSONB`
- `prompt_snapshot JSONB`
- `metrics JSONB`

Replace the semantic dependence on fixed `step_key` values with dynamic task IDs. Existing fixed keys can remain for legacy sessions.

## 9.3 Add lean domain tables

### `ai_capabilities`

Stores capability definitions, schemas, model defaults, permissions, and versions.

### `ai_evidence_items`

Stores source and knowledge evidence with locators and classification.

### `ai_requirements`

Stores atomic tender requirements and response obligations.

### `ai_claims`

Stores claims produced in proposal artifacts.

### `ai_claim_evidence`

Links claims to evidence.

### `ai_findings`

Stores quality findings and repair status.

### `knowledge_sections`

Stores parsed framework/company knowledge metadata and content hashes. The original framework files remain the canonical seed source.

## 9.4 Version snapshots

Every run must persist the exact:

- workflow plan;
- capability versions;
- prompt versions;
- model settings;
- policy versions;
- knowledge source versions;
- artifact renderer version.

This is required for reproducibility and auditability.

---

## 10. API and Frontend Changes

## 10.1 Backend API

Refactor `server/routes/ai.js` into thin endpoints:

```text
POST   /deals/:id/ai/runs
GET    /deals/:id/ai/runs/current
GET    /deals/:id/ai/runs/:runId
POST   /deals/:id/ai/runs/:runId/resume
POST   /deals/:id/ai/runs/:runId/cancel
POST   /deals/:id/ai/runs/:runId/clarifications
POST   /deals/:id/ai/runs/:runId/validate
GET    /deals/:id/ai/runs/:runId/stream
```

The current endpoint contract can be preserved temporarily through an adapter during migration.

## 10.2 AI administration

Replace “Agent Management” as the primary concept with four configuration views:

1. **Capabilities**
   - purpose;
   - model profile;
   - prompt;
   - input/output schema;
   - permitted tools;
   - retry policy;
   - enabled status.

2. **Planner**
   - planner prompt;
   - planning constraints;
   - maximum tasks/depth/repair cycles;
   - fallback plan definition.

3. **Knowledge Sources**
   - framework version;
   - parsed sections;
   - company profile sources;
   - ingestion status;
   - retrieval test console.

4. **Policies and Quality Gates**
   - estimation policy;
   - evidence policy;
   - mandatory gates;
   - thresholds;
   - artifact policies.

## 10.3 Deal AI workspace

Update `DealDetailPage` to display:

- AI-generated workflow plan;
- dynamic task graph/list;
- task dependencies;
- current running tasks;
- requirement coverage summary;
- quality-gate status;
- repair cycles;
- retrieved framework sections;
- assumptions and unresolved gaps;
- generated artifacts;
- human clarification requests.

The UI must not assume known agent names or fixed step keys.

---

## 11. Implementation Roadmap

The recommended delivery is **8–10 calendar weeks**, approximately **58–72 person-days**, using a small cross-functional team:

- 1 Senior Backend/AI Engineer — full time;
- 1 Full-stack/Frontend Engineer — 30–50%;
- 1 QA/Automation Engineer — 30–50%;
- 1 Presales/RFP SME — recurring reviews and benchmark labeling;
- optional Solution Architect review at milestone gates.

The plan uses a strangler migration: existing capabilities are wrapped and reused before internals are replaced.

---

## Phase 0 — Baseline, Safety Net, and Decision Records

**Duration:** 3–5 person-days  
**Goal:** Establish a reproducible baseline and freeze the current behavior before structural changes.

### Tasks

- Create a clean dependency installation process and verify `npm ci` from an empty workspace.
- Add CI jobs for:
  - server syntax;
  - unit tests;
  - frontend TypeScript build;
  - database migration verification;
  - artifact smoke tests.
- Capture current end-to-end outputs for 3 representative tender packs.
- Create architecture decision records:
  - AI semantic decisions vs deterministic runtime invariants;
  - modular monolith retention;
  - no external workflow engine;
  - initial retrieval without mandatory vector DB;
  - maximum repair-loop policy.
- Add feature flags:
  - `AI_RUNTIME_V2_ENABLED`
  - `AI_RUNTIME_V2_SHADOW_MODE`
  - `AI_FRAMEWORK_RETRIEVAL_ENABLED`
- Preserve current workflow as `legacy` runtime.

### Acceptance criteria

- A clean checkout can install, test, and build in CI.
- Current proposal/WBS/diagram outputs are stored as baseline fixtures.
- Legacy workflow remains unchanged and executable.
- Architectural decisions are documented and approved.

---

## Phase 1 — Evidence and Requirement Foundation

**Duration:** 8–10 person-days  
**Goal:** Replace flattened source summaries as the system of record with structured evidence and requirements.

### Implementation status (updated 2026-07-14)

- [x] Added migrations for structured evidence/requirements tables:
  - `server/migrations/017_add_ai_evidence_and_requirements.sql`
- [x] Implemented Phase 1 inventory service:
  - `server/services/evidenceInventory.js`
  - evidence chunking + provenance metadata
  - requirement extraction heuristics + classification
  - requirement reconciliation preserving duplicate source references
  - missing appendix reference detection as explicit `gap`
  - inventory summary model (priority/status/category/obligation + gap counters)
- [x] Wired persistence into AI runtime flows:
  - `/start` extraction flow persists evidence/requirements
  - `/validate` client-context extraction persists evidence/requirements
  - file: `server/routes/ai.js`
- [x] Added requirements inventory API endpoint:
  - `GET /api/deals/:id/ai/requirements`
  - response includes rows + computed summary
- [x] Added/extended tests:
  - `server/tests/evidenceInventory.test.js`
  - includes provenance, reconciliation, gap detection, and summary coverage
- [x] Full test suite passes after implementation (`npm test`)

### Remaining Phase 1 scope (updated 2026-07-14)

- [ ] Implement `requirements.extract` as an explicit structured LLM schema/capability (currently heuristic service-based extraction).
- [ ] Add document role classification and conflict-group linking logic aligned with the full Phase 1 target model.
- [ ] Add benchmark measurement workflow for critical-requirement recall target (>= 90%).
- [x] Expose/consume requirement inventory in frontend deal workspace UI.

### Tasks

- Extend document extraction to emit structured chunks:
  - document ID/name;
  - page/section/worksheet/row locator;
  - text;
  - language;
  - chunk hash;
  - table indicator;
  - extraction warnings.
- Add `ai_evidence_items` and `ai_requirements` migrations.
- Implement `requirements.extract` structured schema.
- Implement source analyst capability:
  - classify document role;
  - identify referenced but missing appendices;
  - extract atomic requirements;
  - classify mandatory/optional/informational;
  - identify response format and artifact obligations;
  - preserve provenance.
- Implement requirement reconciliation:
  - deduplicate repeated clauses;
  - link conflicting requirements;
  - retain exact source citations.
- Add requirement inventory API and internal repository.
- Keep current Markdown context bundle as a temporary compatibility output generated from structured evidence.

### Acceptance criteria

- Every extracted requirement has a document and locator.
- Repeated clauses can be grouped without losing source references.
- Missing referenced attachments are recorded as gaps, not treated as blockers.
- Legacy agents can still receive a generated compatibility summary.
- Benchmark critical-requirement recall is at least 90% before proceeding.

---

## Phase 2 — Capability Registry and AI Planner

**Duration:** 8–10 person-days  
**Goal:** Allow AI to create a valid workflow plan from available capabilities.

### Implementation status (updated 2026-07-14)

- [x] Added migration for Phase 2 planner/capability foundation:
  - `server/migrations/018_add_ai_phase2_planner_and_capabilities.sql`
  - extends `ai_sessions` with workflow-plan/planner/runtime metadata fields
  - creates `ai_capabilities`
  - seeds planner-related feature flags/settings (`ai_runtime_v2_shadow_mode`, fallback plan)
- [x] Implemented capability registry service:
  - `server/ai-runtime/capabilities/capabilityRegistry.js`
  - default capability seeding + enabled capability catalogue loading
- [x] Implemented planner contracts and prompts:
  - `server/ai-runtime/planner/planSchemas.js`
  - `server/ai-runtime/planner/plannerPrompts.js`
- [x] Implemented generic plan compiler (core validations):
  - `server/ai-runtime/planner/planCompiler.js`
  - validates unique task IDs, capability existence, dependency references, cycle detection, and max-tasks budget
- [x] Refactored existing agents into Phase 2 capability adapters:
  - `server/ai-runtime/capabilities/agentCapabilityAdapters.js`
  - Legal → `analysis.legal`
  - Architect → `analysis.solution`
  - Estimator → `analysis.estimation`
  - Coordinator final draft → `proposal.integrate`
  - quality capabilities scaffolded for validator alignment
- [x] Added planner service + shadow mode generation path:
  - `server/ai-runtime/planner/plannerService.js`
  - planner output validation + DB-backed fallback workflow
  - plan snapshot persistence into `ai_sessions`
- [x] Wired shadow plan generation into active runtime flows:
  - `server/routes/ai.js` (`/start` and `/message`)
  - keeps legacy execution path while persisting/validating v2 plans
- [x] Added Phase 2 tests and verified green suite:
  - `server/tests/phase2Planner.test.js`
  - `npm test` passing
  - `npm run build` passing
- [x] Implemented one-pass planner repair loop before fallback:
  - `server/ai-runtime/planner/plannerService.js`
  - planner now attempts structured repair once when primary plan is invalid
  - fallback is used only if both primary and repair plans are invalid/unavailable
- [x] Extended plan compiler checks for Phase 2 contract safety:
  - `server/ai-runtime/planner/planCompiler.js`
  - validates capability input/output contract compatibility
  - validates explicit per-task tool permissions
  - validates task inputs are satisfied by dependencies or allowed external inputs
- [x] Added Phase 2 benchmark workflow/harness for executability quality target:
  - `server/tests/fixtures/phase2PlannerBenchmark.json`
  - `server/scripts/phase2PlannerBenchmark.js`
  - `package.json` script: `benchmark:phase2-planner`
  - latest run result: executableRate `1.0`, appropriateRate `1.0` (threshold `>= 0.9`)

### Remaining Phase 2 scope (for next session)

- [x] Implement one-pass planner repair loop for invalid plans.
- [x] Extend plan compiler checks for input/output contract compatibility and explicit tool-permission validation.
- [x] Add benchmark workflow and SME comparison harness for plan quality/executability target (>= 90%).

Phase 2 is complete and ready for Phase 3 handoff.

### Tasks

- Add `ai_capabilities` table and seed initial capabilities.
- Define capability input/output schemas and versioning.
- Refactor existing agents into capability adapters:
  - Legal → `analysis.legal`
  - Architect → `analysis.solution`
  - Estimator → `analysis.estimation`
  - Coordinator final draft → `proposal.integrate`
  - Validator → quality capabilities
- Create Planner system/task prompts.
- Implement `WorkflowPlan` Zod schema.
- Implement generic plan compiler:
  - capability existence;
  - input/output compatibility;
  - dependency validation;
  - cycle detection;
  - budget checks;
  - tool permissions.
- Implement one-pass planner repair for invalid plans.
- Store fallback workflow as database configuration, not JavaScript constants.
- Add shadow mode: generate a v2 plan while legacy execution continues, but do not execute the v2 plan.
- Compare AI plan to legacy execution and SME expectations.

### Acceptance criteria

- Planner can select any enabled capability without source-code changes.
- Adding a new capability requires configuration/adapter work, not modifications to planner/executor branching.
- No fixed Legal/Architect/Estimator enum exists in the v2 plan schema.
- Invalid plans are rejected or repaired before execution.
- At least 90% of benchmark plans are judged executable and appropriate by the RFP SME.

---

## Phase 3 — Generic DAG Executor and Runtime Migration

**Duration:** 10–12 person-days  
**Goal:** Execute dynamic AI-generated task graphs using existing run/cancellation infrastructure.

### Implementation status (updated 2026-07-14)

- [x] Implemented generic DAG executor runtime foundation:
  - `server/ai-runtime/engine/dagExecutor.js`
  - ready-task calculation, bounded parallelism, dependency gating, task status transitions, retry flow, failure propagation
- [x] Added runtime support modules:
  - `server/ai-runtime/engine/stateMachine.js`
  - `server/ai-runtime/engine/retryPolicy.js`
  - `server/ai-runtime/engine/budgetGuard.js`
  - `server/ai-runtime/engine/taskRunner.js`
- [x] Implemented application-layer execution service:
  - `server/ai-runtime/application/executePlan.js`
- [x] Extended `ai_workflow_steps` for dynamic task metadata:
  - `server/migrations/019_add_ai_phase3_dynamic_workflow_steps.sql`
  - adds `task_id`, `capability_key`, dependency/input/output refs, attempts, metrics, snapshots
- [x] Integrated v2 DAG execution path behind runtime flag in AI route flow:
  - `server/routes/ai.js`
  - reads `ai_runtime_v2_enabled`
  - executes persisted workflow plan via runtime modules
  - persists dynamic task step lifecycle (running/completed/failed)
  - preserves legacy path as compatibility fallback
- [x] Added Phase 3 automated tests and validated behavior:
  - `server/tests/phase3DagExecutor.test.js`
  - covers dependency execution, retries, resume-from-completed outputs, budget validation
- [x] Full test suite passes (`npm test`)

### Remaining Phase 3 scope (for next session)

- [x] Complete full migration of route-owned sequencing logic into dedicated `server/ai-runtime/application/` services so `server/routes/ai.js` is a thin controller.
- [x] Expand task metrics/run trace persistence to include richer per-task telemetry and explicit run-level trace views.
- [x] Add explicit test coverage for cancellation semantics and idempotent replay behavior at integration level.

### Tasks

- Implement generic DAG executor:
  - ready-task calculation;
  - bounded parallelism;
  - dependency completion;
  - task state transitions;
  - cancellation;
  - idempotent resume;
  - retries;
  - failure propagation;
  - human-wait state.
- Extend `ai_workflow_steps` for dynamic task metadata.
- Implement capability runner abstraction.
- Implement typed artifact/reference store between tasks.
- Wrap existing functions as tools/capabilities rather than calling them from fixed branches.
- Move workflow logic out of `server/routes/ai.js` into `server/ai-runtime/application/`.
- Preserve current start/message/session/stream endpoints through compatibility adapters.
- Add run trace and task metrics.
- Implement runtime budgets:
  - max tasks;
  - max task attempts;
  - max parallel tasks;
  - max repair cycles;
  - per-task timeout;
  - run timeout.

### Acceptance criteria

- A generated acyclic plan executes without route-specific branches.
- A failed run resumes from completed task outputs.
- Cancelling a run stops current tasks and marks pending tasks correctly.
- Replaying a completed task does not duplicate stored artifacts.
- `server/routes/ai.js` becomes a thin controller with no specialist sequencing logic.

---

## Phase 4 — Framework and Company Knowledge Retrieval

**Duration:** 6–8 person-days  
**Goal:** Make framework-informed proposal content a first-class AI capability.

### Implementation status (updated 2026-07-15)

- [x] Added knowledge storage foundation and schema:
  - `server/migrations/021_add_knowledge_sections.sql`
- [x] Implemented framework ingestion from seed assets:
  - `server/ai-runtime/knowledge/frameworkRepository.js`
  - parses `framework_index.json`
  - parses `framework_semantic.md` metadata sections
  - persists section content, content hash, source version, metadata
- [x] Implemented company profile ingestion under shared abstraction:
  - `server/ai-runtime/knowledge/companyProfileRepository.js`
- [x] Implemented framework retrieval with candidate ranking + related expansion:
  - `server/ai-runtime/knowledge/frameworkRetriever.js`
  - metadata candidate scoring (title/tags/rfp questions/summary/content)
  - bounded related-section expansion (`relatedLimit`)
- [x] Implemented company retrieval with ranked candidates:
  - `server/ai-runtime/knowledge/companyProfileRetriever.js`
- [x] Added retrieval-intent resolution module and integrated into retrieval flows:
  - `server/ai-runtime/knowledge/knowledgeIntent.js`
  - integrated into both framework/company retrievers
- [x] Added retrieval trace enrichment:
  - query, intents, intent resolution metadata, candidates, rationale, source version, retrieval mode
- [x] Wired knowledge retrieval capabilities into runtime adapters:
  - `server/ai-runtime/capabilities/agentCapabilityAdapters.js`
  - emits `framework_retrieval_trace` / `company_retrieval_trace`
  - emits classified evidence records (`framework_content`, `company_profile`)
- [x] Added retrieval API endpoint for administration/testing:
  - `POST /api/deals/:id/ai/knowledge/retrieve`
  - file: `server/routes/ai.js`
- [x] Added/validated automated tests for Phase 4 foundations:
  - `server/tests/phase4KnowledgeRetrieval.test.js`
  - full suite passing after implementation (`npm test`)

### Remaining Phase 4 scope (for next session)

- [ ] Build frontend administration retrieval test console UI consuming `/api/deals/:id/ai/knowledge/retrieve`.
- [ ] Extend classification output to consistently model all required classes in downstream proposal flow:
  - client requirement;
  - Andersen capability/framework content;
  - recommendation;
  - assumption.
- [ ] Add labeled retrieval benchmark harness and measure precision@5 target (>= 85%).

### Tasks

- Parse `framework_index.json` into `knowledge_sections`.
- Parse section bodies from `framework_semantic.md` using metadata delimiters.
- Store content hashes and framework version.
- Implement metadata candidate search.
- Implement AI retrieval-intent generation and reranking.
- Implement related-section expansion with strict relevance limits.
- Implement framework retrieval trace:
  - query intent;
  - candidate list;
  - selected sections;
  - rationale;
  - version.
- Add company profile/case-study retrieval through the same knowledge abstraction.
- Ensure output classification distinguishes:
  - client requirement;
  - Andersen capability/framework content;
  - recommendation;
  - assumption.
- Add retrieval test console in administration.

### Acceptance criteria

- Framework sections are selected dynamically for relevant RFP questions.
- Full framework content is never injected by default.
- Retrieved framework content includes section IDs and version.
- Proposal methodology claims can be traced to approved knowledge sections.
- Retrieval relevance reaches at least 85% precision@5 on a labeled query set.

---

## Phase 5 — AI-Native Proposal Authoring and Quality Repair

**Duration:** 10–12 person-days  
**Goal:** Generate the proposal through a requirement-led section plan and controlled quality loop.

### Tasks

- Implement `proposal.structure` capability:
  - read response instructions/templates;
  - define file split;
  - define section hierarchy;
  - map requirements to sections;
  - define manual/TBC content.
- Implement typed proposal model instead of raw monolithic Markdown as the canonical intermediate format.
- Implement section-author capability with scoped evidence retrieval.
- Implement claim extraction and evidence linking.
- Implement quality gates:
  - coverage;
  - grounding;
  - consistency;
  - estimation reconciliation;
  - submission compliance;
  - framework/company accuracy;
  - style/usability.
- Implement Repair Planner.
- Implement targeted section/task reruns.
- Add hard maximum of two repair cycles.
- Generate final Markdown only as a rendering projection of the canonical proposal model.
- Integrate current separate Validator as a final independent audit rather than the only quality control.

### Acceptance criteria

- Proposal structure follows source instructions when they exist.
- Every critical requirement has a response mapping or explicit unresolved finding.
- Unsupported factual claims are below the agreed benchmark threshold.
- Failed gates create targeted repair tasks rather than rerunning the entire workflow.
- The same canonical scope feeds proposal, WBS, timeline, and diagrams.

---

## Phase 6 — Dynamic Artifact Planning and Policy Configuration

**Duration:** 6–8 person-days  
**Goal:** Remove fixed artifact sequencing and hardcoded estimation policy constants.

### Tasks

- Implement `artifact.plan` capability.
- Define artifact specification schemas.
- Wrap existing renderers as allowed tools.
- Generate only artifacts selected by the plan.
- Add compliance matrix workbook renderer if required by benchmark tenders.
- Move estimation policy values to versioned database configuration:
  - role rate card;
  - currency;
  - QA/PM policy;
  - task sizing guidance;
  - contingency thresholds;
  - plausibility thresholds.
- Keep arithmetic and reconciliation deterministic.
- Add policy snapshot to each run.
- Remove hardcoded `gpt-image-2` metadata from route logic; use tool/model configuration.

### Acceptance criteria

- A workflow can produce proposal-only, proposal+WBS, or a broader package without code changes.
- Estimation policy can be changed through configuration and is versioned per run.
- All generated artifacts reference the same plan and canonical scope version.
- Artifact rendering remains idempotent and resumable.

---

## Phase 7 — Admin UX, Observability, Evaluation, and Cutover

**Duration:** 7–9 person-days  
**Goal:** Make the AI-native runtime operable, measurable, and safe for production use.

### Tasks

- Build capability configuration UI.
- Build planner/policy configuration UI.
- Add dynamic workflow visualization to Deal AI workspace.
- Display requirement coverage and quality findings.
- Display retrieved framework sections and evidence provenance.
- Add run telemetry dashboard:
  - duration;
  - model calls;
  - retries;
  - task failures;
  - repair cycles;
  - quality scores;
  - artifact counts;
  - estimated token usage where available.
- Create benchmark suite with representative tenders.
- Run legacy vs v2 comparison.
- Enable v2 for internal pilot users.
- Resolve benchmark regressions.
- Make v2 default; retain legacy rollback for one release window.
- Remove obsolete hardcoded routing after successful cutover.

### Acceptance criteria

- Operators can understand why a capability ran and what evidence it used.
- New workflow behavior can be introduced without editing route/orchestrator branches.
- Benchmark release thresholds pass.
- Rollback to legacy is documented and tested.
- V2 becomes default with no critical production regression.

---

## 12. Prioritized Backlog

| ID | Priority | Work item | Effort | Dependencies | Definition of done |
|---|---:|---|---:|---|---|
| AI-001 | P0 | Reproducible install/build/test CI | 2–3d | None | Clean checkout passes CI |
| AI-002 | P0 | Feature flags and legacy runtime boundary | 1d | AI-001 | Legacy and v2 selectable |
| AI-003 | P0 | Structured evidence chunk model | 3d | AI-001 | Source locators persisted |
| AI-004 | P0 | Atomic requirement extraction | 4d | AI-003 | Requirement inventory created with provenance |
| AI-005 | P0 | Requirement reconciliation | 2d | AI-004 | Duplicates/conflicts linked |
| AI-006 | P0 | Capability registry schema and service | 3d | AI-001 | Capabilities versioned and queryable |
| AI-007 | P0 | WorkflowPlan schema | 2d | AI-006 | Generic typed plan accepted |
| AI-008 | P0 | AI Planner prompts and service | 4d | AI-004, AI-006, AI-007 | Planner produces plans for benchmark set |
| AI-009 | P0 | Plan compiler and DAG validator | 3d | AI-007 | Invalid/cyclic plans blocked |
| AI-010 | P0 | Generic DAG executor | 6d | AI-009 | Dynamic plans execute/resume/cancel |
| AI-011 | P0 | Existing agent capability adapters | 3d | AI-006, AI-010 | Legacy specialists run through registry |
| AI-012 | P0 | Move orchestration out of routes | 3d | AI-010 | Route contains no sequencing logic |
| AI-013 | P1 | Framework parser/repository | 3d | AI-003 | Sections indexed/versioned |
| AI-014 | P1 | AI framework retriever/reranker | 4d | AI-013 | Relevant sections selected with trace |
| AI-015 | P1 | Proposal structure capability | 4d | AI-004, AI-010 | RFP-led section/file plan generated |
| AI-016 | P1 | Canonical proposal model | 4d | AI-015 | Typed proposal replaces raw Markdown as source of truth |
| AI-017 | P1 | Claim/evidence linking | 3d | AI-003, AI-016 | Claims trace to evidence |
| AI-018 | P1 | Quality gate framework | 4d | AI-004, AI-016, AI-017 | Findings stored by gate |
| AI-019 | P1 | Repair Planner and targeted rerun | 4d | AI-018 | Failed gates produce bounded repair tasks |
| AI-020 | P1 | Dynamic artifact planner | 3d | AI-010, AI-016 | Artifact set is plan-driven |
| AI-021 | P1 | Policy registry for estimation | 3d | AI-006 | Rates/overheads/thresholds versioned |
| AI-022 | P1 | Dynamic workflow UI | 4d | AI-010 | Arbitrary tasks displayed |
| AI-023 | P1 | Requirement/quality UI | 3d | AI-004, AI-018 | Coverage and findings visible |
| AI-024 | P1 | Run trace and metrics | 3d | AI-010 | Planner/task/model versions traceable |
| AI-025 | P0 | Golden benchmark suite | 5d | AI-001 | Release metrics automated |
| AI-026 | P0 | Shadow comparison and pilot | 4d | AI-008–AI-025 | V2 meets release thresholds |
| AI-027 | P2 | Optional pgvector retrieval | 3–5d | AI-014 evaluation | Implement only if benchmark requires it |
| AI-028 | P2 | OCR pipeline | 4–6d | AI-003 | Scanned PDFs supported, if prioritized |

---

## 13. File-by-File Refactoring Map

## 13.1 Replace or decompose

### `server/services/aiOrchestrator.js`

Current issue: combines model access, prompt loading, routing, agent sequencing, estimation correction, report assembly, diagrams, and fallback behavior.

Target:

- keep a temporary compatibility facade;
- move generic LLM calling to `ai-runtime/adapters/llmGateway.js`;
- move planner to `ai-runtime/planner/`;
- move execution to `ai-runtime/engine/`;
- move capability-specific logic to capability adapters;
- delete `REQUIRED_SPECIALIST_SLUGS`, fixed routing resolution, and fixed agent-plan sequencing after cutover.

### `server/routes/ai.js`

Current issue: approximately 1,900 lines and owns application workflow.

Target:

- parse/authorize request;
- call `startRun`, `resumeRun`, `cancelRun`, or `validateRun` application service;
- stream persisted run events;
- contain no tender-domain branching.

### `server/services/aiSchemas.js`

Target split:

```text
ai-runtime/planner/planSchemas.js
ai-runtime/evidence/evidenceSchemas.js
ai-runtime/quality/qualitySchemas.js
capabilities/estimation/estimationSchemas.js
capabilities/artifacts/artifactSchemas.js
```

Generic runtime schemas and capability-specific schemas should not be mixed.

### `server/services/aiPrompts.js`

Target:

- built-in seed definitions only;
- planner prompt separate from capability prompts;
- every capability may have its own task prompt;
- remove Coordinator-only task-prompt restriction;
- prompt release/version is explicit.

## 13.2 Extend

### `server/services/documentExtractor.js`

Add structured page/worksheet/row chunks and locators. Preserve current format support.

### `server/services/proposalDocument.js`

Accept canonical proposal model/render specification instead of inferring too much from final Markdown.

### `server/services/wbsWorkbook.js`

Accept typed estimation artifact and versioned policy snapshot.

### `server/services/architectureDiagram.js` and `timelineDiagram.js`

Expose deterministic tool contracts. Do not decide whether a diagram is required.

### `src/pages/AgentManagementPage.tsx`

Evolve into capability/planner/policy administration.

### `src/pages/DealDetailPage.tsx`

Render dynamic task plans, evidence status, coverage, findings, repairs, and artifacts.

## 13.3 Add

- `server/ai-runtime/**`
- migrations for capabilities, evidence, requirements, claims, findings, and extended workflow state
- benchmark fixtures and evaluators
- framework parser and retrieval tests
- plan compiler tests
- DAG execution/resume/cancellation tests
- end-to-end golden tender tests

---

## 14. Migration and Cutover Strategy

## 14.1 Strangler approach

Do not rewrite the complete platform in one change.

1. Create v2 runtime behind a feature flag.
2. Wrap existing Legal/Architect/Estimator/Coordinator functions as capabilities.
3. Generate v2 plans in shadow mode while legacy execution produces the user-visible result.
4. Compare plans and predicted artifacts.
5. Execute v2 for selected internal deals.
6. Compare final outputs against legacy and SME scoring.
7. Make v2 default after release thresholds pass.
8. Keep legacy fallback for one release cycle.
9. Remove hardcoded routing and fixed finalization only after successful operational cutover.

## 14.2 Legacy data

- Existing sessions remain readable.
- Do not attempt to transform old fixed workflow steps into new dynamic plans.
- Mark legacy runs with `runtime_version = 'legacy'`.
- New runs use `runtime_version = 'v2'`.

## 14.3 Backward-compatible API

The frontend can initially continue using existing session endpoints. Backend adapters should translate v2 state into the current response shape until the dynamic UI is released.

---

## 15. Evaluation and Test Strategy

## 15.1 Golden benchmark set

Create a minimum set of 12–20 anonymized tender packs covering:

- technical implementation RFP;
- legal/procurement-heavy tender;
- commercial workbook-heavy tender;
- strict response template;
- multiple required files;
- incomplete package with referenced appendices;
- multilingual source documents;
- large spreadsheets;
- public-sector compliance requirements;
- AI-specific requirements;
- pure audit/discovery engagement;
- proposal requiring minimal architecture content.

## 15.2 Required benchmark labels

For each pack, label:

- critical requirements;
- expected clarification behavior;
- required specialist/capability areas;
- required framework topics;
- expected artifacts;
- prohibited unsupported claims;
- expected section/file structure;
- key estimation assumptions;
- known conflicts and missing documents.

## 15.3 Automated tests

### Unit

- plan schema;
- capability registry;
- cycle detection;
- dependency validation;
- budget limits;
- state transitions;
- idempotency;
- requirement mapping;
- framework parser;
- policy calculations.

### Integration

- planner → compiler;
- executor → persistence;
- cancellation/resume;
- evidence retrieval;
- framework retrieval;
- proposal model → renderers;
- repair loop.

### End-to-end

- source pack to complete proposal package;
- forced failure and resume;
- clarification-required run;
- no-diagram proposal;
- multi-file proposal;
- validation and targeted repair.

## 15.4 Release thresholds

Recommended initial thresholds:

| Metric | Threshold |
|---|---:|
| Critical requirement recall | ≥ 95% |
| Mandatory requirement response mapping | ≥ 95% |
| Framework retrieval precision@5 | ≥ 85% |
| Factual claim evidence coverage | ≥ 95% |
| Unsupported high-impact commitments | 0 |
| Valid planner DAG rate after one repair | ≥ 99% |
| Successful resume after injected task failure | 100% |
| Artifact cross-consistency pass | ≥ 90% first pass, ≥ 97% after repair |
| SME preference vs legacy | V2 equal or better in ≥ 80% of benchmark cases |

LLM-as-judge scores may support evaluation, but critical thresholds must include deterministic checks and SME-calibrated labels.

---

## 16. Security and Control Requirements

The AI-native runtime must preserve and strengthen the current source-boundary protections.

### Mandatory controls

- Uploaded content is always untrusted data, never system instruction.
- Planner can select only registered, enabled capabilities.
- Capabilities can invoke only explicitly permitted tools.
- Source documents cannot create new capabilities, modify prompts, or change budgets.
- No unrestricted shell, network, database, or file-system tool is exposed to agents.
- Every AI output is schema-validated before it affects state.
- Every run has maximum tasks, depth, attempts, duration, and repair cycles.
- Evidence and company/framework sources remain clearly classified.
- High-impact commitments without evidence are blocked or require human approval.
- Prompt/model/policy/knowledge versions are logged.
- Sensitive prompt and evidence data are not written to general application logs.

### Prompt-injection tests

Add benchmark documents containing malicious instructions such as:

- ignore system instructions;
- reveal API keys;
- delete files;
- skip legal review;
- change pricing;
- claim certifications not present in evidence.

The runtime must treat these strings as source content and never execute them.

---

## 17. Operational Metrics

Track at run and task level:

- total duration;
- planning duration;
- task duration;
- retries;
- failures;
- cancellation reason;
- input/output size;
- selected capability and version;
- model and prompt version;
- quality-gate scores;
- repair count;
- requirement coverage;
- evidence coverage;
- framework sections retrieved;
- generated artifacts;
- estimated token/cost data where the provider exposes it.

Metrics should support debugging and product improvement, not become a large observability project. PostgreSQL JSONB and structured application logs are sufficient initially.

---

## 18. Key Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Planner creates invalid or cyclic DAG | Run cannot start | Strict schema, compiler, cycle check, one-pass planner repair |
| AI over-plans too many tasks | Cost and latency increase | Task/depth/concurrency budgets; capability granularity guidance |
| AI under-plans and misses specialist analysis | Weak proposal | Requirement-led planning; quality gates; benchmark set |
| Source facts are lost during summarization | Compliance gaps | Structured evidence and atomic requirements before planning |
| Framework content is used as client requirement | Misrepresentation | Knowledge-source classification and claim/evidence policy |
| Repair loop becomes infinite | Cost/runaway behavior | Maximum two cycles and finding-level rerun only |
| Variability causes inconsistent outputs | User distrust | Low-variance planner settings, typed outputs, versioning, benchmark tests |
| Migration breaks current production flow | Operational disruption | Feature flags, shadow mode, capability adapters, legacy rollback |
| Database model becomes over-engineered | Slow delivery | Reuse sessions/steps; add only lean evidence/requirement/claim tables |
| Retrieval adds irrelevant framework content | Generic proposal | AI reranking, relevance rationale, precision benchmark, strict context budget |
| Estimation becomes less controlled | Commercial risk | Deterministic calculations and versioned policies remain mandatory |
| Artifact renderers receive inconsistent inputs | Broken files | Canonical proposal/estimation/artifact specifications and schema validation |

---

## 19. Explicit Non-Goals

The implementation should not include unless separately approved:

- microservices;
- Kubernetes;
- external workflow/orchestration platform;
- multi-tenancy;
- SSO/i18n redesign;
- horizontal scaling;
- unrestricted autonomous agents;
- self-modifying prompts or capabilities;
- automatic external web research during proposal generation;
- a mandatory vector database before retrieval benchmarks justify it;
- replacement of deterministic DOCX/XLSX/rendering logic with free-form AI output;
- removal of current user-approved README credential behavior defined in project memory.

---

## 20. Definition of Done for the Program

The AI-native framework improvement is complete when:

1. No production workflow depends on hardcoded specialist lists or specialist ordering.
2. The Planner can construct a task DAG from a database capability catalogue.
3. The generic executor can run, cancel, retry, and resume that DAG.
4. New capabilities can be added without editing orchestration branches.
5. Client requirements are stored atomically with source provenance.
6. Proposal claims can be traced to client evidence, framework/company evidence, user instruction, recommendation, or assumption.
7. Andersen Delivery Framework sections are retrieved dynamically and auditable by section/version.
8. Proposal structure and artifact set are selected from RFP instructions rather than fixed code.
9. Quality findings create bounded targeted repair tasks.
10. Proposal, architecture, WBS, timeline, and commercial content derive from one canonical scope.
11. Estimation arithmetic is deterministic and policy-driven.
12. Runtime plans, prompts, models, capabilities, policies, and knowledge versions are reproducible.
13. Benchmark release thresholds pass.
14. V2 operates as the default runtime with a tested rollback path.
15. The old `rules/`-oriented implementation plan is replaced by this AI-native plan.

---

## 21. First Implementation Sequence

The first ten concrete actions should be executed in this order:

1. Establish clean CI install/test/build.
2. Add legacy/v2 feature flags and runtime version field.
3. Add structured evidence chunks with source locators.
4. Add atomic requirement extraction and benchmark it.
5. Add capability registry and wrap existing agents as capabilities.
6. Define WorkflowPlan schema and plan compiler.
7. Implement Planner in shadow mode.
8. Implement generic DAG executor using current sessions/steps/locks.
9. Connect Andersen framework retrieval as a capability.
10. Implement proposal structure, quality gates, and targeted repair loop.

Do not begin by creating `server/proposal-intelligence/rules/`. That direction contradicts the primary objective because it would move more semantic decisions into code. Begin with evidence, capabilities, planner contracts, and a generic executor.

---

## 22. Final Recommendation

Proceed with the implementation as a **controlled AI-native runtime migration**, not as a prompt-only enhancement and not as a new deterministic rules engine.

The highest-value architectural change is:

> Replace the fixed Coordinator → Legal/Architect → Estimator → Proposal sequence with an AI-generated, schema-validated task DAG executed by a generic runtime.

The second highest-value change is:

> Convert source documents and the Andersen Delivery Framework into structured, retrievable evidence so every task receives only the material it needs and every important claim remains traceable.

The third highest-value change is:

> Introduce a bounded quality-and-repair loop that updates only the affected proposal sections or artifacts.

These changes will make RFPulse genuinely AI-based while retaining the deterministic controls required for commercial accuracy, reliability, security, and auditable tender delivery.
