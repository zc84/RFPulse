# Endpoint Visual Generation: reuse-first, fidelity-aware implementation plan

Status: **reviewed and corrected; implementation work remains**

Last updated: 2026-07-27

Scope: public `/v1/visuals` endpoint functionality

System behavior: preserve existing Process/Chat output while extracting reusable image-generation services

Language: all code, prompts, tests, comments, API documentation, and plan content must remain in English

Authentication decision: the endpoint is intentionally public and requires no authentication or authorization

## 1. Executive summary

The existing `/v1/visuals` planning and operational foundation is useful, but the rendering implementation created a parallel architecture drawing system whose presentation quality is below the existing Process/Chat examples.

The correction is reuse-first:

- retain the endpoint Visual Planner, typed artifact plans, evidence binding, plan tokens, idempotency, limits, cancellation, and public API behavior;
- extract the reusable OpenAI image-generation and prompt-building logic from the system path;
- make AI-rendered architecture artifacts use one shared proposal visual language;
- keep renderer selection server-owned;
- keep deterministic Gantt rendering as the default because schedule geometry is an exact-data requirement;
- describe AI-rendered architecture fidelity truthfully as validated best effort, not mathematical exactness;
- retain deterministic architecture rendering only as a temporary rollback path during migration;
- remove duplicated architecture rendering code only after the replacement passes the complete evaluation and rollout gates.

The target behavior is:

```text
Public request
  -> validate and normalize
  -> enforce pre-provider input and complexity limits
  -> canonicalize structured facts
  -> endpoint Visual Planner
  -> validate and persist a self-contained VisualArtifactPlan
  -> server rendering policy
       -> shared AI architecture renderer
       -> deterministic exact Gantt renderer
  -> bounded output validation and optional advisory visual QA
  -> endpoint response
```

## 2. Corrected rendering and fidelity policy

### 2.1 Architecture overview

`architecture-overview` uses the shared system image renderer.

Fidelity:

- conceptual;
- presentation-oriented;
- supplied terminology should be preserved;
- exact topology is not guaranteed.

Eligible source:

- proposal markdown;
- architecture markdown;
- structured architecture, cloud, or C4 data.

### 2.2 Architecture details, cloud, and C4

`architecture-details`, `cloud-architecture`, and `architecture-c4` use the shared system image renderer after the typed plan has been validated and serialized.

Fidelity:

- exact structured input and evidence binding;
- `validated_best_effort` rendered fidelity;
- mandatory elements and relationships are checked before rendering;
- rendered pixels must not be advertised as `structural_exact`;
- advisory visual QA may detect omissions or reversals but cannot prove topology.

Eligibility remains strict:

- `architecture-details` requires structured architecture data;
- `cloud-architecture` requires structured cloud data;
- `architecture-c4` requires structured C4 data;
- qualitative markdown alone does not create an exact structured artifact.

The existing deterministic architecture renderers remain available only behind a server-controlled rollback policy during migration. They are not client-selectable.

### 2.3 Gantt

`gantt` remains deterministic by default.

Fidelity:

- `data_exact`;
- structured dates remain authoritative;
- task positions, durations, dependencies, and milestones are calculated by code;
- visible labels use project-relative months and weeks;
- no calendar dates appear in the PNG.

Visible time labels use:

```text
M1
  WK1 WK2 WK3 WK4
M2
  WK1 WK2 WK3 WK4
...
```

The existing system timeline image prompt may be extracted for Process/Chat compatibility, but it is not a replacement for the endpoint's exact structured Gantt renderer. A future presentation-only timeline mode would require a separate versioned product decision.

## 3. Reference output provenance

The local files below remain useful visual references:

- `server/uploads/22/architecture-1-1783322367809.png`
- `server/uploads/22/architecture-2-1783322367831.png`

They are not reproducible CI fixtures:

- `server/uploads` is ignored by Git;
- the images may contain customer-sensitive material;
- the files predate the current `extractArchitectureDiagramSource()` and `generateOpenAIImageArtifact()` implementation;
- repository history indicates that the contemporaneous code used two direct `images.generate` calls for overview and detail variants.

