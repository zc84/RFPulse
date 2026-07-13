# Andersen Delivery Framework

**Document control.** Version 2.4 · July 2026 · Owner: Delivery Excellence Office · Review cycle: quarterly · Classification: client-shareable. Change history: v2.0 — full revision superseding v1.x; restructured for per-section excerpting; case evidence, working-model, subcontracting, IP and continuity sections added. v2.1 — readability pass (structured lists), figures embedded. v2.2 — sections 23–27 added (support & SLAs, team composition, accessibility, business continuity, corporate responsibility) based on recurring tender requirements and evaluation feedback. v2.3 — sections 28–31 added (AI-assisted delivery, UX & product design, incumbent takeover, multi-vendor environments). v2.4 — sections 32–33 added (regulated industries, Middle East/GCC); AI-over-sensitive-data controls added to section 28. Case examples are drawn from delivered Andersen engagements; client names are withheld under NDA. Named reference contacts and signed reference letters for comparable projects are available under NDA on request.

<!--META
id: sec-00-answer-map
title: "Where to Find Answers"
summary: "Mapping table from typical RFP/evaluator questions to framework sections. Use as router: match the client question, fetch the mapped section."
tags: [navigation, rfp-mapping, index]
rfp_questions: [Where is X answered in your methodology?]
engagement_models: [all]
cases: []
visuals: []
tables: [question-to-section map]
related_sections: []
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## Where to Find Answers

This document is structured so that bid teams and evaluators can locate specific answers quickly. Common RFP and evaluation questions map to sections as follows.

| Typical evaluator question | Section |
|---|---|
| How do you involve users and stakeholders? | 5, 9, 13 |
| How often do you communicate status, problems, progress? | 14 |
| Describe your quality assurance measures | 8, 9, Appendix C |
| How do you ensure cost certainty? | 16 |
| How do you ensure deadline certainty? | 16 |
| How flexible are you with changes? | 16 |
| How do you handle knowledge transfer? | 13 |
| What are your substitution and continuity arrangements? | 17 |
| How do you scale the team up or down? | 17 |
| Where is the work performed; time zones; languages? | 18 |
| Do you subcontract? | 19 |
| Who owns the intellectual property? | 20 |
| Where is our data stored and who can access it? | 10 |
| What happens when something goes wrong? | 15, 23 |
| What are your support tiers, SLAs and warranty? | 23 |
| Who exactly will work on our project (team, CVs)? | 24 |
| How do you ensure accessibility (WCAG)? | 25 |
| What are your business continuity / DR arrangements? | 26 |
| What are your social and environmental practices? | 27 |
| How do you use AI in delivery; is our IP safe? | 28 |
| How does AI handle our sensitive/personal data? | 28, 32 |
| How do you deliver for healthcare / banking / government? | 32 |
| How do you handle GCC data residency, Arabic, local rules? | 33 |
| Describe your UX/design methodology | 29 |
| How would you take over from our current supplier? | 30 |
| How do you work alongside our other vendors? | 31 |
| What evidence can you provide? | Case Index |