Therefore:

- do not claim that the files were produced by the exact current pipeline;
- record their hashes, timestamps, dimensions, and best-known generating commit in an evaluation manifest;
- do not commit customer-sensitive source or images without explicit review;
- create sanitized, versioned synthetic fixtures for CI;
- treat the local images as a manual style reference only until provenance is complete.

## 4. Existing implementation inventory

### 4.1 System services to extract and reuse

Architecture:

- `server/services/aiOrchestrator.js`
  - `extractArchitectureDiagramSource()`
  - `buildArchitectureDiagramImagePrompt()`
  - `generateArchitectureDiagramImages()`
  - `generateOpenAIImageArtifact()`

Timeline compatibility:

- `server/services/timelineDiagram.js`
  - `extractTimelinePhasesFromMarkdown()`
  - `buildTimelineDiagramImagePrompt()`
  - `buildTimelineDiagramFromMarkdown()`

System orchestration and persistence:

- `server/routes/ai.js`
  - `executeDiagramGenerationForMarkdown()`
  - architecture and timeline persistence and embedding flow

The endpoint must not call route orchestration or system database workflow functions.

### 4.2 Endpoint foundation to retain

- `/v1/visuals/plan`;
- `/v1/visuals/render`;
- request and response schemas;
- context-aware type selection;
- canonical structured facts and evidence references;
- server-issued opaque plan tokens;
- idempotency;
- public unauthenticated access;
- endpoint-specific uppercase error envelope;
- `auto`, `recommend`, and `explicit` selection modes;
- request cancellation;
- five-minute request deadline;
- input, output, artifact-count, and complexity limits;
- emergency kill switch.

### 4.3 Code affected by the rendering migration

The migration must explicitly review and update:

- `server/visuals/application/planVisuals.js`;
- `server/visuals/application/renderVisuals.js`;
- `server/visuals/createVisualModule.js`;
- `server/visuals/infrastructure/openAiVisualProvider.js`;
- `server/visuals/infrastructure/openAiOverviewRenderer.js`;
- `server/visuals/renderers/rendererRegistry.js`;
- `server/visuals/renderers/detailedArchitectureRenderer.js`;
- `server/visuals/renderers/structuredArchitectureRenderer.js`;
- `server/visuals/renderers/orthogonalRouter.js`;
- `server/visuals/renderers/technologyIconRegistry.js`;
- `server/visuals/renderers/ganttRenderer.js`;
- `server/visuals/domain/catalog.js`;
- `server/visuals/domain/schemas.js`;
- `server/visuals/domain/complexity.js`;
- endpoint estimates, usage reporting, tests, fixture scripts, and environment documentation.

`simple-icons` may be removed only after confirming that no retained production renderer uses it.

## 5. Target module architecture

Extract focused shared services, for example:

```text
server/diagram-generation/
  architectureSource.js
  architecturePrompt.js
  timelineSource.js
  timelinePrompt.js
  imageArtifactGenerator.js
  architectureRenderer.js
  errors.js
```

Both callers depend on the shared services:

```text
System Process/Chat ─┐
                     ├─> shared image service ─> OpenAI Images API
Public visual API ───┘
```

Requirements:

- preserve current Process/Chat prompt semantics and output behavior;
- keep `generateArchitectureDiagramImages()` as a compatibility wrapper;
- keep `buildTimelineDiagramFromMarkdown()` as a compatibility wrapper;
- avoid circular imports;
- inject the image client or provider;
- do not let the shared service query endpoint tables or call routes;
- translate shared errors at each caller boundary;
- never leak system prompt text or provider internals through the public endpoint;
- add characterization tests before moving prompt logic.

## 6. Self-contained renderer input

Plan-token rendering cannot depend on recovering the original request. Every persisted plan must contain the bounded renderer-ready semantic payload required for replay.

Use a discriminated union rather than `structuredContent: unknown`:

```ts
type SharedArchitectureRenderRequest =
  | {
      profile: "overview";
      title: string;
      purpose: string;
      audience: string;
      sourceExcerpt?: string;
      content: OverviewRenderContent;
      mandatoryTerminology: string[];
      stylePreset: "system-proposal-v1";
    }
  | {
      profile: "details";
      title: string;
      purpose: string;
      audience: string;
      content: DetailsRenderContent;
      mandatoryTerminology: string[];
      mandatoryRelationships: DirectedRelationship[];
      stylePreset: "system-proposal-v1";
    }
  | {
      profile: "cloud";
      title: string;
      purpose: string;
      audience: string;
      content: CloudRenderContent;
      mandatoryTerminology: string[];
      mandatoryRelationships: DirectedRelationship[];
      stylePreset: "system-proposal-v1";
    }
  | {
      profile: "c4";
      title: string;
      purpose: string;
      audience: string;
      content: C4RenderContent;
      mandatoryTerminology: string[];
      mandatoryRelationships: DirectedRelationship[];
      stylePreset: "system-proposal-v1";
    };
```

Rules:

- derive mandatory checklists from validated content rather than accepting independent client values;
- persist a bounded sanitized `sourceExcerpt` only when overview rendering needs qualitative context;
- do not persist the full raw request in the plan token store;
- do not pass planner reasoning;
- do not copy user-authored rendering instructions;
- treat all titles, labels, descriptions, and excerpts as untrusted data;
- place untrusted values inside explicit delimiters;
- test delimiter-closing and instruction-in-label attacks;
- reject over-complex mandatory structured content instead of silently truncating it;
- preserve English control instructions even when source labels are multilingual.

## 7. Profile behavior

### 7.1 Overview profile

Input:

- bounded architecture source excerpt when needed;
- validated semantic groups;
- component labels;
- essential relationships;
- exact terminology checklist;
- title, purpose, audience, and presentation density.

The prompt should preserve the existing proposal-slide visual language:

- executive hierarchy;
- white landscape canvas;
- dark navy title;
- coherent cards and boundaries;
- concise labels;
- unambiguous connectors;
- neutral glyphs when a technology icon is not unambiguous.

### 7.2 Details profile

Input:

- components;
- responsibilities;
- technologies;
- boundaries;
- exact directed relationships and protocols;
- external systems represented by validated components;
- required connector semantics.

The prompt must request:

- every supplied component;
- correct source and target for every relationship;
- visible arrowheads;
- no ambiguous shared connector trunk;
- a compact legend when multiple connector styles are present;
- native technology icons only when unambiguous;
- neutral glyphs otherwise.

The response remains `validated_best_effort` even when these instructions are present.

### 7.3 Cloud profile

Input is limited to fields represented by the versioned schema.

Before implementation, either:

- extend the source and artifact schemas to model account, subscription, project, region, network, identity, and security scopes; or
- remove unsupported fields from the profile requirements.

The renderer must never infer a provider, service, region, or security boundary that is absent from validated content.

### 7.4 C4 profile

Input:

- requested C4 level;
- people, systems, containers, or components;
- containment boundaries;
- technologies;
- directed relationships.

The output follows the requested C4 semantics while using the shared proposal visual language. The rendered image remains `validated_best_effort`.

### 7.5 Gantt renderer

The deterministic renderer:

- uses an explicit project epoch;
- treats task date inclusivity consistently;
- maps every 28-day project month to four seven-day weeks;
- calculates task bars from structured dates;
- validates dependency references and cycles;
- renders milestone tasks consistently;
- displays relative `M/WK` labels only;
- returns `data_exact` when mechanical validation passes.

## 8. Versioning and compatibility

The rendering migration changes observable plan semantics.

Required changes:

- bump the endpoint plan schema from version `1` to version `2`;
- introduce `validated_best_effort` for AI-rendered details, cloud, and C4 artifacts;
- keep `conceptual` for overview;
- keep `data_exact` for deterministic Gantt;
- bump `ENDPOINT_RENDERER_POLICY_VERSION`;
- reject old plan tokens with `PLAN_VERSION_UNSUPPORTED`;
- document that rolling deployments may invalidate short-lived plan tokens;
- keep the public route namespace `/v1/visuals`;
- continue accepting public `style_preset: "professional-light-v1"` as the compatibility alias;
- map the compatibility alias internally to `system-proposal-v1`;
- do not expose internal renderer selection controls to clients.