<!--META
id: sec-01-purpose
title: "1. Purpose"
summary: "What the framework is, how sections stand alone for excerpting, and how client standards override defaults via the Delivery Approach Note."
tags: [introduction, tailoring, delivery-approach-note]
rfp_questions: [How do you tailor your methodology to our organisation?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: []
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 1. Purpose

This document describes Andersen's operating standard for technology engagements: who does what, in which cadence, with which tools, against which thresholds, and what the client sees at every step. Each section is written to stand alone, so that individual sections can be excerpted into proposals or reviewed against a specific evaluation criterion.

**Cross-reference convention.** Every section is fully self-contained: its body text carries all needed substance inline and contains no pointers to other sections or appendices. Navigation across the document happens through the "Where to Find Answers" table and the numbered contents. In the machine-readable edition, each section's metadata lists its related sections, so automated assembly can retrieve a section together with its context.

Where a client's own standards differ — tooling, ceremonies, compliance regimes — we adopt the client's standard and record the deviation in the Delivery Approach Note, a short document produced during mobilisation that fixes the agreed working model for the engagement.

<!--META
id: sec-02-engagement-models
title: "2. Engagement Models"
summary: "Four delivery models (PDS, fixed price, dedicated team/T&M, audit) with real case examples and a comparison table: ownership, pricing, duration, best fit, governance depth."
tags: [engagement-models, pds, fixed-price, dedicated-team, t-and-m, audit, pricing]
rfp_questions: [What engagement/commercial models do you offer? | Who owns the delivery outcome?]
engagement_models: [all]
cases: [CASE-01, CASE-02, CASE-03, CASE-04]
visuals: []
tables: [model comparison]
related_sections: [sec-23-support-sla]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 2. Engagement Models

Andersen delivers through four models. The practices in this framework apply to all of them; the depth of each practice scales with how much delivery responsibility Andersen carries.

**Project Delivery Service (PDS) — outcome ownership.** Andersen owns scope, plan, quality and the delivery outcome, typically milestone-based with two-week sprints inside each milestone.

> **CASE-01 — AI knowledge assistant, UK building-services company.** For a UK building-services company operating a nationwide 24-hour callout service, Andersen delivered an AI knowledge assistant as a PDS engagement: a core team of eight covering delivery management, project management, AI/ML engineering, DevOps, frontend development, UI/UX design and QA. Delivery ran in milestone-based two-week sprints with weekly client calls and sprint review demos; tracking in Jira, source in GitLab, design in Figma. A follow-on multi-tenant expansion for a sister brand was scoped and priced as a separate 10-week package.

**Fixed scope / fixed price.** For well-bounded scope with a defined end state.

> **CASE-02 — Salesforce implementation, US agricultural logistics company.** A nine-week fixed-scope engagement with a 3-FTE team (project manager, Salesforce engineer, QA engineer) ran through an explicit phase sequence: discovery and analysis, data model and configuration, security setup, three system integrations (telephony, freight marketplace, ERP), data migration, testing and UAT, user training, go-live, and a hypercare period.

**Dedicated team / team augmentation (T&M).** Andersen engineers embed into the client's delivery organisation and ceremonies. In this model the client owns the process; Andersen's obligation is to strengthen it from inside.

> **CASE-03 — Delivery capability strengthening, UK specialist insurer.** Andersen analysts and developers embedded into three in-house Scrum teams, standardising intake, refinement, definition-of-ready and defect-handling conventions across the teams, and setting up shared Jira dashboards so that management reporting reflected the actual state of work.

**Audit and consulting.** Short, deliverable-focused engagements with fixed outputs.

Delivered systems typically continue into a contracted managed-support model, which can also be purchased standalone as a takeover of an existing system.

> **CASE-04 — Architecture and modernisation audit, European online broker.** A two-month audit staffed at 2.5 FTE (solution architect, senior DevOps engineer, part-time PM) delivered AS-IS architecture documentation, a target TO-BE architecture, a gap analysis, a risk matrix with mitigations, a phased modernisation roadmap, and a TCO model covering target AWS infrastructure costs, migration cost estimate and ongoing support costs.

Model comparison at a glance:

| | PDS | Fixed price | Dedicated team / T&M | Audit / consulting |
|---|---|---|---|---|
| Outcome ownership | Andersen | Andersen | Client (Andersen strengthens) | Andersen (deliverables) |
| Scope flexibility | Re-prioritise per milestone | Change control with published impact | Re-prioritise per sprint | Fixed deliverable set |
| Pricing | Milestone-based | Fixed, with agreed contingency | Monthly per FTE | Fixed or capped |
| Typical duration | 3–12 months | 2–6 months | 6 months – multi-year | 1–3 months |
| Best fit | Defined outcome, evolving detail | Well-bounded, stable scope | Long-lived product development | Decision preparation, due diligence |
| Governance depth | Full framework | Full framework + stricter scope boundary | Client process + Andersen baseline checks | Lightweight, deliverable gates |

<!--META
id: sec-03-principles
title: "3. Delivery Principles"
summary: "Four operating principles with mechanisms: outcome-first analysis (BPMN example), milestone plan + 2-week sprints, hard quality gates, client access to live tooling."
tags: [principles, business-outcome, transparency, planning]
rfp_questions: [Describe your delivery approach/philosophy]
engagement_models: [all]
cases: []
visuals: [VIS-01]
tables: []
related_sections: [sec-08-engineering, sec-09-qa, sec-15-escalation, sec-app-c-quality-gates]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 3. Delivery Principles

**Start from the business outcome.** Before estimating, we require an understanding of why the initiative exists. When a client asks us to "automate an approval workflow", the business analyst maps the current process end-to-end: who initiates, who approves at each level and under what monetary thresholds, what happens on rejection or timeout, which exceptions bypass the hierarchy, what the auditors need to see, and which upstream and downstream systems consume the result. This takes two to four working sessions with process owners and produces a BPMN process map plus a decision table, which the client reviews and signs off before design begins.

**Structured plan, iterative execution.** Releases and milestones are planned up front; execution runs in two-week sprints inside that structure. Every sprint review re-baselines the burn-up against the milestone plan. A forecast slip beyond one sprint triggers the engagement's escalation path while there is still room to recover.

**Quality is enforced at gates.** Work cannot pass defined checkpoints without meeting explicit criteria: stories do not enter a sprint without acceptance criteria, merge requests do not merge without passing review and pipeline checks, releases do not ship without a signed release checklist.

**Transparency by default.** The client has standing access to the Jira boards, dashboards, test results and risk register that the team itself works from. Status reports summarise this data; the underlying tooling remains open to the client throughout.

<!--META
id: sec-04-mobilisation
title: "4. Mobilisation: The First Ten Working Days"
summary: "Day-by-day (D1-D10) mobilisation plan with owners and outputs: kickoff, infrastructure, registers, Delivery Approach Note, first sprint planning."
tags: [mobilisation, kickoff, onboarding, project-start, ramp-up]
rfp_questions: [How do you start an engagement? | What happens in the first weeks?]
engagement_models: [pds, fixed-price, dedicated-team]
cases: []
visuals: [VIS-02]
tables: [day/activity/owner/output plan]
related_sections: [sec-05-discovery]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 4. Mobilisation: The First Ten Working Days

Mobilisation converts a signed contract into a running delivery against a standard checklist. The target is a fully operational team by day 10.

| Days | Activity | Owner | Output |
|---|---|---|---|
| 1–2 | Kickoff: goals, scope boundaries, success criteria, named decision-makers on both sides | PM | Kickoff minutes; stakeholder map |
| 2–5 | Delivery infrastructure: Jira project and workflow, Confluence space, Git repositories with branch protection, CI/CD skeleton, communication channels, access provisioning, NDA and security induction for every team member | DevOps + PM | Environment and access matrix |
| 3–7 | Initial BA and architecture working sessions; risk and dependency registers opened with first entries | BA + Architect | Registers with initial content |
| 5–10 | Roadmap baselined; reporting pack format agreed; Delivery Approach Note drafted and signed; first sprint planning held | PM | Delivery Approach Note; roadmap; RACI; communication plan |

On PDS and fixed-price engagements, the first one to three sprints are discovery sprints; implementation sprints begin once the estimated backlog is signed off. On dedicated-team engagements, mobilisation compresses to team onboarding into the client's existing process, typically five working days.

The risk register opens with real content on day one — known risks always exist at kickoff (key-person dependencies, environment access lead times, third-party interface readiness), and recording them immediately establishes the register as a working tool.

<!--META
id: sec-05-discovery
title: "5. Discovery and Requirements"
summary: "Workshop cadence (2-3/week, minutes in 48h), discovery artefacts, user research and usability testing, Jira-to-test traceability, range-based estimation with velocity calibration."
tags: [discovery, requirements, business-analysis, workshops, user-research, usability, traceability, estimation]
rfp_questions: [How do you involve users and stakeholders? | How do you gather requirements? | How do you estimate?]
engagement_models: [pds, fixed-price]
cases: []
visuals: []
tables: []
related_sections: [sec-09-qa, sec-29-ux-design]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 5. Discovery and Requirements

Discovery converts business objectives into an implementable, estimable backlog. On PDS and fixed-price engagements it runs as a distinct phase of two to six weeks (one to three discovery sprints); on dedicated-team engagements it runs continuously alongside delivery as backlog refinement.

The working pattern: two to three facilitated workshops per week with process owners, subject-matter experts and — for user-facing systems — representatives of the end-user population, each workshop followed within 48 hours by written minutes and updated artefacts, so the client corrects our understanding while context is fresh.

Discovery produces:

- AS-IS process maps and TO-BE process definitions;
- functional decomposition and user-story-level requirements, acceptance criteria in Given/When/Then form;
- a non-functional requirements register: performance targets, availability, capacity, security, accessibility, regulatory constraints;
- an integration inventory: every interface with its owner, protocol, data-contract status and test-environment availability;
- a data migration scope assessment where legacy data exists.

For user-facing systems, discovery includes user research proportionate to the engagement: task analysis with real users, clickable prototypes in Figma, and usability testing of key flows before they are committed to the backlog. Usability findings enter the backlog through the same refinement process as functional requirements.

**Traceability.** Every Jira story links back to a business objective and forward to its test cases (TestRail or Xray) and the merge requests that implemented it. At any point in delivery we can answer "which requirements are implemented, tested, and accepted" directly from live tooling. This is also the evidence pack that auditors and steering committees request.

**Estimation.** Discovery closes with an estimation checkpoint: the backlog is estimated in story points at team level and converted to a date range through planned velocity, with explicit confidence bands. Planned velocity for a newly assembled team is calibrated from measured velocities of comparable Andersen teams on the same stack, then revised against the team's own measured velocity after the first two sprints. Estimates are presented as ranges with the underlying assumptions listed in the estimate document. When an assumption later breaks, the conversation references a documented assumption and its agreed contingency, which keeps re-planning factual. The client signs off scope for the first release before implementation sprints begin.

<!--META
id: sec-06-architecture
title: "6. Solution Architecture and Design Governance"
summary: "Named architect, architecture pack contents, ADR discipline (10-20 per 6-month engagement), phased modernisation roadmaps, 3-checkpoint Architecture Review Board with shareable records."
tags: [architecture, adr, design-governance, modernisation, review-board, c4]
rfp_questions: [How do you govern technical decisions? | How do you approach modernisation?]
engagement_models: [pds, fixed-price, audit]
cases: []
visuals: []
tables: []
related_sections: [sec-05-discovery, sec-32-regulated]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 6. Solution Architecture and Design Governance

Every engagement above trivial size has a named solution architect accountable for the technical design; on smaller engagements this is a part-time allocation.

The architecture pack contains:

- a solution context diagram (C4 levels 1–2);
- an integration design for every external interface;
- a data flow diagram in which personal and regulated data is explicitly marked;
- a deployment topology;
- a non-functional design note showing how each requirement from the NFR register is met.

Significant decisions are recorded as Architecture Decision Records: context, options considered, decision, rationale, consequences. ADRs are stored in the repository alongside the code and reviewed with the client's technical stakeholders. Any decision that would cost more than a sprint to reverse — database technology, integration pattern, hosting model, framework choice — gets an ADR; a typical six-month engagement accumulates between ten and twenty. The ADR log doubles as audit evidence: it shows when each decision was made, by whom, against which alternatives.

For modernisation engagements, architecture work starts from an AS-IS/TO-BE gap analysis and produces a phased roadmap in which each phase leaves the system releasable and operable. Big-bang cutovers are designed only where the client's constraints force one, and in that case the associated risk is recorded in the risk register and reviewed at steering level.

**Architecture Review Board.** Engagement architects present designs to senior architects outside the project team at three defined checkpoints: end of discovery, before first production release, and at major change. The ARB session produces a written review record with findings the engagement architect must either implement or formally answer. Anonymised ARB review records can be shared with clients on request.

<!--META
id: sec-07-execution
title: "7. Delivery Execution"
summary: "Two-week sprint ceremony set with durations, definition of ready/done verbatim, shared client-visible Jira board, adaptation to client processes."
tags: [scrum, sprints, ceremonies, definition-of-ready, definition-of-done, kanban, safe]
rfp_questions: [Describe your development process | How do you run sprints?]
engagement_models: [pds, fixed-price, dedicated-team]
cases: []
visuals: []
tables: [ceremony schedule]
related_sections: [sec-08-engineering, sec-09-qa]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 7. Delivery Execution

The default rhythm is Scrum with two-week sprints. Ceremonies for a typical 6–9 person team:

| Ceremony | When | Duration | Notes |
|---|---|---|---|
| Sprint planning | First Monday | 2 h | Against a refined, estimated backlog |
| Daily stand-up | Fixed time daily | 15 min | Client representatives welcome |
| Backlog refinement | Weekly | 1 h | Stories reach definition of ready ahead of the sprint in which they are planned; from the second implementation sprint onward, the target is a two-sprint-deep ready backlog |
| Sprint review / demo | Last Friday | 1 h | Live demo on a test environment; client product owner required |
| Retrospective | Last Friday | 45 min | Actions tracked in Jira with owners and due dates |

**Definition of ready** — a story may enter a sprint only when:

- acceptance criteria are agreed;
- dependencies are identified;
- the story is testable and estimated;
- UX design is attached where applicable.

**Definition of done** — a story may be demonstrated only when:

- code is merged to the main branch;
- unit and integration tests pass;
- acceptance criteria are verified by QA on a test environment;
- documentation is updated;
- no defects of severity high or above remain open against the story.

The team works on the same Jira board the client sees. For clients on Kanban, SAFe or a house hybrid, the team adopts the client's rhythm during mobilisation; the practices we retain in any process are the definition-of-ready/done discipline, a demo cadence of at most two weeks, and written retrospective actions.

<!--META
id: sec-08-engineering
title: "8. Engineering Standards"
summary: "Protected branches, 1-2 reviewer rule with checklists, pipeline gate chain (lint to package), 80% coverage gate, waiver process, 20% tech-debt allocation with billing treatment."
tags: [code-review, ci-cd, pipeline, git, quality-thresholds, technical-debt, sonarqube, coverage]
rfp_questions: [Describe your quality assurance measures (engineering) | What are your coding standards?]
engagement_models: [pds, fixed-price, dedicated-team]
cases: [CASE-05, CASE-06]
visuals: [VIS-05]
tables: []
related_sections: [sec-09-qa, sec-12-release, sec-28-ai]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 8. Engineering Standards

These standards apply on every engagement where Andersen owns the codebase. On augmentation engagements we follow the client's standards and flag gaps against this baseline in writing during mobilisation.

**Source control.** Git with protected main branches. All work flows through merge requests; direct pushes to protected branches are technically blocked. Branch naming and commit conventions are agreed at mobilisation and enforced by hooks.

**Code review.** Every merge request requires at least one approving review from an engineer who did not write the code. Components flagged as critical — authentication, payments, data-migration code — require two reviews, one from a senior engineer. Review scope is defined in reviewer checklists stored in the repository: functional correctness, security (input validation, authorisation checks, secrets handling), error handling and logging, test adequacy, backward compatibility, operational supportability.

**Pipeline.** Every merge request runs a pipeline before it can merge. Reference stages: lint → unit tests → build → static analysis (SonarQube quality gate) → dependency and container scanning → package. Artifacts are published to immutable registries with provenance metadata. A failing gate blocks the merge; exceptions require a written waiver from the tech lead with an expiry date, and open waivers are listed in the weekly status report.

> **CASE-05 — Regulated delivery pipeline, US payments network.** On an engagement for a US payments network, the delivery chain ran: merge request with enforced review rules → pipeline on tenant-scoped runners (lint, unit tests, build, static analysis, package) → immutable artifact registries with provenance metadata → security and IaC-drift gates → GitOps promotion through dev → functional testing → performance testing → acceptance testing → pre-prod → production. This pipeline structure is what made regular releases sustainable in a compliance-heavy environment without a separate hardening phase before each release.

**Quality thresholds.** Engagement defaults, recorded in the Delivery Approach Note and adjusted only there: unit test coverage on new code at or above 80%; zero new critical or blocker findings in static analysis; no known critical vulnerabilities in dependencies at release time. These operate as merge and release gates.

> **CASE-06 — Engineering remediation, telecom platform takeover.** Taking over a telecom communications platform, Andersen inherited a codebase far below these thresholds. The remediation plan — raising unit coverage to the 80% target, completing CI/CD configuration, introducing a unified code style, and standing up monitoring, logging and alerting — was scheduled, tracked and reported sprint by sprint in the same way as feature work.

**Technical debt.** The default allocation reserves up to 20% of team capacity for technical debt and engineering improvements. On T&M this allocation is agreed with the client and visible in the sprint plan; on fixed price it is included in the estimate and carries no separate billing. The debt backlog lives in Jira, a tech lead acts as its custodian, and its burn-down is reported alongside feature progress.

<!--META
id: sec-09-qa
title: "9. Quality Engineering"
summary: "QA from discovery, test strategy contents, automation toolchain, managed UAT with entry/exit criteria and real users, defect SLAs with clock rules, weekly quality metrics."
tags: [testing, qa, test-strategy, automation, uat, defect-sla, test-pyramid, regression]
rfp_questions: [Describe your quality assurance measures | How do you organise UAT? | What are your defect SLAs?]
engagement_models: [all]
cases: [CASE-07]
visuals: [VIS-06]
tables: []
related_sections: [sec-16-change-certainty, sec-23-support-sla, sec-25-accessibility]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 9. Quality Engineering

QA engineers join at discovery: acceptance criteria are reviewed for testability before stories are estimated, and the test strategy is a mobilisation-phase deliverable agreed with the client.

The test strategy defines, per engagement:

- the test pyramid: unit tests at developer level, API and integration tests, targeted end-to-end UI tests, exploratory testing;
- environments and test-data management, including anonymised production-like data where regulation allows;
- the automation approach and toolchain;
- non-functional testing scope — load and performance against the specific figures in the NFR register, accessibility where applicable;
- the regression policy — the automated regression suite runs on every release candidate, with manual regression only where automation coverage does not yet exist.

Typical automation toolchain: Selenium or Playwright for web UI, Appium for mobile, Postman/Newman for API, JMeter for load, Cucumber where the client wants business-readable scenarios; results in TestRail, failures triaged daily.

> **CASE-07 — QA process rebuild, European pet-supplies retailer.** For a major European pet-supplies retailer with a multi-country store network, Andersen QA engineers rebuilt the testing process on the Selenium/Appium/Java/Cucumber/JMeter stack: a renewed test strategy, a formal software testing lifecycle, and then an optimised steady-state team of two manual QA engineers, one automation engineer and one developer. The client's release quality improved while the release cycle shortened; the optimised team composition reduced ongoing QA cost against the pre-engagement baseline.

**UAT organisation.** Andersen prepares and runs UAT as a managed activity:

- entry criteria: feature-complete scope, regression green, known-defect list published;
- test scenarios derived from acceptance criteria and written in business language;
- a tester group recruited jointly with the client from the real user population;
- a defect triage board meeting daily during the UAT window, with both client and Andersen present;
- exit criteria agreed before UAT starts: no open critical/high defects in scope, sign-off from the business owner.

UAT findings classified as enhancement requests are routed into change control; defects follow the defect process — which keeps the UAT exit decision clean.

**Defect management.** Severity definitions and response targets are agreed at mobilisation. Defaults during delivery (business-hours coverage): critical (production down, data loss) — response within 2 hours and fix or accepted workaround within 24 hours, both clocks running within the contracted coverage window (a critical raised outside the window starts its clock at the next window's opening); high — triage within 1 business day, fix scheduled into the current or next sprint; medium and low — prioritised in backlog refinement. Where the client contracts a 24/7 support tier, both critical clocks run on elapsed time. Defect metrics reported weekly: open defects by severity and age, escape rate (defects found in UAT or production versus earlier stages), and reopen rate. A rising escape rate is treated as a process problem and taken to the retrospective.

<!--META
id: sec-10-security
title: "10. Security, Compliance and Data Location"
summary: "ISO 27001/9001 certification, regime mapping (GDPR/HIPAA/PCI/SOC2/DORA), security in design/build/operation, hosting configurations and data-residency options with named-access control."
tags: [security, compliance, iso-27001, gdpr, data-location, data-residency, threat-modelling, access-control]
rfp_questions: [Where is our data stored and who can access it? | How do you handle security and compliance?]
engagement_models: [all]
cases: [CASE-08]
visuals: []
tables: []
related_sections: [sec-28-ai, sec-32-regulated, sec-33-gcc]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 10. Security, Compliance and Data Location

**Certification.** Andersen holds ISO/IEC 27001 (information security management) and ISO 9001 (quality management) certification; certificate numbers and scope statements are provided in proposal annexes and on request. Engagement-level security practice inherits from the corporate ISMS and is tailored in a security annex to the Delivery Approach Note.

**Requirements.** The applicable regime is established in discovery and decomposed into backlog items and test cases like any other requirement: GDPR is the default assumption for any engagement touching EU personal data; HIPAA, PCI DSS, SOC 2, DORA or national public-sector rules are mapped where relevant.

**Design.** Threat modelling is performed for externally exposed or data-sensitive components and documented in the architecture pack. Data flow diagrams identify where regulated data is stored, processed and transmitted, and under which encryption in transit and at rest.

**Build.**

- Secure coding standards enforced in code review;
- secrets held in a vault and injected at deploy time, never stored in source control;
- static-analysis security rules plus dependency and container scanning as pipeline gates;
- least-privilege access to all environments, with a maintained access matrix and a joiner/leaver process.

**Operation.**

- Vulnerability management with patching timelines agreed per severity;
- audit logging of security-relevant events;
- an incident-response path agreed at mobilisation: who is called, within what time, with what escalation.

> **CASE-08 — Compliance evidence on demand, German healthcare MVP.** On a healthcare MVP for a German client, the contractually agreed standard was that compliance-relevant behaviour — authentication, authorisation, personal-data handling — be verified by automated configuration and test processes, with test-coverage evidence demonstrable at any time. In regulated industries the ability to produce evidence on demand carries as much weight as the control itself, and the delivery was built to that standard.

**Data location and access.** Agreed per engagement in the Delivery Approach Note and available in the following configurations: client-hosted tooling (Andersen works entirely inside the client's Jira/Git/cloud tenancy — the default for public-sector and regulated clients); Andersen-hosted tooling with EU-region tenancy; or hybrid. Source code and client data reside in the agreed region; access is restricted to named, security-inducted team members from agreed delivery locations, enforced through the access matrix and reviewed monthly. Client-specific constraints — EU-only access, citizenship requirements, on-premises work — are confirmed and priced explicitly at proposal stage.

<!--META
id: sec-11-data-integration
title: "11. Data and Integration Delivery"
summary: "Migration as engineered workstream: profiling, signed mapping, 2+ dry runs with reconciliation reports, cutover runbook; integration data contracts, contract tests in CI, third-party dependency tracking."
tags: [data-migration, reconciliation, cutover, rollback, integration, data-contracts, third-party]
rfp_questions: [How do you migrate our data safely? | How do you manage integrations?]
engagement_models: [pds, fixed-price]
cases: [CASE-09]
visuals: []
tables: []
related_sections: [sec-21-risk, sec-30-takeover, sec-31-multivendor]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 11. Data and Integration Delivery

Data migration runs as an engineering workstream with its own plan and owner. The sequence:

- source profiling — volumes, quality, anomalies — with profiling reports shared with the client, since undiscovered data-quality problems are the most common cause of go-live slips;
- field-level mapping specification signed off by business owners;
- transformation build with automated tests on the mapping rules;
- at least two full dry runs against production-scale data before cutover, each producing a reconciliation report: record counts, checksums, business-rule spot checks, financial totals where applicable;
- a cutover runbook with timings, owners, go/no-go checkpoints and a rehearsed rollback;
- a post-migration reconciliation signed by the business.

> **CASE-09 — Migration risk management, US healthcare imaging provider.** On an EHR/RCM replacement for a US medical-imaging company, migration risk was managed through a standing release risk register reviewed with the client every Friday. The register explicitly modelled the risk that a fresh production data dump would differ from the tested dataset, and the mitigation strategy was agreed jointly with the client before go-live — including its consequences for the stabilisation-phase timeline, which were re-planned jointly with the client's management team.

Integration delivery: every interface gets a written data contract (schema, semantics, error behaviour, versioning policy), agreed authentication, idempotency and retry semantics, timeout and circuit-breaking behaviour, and monitoring on both traffic and error rates. Contract tests run in CI, so a breaking change is caught before it can reach the partner's production system. Where the counterpart system belongs to a third party, the dependency register tracks their deliverables with named contacts and needed-by dates, and slippage is escalated through governance. On integration-heavy programmes we treat third-party interface readiness as a top-three schedule risk from day one.

<!--META
id: sec-12-release
title: "12. Release and Deployment"
summary: "Environment promotion chain as code, blue/green-canary with SLO-triggered rollback, signed release checklist, observability shipped with each release."
tags: [release, deployment, blue-green, canary, rollback, observability, iac, monitoring]
rfp_questions: [How do you release to production? | What is your rollback strategy?]
engagement_models: [pds, fixed-price, dedicated-team]
cases: [CASE-10]
visuals: [VIS-05]
tables: []
related_sections: [sec-08-engineering, sec-23-support-sla]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 12. Release and Deployment

Environments follow a promotion chain agreed at mobilisation — typically dev → test → UAT/pre-prod → production, extended with dedicated functional, performance and acceptance stages on larger programmes. Environment configuration is code (Terraform or equivalent), so environments are reproducible and drift is detected in the pipeline.

Deployment mechanics scale with criticality. For user-facing services the default is blue/green or canary release with automated health checks and rollback triggers tied to SLO thresholds, so a bad release is rolled back on signal. Where GitOps is used, rollback is deterministic: revert the release tag and the reconciler restores the last known-good state; on other stacks, rollback is a rehearsed, scripted procedure. For systems where zero-downtime machinery is not warranted, deployment happens in a maintenance window. In every case rollback is defined, tested and time-boxed before the release is approved.

Every production release passes a release checklist signed by the PM and tech lead:

- regression suite green;
- performance within NFR targets;
- security scans clean, or waivers documented;
- rollback verified;
- monitoring dashboards and alerts in place for the new functionality;
- support and on-call briefed;
- client go/no-go recorded.

Release notes reach the client before deployment. After deployment the team runs production validation checks and monitors the service through its first traffic peaks.

Observability ships with the release: Prometheus/Grafana or the client's stack (Dynatrace, Datadog, CloudWatch) dashboards and alert rules are part of the release's definition of done.

> **CASE-10 — Operating at scale, Canadian travel-technology platform.** A platform processing over USD 1 billion in annual travel transactions is delivered and operated with a 32-person Andersen team spanning QA leadership, test automation, product ownership and development. Releases run through fully automated Azure DevOps pipelines onto Docker/AKS infrastructure managed with Terraform, observed in real time through Grafana, Prometheus and Dynatrace. At this team size, release discipline and observability live in the pipeline configuration itself — the process does not depend on any individual remembering the steps.

<!--META
id: sec-13-transition
title: "13. Transition, Training and Hypercare"
summary: "Transition package contents, KT by working together with per-person checklist, end-user training workstream (incl. train-the-trainer), 2-4 week hypercare with exit criterion, support tiers up to 24/7."
tags: [knowledge-transfer, transition, hypercare, training, end-user-training, runbooks, support-tiers]
rfp_questions: [How do you handle knowledge transfer? | How do you train our users? | What happens after go-live?]
engagement_models: [pds, fixed-price]
cases: []
visuals: []
tables: []
related_sections: [sec-17-continuity, sec-23-support-sla, sec-24-team]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 13. Transition, Training and Hypercare

Operational transition is planned from the start of the engagement; the operational documentation set is built incrementally through delivery and verified against reality at transition.

**Transition package:**

- runbooks for routine operations and known failure modes;
- architecture and integration documentation;
- monitoring and alerting handover with alert-response playbooks;
- access and credentials handover with rotation;
- a support process definition: severity levels, response targets, escalation chain, ticket flow.

**Knowledge transfer to the client's engineers** is done by working together: client engineers join code reviews, deployments and incident drills during the final phase, and a KT completion checklist is tracked per topic per person. Handing over documents alone does not count as completed KT.

**End-user training** is a distinct workstream on engagements that change how people work: role-based training materials (quick-reference guides, walkthrough videos, exercise environments with realistic data), delivered either directly to user groups or in a train-the-trainer format where the client prefers to own ongoing training. Training completion is tracked and reported before go-live, and training feedback is triaged with the same discipline as UAT findings.

**Hypercare.** Where the client takes over operation, the engagement includes a hypercare period — default two to four weeks after go-live — with the delivery team on call, daily triage, and an agreed exit criterion (for example, a defined number of consecutive days below an agreed incident threshold) in addition to a target end date. Where Andersen provides ongoing support, the engagement moves into a support model with contracted SLAs; available tiers range from business-hours coverage to 24/7 on-call, and the chosen tier — with its response times — is fixed in the support agreement.

<!--META
id: sec-14-communication
title: "14. Communication and Reporting"
summary: "Full cadence table (daily to quarterly), contractualisation via Delivery Approach Note/SoW, fixed status-report structure, defined RAG semantics, earned-value steering view."
tags: [communication, reporting, cadence, rag, status-report, steering-committee]
rfp_questions: [How often do you communicate status, problems, progress? | How do you report?]
engagement_models: [all]
cases: []
visuals: [VIS-03]
tables: [cadence table]
related_sections: [sec-15-escalation, sec-16-change-certainty, sec-21-risk, sec-app-b-governance-roles]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 14. Communication and Reporting

The standing cadence on a typical engagement:

| Interaction | Frequency | Duration | Participants |
|---|---|---|---|
| Stand-up | Daily | 15 min | Team; client welcome |
| Blocker flagging | Same day, as they arise | — | Shared channel |
| Written status report | Weekly | — | PM → client stakeholders |
| Status call | Weekly | 30–60 min | PM, client counterpart |
| Sprint review / demo | Every 2 weeks | 1 h | Team, client PO, stakeholders |
| Risk register review | Weekly, within status call | — | PM, client counterpart |
| Change review (small changes batched) | Weekly | 30 min | PM, client counterpart |
| Steering committee | Monthly or per milestone | 1 h | Delivery Manager, sponsors, PM |
| Relationship retrospective | Quarterly on long engagements | 1 h | Delivery and client leadership |

This cadence is written into the Delivery Approach Note at mobilisation and, where the client requires it, into the statement of work, which makes the communication obligation documented and auditable.

The weekly written status report has a fixed structure:

- progress against milestones;
- RAG status, with reasons for any amber or red;
- top risks, with movement since last week;
- decisions needed from the client, with dates by which they are needed;
- upcoming milestones.

RAG semantics are defined: green — on plan; amber — a threat to a milestone exists and a recovery plan is attached; red — a milestone will be missed without client-side decisions, and options are attached. An amber without a recovery plan, or a red without options, is treated as a defective report. Team culture treats an early red as good reporting.

The steering committee reviews trajectory against the roadmap, budget burn versus scope delivered (an earned-value view), top risks, and decisions above the working team's authority.

<!--META
id: sec-15-escalation
title: "15. Escalation and Issue Resolution"
summary: "3-level escalation ladder with tightening response times (L3: 4 business hours + options paper), DM as standing second contact, contractual exit assistance."
tags: [escalation, issues, delivery-manager, exit-assistance, termination]
rfp_questions: [What happens when things go wrong? | How do we escalate problems?]
engagement_models: [all]
cases: []
visuals: [VIS-04]
tables: [escalation levels]
related_sections: [sec-14-communication, sec-17-continuity, sec-32-regulated]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 15. Escalation and Issue Resolution

Every engagement has a named Delivery Manager above the PM as the client's standing second point of contact. Part of the DM's role is to hear what a client may not want to say to the PM directly.

Escalation levels, with response commitments that tighten as severity rises:

| Level | Participants | Response |
|---|---|---|
| 1 | PM + client counterpart | Within 1 business day |
| 2 | Delivery Manager + client sponsor | Same business day |
| 3 | Andersen account/portfolio leadership + client executive | Within 4 business hours, with a written options paper within 3 business days |

Any party can escalate; escalation is treated as normal governance, and using it never penalises the client relationship at working level. Issues arising from materialised risks carry their action plans in the risk register, so the escalation conversation starts from documented history.

If delivery reaches a point where the client considers termination, Andersen provides exit assistance as a contractual commitment: orderly knowledge transfer, documentation handover, and a defined transition period at the engagement's standard rates.

<!--META
id: sec-16-change-certainty
title: "16. Change Control, Cost and Schedule Certainty"
summary: "Impact-before-commitment change process with weekly change review, four cost-certainty mechanisms, schedule early-warning mechanics, flexibility rules per model."
tags: [change-control, cost-certainty, schedule-certainty, earned-value, contingency, flexibility]
rfp_questions: [How do you ensure cost certainty? | How do you ensure deadline certainty? | How flexible are you with changes?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-05-discovery, sec-14-communication, sec-21-risk]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 16. Change Control, Cost and Schedule Certainty

**Change control.** Scope changes are estimated for schedule, cost and risk impact, documented, and decided by the client before work starts. A decision log records what was agreed and why. This protects certainty in both directions: the client is never billed for un-agreed work, and the plan is never eroded by silently absorbed scope. Small changes are batched into a lightweight weekly change review with the client counterpart, so control does not become bureaucracy.

**Cost certainty** rests on four mechanisms working together:

- range-based estimation with documented assumptions;
- sprint-level re-baselining against the milestone plan;
- an earned-value view at monthly steering — budget burn versus scope delivered;
- the change-control discipline above.

Fixed-price engagements additionally carry a contingency line agreed at contract time and a stricter scope boundary definition.

**Schedule certainty** uses the same machinery plus early-warning mechanics: definition-of-ready discipline keeps the team from stalling on unprepared work; the dependency register surfaces slipping client-side or third-party inputs weeks before they hit the critical path; and any forecast slip beyond one sprint triggers Level-1 escalation with a recovery plan while options still exist.

**Flexibility.** Re-prioritisation within agreed capacity is free on T&M and dedicated-team models — the backlog is the client's to reorder up to each sprint boundary. On fixed price, flexibility is handled through the change process with published impact before commitment.

<!--META
id: sec-17-continuity
title: "17. Team Continuity, Substitution and Scaling"
summary: "Named deputies, 2-week paid overlap on rotation at Andersen's expense, replacement-for-cause in 10 business days, named-person bid rules, ramp-up 2-4 weeks/specialist, ramp-down notice."
tags: [continuity, substitution, replacement, ramp-up, ramp-down, deputies, rotation, bench]
rfp_questions: [What are your substitution and continuity arrangements? | How do you scale the team up or down?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-18-working-model, sec-24-team]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 17. Team Continuity, Substitution and Scaling

**Named deputies.** Every key role — PM, tech lead, architect — has a named deputy from the start of the engagement, recorded in the Delivery Approach Note. Project knowledge is required to live in the shared toolchain (Jira, Confluence, Git, ADRs), and this is verified in ARB and DM reviews, so short-term absence of any individual does not stall delivery.

**Planned rotation.** Any rotation of a key role includes a minimum two-week overlap between outgoing and incoming specialists at Andersen's expense. The incoming specialist is presented to the client with a CV before the rotation is confirmed; the client can reject the candidate.

**Replacement for cause.** If the client considers a team member unsuitable, Andersen presents a replacement candidate within 10 business days; the replacement's onboarding overlap is at Andersen's expense. This commitment is offered as a contractual term.

**Named-person bids.** Where a tender names specific individuals, substitutions before or during delivery are made only with client consent and only with candidates of demonstrably equivalent qualification (CV plus, where required, interview).

**Ramp-up and ramp-down.** Team extension follows a standard lead time of two to four weeks per specialist depending on stack, drawing on Andersen's bench of over 3,000 engineers; each new member goes through the engagement's documented onboarding checklist and security induction. Ramp-down follows notice periods agreed in the contract (typically four weeks per role), with knowledge-transfer obligations completed before release. Scaling in either direction is reflected in the roadmap and reported at steering.

<!--META
id: sec-18-working-model
title: "18. Working Model: Locations, Time Zones, Languages"
summary: "Delivery regions, guaranteed overlap windows per client region (table), on-site policy incl. public-sector requirements, language capabilities incl. German for DACH."
tags: [locations, time-zones, overlap, nearshore, on-site, languages, german, dach]
rfp_questions: [Where is the work performed? | What time-zone overlap do you guarantee? | Do you support German-language delivery?]
engagement_models: [all]
cases: []
visuals: []
tables: [region/staffing/overlap]
related_sections: [sec-23-support-sla, sec-33-gcc]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 18. Working Model: Locations, Time Zones, Languages

Andersen delivers from delivery centres across Central and Eastern Europe, Western Europe, the Caucasus, Central Asia and Latin America, which allows teams to be composed around the client's time zone.

**Time-zone overlap.** For EU clients, teams work fully within CET ± 2 hours — overlap is the whole working day. For UK clients, effectively the same. For North American clients, teams are composed for a guaranteed overlap window — typically four or more shared working hours with Eastern Time daily — and ceremonies are scheduled inside that window; where a longer overlap matters, LatAm-based staffing extends it.

| Client region | Primary staffing regions | Guaranteed overlap |
|---|---|---|
| EU / DACH | Central & Eastern Europe, Western Europe | Full working day (CET ± 2) |
| UK | Central & Eastern Europe, Western Europe | Full working day |
| US / Canada East | CEE + Latin America | ≥ 4 h with Eastern Time; extendable via LatAm staffing |
| US West | Latin America | ≥ 4 h with Pacific Time |
| Middle East | CEE, Caucasus, Central Asia | Full working day (GST ± 2) |

**On-site presence.** Kickoffs, discovery workshops, major milestone reviews and go-lives can be attended on-site; regular on-site cadences (for example, monthly) are agreed in the Delivery Approach Note and priced transparently. For public-sector engagements with mandatory on-site or in-country requirements, the staffing plan states explicitly which roles are on-site, hybrid and remote.

**Languages.** English is the default working language on all engagements. German-language delivery capability (documentation and client-facing communication) is available for DACH engagements and stated per-role in the staffing plan, along with other languages where relevant. All client-facing documentation is delivered in the contractually agreed language.

<!--META
id: sec-19-subcontracting
title: "19. Subcontracting"
summary: "Employees by default; subcontractors only with prior written consent, declared by name, full obligation flow-down, Andersen as single point of responsibility."
tags: [subcontracting, declarations, flow-down, public-procurement]
rfp_questions: [Do you subcontract?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: []
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 19. Subcontracting

Andersen's default is delivery by Andersen employees. Subcontractors are engaged only with the client's prior written consent, are declared by name and role in proposals where required by procurement rules, and operate under flow-down of all confidentiality, security, IP and quality obligations of the main contract. Andersen remains the single point of responsibility for the entire delivery regardless of subcontractor involvement. For public tenders, subcontractor declarations and supporting documents are provided in the format the procedure requires.

<!--META
id: sec-20-ip
title: "20. Intellectual Property"
summary: "Client owns all work product on payment; background IP identified and licensed without restricting use; OSS inventoried (SBOM) with licence checks in pipeline."
tags: [ip, intellectual-property, work-for-hire, background-ip, open-source, sbom, licences]
rfp_questions: [Who owns the intellectual property?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-28-ai, sec-31-multivendor]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 20. Intellectual Property

The contractual default: all work product created for the client — source code, documentation, designs, models, configurations — is the client's property, assigned on payment (work-for-hire where the jurisdiction recognises it, assignment otherwise). Andersen background IP (pre-existing tools, libraries, accelerators) used in the delivery is identified in the contract and licensed to the client on terms that do not restrict the client's use of the delivered system. Third-party and open-source components are inventoried (SBOM available on request), with licence compatibility checked in the pipeline's dependency-scanning stage, so the client receives a system with a documented licence position.

<!--META
id: sec-21-risk
title: "21. Risk and Dependency Management"
summary: "Day-one risk register with owner/probability/impact/trigger/mitigation, item-by-item weekly review, dependency register with needed-by dates, neutral reporting of client-side dependencies."
tags: [risk-register, dependencies, mitigation, early-warning]
rfp_questions: [How do you manage risks? | How do you track dependencies on us and third parties?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-14-communication, sec-16-change-certainty]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 21. Risk and Dependency Management

The risk register opens on day one of mobilisation and is reviewed item by item in the weekly status call, with a deeper pass at each steering committee. Each risk carries an owner (a named person), probability and impact scores, a trigger condition, a mitigation with its own due date, and a movement history. Risks that materialise convert to issues with action plans; risks retired by mitigation are closed with a note. The register is maintained as a decision tool for the client, and its review is a fixed agenda item of the weekly status call.

Dependencies — client-side deliverables, third-party interfaces, hardware, approvals — receive the same treatment in the dependency register: a named owner on the owning side and a needed-by date derived from the plan, so a slipping dependency appears as schedule risk weeks before it reaches the critical path. Client-side dependencies (SME availability, environment access, data provision, sign-offs) are reported with the same neutrality as Andersen-side risks; the purpose is early visibility for joint action.

<!--META
id: sec-22-improvement
title: "22. Continuous Improvement"
summary: "Retro actions tracked as work items, monthly delivery metrics review (velocity stability, escape rate, cycle time, pipeline health), quarterly relationship review."
tags: [retrospectives, metrics, improvement, relationship-review]
rfp_questions: [How do you improve over time?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-14-communication]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 22. Continuous Improvement

Sprint retrospectives produce actions with owners and due dates, tracked in the same Jira project as delivery work, so improvement items are planned and reported with the same visibility as features. Delivery metrics reviewed monthly by the team and Delivery Manager: velocity stability, defect escape rate, cycle time from ready to done, pipeline duration and failure rate, and unplanned-work share. Engagement-level improvements with wider applicability feed back into Andersen's central delivery practice; this framework document is versioned and updated quarterly from those inputs.

Long engagements additionally get a quarterly relationship review — what the client wants more of, less of, and differently — attended by delivery leadership and held separately from commercial conversations.

<!--META
id: sec-23-support-sla
title: "23. Support, Service Management and SLAs"
summary: "Support tiers (8x5 to 24/7), warranty (2 months default), full SLA matrix P1-P4 with clock rules and client-update cadence, availability targets, measurement rules and service credits, L1/L2/L3 operation, development capacity within support, monthly/quarterly service reporting, training."
tags: [support, sla, service-management, itil, warranty, incident, service-desk, availability, service-credits, training]
rfp_questions: [What are your support tiers, SLAs and warranty? | Describe your incident response | What service reporting do you provide? | Do you provide training?]
engagement_models: [all]
cases: [CASE-11, CASE-12]
visuals: []
tables: [support tiers; SLA matrix P1-P4]
related_sections: [sec-08-engineering, sec-09-qa, sec-13-transition, sec-18-working-model, sec-30-takeover]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 23. Support, Service Management and SLAs

After go-live, the engagement moves into a contracted support model; support can also be purchased standalone as a takeover of an existing system. This section defines the standard offering; the specific tier, SLA figures and scope are fixed in the SLA annex, and the tables below ship with every support offer as the starting position.

**Warranty.** Every delivery includes a post-go-live warranty period — default 2 months — during which defects attributable to Andersen's work are fixed at no charge. Warranty severity clocks follow the contracted support tier; where no support tier is purchased, warranty runs on the business-hours matrix below in the client's primary time zone.

**Support tiers and coverage.**

| Tier | Coverage | Intended for |
|---|---|---|
| Business hours | 8×5 in the client's primary time zone | Internal tools, content platforms |
| Extended | 12×5 or 16×5, weekend on-call optional | Customer-facing systems with business-hours peaks |
| Full | 24×7 on-call with runbook-driven L1 | Statutory, revenue-critical or safety-relevant platforms |

**Default SLA matrix** (per-contract figures fixed in the SLA annex). On the 24×7 tier all clocks run on elapsed time; on business-hours tiers all clocks run within the coverage window and pause outside it (a P1 logged Friday 16:00 on an 8×5 contract resumes Monday 08:00 — stated here so there is no ambiguity at contract stage):

| Priority | Definition | Response (24×7) | Response (business hours) | Restoration target | Client updates during incident |
|---|---|---|---|---|---|
| P1 | Service down, data loss or security breach | 30 min | 2 h | Workaround or restore within 4 clock-hours (24×7) / 4 coverage-hours (business tier); RCA report within 5 business days | Every 30 min, named incident manager |
| P2 | Major function degraded, no workaround | 1 h | 4 h | Fix within 24 clock-hours (24×7) / 1 business day | Every 2 h |
| P3 | Minor function affected, workaround exists | 8 coverage-hours | 8 coverage-hours | Fix in next scheduled release | At triage and resolution |
| P4 | Cosmetic, query, improvement request | 2 business days | 2 business days | Backlog, prioritised at service review | At resolution |

**Availability.** The SLA annex additionally carries an availability target per system — typically 99.5–99.9% monthly, measured at the load balancer, excluding agreed maintenance windows.

**Measurement and remedies.** Clocks start when the ticket is logged in the service desk (or when monitoring raises the alert, whichever is earlier). Exclusions: agreed maintenance windows, incidents caused by client-side changes outside the change process, and third-party outages beyond the contracted scope. SLA attainment is reported monthly against these definitions, and the SLA annex includes a service-credit regime — credits against the monthly fee when attainment falls below agreed thresholds — so the commitment carries financial consequence.

Delivery-phase defect targets apply before go-live; the matrix above governs the contracted support phase. The support P1 restoration target is deliberately tighter than the delivery-phase default, because a production system in support has runbooks, monitoring and a known estate that a system under construction does not.

**Service operation.** Support requests flow through a ticketing service desk (Jira Service Management by default, or the client's ITSM tool) with full traceability from logging to closure. First-line triage follows runbooks for known scenarios; production access is restricted to qualified L2/L3 engineers. L2 covers infrastructure and configuration; L3 is application engineering with access to the original delivery team's knowledge base (ADRs, runbooks, test suites). Recurring incidents trigger formal problem management with root-cause analysis and preventive actions tracked to closure.

**Change and release control in support.** Production changes go through the same gate chain as delivery: reviewed merge requests, pipeline checks, rehearsed rollback. Emergency fixes use an expedited path with retrospective review at the next service meeting.

**Development services within support.** Contracts include a defined monthly capacity (hour pool or dedicated FTEs) for enhancements, ordered through a request-estimate-approve flow; unused-hours treatment (carry-over or lapse) is fixed in the contract, so there is no billing ambiguity.

**Service reporting.** Monthly written service report: SLA attainment per priority against the measurement rules above, availability actuals, incident volumes and trends, root-cause summaries, patch and vulnerability status, backup and restore-test status, capacity consumption against the pool. Quarterly service review meeting: trends, improvement actions, upcoming risks, and SLA fitness — where the SLA no longer matches how the client uses the system, we table the adjustment at this review.

**Training.** Support contracts include role-based editor/administrator training at handover — live sessions per user group, quick-reference guides, exercise environment — plus scheduled refresher sessions after major releases and on onboarding of new client staff; training consumption is reported with the capacity pool.

> **CASE-11 — Tiered SLA across time zones, New Zealand fintech.** For a card-services provider, Andersen runs L2 (infrastructure) support on an 8×5 schedule aligned to the client's business day (NZT) and L3 (application) support 8×5 CET, under a tiered SLA plan with defined response times, update intervals and mitigation timeframes. The engagement began with an infrastructure and process audit so the support team understood the estate before the first ticket — a step we treat as standard for support takeovers.

> **CASE-12 — 24/7 runbook-based emergency support, German media-technology provider.** For a cloud streaming-platform vendor, Andersen provides 24/7 emergency coverage where L1 performs runbook-driven triage and known-issue remediation, and production access is restricted to qualified L2/L3 engineers. Call volume is low (1–2 emergencies per month) but contractually guaranteed — the model is priced for readiness and scalability.

Coverage outside Andersen's standard staffing regions (for example APAC business hours, as in CASE-11) is delivered through shifted working schedules and on-call rotations agreed per contract, and stated explicitly in the staffing plan.

<!--META
id: sec-24-team
title: "24. Team Composition and Key Personnel"
summary: "Named-CV bid standard with CV content spec (education+graduation year, certifications, projects, clearance), team shapes per engagement size, seniority mix (max 1 junior per 3 senior/middle), separation of duties, client-side roles with time commitments."
tags: [team, cv, key-personnel, staffing, seniority, named-persons, roles]
rfp_questions: [Who exactly will work on our project? | Describe the quality and balance of the proposed team | What do your CVs contain?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-15-escalation, sec-17-continuity, sec-21-risk]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 24. Team Composition and Key Personnel

**Named CVs as the bid standard.** In every evaluated bid, each proposed role is presented with a named CV, because evaluators score the specific team proposed. Our standard CV format includes: name; proposed role; education with graduation year; professional certifications; years of relevant experience; the 3–5 most relevant projects with the person's actual contribution; language proficiencies where the contract requires them; and, for on-site public-sector roles, right-to-work and clearance status. Where the procedure prescribes a CV template (e.g., Europass) or page limit, CVs are reformatted to comply. Representative CVs are used only where the procurement procedure explicitly permits them, are labelled as such, and carry the substitution guarantee (client approval, demonstrably equivalent qualification) as a contractual term.

**Team shape by engagement.** Composition follows the scope, and the staffing plan shows the reasoning:

- a compact product build runs with 6–9 people: PM, BA, architect (part-time allocation on smaller scopes), 2–4 engineers, QA, DevOps, designer where there is UI;
- a QA-focused engagement may be as small as 3–4 specialists with a defined lead;
- a large platform operation scales past 30 with explicit sub-team leads and a Delivery Manager layer.

Each staffing plan states the seniority mix (our default: no more than one junior per three senior/middle engineers on client-billed work), the allocation percentage per person, and who deputises for whom.

**Balance and separation of duties.** Delivery, architecture and quality assurance report through different leads, so implementation and verification are never in the same hands. The governance layer (Delivery Manager, account leadership) sits outside the sprint team, giving the client an escalation route independent of day-to-day delivery.

**Client-side roles.** The staffing plan names the counterpart roles needed from the client — product owner, SME availability per week, security/infrastructure contacts, decision-maker for change control — with the expected time commitment for each. A missing client-side role is recorded as a schedule risk at contract stage.

**Continuity.** Named deputies, rotation overlaps, replacement-for-cause commitments and ramp mechanics are contractual commitments, fixed at the start of the engagement.

<!--META
id: sec-25-accessibility
title: "25. Accessibility and Inclusive Design"
summary: "WCAG 2.2 AA target (exceeding EN 301 549 baseline), correct legal mapping (Directive 2016/2102, EAA 2019/882), accessibility-first design, automated CI checks (axe-core, Lighthouse), named manual AT testing (NVDA/JAWS/VoiceOver), pre-release audit by independent specialist, public accessibility statement, VPAT for non-EU."
tags: [accessibility, wcag, en-301-549, inclusive-design, screen-readers, audit, public-sector, vpat]
rfp_questions: [How do you ensure accessibility (WCAG)? | Who performs accessibility testing and audits?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-09-qa, sec-29-ux-design]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 25. Accessibility and Inclusive Design

For public-sector and consumer-facing systems in the EU, accessibility is a legal obligation: the Web Accessibility Directive (EU) 2016/2102 for public bodies and the European Accessibility Act (EU) 2019/882 for in-scope products and services, with EN 301 549 as the harmonised standard (currently baselining WCAG 2.1 level AA). Our default engineering target is **WCAG 2.2 level AA** — exceeding the current EN 301 549 baseline — unless the contract sets a different standard. Outside the EU, the applicable regime (ADA/Section 508, national law) is mapped in discovery, and a VPAT/accessibility conformance report is produced where the market expects one.

**Accessibility-first design.** Accessibility work starts at the design stage: designers work against an accessibility checklist (contrast, focus order, target sizes, motion), and every UI component in the design system carries its accessibility notes. Content models include alt-text and plain-language fields, and multilingual requirements — including right-to-left scripts or statutory minority-language obligations such as Irish — are part of the information architecture from discovery.

**Testing — automated, manual, and audited, with named owners.**

- automated checks (axe-core rules, Lighthouse accessibility scoring) run in the CI pipeline on every merge request — regressions fail the build; WAVE and browser tooling support manual review;
- manual testing is performed by QA engineers trained in assistive technology: keyboard-only navigation, screen readers (NVDA, JAWS, VoiceOver), zoom and reflow, colour-vision simulation. The test strategy names who performs this testing and on which pages/flows;
- before each major release, a formal accessibility audit against the applicable WCAG success-criteria list is conducted by an accessibility specialist who did not build the features; where the contract or national law requires an external certified audit, it is scoped and scheduled in the release plan with the auditor named. Where the client wants validation with real assistive-technology users, we organise moderated sessions with users of screen readers and alternative input as part of UAT;
- audit reports (redacted) and specialist credentials are available on request as evaluation evidence.

**Evidence and statements.** The audit produces a findings report with severity and remediation plan; we prepare or update the public accessibility statement the client is legally required to publish under Directive 2016/2102, and accessibility defects are tracked in the same defect process, with severity mapped to user impact.

<!--META
id: sec-26-bcdr
title: "26. Business Continuity and Disaster Recovery"
summary: "RTO/RPO default tiering table (Tier 1: RTO 4h/RPO 15min), rehearsed restore tests reported monthly, IaC rebuild, annual DR exercises, distributed-delivery continuity with 2022 relocation as evidence, ISO 27001 ISMS continuity controls, BC policy as annex."
tags: [business-continuity, disaster-recovery, rto, rpo, backups, resilience, failover]
rfp_questions: [What are your business continuity / DR arrangements? | What are your RTO/RPO commitments?]
engagement_models: [all]
cases: []
visuals: []
tables: [RTO/RPO tiers]
related_sections: [sec-05-discovery, sec-10-security, sec-13-transition, sec-17-continuity, sec-18-working-model, sec-23-support-sla]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 26. Business Continuity and Disaster Recovery

**Continuity of the service we build.** DR parameters are engineering requirements captured in the NFR register: target RTO and RPO are agreed per system against a default tiering, and the architecture is designed to meet them.

| System criticality | RTO (default) | RPO (default) | Typical measures |
|---|---|---|---|
| Tier 1 — revenue/statutory-critical | ≤ 4 h | ≤ 15 min | Multi-zone or multi-region, automated failover, continuous replication |
| Tier 2 — business-important | ≤ 24 h | ≤ 4 h | Warm standby or rapid IaC rebuild, frequent snapshots |
| Tier 3 — internal/deferrable | ≤ 3 business days | ≤ 24 h | Daily backups, documented rebuild |

Supporting mechanics: automated backups with contractually defined frequency and retention; scheduled restore tests, with results reported in the monthly service report; infrastructure as code enabling full environment rebuild; DR runbooks in the transition package, exercised at least annually on supported systems.

**Continuity of our own delivery.** Andersen's delivery model is geographically distributed: teams operate from delivery centres across multiple countries, engagement knowledge is required to live in the shared toolchain, and delivery infrastructure is cloud-based with no single-site dependency. If a delivery location becomes unavailable — outage, natural event, geopolitical disruption — work continues from other locations, with key-person cover provided through named deputies, defined for every key role from the start of the engagement. This model has been exercised at scale: in 2022 Andersen relocated a substantial share of its delivery workforce across borders within weeks while maintaining client deliveries — the strongest evidence we can offer that the continuity model works under real stress.

**During a disruption**, the engagement's standing escalation and communication machinery applies: the client is informed the same day with an impact assessment and continuity plan, and the risk register records the event and the response for later audit. Continuity controls are part of Andersen's ISO 27001-certified ISMS; the corporate business continuity policy is provided as a proposal annex where the procedure requires it, and client-specific continuity requirements (e.g., data-residency-constrained failover) are addressed in the Delivery Approach Note.

<!--META
id: sec-27-esg
title: "27. Corporate Responsibility: Social, Environmental and Ethical Practice"
summary: "Policy set as annexes (code of conduct, anti-bribery, modern-slavery statement, D&I), education programmes with volumes in annex, engagement-linked social value for UK/Irish scoring, environmental practice targeting travel/compute with resource efficiency as architecture review item, CSRD alignment."
tags: [esg, csr, social-value, environment, ethics, modern-slavery, diversity, education]
rfp_questions: [What are your social and environmental practices? | Do you have a modern slavery statement? | What social value can you deliver?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-06-architecture, sec-18-working-model]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 27. Corporate Responsibility: Social, Environmental and Ethical Practice

Public procurement increasingly scores social and environmental practice on evidence — policies as documents, programmes with volumes, measures with dates. This section states the practice; the supporting documents and current figures are provided in proposal annexes.

**Ethical framework.** Andersen operates a corporate code of conduct binding on all staff, supported by anti-bribery and anti-corruption rules, a published modern-slavery statement covering the supply chain, and equal-opportunity employment practice across a workforce distributed over multiple countries and cultures. The policy set (code of conduct, anti-bribery, modern slavery, diversity and inclusion) is provided as proposal annexes where the procedure requires it.

**Social contribution.** The largest social lever of a 3,000+-engineer company is education in the regions where it operates: internship and traineeship programmes that move graduates into the profession, free and subsidised IT courses run from delivery centres, university partnerships, and public knowledge-sharing — open webinars, published expert interviews and R&D papers. Current programme volumes (trainees per year, course graduates, university partners) are supplied in the annex, since these figures change every intake. Engagement-linked social value can be agreed explicitly — training places or internships tied to the contract — the mechanism UK and Irish social-value scoring rewards.

**Environmental practice.** As a services company, the footprint is dominated by offices, travel and compute, and the practice targets those three:

- remote-first delivery reduces routine travel to the on-site cadence the engagement genuinely requires;
- delivery infrastructure is cloud-based and sized to demand, with no owned data centres;
- at the engineering level, performance-efficient architecture, right-sizing and autoscaling reduce the client's hosting energy consumption and bill together — architecture reviews treat resource efficiency as a standing review item.

Where the client operates ESG reporting (CSRD or voluntary), delivery reporting is aligned to feed it, and current environmental measures and any certifications in progress are stated in the annex with dates.

<!--META
id: sec-28-ai
title: "28. AI-Assisted Delivery and Responsible AI Use"
summary: "Controls for AI in delivery: enterprise tenancies with training disabled, no client code in public AI services, per-repo/full opt-out, AI output through standard gates, usage logging, AI productivity reflected in estimates. Building AI features: EU AI Act (2024/1689) risk classification, SME-curated evaluation sets with agreed thresholds, guardrails, in-region model hosting, model-specific monitoring. Sensitive data: minimisation, pseudonymisation, tested PII redaction, query-time retrieval scoping, client-tenancy hosting, BAA for PHI, DPIA, synthetic/anonymised eval data."
tags: [ai, responsible-ai, llm, genai, eu-ai-act, copilot, rag, guardrails, evaluation, ip-protection]
rfp_questions: [How do you use AI in delivery; is our IP safe? | How do you govern AI features you build? | Are you EU AI Act compliant?]
engagement_models: [all]
cases: [CASE-01]
visuals: []
tables: []
related_sections: [sec-05-discovery, sec-08-engineering, sec-10-security, sec-12-release, sec-32-regulated]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 28. AI-Assisted Delivery and Responsible AI Use

This section covers both halves of the AI topic: how AI is used inside our delivery process — under which controls, with which consequences for the client's IP and data — and the additional discipline applied when we build AI capabilities for clients.

**AI in our delivery process — the control set.**

- Approved AI coding and analysis assistants run under enterprise agreements with training-on-customer-data disabled; client code, requirements and data are never submitted to consumer or public AI services;
- the AI toolset used on an engagement is declared in the Delivery Approach Note; the client can restrict or exclude AI use per repository or entirely — enforced technically through repository and network policy — and can additionally restrict use for defined data classes, enforced through data-handling procedure and access scoping;
- AI-produced output enters the codebase only through the standard gate chain — human review, tests, static analysis, security scanning. The engineer who submits the merge request owns its correctness, whatever tooling helped produce it;
- where the client requires auditability of AI involvement (some regulated environments do), tool usage is logged and reportable;
- productivity effects of AI tooling are already reflected in our estimates and velocity calibration, so the client is never billed for manual effort the tooling removed.

**Building AI features for clients.** Deliveries that include AI capability (assistants, RAG search, document processing, ML models) carry additional discipline on top of the standard framework:

- risk classification against the EU AI Act ((EU) 2024/1689) is performed in discovery, with the compliance obligations of the resulting class decomposed into backlog items like any other regulatory requirement;
- an evaluation set — realistic inputs with expected outputs, curated with the client's SMEs — is built before the first model integration, and release gates include measured accuracy and groundedness thresholds on that set, with the threshold figures agreed per use case in the acceptance criteria;
- guardrails are explicit deliverables: input/output filtering, prompt-injection defences, data-access scoping so the model can only reach what the requesting user may see, and logged model interactions for audit;
- hosting follows the engagement's agreed data-location rules — including fully in-region or client-tenancy model hosting where residency demands it;
- operational monitoring includes model-specific signals (quality drift, cost per interaction, refusal rates) alongside standard observability.

**AI over sensitive and regulated data.** Where AI features touch personal, medical, financial or otherwise regulated data, additional controls apply on top of the above:

- data minimisation first: the model receives only the fields the use case needs, and identifiers are pseudonymised or masked in the pipeline before model exposure wherever the use case allows;
- automated PII redaction runs on prompts and on logs before storage, with redaction coverage tested against labelled samples and reported; where the use case requires personal data to reach the model (e.g., a clinician's assistant), that flow is explicit in the DPIA, covered by the processing agreement, and scoped to the minimum fields;
- retrieval scoping is enforced at query time: the model can only reach documents and records the requesting user is entitled to see, verified against the client's access model, and covered by tests;
- model hosting for regulated data defaults to the client's own tenancy or an in-region deployment, with no-training-on-data terms contractually confirmed with the model provider — and, for US healthcare data, a Business Associate Agreement executed with the model provider before any PHI flows;
- a DPIA (and, where the EU AI Act classification requires it, the corresponding conformity documentation) is produced for the AI feature before it processes real data;
- evaluation and development run on anonymised or synthetic datasets where regulation restricts the use of production data; production data enters testing only under the client's documented approval and the engagement's agreed test-data rules.

CASE-01 is a delivered example: an AI knowledge assistant for a UK building-services company, shipped as a PDS engagement in milestone-based two-week sprints, with a multi-tenant expansion scoped as a follow-on package.

<!--META
id: sec-29-ux-design
title: "29. UX and Product Design"
summary: "User research in discovery (interviews, task analysis, journeys), wireframe-prototype-visual flow with client review, usability testing 5-8 users/round, design QA in DoD, brand-guideline compliance check, design system governance with contribution rules, privacy-compliant behavioural analytics with event taxonomy."
tags: [ux, design, figma, usability-testing, design-system, user-research, analytics, brand]
rfp_questions: [Describe your UX/design methodology | How do you govern a design system? | How do you measure user behaviour?]
engagement_models: [pds, fixed-price, dedicated-team]
cases: [CASE-01]
visuals: []
tables: []
related_sections: [sec-05-discovery, sec-16-change-certainty, sec-20-ip, sec-22-improvement, sec-25-accessibility]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 29. UX and Product Design

On user-facing engagements, design is staffed from day one of discovery as a workstream with its own artefacts and gates; its outputs are versioned in Figma alongside the engagement's other artefacts, and design files transfer to the client as work product under the contract's IP terms.

**User research in discovery.** Discovery includes user research proportionate to the engagement: stakeholder and user interviews, task analysis, journey mapping for the critical flows, and a review of analytics from the existing system where one exists. Research outputs are written artefacts the client reviews — personas grounded in interview data, journey maps with pain points, and a prioritised list of design problems, each traceable into the backlog.

**Design production and validation.**

- wireframes → clickable Figma prototypes → visual design, with client review at each step;
- usability testing of key flows on the prototype before implementation commits: moderated sessions with 5–8 representative users per round, findings ranked by severity and routed into the backlog through standard refinement;
- accessibility is designed in from the first wireframe, and brand compliance is checked against the client's brand guidelines as an explicit review item — including in illustrative mock-ups;
- design QA is part of the definition of done: implemented UI is verified against the approved design before a story is demonstrated.

CASE-01 includes this workstream in delivered form: UI/UX design in Figma as part of an 8-person PDS team, with design review inside the sprint cadence.

**Design system governance.** For engagements above a single application, design tokens and a component library are established early, with contribution rules — who may add components, how changes are versioned and reviewed — so the system survives team growth and vendor plurality. Where the client already operates a design system, we contribute to it under the client's own governance; disagreements between delivery design and the client's brand authority are routed through the product owner as design decisions, recorded in the decision log like any other decision.

**Behavioural analytics.** Instrumentation ships with the product: an event taxonomy agreed with the product owner, privacy-compliant tooling (consent-aware; EU-hosted or first-party collection where GDPR posture requires), dashboards for the KPIs the design was meant to move, and a post-launch review comparing intended against actual behaviour, with findings routed into the improvement backlog.

<!--META
id: sec-30-takeover
title: "30. Taking Over an Existing System or Incumbent Supplier"
summary: "Priced, walk-away-able due diligence (2-6 weeks): code/infra/licence/docs audit with takeover report. Knowledge capture with or without incumbent cooperation. TUPE/ARD and licence novation handling. Shadow-assisted-full phases with entry/exit criteria; SLA clocks from full responsibility; 3-month no-regression window at no charge."
tags: [takeover, incumbent, transition-in, due-diligence, tupe, novation, shadowing, no-regression]
rfp_questions: [How would you take over from our current supplier? | What is your transition-in plan? | What happens to inherited technical debt?]
engagement_models: [all]
cases: [CASE-06, CASE-11]
visuals: []
tables: []
related_sections: [sec-02-engagement-models, sec-08-engineering, sec-11-data-integration, sec-13-transition, sec-23-support-sla]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 30. Taking Over an Existing System or Incumbent Supplier

A takeover runs on a phased, evidence-based plan, because its risk profile differs from greenfield delivery: knowledge is leaving, documentation is often stale, and the client needs continuity guarantees before commitment.

**Due diligence first.** Before committing to SLAs or delivery dates, a time-boxed assessment (typically 2–6 weeks depending on estate size; a full architecture audit where the estate warrants it) establishes what is actually there:

- code and architecture review against Andersen's engineering baseline, producing a findings register with severity;
- infrastructure, environment and access inventory; licence and open-source position (SBOM);
- documentation inventory verified against reality; test coverage and pipeline state;
- operational history: incident patterns, known fragile areas, pending upgrades.

The output is a takeover report with a risk register and a remediation backlog, priced and scheduled explicitly, so inherited technical debt enters the plan with costs attached. The due-diligence phase is separately priced and commercially self-contained: its findings can adjust the subsequent scope and price, and either party can decline to proceed after it — terms that protect both sides from committing blind.

**Knowledge capture while it is still available.** Where the incumbent cooperates, structured handover sessions are scheduled per topic with written minutes and a KT completion checklist; where cooperation is limited, the plan compensates with deeper code and configuration analysis, monitoring-based behaviour mapping, and a longer shadowing phase — and says so explicitly, with the residual risk in the register.

**Legal and staffing dimensions.** Where the takeover triggers staff-transfer obligations (TUPE in the UK, the Acquired Rights Directive elsewhere in the EU), Andersen engages its legal counsel and the client's early, and the position is stated in the proposal. Third-party licences, hosting agreements and support contracts held by the incumbent are inventoried during due diligence, with novation or replacement planned per item before cutover.

**Phased assumption of responsibility.** Shadow (we observe, incumbent leads) → assisted (we lead, incumbent on call) → full responsibility, each phase with entry/exit criteria, dates and agreed phase pricing in the takeover plan. Contracted SLA clocks start at full responsibility; during shadow and assisted phases, interim response targets are agreed so coverage is continuous. For support takeovers this is standard practice — CASE-11 began with exactly such an audit-first engagement; CASE-06 shows the remediation pattern on an inherited codebase (coverage ramp, pipeline completion, monitoring build-out, tracked as sprint work).

**No-regression window.** For an agreed period after full assumption (default: first 3 months), any degradation of previously working functionality caused by our changes is fixed at no charge, on the contracted support severity clocks. This window is longer than the standard 2-month post-delivery warranty deliberately: on an inherited estate we did not build, the client carries more uncertainty, so we carry more of the risk.

<!--META
id: sec-31-multivendor
title: "31. Working in Multi-Vendor Environments"
summary: "Cross-vendor boundary definition in Delivery Approach Note, SIAM/service-integrator compatibility with OLAs, cause-neutral incident triage on evidence, contract tests as objective boundary arbitration, embedded work in client ceremonies, inter-vendor confidentiality and least-privilege, cross-vendor dependency tracking."
tags: [multi-vendor, siam, ola, raci, cross-vendor, incidents, confidentiality, ecosystem]
rfp_questions: [How do you work alongside our other vendors? | Do you operate under SIAM? | How do you handle cross-vendor incidents?]
engagement_models: [all]
cases: [CASE-03]
visuals: []
tables: []
related_sections: [sec-07-execution, sec-08-engineering, sec-10-security, sec-11-data-integration, sec-15-escalation, sec-16-change-certainty, sec-20-ip, sec-21-risk, sec-30-takeover]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 31. Working in Multi-Vendor Environments

**Boundary definition at mobilisation.** The Delivery Approach Note names every party at each interface Andersen's scope touches: who owns which system, which data contract, which environment, and who approves changes on each side. A cross-vendor RACI covering the shared processes — releases, incidents, changes affecting shared interfaces — is agreed through the client's governance, with the client party to every cross-vendor commitment. Where the client runs a SIAM or service-integrator model, Andersen operates as a service-tower supplier under the integrator's processes, and Operational Level Agreements between towers are defined so that end-to-end SLAs decompose into accountable pieces.

**Cause-neutral incident handling.** When an incident spans vendor boundaries, triage runs on symptoms and evidence first — logs, traces, contract-test results — with attribution afterwards. Our engineers participate in joint war-rooms under the client's incident lead. For interfaces Andersen builds or consumes, contract tests in CI provide objective evidence of which side of the boundary changed behaviour; for inherited interfaces without test coverage, building that coverage is an early takeover task.

**Working inside the client's ceremonies.** On augmentation and co-delivery engagements, Andersen teams join the client's ceremonies, standards and tooling alongside other suppliers. CASE-03 shows the embedded-team pattern delivered: Andersen specialists working inside three of a UK insurer's Scrum teams, standardising intake, refinement and defect-handling conventions, with shared Jira dashboards giving management a single consistent view of delivery state.

**Confidentiality between suppliers.** Where competing vendors share repositories or environments, access follows least-privilege per vendor, Andersen background IP is identified and segregated, and our staff operate under confidentiality terms that survive the presence of third parties in the same codebase — the same discipline we expect in return, and worth agreeing explicitly at mobilisation.

**Protecting the client's interests at the seams.** Interface changes affecting another vendor go through the client's change control with impact stated per party; cross-vendor dependencies are tracked in the dependency register with a named owner per vendor and needed-by dates; and escalation across vendors uses the client's governance path, with Andersen's Delivery Manager accountable for our side of every shared commitment.

<!--META
id: sec-32-regulated
title: "32. Delivery in Regulated Industries: Healthcare, Financial Services, Public Sector"
summary: "Compliance register method (HIPAA/FDA-MDR, PCI DSS, PSD2 SCA, EMD2, DORA, KYC/AML, public-sector baselines incl. clearances), supplier-side obligations (DORA Art.30 terms, audit rights, SAMA/CBUAE outsourcing approvals), field-level tokenisation, audit trails, anonymised test data with documented approvals for production-scale testing, per-release privileged-access recertification, evidence-on-demand."
tags: [regulated, healthcare, banking, fintech, hipaa, dora, pci-dss, psd2, emd2, kyc-aml, public-sector, audit-trail, compliance-register, outsourcing]
rfp_questions: [How do you deliver for healthcare / banking / government? | Do you accept DORA outsourcing provisions? | How do you protect sensitive data in engineering?]
engagement_models: [all]
cases: [CASE-08, CASE-09, CASE-13]
visuals: []
tables: []
related_sections: [sec-05-discovery, sec-09-qa, sec-10-security, sec-15-escalation, sec-23-support-sla, sec-28-ai]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 32. Delivery in Regulated Industries: Healthcare, Financial Services, Public Sector

This section describes how Andersen's security, data-location and AI-over-sensitive-data controls combine into a delivery posture for engagements where the client answers to a regulator.

**Regime mapping as a discovery deliverable.** The applicable regime set is established in discovery and maintained as a compliance register: HIPAA and FDA/MDR boundaries for healthcare; PCI DSS, PSD2 payment-services conditions (including SCA), EMD2 e-money licensing conditions, DORA operational-resilience obligations and KYC/AML duties for financial services; national public-sector security baselines for government work (e.g., Cyber Essentials Plus in the UK, BSI IT-Grundschutz in Germany), including personnel clearance requirements where classified or official-sensitive material is handled. Each obligation is decomposed into backlog items, architecture constraints and test cases with traceability, so compliance is verifiable per requirement.

**Supplier-side obligations.** Regulated clients must also regulate us. Andersen accepts the contractual provisions financial-sector outsourcing regimes require of ICT providers — DORA Article 30 contract terms, regulator and client audit/access rights, incident-notification duties, exit and transition assistance, and the data needed for the client's register of information — and supports the client's material-outsourcing approval processes (e.g., SAMA and CBUAE no-objection procedures in the Gulf) with the documentation they demand.

**Engineering posture for sensitive data.**

- encryption in transit and at rest as a baseline, with field-level protection (tokenisation or vault-based encryption) for the highest-sensitivity fields — payment card data, health records, identity documents;
- audit trails on every access to and change of sensitive data, retained per the regime's retention rules and exportable for the client's own audits;
- environment discipline: development and test environments run on anonymised or synthetic data by default, with the anonymisation method documented for the client's DPO; production-scale data enters testing (e.g., migration dry runs, CASE-09) only under the client's documented approval and agreed test-data controls;
- access on a strict need-to-know basis with named individuals, security induction, and joiner/leaver enforcement; on regulated engagements the monthly access review is supplemented with per-release recertification of privileged access;
- evidence on demand as the design goal: automated configuration and test checks demonstrate compliance-relevant behaviour at any time, which is what a regulator or internal auditor actually asks for (CASE-08).

> **CASE-13 — Licensed banking platform, European e-money institution and bank.** For a fintech group holding banking licences in several European markets and operating EU-wide under an e-money licence, an Andersen team of up to 25 FTEs works inside the client's delivery organisation on web and mobile channels. The engagement runs under PCI DSS (data encryption, access controls, regular security audits, real-time monitoring), PSD2 strong customer authentication, and the audit-trail, data-retention and high-availability obligations of the client's licences — three years of continuous delivery in which compliance controls are part of the engineering work, verified in the pipeline and audit-ready.

Healthcare deliveries follow the same pattern with regime-specific content: CASE-08 (German healthcare MVP — compliance evidence demonstrable at any time) and CASE-09 (US medical-imaging EHR/RCM migration with jointly governed release risk) show the posture applied.

**Regulator-facing obligations.** Where the client must notify or evidence to a regulator (incident reporting under DORA or GDPR, audit responses, licensing reviews), the engagement's reporting and logging are designed so the client can meet its deadlines from our artefacts — incident timelines from the service desk record, access evidence from the audit trail, change evidence from the decision log and release records.

<!--META
id: sec-33-gcc
title: "33. Delivering in the Middle East and GCC"
summary: "GCC regime set (Saudi PDPL+transfer regs, NCA ECC, CST, SAMA CSF; UAE PDPL, DIFC/ADGM; Qatar PDPPL), in-Kingdom/in-country hosting incl. government clouds, Abu Dhabi TAMM/DGE ecosystem experience (pursuit-stage solutioning + technical defence), Sun-Thu working week, 0-2h Gulf overlap from Caucasus/Central Asia, Arabic/RTL design, on-site expectations, LCGPA local content."
tags: [gcc, middle-east, saudi-arabia, uae, qatar, pdpl, nca-ecc, sama-csf, difc, adgm, data-residency, arabic, rtl, tamm, dge, lcgpa]
rfp_questions: [How do you handle GCC data residency, Arabic, local rules? | What is your experience in Saudi Arabia / UAE? | Can you host in-Kingdom?]
engagement_models: [all]
cases: []
visuals: []
tables: []
related_sections: [sec-10-security, sec-18-working-model, sec-28-ai, sec-29-ux-design, sec-32-regulated]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## 33. Delivering in the Middle East and GCC

GCC engagements combine strict data-sovereignty regimes, government-platform ecosystems and distinct working conventions; this section states how the framework adapts. Regional regulatory requirements are mapped in discovery and maintained as a compliance register, with each obligation decomposed into backlog items and test cases.

**Regulatory and data-sovereignty landscape.** The compliance register for GCC engagements covers, as applicable: Saudi Arabia's PDPL (including its cross-border transfer regulations), the NCA Essential Cybersecurity Controls, the CST cloud framework and SAMA CSF for financial-sector work in the Kingdom; the UAE's federal PDPL and the separate DIFC and ADGM data-protection regimes for financial free zones; Qatar's PDPPL; and the sector rules of the client's regulator, including material-outsourcing approval processes (SAMA, CBUAE) where Andersen is the outsourced provider. Data-residency expectations are treated as hard constraints: in-Kingdom or in-country hosting, including government cloud platforms, is supported through client-tenancy, in-region or hybrid hosting configurations, with model hosting for AI features following the same residency rules.

**Government-platform ecosystems.** GCC public-sector work is built on government platforms and standards — in Abu Dhabi, for example, TAMM service journeys and the Department of Government Enablement's cloud requirements shape architecture and compliance from day one. At pursuit stage, Andersen's solution teams prepared the full technical documentation for a bidder on an Abu Dhabi government transport authority's mobility platform — delivery within the DGE Cloud and TAMM environment, in-country AI hosting, government security compliance — and supported the bidder through both rounds of technical defence. Delivered GCC references matched to the client's sector are provided per bid from the case library.

**Working model adaptations.**

- working week: teams align to the client's Sunday–Thursday or Monday–Friday convention; Andersen's standard time-zone overlap commitments apply to the client's actual working days, and delivery centres in the Caucasus and Central Asia sit within 0–2 hours of Gulf time, so full-working-day overlap is the standard arrangement;
- on-site presence: GCC clients typically expect a stronger on-site component — kickoffs, steering, and where required resident roles are stated per role in the staffing plan and priced transparently; tender-defence presentations are attended in person;
- language: English is the standard working language of GCC delivery; Arabic-language user interfaces are a product requirement handled in design (right-to-left layouts, Arabic typography and content models), and Arabic-speaking client-facing staffing is stated per engagement in the staffing plan;
- local requirements — commercial registration, in-country invoicing entities, national-content programmes (in Saudi Arabia, LCGPA local-content rules) — are addressed at proposal stage with the commercial team, so the delivery plan and the market-entry mechanics stay consistent.

**Evidence.** Regional references — including Gulf-region government and enterprise pursuits and deliveries — are provided per bid from the case library, filtered to the client's sector; reference letters are available under NDA on request.

---

<!--META
id: sec-app-a-lifecycle
title: "Appendix A. Delivery Lifecycle with Stage Gates"
summary: "One-line lifecycle: six phases with explicit exit gates from mobilisation to hypercare exit."
tags: [lifecycle, stage-gates, phases]
rfp_questions: [What is your delivery lifecycle?]
engagement_models: [pds, fixed-price]
cases: []
visuals: [VIS-01]
tables: []
related_sections: [sec-04-mobilisation, sec-05-discovery, sec-12-release, sec-13-transition]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## Appendix A. Delivery Lifecycle with Stage Gates

Mobilisation (gate: Delivery Approach Note signed, team operational) → Discovery sprints (gate: estimated backlog and re-baselined roadmap signed) → Solution design (gate: architecture pack through ARB review, ADRs recorded) → Implementation in two-week sprints (gate per sprint: demo delivered, burn-up re-baselined) → Release(s) (gate: release checklist signed, production validation passed) → Transition (gate: KT checklist complete, training delivered, hypercare exit criterion met).

<!--META
id: sec-app-b-governance-roles
title: "Appendix B. Governance Roles"
summary: "Three governance layers with Andersen/client roles and scope; account leadership as out-of-chain escalation point."
tags: [governance, roles, raci]
rfp_questions: [What is your governance structure?]
engagement_models: [all]
cases: []
visuals: [VIS-03]
tables: [governance layers]
related_sections: [sec-14-communication, sec-15-escalation]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## Appendix B. Governance Roles

| Layer | Andersen | Client | Scope |
|---|---|---|---|
| Executive steering | Delivery Manager + account leadership | Sponsor | Roadmap, budget, escalations, changes above threshold |
| Delivery management | Project Manager | Client counterpart / product owner | Plan, risks, scope, reporting |
| Execution | Architect, BA, engineers, QA, DevOps | SMEs, product owner, users | Daily delivery |

Andersen account leadership stands outside the delivery chain as a permanent escalation point at the highest escalation level.

<!--META
id: sec-app-c-quality-gates
title: "Appendix C. Quality Gates Summary"
summary: "Single-table summary of all five quality gates with default criteria (story→sprint, MR→main, story→done, RC→production, go-live→hypercare exit)."
tags: [quality-gates, definition-of-done, release-criteria, thresholds]
rfp_questions: [Summarise your quality gates]
engagement_models: [all]
cases: []
visuals: [VIS-05, VIS-06]
tables: [gate/criteria]
related_sections: [sec-07-execution, sec-08-engineering, sec-09-qa, sec-12-release]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## Appendix C. Quality Gates Summary

| Gate | Criteria (engagement defaults, fixed in the Delivery Approach Note) |
|---|---|
| Story → sprint | Definition of ready: acceptance criteria, estimate, dependencies, testability, design where applicable |
| Merge request → main | 1–2 approving reviews; pipeline green (lint, unit tests, build, static-analysis gate, dependency/container scan); coverage on new code ≥ 80% |
| Story → done | Acceptance criteria verified by QA on a test environment; documentation updated; no open high+ defects |
| Release candidate → production | Regression green; performance within NFR targets; security scans clean or waived in writing; rollback rehearsed; monitoring in place; client go/no-go recorded |
| Go-live → hypercare exit | Agreed incident-threshold criterion met for the agreed number of consecutive days |

<!--META
id: sec-app-d-artefacts
title: "Appendix D. Delivery Artefacts with Owners and Cadence"
summary: "All 14 standing artefacts with owner and production/update cadence."
tags: [artefacts, deliverables, documentation, owners]
rfp_questions: [What deliverables/documentation do you produce?]
engagement_models: [all]
cases: []
visuals: []
tables: [artefact/owner/cadence]
related_sections: [sec-04-mobilisation, sec-14-communication]
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## Appendix D. Delivery Artefacts with Owners and Cadence

| Artefact | Owner | Produced / updated |
|---|---|---|
| Delivery Approach Note | PM | Mobilisation; on change |
| Roadmap and milestone plan | PM + architect | Mobilisation; re-baselined per sprint |
| RACI matrix | PM | Mobilisation |
| Risk register | PM | Weekly |
| Dependency register | BA | Weekly |
| Requirements with traceability | BA | Continuous (Jira ↔ tests ↔ merge requests) |
| Architecture pack and ADRs | Architect | Design phase; per significant decision |
| Test strategy and test results | QA lead | Mobilisation; results continuous |
| Release checklist and release notes | PM + tech lead | Per release |
| Runbooks and operational documentation | Team | Incremental; verified at transition |
| Weekly status report | PM | Weekly |
| Decision log | PM | Continuous |
| KT completion checklist | PM | Transition |
| Training materials and completion report | PM + BA | Before go-live |

<!--META
id: sec-case-index
title: "Case Index"
summary: "Index of CASE-01..10 with engagement model and section mapping; swap per bid by industry/technology; reference letters available under NDA."
tags: [cases, evidence, references, proof]
rfp_questions: [What evidence can you provide? | Can you provide references?]
engagement_models: [all]
cases: [CASE-01, CASE-02, CASE-03, CASE-04, CASE-05, CASE-06, CASE-07, CASE-08, CASE-09, CASE-10]
visuals: []
tables: [case index]
related_sections: []
excerpt_standalone: true (no in-text pointers; related_sections list context for automated assembly)
-->
## Case Index

| ID | Engagement | Model | Referenced in |
|---|---|---|---|
| CASE-01 | AI knowledge assistant, UK building services | PDS | §2, §28, §29 |
| CASE-02 | Salesforce implementation, US agricultural logistics | Fixed price | §2 |
| CASE-03 | Delivery strengthening, UK specialist insurer | Augmentation | §2, §31 |
| CASE-04 | Architecture audit, European online broker | Audit | §2 |
| CASE-05 | Regulated delivery pipeline, US payments network | PDS | §8 |
| CASE-06 | Engineering remediation, telecom platform | PDS (platform takeover) | §8, §30 |
| CASE-07 | QA process rebuild, European pet-supplies retailer | Augmentation | §9 |
| CASE-08 | Compliance evidence, German healthcare MVP | Fixed scope | §10 |
| CASE-09 | Migration risk management, US healthcare imaging | PDS | §11 |
| CASE-10 | Travel platform at scale, Canada | Dedicated team | §12 |
| CASE-11 | Tiered SLA support across time zones, NZ fintech | Managed support (§23) | §23, §30 |
| CASE-12 | 24/7 runbook emergency support, German media-tech | Managed support (§23) | §23 |
| CASE-13 | Licensed banking platform, European EMI/bank | Dedicated team | §32 |

Case examples can be swapped per bid for cases matching the client's industry and technology; the full case library exceeds 1,100 delivered projects. Named reference contacts and signed client reference letters are available under NDA on request.

<!--META
id: sec-visual-assets
title: "Visual Assets"
summary: "Registry of proposal-ready infographics (SVG): what each shows and which sections it illustrates. Insert into proposals next to the mapped section."
tags: [visuals, infographics, svg, presentation]
rfp_questions: []
engagement_models: [all]
cases: []
visuals: [VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06]
tables: [visual registry]
excerpt_standalone: true
-->
## Visual Assets

| ID | File | Shows | Use with sections | Suggested use |
|---|---|---|---|---|
| VIS-01 | visuals/VIS-01_delivery_lifecycle.svg | Delivery lifecycle with stage gates | sec-app-a-lifecycle, sec-03-principles, sec-04-mobilisation | methodology overview slide |
| VIS-02 | visuals/VIS-02_mobilisation_timeline.svg | Mobilisation 10-day timeline | sec-04-mobilisation | project-start slide |
| VIS-03 | visuals/VIS-03_governance_cadence.svg | Governance layers and communication cadence | sec-14-communication, sec-app-b-governance-roles | communication-frequency answer |
| VIS-04 | visuals/VIS-04_escalation_ladder.svg | Escalation ladder | sec-15-escalation | when-things-go-wrong answer |
| VIS-05 | visuals/VIS-05_pipeline_promotion.svg | Engineering pipeline and environment promotion | sec-08-engineering, sec-12-release | engineering/DevOps answer |
| VIS-06 | visuals/VIS-06_quality_model.svg | Quality model: test pyramid and defect SLAs | sec-09-qa, sec-app-c-quality-gates | QA-measures answer |

Each SVG carries its own metadata in the `<desc>` element (JSON: id, tags, sections, usage). Palette (Andersen brand): black #111111, dark grey #3D3D3D, grey #9E9E9E, brand yellow #FFDB00, pale yellow #FFF6C8 — matches andersenlab.com theme colour; recolour per client brand only when co-branding is required.