The response validation object must support:

```text
passed
warning
failed
unverified
```

It must never report `passed` automatically merely because an image provider returned bytes.

## 9. Fidelity and visual QA

### 9.1 Mechanical validation

Run for every output:

- valid PNG signature;
- decodable PNG;
- expected dimensions;
- configured pixel-area limit;
- artifact and aggregate byte limits;
- non-empty image;
- allowed MIME type;
- no raw prompt or provider metadata in the response.

### 9.2 Semantic pre-render validation

- schema validation;
- referential integrity;
- evidence validation;
- type eligibility;
- normalized mandatory terminology;
- normalized directed relationships;
- bounded renderer payload.

### 9.3 Advisory post-render QA

Initially keep visual QA disabled in production until its value, latency, and cost are measured.

Evaluation may test one advisory vision QA call per AI artifact for:

- required component recall;
- invented critical component detection;
- sampled relationship direction;
- legend presence;
- label legibility;
- obvious connector breakage;
- broad visual similarity to the approved style rubric.

Policy when enabled:

- at most one QA call per AI artifact;
- at most one defect-specific regeneration per AI artifact;
- no unbounded loop;
- all calls share the request deadline;
- QA and regeneration are included in budgets and usage reporting;
- failure to verify mandatory content produces `warning` or artifact failure according to policy;
- QA never upgrades image-model output to mathematical exactness.

## 10. Evaluation baseline

Create two evaluation layers.

### 10.1 Versioned CI fixtures

Use sanitized synthetic fixtures covering:

- overview from markdown;
- details with directed and bidirectional relationships;
- AWS, Azure, and GCP cloud cases;
- C4 context, container, and component levels;
- exact Gantt dates, dependencies, and milestones;
- maximum supported density;
- multilingual labels;
- long labels;
- malformed references;
- prompt-injection text inside labels and excerpts.

### 10.2 Controlled visual evaluation bundle

Maintain a manifest containing:

- source fixture identifier and hash;
- output image hash;
- prompt and schema versions;
- model identifier;
- image size, quality, and background;
- generating commit;
- timestamp;
- rubric scores;
- reviewer;
- confidentiality classification.

Do not make CI depend on ignored local upload files or the ignored tender document.

For nondeterministic AI profiles:

- run at least three generations per representative fixture;
- define a numeric rubric and pass threshold before implementation;
- record omission, invention, latency, cost, and failure rates;
- do not accept a single unusually good image as proof of stable quality.

## 11. Public unauthenticated endpoint controls

No authentication or authorization is required. This is a product requirement.

The public endpoint must enforce:

- per-IP rate limiting;
- a distributed or explicitly single-instance global request limit;
- provider-call concurrency limits;
- planner, image, QA, and regeneration budgets;
- hourly and daily usage windows;
- cost-weighted usage units;
- emergency kill switch;
- required `Idempotency-Key` for billable render requests;
- short-lived high-entropy plan tokens;
- input, output, pixel, artifact-count, and complexity limits;
- request cancellation;
- five-minute request deadline (`300_000 ms`);
- redacted logs with no raw proposal content;
- no arbitrary callback URLs, file paths, HTML, or executable templates.

Budget policy:

- calculate the maximum possible call graph before provider work;
- atomically reserve worst-case capacity;
- record actual calls on completion;
- release unused reservation where the storage design supports it;
- count semantic regeneration separately from transient provider retry;
- reject before provider work when capacity is unavailable.

For two AI architecture artifacts, the maximum optional QA path is:

```text
1 planner call
2 initial image calls
2 QA calls
2 regeneration image calls
```

## 12. Output and idempotency limits

The current two reference PNGs do not fit the existing aggregate and idempotency limits.

Before switching rendering:

- set an explicit per-artifact PNG limit;
- set an aggregate binary response limit that supports the maximum artifact count;
- account for base64 expansion of approximately four thirds;
- include JSON envelope overhead;
- make the idempotency serialized-response limit larger than the maximum valid API response;
- add boundary tests using real PNG sizes;
- evaluate whether large base64 JSONB rows are acceptable.

Initial implementation target:

- maximum PNG bytes per artifact: `3 MiB`;
- maximum aggregate PNG bytes: `6 MiB`;
- maximum serialized idempotent response: `12 MiB`;
- maximum artifacts per request: `2`.

If database storage proves unsuitable, preserve the public base64 response contract while storing generated artifacts separately and reconstructing idempotent replays from internal artifact references.

## 13. Idempotency and failure semantics

- claim idempotency before consuming a plan render attempt;
- completed replay must not call the planner, renderer, QA, or provider again;
- the same idempotency key with another payload returns conflict;
- an in-progress request returns `IDEMPOTENCY_IN_PROGRESS`;
- a request that fails after provider work remains explicitly failed for that key;
- retry after such failure requires a new key;
- document whether a failed provider attempt consumes a plan render count;
- never claim that a process crash or upstream timeout makes duplicate provider billing impossible;
- add PostgreSQL concurrency tests for claims, expiry, response persistence, and render-count races.

## 14. Provider retry and error mapping

Define a deadline-aware transient retry policy:

- retry only supported transient 429 and 5xx failures;
- respect `Retry-After` when present;
- use bounded jitter;
- do not retry invalid prompts, moderation failures, schema failures, or client cancellation;
- do not retry when insufficient request deadline remains;
- distinguish transient retry from semantic regeneration in usage reporting.

Shared service errors must be translated into:

- system Process/Chat errors at the system boundary;
- uppercase public visual API errors at the endpoint boundary.

No provider response may expose raw proposal content, internal prompts, stack traces, or secrets.

## 15. Implementation phases

### Phase 0 — freeze, correct, and measure

- add characterization tests for current system architecture and timeline prompts;
- document the true provenance of the local reference images;
- create sanitized versioned CI fixtures;
- define the scored visual rubric, thresholds, reviewers, and repeat count;
- confirm plan schema version `2` and renderer policy version;
- confirm `validated_best_effort` architecture semantics;
- confirm deterministic Gantt as the default;
- confirm coherent output and idempotency limits;
- define worst-case provider budgets.

Exit criteria:

- current Process/Chat behavior is protected by tests;
- the reference manifest is accurate;
- CI does not depend on ignored customer files;
- fidelity and validation terms are truthful;
- no production behavior has changed.

### Phase 1 — extract shared image services

- extract the image artifact generator;
- extract architecture source and prompt construction;
- extract timeline source and prompt construction for Process/Chat compatibility;
- keep compatibility wrappers;
- preserve dependency injection;
- add caller-specific error adapters;
- run the full test suite.

Exit criteria:

- both callers can import the shared service without route imports;
- Process/Chat prompt contracts remain intentionally equivalent;
- no duplicate OpenAI image wrapper remains.

### Phase 2 — implement plan schema v2 and self-contained adapters

- add versioned fidelity classes;
- add self-contained renderer-ready payloads;
- add discriminated profile schemas;
- add bounded sanitized overview excerpts;
- add exact terminology and directed-relationship derivation;
- extend or narrow the cloud schema explicitly;
- map public `professional-light-v1` to internal `system-proposal-v1`;
- bump renderer policy version.

Exit criteria:

- plan-token render requires no original request recovery;
- all profile payloads are typed and bounded;
- old tokens fail safely;
- no client prompt reaches the image provider.

### Phase 3 — architecture vertical slices

- switch `architecture-overview` to the extracted shared service;
- switch `architecture-details` behind a rollout flag;
- generate repeated fixture outputs;
- compare against the rubric and deterministic baseline;
- migrate cloud and C4 only after the details gate passes;
- keep the deterministic architecture path available for rollback.

Exit criteria:

- AI architecture outputs meet the defined pass rate;
- validation metadata is truthful;
- Process/Chat output remains unchanged;
- output sizes fit the endpoint contract;
- rollback works.

### Phase 4 — operational hardening and optional QA

- implement provider concurrency control;
- implement hourly and cost-weighted budgets;
- reserve worst-case call capacity;
- add transient retry policy;
- add PostgreSQL idempotency and budget integration tests;
- measure advisory QA;
- enable QA only when its value justifies cost and latency;
- verify the five-minute deadline across render, QA, and regeneration.

Exit criteria:

- multi-request capacity tests pass;
- provider calls cannot bypass endpoint budgets;
- actual usage is reported correctly;
- timeout and cancellation propagate through every call;
- logs are redacted.

### Phase 5 — complete evaluation and rollout

- generate all five diagram types from sanitized fixtures;
- run repeated architecture generations;
- verify deterministic Gantt geometry;
- measure latency, cost, failure rate, output size, and QA value;
- perform a canary rollout;
- verify emergency disable and rollback;
- observe production metrics for an agreed period.

Exit criteria:

- Product accepts the scored presentation results;
- Architecture accepts the documented best-effort fidelity;
- no accepted fixture contains an invented critical system;
- accepted mandatory relationships meet the rubric threshold;
- Gantt uses relative `M/WK` labels and no calendar dates;
- operational budgets remain within approved limits.

### Phase 6 — cleanup

Only after Phase 5:

- remove unused custom architecture renderer code;
- remove the orthogonal router if no fallback uses it;
- remove the technology icon registry if unused;
- remove `simple-icons` if unused;
- remove the endpoint-owned OpenAI overview renderer if superseded;
- simplify the renderer registry;
- retain deterministic Gantt and its required SVG utilities;
- remove obsolete implementation-specific tests;
- retain contract, fidelity, prompt, usage, and rollout tests.

Exit criteria:

- there is one shared AI image-generation path;
- deterministic Gantt remains supported;
- no dead architecture renderer or dependency remains;
- `git diff --check`, full tests, and production build pass.

## 16. Test plan

### Shared service tests

- architecture extraction compatibility;
- timeline extraction compatibility;
- prompt characterization;
- injected fake image client;
- size, quality, background, and output-format parameters;
- caller-specific error translation;
- cancellation propagation;
- no circular imports.

### Plan and adapter tests

- all five types can be planned;
- plan schema v2 fidelity classes are enforced;
- token plans are self-contained;
- overview excerpts are bounded;
- profile payloads use discriminated schemas;
- mandatory terminology and relationships are derived from validated content;
- malicious instructions remain inside untrusted-data boundaries;
- unsupported cloud fields are rejected;
- oversized mandatory content is rejected before provider work.

### Render application tests

- plan-token rendering skips a second planner call;
- all architecture profiles use the shared image service;
- Gantt uses the deterministic renderer;
- public style alias maps to the internal preset;
- validation is not automatically marked passed;
- `best_effort` and `atomic` behavior is correct;
- usage includes planner, image, QA, regeneration, and retry calls;
- timeout aborts every upstream call;
- output limits are checked incrementally;
- idempotent replay creates no duplicate application call.

### PostgreSQL integration tests

- concurrent idempotency claims;
- payload conflict;
- stale and expired claims;
- failed request semantics;
- plan render-count races;
- hourly and daily budget atomicity;
- worst-case reservation;
- response-size boundary;
- cleanup and migration behavior.

### Compatibility tests

- Process/Chat architecture generation;
- Process/Chat timeline generation;
- proposal persistence and embedding;
- legacy `/v1/diagrams/render`;
- public endpoint uppercase error envelope;
- system and endpoint errors do not leak into each other.

### Visual evaluation

- required component recall;
- invented critical components;
- mandatory relationship direction;
- arrowhead visibility;
- legend presence;
- icon correctness or neutral fallback;
- typography and clipping;
- presentation similarity;
- repeated-run pass rate;
- exact Gantt positions, dependencies, and milestones.

## 17. Acceptance criteria

Functional:

- all five visual types remain selectable under their eligibility rules;
- planning and rendering remain separate;
- plan-token replay is self-contained;
- the endpoint remains public and unauthenticated;
- no client-authored renderer prompt or renderer ID is accepted;
- deterministic Gantt remains the exact schedule path.

Fidelity:

- overview is `conceptual`;
- AI details, cloud, and C4 are `validated_best_effort`;
- Gantt is `data_exact`;
- validation status is evidence-based and never automatically passed;
- API documentation does not claim mathematical topology guarantees for generated images.

Engineering:

- Process/Chat output remains compatible;
- shared image services have dependency injection;
- renderer policy and schema versions are bumped;
- old tokens fail safely;
- output and idempotency limits are coherent;
- all provider work is covered by budgets, concurrency control, timeout, and cancellation;
- full `npm test` passes;
- `npm run build` passes;
- `git diff --check` passes;
- code, prompts, comments, tests, and documentation are in English.

## 18. Explicit decisions

1. The endpoint remains public and unauthenticated.
2. Extract shared image services instead of calling Process/Chat routes or workflow functions.
3. Preserve the endpoint Visual Planner and canonical evidence model.
4. Preserve current Process/Chat behavior through compatibility wrappers.
5. Use `system-proposal-v1` internally.
6. Continue accepting `professional-light-v1` as the public compatibility alias.
7. Use AI image generation for overview, details, cloud, and C4 presentation profiles.
8. Describe AI architecture output as `validated_best_effort`, not exact.
9. Keep deterministic Gantt as the default `data_exact` renderer.
10. Keep renderer choice server-owned.
11. Do not accept arbitrary client prompts.
12. Persist a self-contained renderer-ready plan for token replay.
13. Keep the five-minute request deadline.
14. Bound QA to one call and one regeneration per AI artifact when enabled.
15. Remove deterministic architecture fallback code only after evaluation, canary, and rollback gates pass.

## 19. Current handoff state

Implemented in the current workspace:

- endpoint planner;
- five visual types;
- plan schema version `2`;
- typed plans and canonical evidence;
- `conceptual`, `validated_best_effort`, and `data_exact` fidelity classes;
- public unauthenticated routes;
- plan tokens;
- self-contained architecture token rendering;
- idempotency;
- coherent artifact, aggregate output, and idempotency limits;
- hourly and daily cost-weighted budgets;
- PostgreSQL provider concurrency leases;
- bounded transient image retry;
- request deadline and cancellation;
- endpoint-specific errors;
- shared architecture source, prompt, image, and renderer services;
- shared timeline source and prompt services;
- Process/Chat compatibility wrappers;
- all four architecture profiles routed through the shared image adapter;
- deterministic Gantt;
- server-controlled deterministic architecture rollback;
- truthful `unverified` semantic validation while QA is disabled;
- renderer estimates and actual usage reporting;
- sanitized evaluation and local-reference provenance manifests;
- environment and deployment documentation;
- database migration and verification coverage for visual controls.

Intentionally pending external evaluation:

- execute migration `028` and database verification against the target PostgreSQL environment;
- repeated live image generation from sanitized fixtures;
- scored comparison with the controlled visual references;
- latency, cost, omission, invention, and relationship-direction measurements;
- a production canary and rollback exercise;
- advisory visual QA and bounded semantic regeneration;
- final deterministic architecture fallback and `simple-icons` cleanup.

Advisory QA remains disabled until repeated evaluation demonstrates that it improves acceptance enough to justify its latency and cost.

## 20. Recommended next actions

1. Apply and verify migration `028` in the target environment.
2. Start the endpoint with `ENDPOINT_VISUAL_ARCHITECTURE_RENDERER=shared`.
3. Generate every architecture profile at least three times from sanitized fixtures.
4. Score the outputs against the versioned rubric and local manual references.
5. Exercise `ENDPOINT_VISUAL_ARCHITECTURE_RENDERER=deterministic` as rollback.
6. Measure provider retries, request deadlines, output sizes, and budget counters.
7. Decide whether advisory QA should be implemented and enabled.
8. Run a bounded production canary.
9. Remove deterministic architecture fallback code and `simple-icons` only after the canary gate passes.
