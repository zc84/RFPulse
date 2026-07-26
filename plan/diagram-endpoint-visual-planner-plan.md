# Endpoint Visual Planner: MVP and target architecture

Status: implemented and validated  
Scope: endpoint functionality only  
Out of scope: system Process/Chat flow and proposal document generation

Implementation result:

- the public, unauthenticated `/v1/visuals/plan` and `/v1/visuals/render` endpoints are implemented;
- all five catalog types are enabled;
- conceptual overview rendering uses the endpoint-owned AI image adapter;
- details, cloud, C4, and Gantt rendering use deterministic SVG-to-PNG adapters;
- plan tokens, evidence binding, idempotency, limits, timeouts, shared budgets, and endpoint-specific error envelopes are implemented;
- the legacy `/v1/diagrams/render` route and the system Process/Chat generation flow remain separate.

## 1. Goal

Improve diagrams generated through the public endpoint by adding an AI planning step between the source material and rendering.

The planner must not merely rewrite the source into a free-form image prompt. It must produce a typed, inspectable `VisualArtifactPlan` that:

- selects only visuals that materially improve the proposal;
- chooses the correct visual type and renderer;
- separates semantic decisions from exact business data;
- carries source references for dates, amounts, labels, and relationships;
- defines validation rules before rendering starts;
- supports architecture diagrams and commercial visuals such as Gantt charts.

The target pipeline is:

```text
Endpoint request
  -> request validation and normalization
  -> endpoint-specific Visual Planner
  -> typed VisualArtifactPlan validation
  -> renderer routing
  -> artifact-specific rendering
  -> fidelity and quality checks
  -> endpoint response
```

### Target user and job to be done

Primary user: an API client or internal proposal service that has proposal/architecture source and needs one or two useful visuals without manually authoring graph JSON.

Secondary user: an operator or developer who wants to inspect a plan before paying for rendering, then render the approved server-issued plan.

The first implementation proves both rendering strategies:

- `architecture-overview` for a conceptual AI-rendered visual;
- `gantt` for an exact-data deterministic visual;
- zero, one, or two artifacts per request.

The endpoint product must ultimately support this fixed five-type catalog:

- `architecture-overview`;
- `architecture-details`;
- `cloud-architecture`;
- `architecture-c4`;
- `gantt`.

The three structurally exact architecture types were completed in the same endpoint implementation without expanding the public type catalog.

## 2. Hard boundary: do not change system generation

This initiative must not change:

- `server/routes/ai.js`;
- system agent prompts or database agent configuration;
- the system artifact-planning step;
- `generateArchitectureDiagramImages`;
- proposal DOCX assembly or image embedding;
- existing Process/Chat behavior.

Endpoint code may reuse low-level utilities that have no system behavior attached, but it must not call or modify the system agent orchestration. Planner prompts, schemas, flags, telemetry, and retries are endpoint-owned.

## 3. Problems to solve

The current endpoint asks a renderer to solve too many problems at once: interpret the content, decide the composition, preserve exact facts, and draw the final result.

This creates several failure modes:

- a graph-shaped JSON request does not provide enough visual intent;
- direct image generation can omit, rename, duplicate, or invent elements;
- deterministic drawing preserves facts but produces weak layouts when it relies on manually assigned coordinates;
- one generic architecture contract cannot represent overview, detailed topology, cloud resources, C4 hierarchy, and Gantt timelines cleanly;
- the response does not explain why a given visual or renderer was selected;
- there is no plan-level artifact that can be inspected, approved, cached, or replayed.

## 4. Product behavior and fixed API decisions

### 4.1 Separate legacy and new endpoint families

1. Legacy API: `POST /v1/diagrams/render`
   - The existing `diagram`, `style`, and `render` contract remains unchanged.
   - Request normalization, status codes, lowercase error codes, and response shape are frozen by route-level tests.
   - New modes are not added to this handler.
   - Freeze the committed/deployed baseline before implementation.
   - The uncommitted experimental `style.fidelity: "strict"` branch is not accepted as baseline by implication. Decide separately whether to remove it, keep it experimental, or version it.

2. New source-driven API: `/v1/visuals`
   - Input contains proposal/architecture source, structured business data, and intent.
   - The planner produces zero to two artifact plans in MVP.
   - The API returns artifact statuses, plan metadata, warnings, and usage.

The namespace is fixed to `/v1/visuals` because the target scope includes commercial visuals, not only diagrams, and a separate route minimizes regression risk.

### 4.2 New endpoint surface

#### `POST /v1/visuals/plan`

Creates one validated plan synchronously and returns:

- opaque `plan_token`, expiry, `source_digest`, schema version, and prompt version;
- `renderable: true | false`;
- decision codes and warnings, never chain-of-thought;
- estimated renderer calls and cost/latency bands.

An empty plan is a successful cost-saving outcome: return HTTP 200, `renderable: false`, and reason codes when no useful visual is justified.

#### `POST /v1/visuals/render`

Accept exactly one of:

- inline `source`, which plans and renders in one convenience request;
- a server-issued opaque `plan_token`.

The endpoint intentionally requires no authentication or authorization. The `plan_token` is therefore a short-lived, high-entropy bearer capability: possession permits rendering that plan until expiry. It is signed or resolves to server-side state and is bound to source digest, schema/prompt/model versions, server-selected renderer policy, and TTL. It must not contain readable proposal content.

Do not accept raw client-authored plans in MVP. Any future raw-plan mode must resubmit source, undergo full fact verification, and ignore client-selected renderer and validation policy.

### 4.3 Source-driven request

```json
{
  "mode": "source",
  "source": {
    "proposal_markdown": "...",
    "architecture_markdown": "...",
    "structured_data": {
      "architecture": {},
      "timeline": []
    }
  },
  "context": {
    "proposal_type": "cloud-migration",
    "audience": ["executive", "technical"],
    "stage": "final-proposal",
    "goals": [
      "explain target architecture",
      "show migration approach"
    ],
    "customer_priorities": ["security", "AWS"]
  },
  "selection": {
    "mode": "auto",
    "preferred_types": [],
    "excluded_types": [],
    "max_visuals": 2
  },
  "request": {
    "intent": "Create the visuals needed for an executive proposal",
    "language": "en"
  },
  "render": {
    "format": "png",
    "delivery": "base64",
    "failure_policy": "best_effort",
    "style_preset": "professional-light-v1"
  }
}
```

Rules:

- at least one textual or structured source must be present;
- `selection.max_visuals` defaults to 2 and is capped at 2 in the initial vertical slice;
- `selection.mode: "auto"` lets the planner choose from enabled types;
- `selection.mode: "recommend"` returns ranked decisions without rendering;
- `selection.mode: "explicit"` requires an explicit `types[]` list;
- `recommend` is valid only for `/v1/visuals/plan`; `/render` accepts `auto`, `explicit`, or a previously issued plan token;
- `preferred_types` influence ranking but cannot bypass evidence or renderer checks;
- `excluded_types` are hard exclusions;
- input byte size, field lengths, and collection sizes are bounded;
- URLs or external files are not fetched in the first version;
- untrusted source text is treated as data, not as planner instructions.
- `structured_data.timeline` is required for a renderable MVP Gantt; prose is not authoritative for dates or dependencies;
- arbitrary style prompts are rejected; MVP permits only server-owned style presets.

### 4.4 Context-based visual selection

Selection uses four inputs:

1. proposal and architecture source;
2. canonical structured facts;
3. request context: proposal type, audience, stage, goals, and customer priorities;
4. server capabilities: enabled types, renderer availability, limits, and cost policy.

Context fields are optional. The planner may infer missing qualitative context from the source, but inferred values must be marked as inference and may not become authoritative business facts.

The planner first returns a structured `ProposalProfile`, then evaluates the enabled diagram catalog:

```ts
type ProposalProfile = {
  proposalType?: string;
  audiences: Array<"executive" | "business" | "technical" | "mixed">;
  themes: string[];
  goals: string[];
  availableFactClasses: string[];
  inferredFields: string[];
};

type CandidateDecision = {
  type: VisualType;
  decision: "selected" | "omitted" | "blocked";
  purpose?: string;
  relevance: number;
  evidenceCoverage: number;
  audienceFit: string[];
  reasonCodes: string[];
};
```

The AI proposes semantic relevance and purpose. The server makes the final eligibility decision:

```text
semantic relevance
AND sufficient evidence
AND audience fit
AND enabled compatible renderer
AND non-redundancy
AND request cost/complexity budget
```

Minimum eligibility rules:

| Type | Required context/evidence |
|---|---|
| `architecture-overview` | Several architectural concepts and a need for high-level explanation |
| `architecture-details` | Structured component/interface IDs and exact relationships |
| `cloud-architecture` | Structured provider resources, scopes/regions or network/security boundaries |
| `architecture-c4` | Structured C4 level, element kinds, containment, and relationships |
| `gantt` | Structured tasks, dates, milestones, and dependencies |

A semantically useful but unsupported candidate is returned as `blocked`, for example `STRUCTURED_TIMELINE_REQUIRED`; it is never rendered using invented data.

Portfolio rules prevent redundant output in `auto` and `recommend` modes:

- select at most one high-level architecture overview;
- omit a C4 Context view when it communicates the same message as the selected overview to the same audience;
- every selected diagram must answer a distinct proposal question;
- prefer the smallest set that covers the request goals;
- a valid result may contain zero selected diagrams.

In `explicit` mode, requested types are not removed by automatic non-redundancy ranking. They are rendered when their type-specific evidence and renderer requirements are satisfied.

The initial implementation performs profiling, candidate selection, and type-specific planning in one structured AI call. Split profiling and selection into separate calls only if evaluation shows a measurable quality benefit or the profile must be reused.

## 5. Typed VisualArtifactPlan

The planner output must be validated with Zod/JSON Schema before any renderer is called.

```ts
type VisualArtifactPlan = {
  version: "1";
  proposalProfile: ProposalProfile;
  candidates: CandidateDecision[];
  requestSummary: string;
  artifacts: ArtifactPlan[];
  warnings: string[];
};
```

The full candidate list is returned in `recommend`, debug, or `include_plan` mode. Normal render responses return only selected decisions, blocked reason codes, and the plan summary.

Each artifact has a common envelope:

```ts
type ArtifactPlan = {
  id: string;
  type: VisualType;
  title: string;
  purpose: string;
  audience: "executive" | "business" | "technical" | "mixed";
  fidelityClass: "conceptual" | "structural_exact" | "data_exact";
  required: boolean;
  dependsOn: string[];
  content: TypeSpecificContent;
  presentation: PresentationSpec;
};
```

`ArtifactPlan` is implemented as a real discriminated union keyed by `type`; exact evidence references live next to the factual fields they support. Validation policies are server-owned per type and are not generated by the planner.

Conceptual and data-exact foundation types:

- `architecture-overview`;
- `gantt`.

Structurally exact types enabled in the completed implementation:

- `architecture-details`;
- `cloud-architecture`;
- `architecture-c4`.

No other visual type is part of the current endpoint scope. Adding one requires a separately reviewed schema, renderer, evidence policy, evaluation set, and API capability version.

Do not use a universal `nodes[]/edges[]` schema for all types. Define a discriminated content schema per visual type.

Examples:

- architecture overview: semantic groups, essential components, main relationships, audience emphasis;
- architecture details: stable component IDs, interfaces, protocols, data stores, trust boundaries, and exact relationships;
- cloud architecture: provider, accounts/subscriptions/projects, regions, networks, managed services, resources, security boundaries, and exact connections;
- C4: view level (`context`, `container`, or `component`), people, software systems, containers/components, boundaries, technologies, and relationships;
- Gantt: tasks, stable IDs, start/end dates, dependencies, milestones, groups;

## 6. Source truth and evidence rules

The planner controls selection, hierarchy, emphasis, grouping, and wording. It does not control factual truth.

Source precedence in the target architecture:

1. `structured_data` for component/resource IDs, hierarchy, relationships, protocols, cloud provider metadata, dates, milestones, and dependencies;
2. explicitly labeled tables or structured blocks in the supplied source;
3. prose for qualitative concepts and explanatory labels;
4. planner inference only for visual grouping or presentation, never for missing business facts.

Before the planner call, the server canonicalizes structured input and assigns fact IDs. The planner may reference those IDs but may not create paths or hashes. Every exact datum in a deterministic artifact carries a server-verifiable `EvidenceRef`, for example:

```ts
type EvidenceRef = {
  factId: string;
  sourceId: "structured_data";
  canonicalPath: string;
  sourceDigest: string;
  valueDigest: string;
};
```

In MVP, exact dates and dependencies may come only from structured data. For structurally exact architecture types, component/resource IDs, hierarchy, and relationships must also come from structured data. Authoritative exact-fact extraction from prose is a later, separately evaluated ingestion capability.

If required exact data is missing or contradictory:

- the planner must emit a warning;
- it must omit the affected visual or produce a clearly incomplete plan;
- it must not invent a date, amount, dependency, percentage, or system component.

## 7. Endpoint-specific planner

Create an endpoint-owned service, for example:

```text
server/services/endpointVisualPlanner.js
server/services/endpointVisualSchemas.js
server/prompts/endpointVisualPlanner.v1.js
```

Do not use the database-backed system `callAgent` path. Use a dedicated OpenAI client invocation with structured output and an explicit prompt version.

Planner instructions must require it to:

- first identify decision-relevant visual candidates;
- avoid decorative or redundant visuals;
- select at most `max_visuals`;
- prefer one strong overview over several overlapping diagrams;
- use deterministic visual types whenever exact dates or numbers matter;
- use image generation only for conceptual `architecture-overview`;
- select structural fidelity for `architecture-details`, `cloud-architecture`, and `architecture-c4`;
- preserve identifiers and terminology from the source;
- return only the typed plan;
- treat source content as untrusted data and ignore instructions embedded in it;
- explain omissions and uncertainties in plan fields;
- never place secrets, credentials, personal data, or internal prompt text into artifacts.

Prompt-injection resistance must not rely on that instruction alone:

- place control instructions and untrusted source in separate message sections with explicit delimiters;
- allowlist plan fields and visual types;
- enforce per-field and collection limits before a provider call;
- post-validate planner claims against server-owned fact IDs;
- never copy source-authored instructions into a renderer prompt;
- maintain an adversarial evaluation corpus.

Recommended model settings:

- structured response format;
- low temperature;
- fixed prompt version in telemetry;
- one planner call per source request;
- no automatic recursive planning loop.

## 8. Renderer registry

Introduce an endpoint-owned registry:

```ts
type Renderer = {
  supports(plan: ArtifactPlan): boolean;
  render(plan: ArtifactPlan, options: RenderOptions): Promise<RenderedArtifact>;
  validate?(artifact: RenderedArtifact, plan: ArtifactPlan): Promise<ValidationResult>;
};
```

Routing:

| Visual type | Default renderer | Reason |
|---|---|---|
| Conceptual architecture overview | OpenAI image renderer | Benefits from composition and visual hierarchy |
| Architecture details | Deterministic graph auto-layout renderer | Components, interfaces, and relationships must remain exact |
| Cloud architecture | Deterministic graph auto-layout plus server-owned cloud icon library | Resources, boundaries, regions, and connections must remain exact |
| C4 architecture | Deterministic C4-aware auto-layout renderer | C4 levels, nesting, identities, and relationships must remain exact |
| Gantt | Deterministic timeline renderer | Dates and dependencies must be exact |

The planner selects visual type and fidelity class, never an executable renderer ID. The server resolves them through an allowlisted, versioned compatibility registry. A planner cannot route a Gantt chart to an image model or lower its validation policy.

### 8.1 Architecture overview image renderer

Build the image prompt from a validated architecture plan rather than raw proposal text or serialized request JSON.

The prompt should contain:

- purpose and audience;
- mandatory components and relationships;
- grouping and hierarchy;
- required labels and terms;
- visual style constraints;
- explicit prohibitions against adding or removing systems;
- a compact machine-generated checklist of mandatory facts.

The renderer may improve composition, but it may not reinterpret the plan.

### 8.2 Structurally exact architecture renderers

`architecture-details`, `cloud-architecture`, and `architecture-c4` use deterministic auto-layout. They share a low-level graph/layout foundation where practical, but keep separate type schemas and validation:

- details validate component/interface IDs, protocols, trust boundaries, and edges;
- cloud validates provider resources, scopes, regions, network/security boundaries, and icon mapping;
- C4 validates the requested level, element kinds, nested boundaries, technologies, and permitted relationships.

The cloud renderer may use only server-owned, versioned, license-reviewed icon packs. Unknown services receive a neutral labeled resource shape; the planner must not invent a closest-looking provider service.

### 8.3 Deterministic Gantt renderer

Use layout/chart libraries for exact-data artifacts. Do not maintain hand-authored node coordinates as the primary layout mechanism.

Candidate implementation directions to validate in a short spike:

- graph auto-layout for flows and architecture fallbacks;
- a real runtime Gantt/timeline dependency or a purpose-built SVG renderer;
- a C4-capable layout approach with explicit boundary nesting;
- server-owned and license-reviewed AWS/Azure/GCP icon assets with neutral fallback icons;
- SVG composition plus `@resvg/resvg-js` only as the final rasterization step.

The spike must compare output quality, license, maintenance activity, headless rendering behavior, bundle/runtime cost, and support for fonts and long labels.

The repository's Gantt-related coding skill is documentation, not a runtime renderer, and must not be treated as an installed rendering dependency.

## 9. Quality assurance

QA has two layers.

### 9.1 Plan validation

Always run:

- schema validation;
- renderer/type compatibility;
- uniqueness and referential integrity of IDs;
- graph dependency and cycle checks where applicable;
- C4 level, containment, and relationship validation;
- cloud provider/resource/icon allowlists and boundary validation;
- date ordering and dependency checks for Gantt;
- evidence coverage for exact facts;
- maximum visual and complexity limits.

Invalid plans fail before billable rendering begins.

### 9.2 Render validation

Deterministic artifacts:

- compare rendered labels/data against the plan;
- check clipping, overflow, empty bounds, and image dimensions;
- verify totals and axes from source values;
- create a render checksum tied to the normalized plan.

Image artifacts:

- retain structural checks on the input plan;
- optionally run one bounded advisory vision QA pass to estimate mandatory-component recall, forbidden additions, and legibility;
- return warnings when non-critical presentation issues remain;
- do not use vision QA as the sole fail-closed source of truth.

Vision QA and automatic regeneration are disabled in MVP. They may be enabled behind a feature flag only after precision/recall, latency, cost, and error-class-specific retry value are measured on a labeled set. Exact text requirements must use a deterministic text layer or must not be advertised as guaranteed.

## 10. Response contract

Source-driven and plan-driven responses:

```json
{
  "request_id": "...",
  "plan": {
    "plan_token": "...",
    "version": "1",
    "prompt_version": "endpoint-visual-planner-v1",
    "source_digest": "...",
    "renderable": true,
    "expires_at": "..."
  },
  "status": "complete",
  "artifacts": [
    {
      "id": "...",
      "type": "gantt",
      "mime_type": "image/png",
      "image_base64": "...",
      "width": 1600,
      "height": 900,
      "renderer": "deterministic-gantt-v1",
      "status": "complete",
      "warnings": [],
      "validation": {
        "status": "passed"
      }
    }
  ],
  "errors": [],
  "warnings": [],
  "usage": {
    "planner_calls": 1,
    "image_generation_calls": 0,
    "qa_calls": 0
  }
}
```

The full plan may be returned only when requested with `include_plan: true`; otherwise return the opaque plan token, version, and summary to keep payloads smaller.

Legacy requests retain their current status codes and response body. New fields must not be added to the legacy response unless they are optional and verified not to break clients.

Delivery options:

- MVP: base64 in JSON, matching current behavior;
- follow-up: short-lived object-storage URL for large or multi-artifact responses;
- enforce a total response-size limit and reject plans that cannot fit the selected delivery mode.

## 11. Security, cost, and operational controls

The endpoint is intentionally public and unauthenticated. No API key, bearer identity, user session, or authorization check is required. The following abuse and cost controls are therefore prerequisites rather than substitutes for authentication:

- add per-IP, global, and route-specific rate limits;
- cap global and per-process concurrent planner/image calls;
- define per-request planner, image, and QA call budgets;
- limit input size, artifact count, resolution, and total output bytes;
- enforce provider-side daily/hourly budget alarms and an emergency kill switch;
- redact source text and secrets from logs;
- retain hashes and structured metadata rather than full proposal content by default;
- set upstream timeouts and abort signals;
- propagate a request ID through planner, renderer, and QA;
- reject unknown renderer IDs and prompt versions;
- do not accept arbitrary callback URLs, file paths, HTML, or executable templates;
- document retention behavior for generated artifacts.
- require `Idempotency-Key` for billable render calls and cache the result for a defined TTL;
- scope idempotency by route plus normalized request digest, and optionally IP, rather than user identity;
- issue only signed/high-entropy, short-lived plan tokens and store only a token hash when server-side state is used;
- reject expired, modified, replay-policy-incompatible, or source-digest-mismatched plan tokens;
- classify or redact sensitive input before sending it to an external AI provider;
- define policy for confidential tender data, PII, and provider retention;
- retain no raw source by default unless an approved retention mode is explicitly selected.

Because there is no authenticated identity, per-customer quotas, revocation by user, and tenant-level audit guarantees are not available. This limitation must be documented. If IP/global controls do not keep abuse and spend within the agreed canary budget, public rollout must stop or the product decision to omit authentication must be revisited.

Telemetry should include:

- request mode and visual types;
- planner/renderer/prompt versions;
- latency by stage;
- token and image-generation usage;
- validation failures and regeneration reasons;
- artifact count and response size;
- provider errors, timeouts, and cancellation;
- no raw proposal content.

## 12. Failure model

Define stable endpoint error codes:

- `INVALID_REQUEST`;
- `SOURCE_TOO_LARGE`;
- `PLAN_INVALID`;
- `UNSUPPORTED_VISUAL_TYPE`;
- `RENDERER_UNAVAILABLE`;
- `RENDER_FAILED`;
- `QUALITY_CHECK_FAILED`;
- `BUDGET_EXCEEDED`;
- `RATE_LIMITED`.

Legacy errors remain unchanged. The uppercase envelope applies only to `/v1/visuals`.

MVP execution contract:

- plan creation is synchronous and makes at most one planner call;
- render is synchronous for at most two artifacts, with at most one image-model artifact;
- each request has one propagated deadline, upstream abort signals, bounded concurrency of two, and output/pixel limits;
- `failure_policy` is client-selected as `atomic` or `best_effort`, defaulting to `best_effort`;
- artifacts expose `required`, `dependsOn`, status, and per-artifact error;
- a best-effort response uses HTTP 200 with `complete`, `partial`, or `failed`; request-wide validation, rate-limit, budget, or provider-unavailability errors use HTTP errors;
- disconnect and timeout behavior must cancel pending work where supported;
- the same `Idempotency-Key` returns the stored outcome and causes no duplicate provider calls.

If canary p95 exceeds the agreed synchronous deadline or payload ceiling, asynchronous jobs (`202`, job ID, status/result endpoint) become a release blocker for wider rollout.

## 13. Implementation phases

### Phase 0 — contract and baseline (completed)

- Freeze golden requests and outputs for the current legacy endpoint.
- Decide the status of the uncommitted experimental strict renderer.
- Record current latency, cost, and failure rate on a small evaluation set.
- Finalize `/v1/visuals` request/response schemas and separate error codes.
- Define the endpoint/system isolation test.
- Confirm and document that `/v1/visuals` has no authentication or authorization middleware.
- Add dedicated IP/global limiters, concurrency caps, provider-spend alarms, request/output budgets, deadline propagation, redacted logging, idempotency storage, and an emergency kill switch before enabling a paid route.
- Make the Express app testable without coupling route tests to `listen()`.

Exit criteria:

- legacy contract is covered by tests;
- the new plan schema is reviewed;
- endpoint-only file boundaries are documented.
- unauthenticated requests work by contract while IP/global limits and budgets are enforced;
- duplicate idempotency keys cannot duplicate provider calls.

### Phase 1 — signed-plan dry run (completed)

- Implement request normalization and schemas.
- Canonicalize structured source into server-owned fact IDs and a source digest.
- Add the endpoint-specific structured-output planner.
- Add `POST /v1/visuals/plan`.
- Persist or sign opaque server-issued plan tokens with source/version binding and TTL.
- Add plan validation, evidence checks, layered prompt-injection controls, budgets, and telemetry.
- Do not render new artifact types yet.

Exit criteria:

- plans validate for architecture-overview and Gantt fixtures;
- missing/contradictory data creates warnings rather than invented facts;
- negative cases return a valid non-renderable empty plan;
- planning does not call system agents or modify system artifacts.

### Phase 2 — MVP vertical slice (completed)

- Route validated architecture plans to the OpenAI image renderer.
- Replace raw JSON prompt construction with plan-based prompt construction.
- Implement a real deterministic Gantt renderer selected by a dependency spike.
- Require structured timeline data and verify exact task IDs, dates, dependencies, and milestones.
- Add `POST /v1/visuals/render`, plan replay, idempotency, statuses, and failure policy.
- Keep vision QA and automatic image regeneration disabled.
- Keep the legacy route byte-for-byte compatible.

Exit criteria:

- architecture evaluation set improves against the endpoint baseline;
- Gantt data fidelity is 100% on the evaluation set;
- mandatory architecture components and terminology pass measurable thresholds;
- latency, cost, size, and call budgets are enforced.

### Phase 3 — execution hardening (core safeguards completed; production SLO observation remains operational)

- Evaluate synchronous p95 latency, response size, and memory on canary traffic.
- Add asynchronous multi-artifact jobs if synchronous gates are missed.
- Add cancellation, process-restart, concurrency, and provider-failure coverage.
- Add object-storage delivery only if measured payload size justifies it.
- Establish dashboards and alerts.

Exit criteria:

- the selected execution model meets its SLO;
- retries do not duplicate charges;
- rollback leaves `/v1/diagrams/render` unaffected.

### Phase 4 — complete the five-type catalog (completed)

- Add `architecture-details` with deterministic graph auto-layout.
- Add `cloud-architecture` with provider/resource validation and versioned cloud icon packs.
- Add `architecture-c4` with explicit C4 level and containment validation.
- Reuse a common graph/layout foundation without collapsing the three public schemas into one generic contract.
- Add structural-data and overflow validation for each type.
- Evaluate advisory vision QA separately; enable it only if labeled-set precision/recall and cost justify it.
- Publish migration and capability documentation.

Exit criteria:

- all five supported types have a documented schema, renderer, evaluation set, and rollout gate;
- no exact-data visual uses an image model;
- legacy behavior remains unchanged.

## 14. Test strategy

### Contract tests

- legacy request and response snapshots;
- `/v1/visuals/plan`, inline-source render, and server-issued-plan render;
- invalid mixed-mode requests;
- strict separation of legacy lowercase and new uppercase error envelopes;
- base64 delivery and response-size rejection.

### Planner tests

- structured output schema;
- visual selection and maximum count;
- `auto`, `recommend`, and `explicit` selection behavior;
- preferred/excluded-type constraints;
- proposal profile inference markers;
- candidate reason codes and server eligibility overrides;
- redundancy rules across overview and C4;
- no useful visual returns an empty plan;
- missing, contradictory, and malicious source text;
- exact facts always have evidence;
- stable prompt/model/version metadata.

Because LLM output is probabilistic, combine mocked contract tests with a versioned live evaluation suite. Do not assert byte-identical plans from live calls.

### Renderer tests

- one golden fixture per visual type;
- exact-value/property assertions before pixel comparisons;
- details: component/interface/protocol and relationship fidelity;
- cloud: resource identity, provider scope, boundary, connection, and icon/fallback fidelity;
- C4: view-level, element-kind, containment, technology, and relationship fidelity;
- layout overflow and clipping;
- Unicode and long labels;
- high-density graphs and timelines;
- deterministic output stability where promised.

### Integration tests

- source -> plan -> architecture/Gantt renderer -> response;
- server-issued plan skips planner;
- timeout, cancellation, provider failure, and retry budget;
- best-effort and atomic failure policies;
- idempotent retry, plan expiry, token tampering, and source-digest mismatch;
- route-level JSON parser `413`, nesting/array limits, and compressed-body policy;
- concurrency, client disconnect, and process-restart behavior;
- telemetry contains metadata but not source content;
- system routes and system generation remain untouched.

### Security tests

- prompt injection inside source markdown;
- oversized and deeply nested payloads;
- secret-like content is not logged;
- unknown renderer/prompt IDs;
- successful unauthenticated access plus IP/global rate-limit and budget rejection;
- malicious labels cannot inject SVG/HTML/script content.
- confidential/PII policy enforcement before provider calls;
- plan-token entropy, signature, expiry, and non-disclosure of source content.

## 15. Acceptance criteria

Functional:

- a source request can produce a validated zero-to-two-artifact plan;
- all five supported types use their intended renderer class;
- exact dates and numbers are reproduced without invention;
- a client can inspect a plan before rendering;
- a server-issued plan can be replayed semantically without another planner call;
- deterministic replay is stable, while AI image regeneration is explicitly non-deterministic;
- the legacy endpoint contract passes unchanged.

Quality:

- on a versioned evaluation set of at least 50 representative and negative inputs, visual-type selection agrees with the human rubric in at least 90% of cases;
- at least 85% of supported-case plans are accepted without edits;
- at least 95% of negative cases correctly return an empty plan, with zero fabricated exact business facts;
- architecture reaches at least 95% required component/relationship recall, zero invented critical external systems, and at least 90% human readability/usefulness pass rate;
- details/cloud/C4 deterministic outputs preserve 100% of structured element IDs, containment, and relationships;
- cloud fixtures contain zero provider-service substitutions and 100% valid icon-or-neutral-fallback mappings;
- C4 fixtures contain 100% valid element kinds and boundary nesting for the selected C4 level;
- Gantt has 100% equality for structured task IDs, dates, dependencies, and milestones;
- no clipped titles, legends, or mandatory labels in golden fixtures;
- no image regeneration in MVP;
- empty or redundant visuals are omitted.

Operational:

- per-request call and output budgets are enforced;
- 100% of requests remain unauthenticated by contract and are covered by IP/global rate limits and spend controls;
- replaying an `Idempotency-Key` creates zero duplicate provider calls;
- sampled logs contain zero raw source bodies or secrets; default source retention is none;
- stage latency and usage are observable;
- each new stage and renderer has an independent feature flag;
- disabling the new flow does not affect system Process/Chat generation.

Release-blocking SLOs to finalize numerically in Phase 0:

- suggested `/plan` p95 ceiling: 8 seconds;
- suggested deterministic Gantt p95 ceiling: 2 seconds server-side;
- suggested full architecture request p95 sync ceiling: 45 seconds;
- render failure rate at most 2%, excluding documented provider outage;
- average cost per accepted artifact within the Product-approved budget;
- canary of at least 100 requests with at least 90% useful successful artifacts, at most 5% partial/failed responses, and no severity-1 privacy/security issue.

## 16. Rollout and rollback

Feature flags:

- `ENDPOINT_VISUAL_PLANNER_ENABLED`;
- `ENDPOINT_ARCHITECTURE_PLAN_RENDERER_ENABLED`;
- `ENDPOINT_DETERMINISTIC_VISUALS_ENABLED`;
- `ENDPOINT_VISION_QA_ENABLED`.

Rollout:

1. internal dry-run planning;
2. public plan endpoint under strict global budget;
3. limited-percentage or time-windowed source rendering;
4. canary traffic under explicit spend and concurrency ceilings;
5. wider availability after quality/cost thresholds are met.

Rollback:

- disable a failing renderer without disabling plan creation;
- disable vision QA without changing plan/render contracts;
- disable source-driven modes while preserving legacy graph rendering;
- pin the last known-good planner prompt and schema version.

## 17. Decisions

Accepted for MVP:

1. Use `/v1/visuals`; freeze `/v1/diagrams/render`.
2. Support `best_effort` and `atomic`; default to `best_effort` with per-artifact status.
3. Require no authentication or authorization; protect the public endpoint with IP/global limits, concurrency caps, spend alarms, and a kill switch.
4. Use synchronous base64 delivery for at most two artifacts and one image artifact; async becomes mandatory if canary SLOs fail.
5. Exact Gantt data and structurally exact architecture topology must be structured; prose extraction is not authoritative.
6. Use signed/high-entropy server-issued plan tokens bound to source/version and TTL; no trusted raw client plans.
7. Use fixed server-owned style presets; postpone arbitrary style prompts and brand kits.
8. Vision QA and automatic regeneration are not part of MVP.
9. Support `auto`, `recommend`, and `explicit` selection modes.
10. Base automatic selection on proposal source, structured facts, audience, stage, goals, customer priorities, enabled capabilities, evidence coverage, non-redundancy, and cost limits.

Operational values to tune from deployment telemetry:

1. Exact latency, cost, input-byte, output-byte, pixel, and quota limits.
2. Data classification, confidential tender/PII policy, provider retention, and artifact retention.
3. MVP language: default recommendation is English-only claims; deterministic Unicode support and every additional image-text language require separate evaluation gates.
4. Evaluation ownership: Product owns usefulness, Architecture owns structural fidelity, domain owners approve timeline fixtures, and Engineering owns operational SLOs.
5. Final runtime Gantt renderer after the dependency spike.
6. Disposition of the current uncommitted experimental strict renderer.

## 18. Deliverables

- endpoint-only ADR covering planner/render separation and system isolation;
- versioned request, plan, response, and error schemas;
- endpoint-specific planner prompt and evaluation set;
- renderer registry and renderer compatibility map;
- fixtures for overview, details, cloud, C4, and Gantt, delivered alongside each type's rollout;
- legacy compatibility test suite;
- security/cost/observability controls;
- migration guide with plan-only, inline-source render, and server-issued-plan examples.

## 19. Multi-agent review decisions

The draft was reviewed independently by a Solution Architect, an adversarial Critic, and a Product Owner.

Accepted:

- split the five-type product catalog from an executable two-type initial vertical slice;
- create `/v1/visuals` instead of expanding the legacy handler;
- move limits, quotas, privacy, timeouts, idempotency, and abuse controls before the first paid endpoint;
- replace raw replayable plans with signed/high-entropy server-issued plan tokens;
- replace LLM-created quote hashes with server-created fact IDs and canonical digests;
- let the planner select fidelity class while the server selects renderer/version;
- distinguish conceptual, structural-exact, and data-exact rendering;
- make vision QA advisory and remove regeneration from MVP;
- define synchronous caps and an objective trigger for async jobs;
- make Gantt depend on structured timeline data and a real runtime renderer;
- make acceptance, latency, cost, security, and rollout gates measurable.
- add context-based `auto`, `recommend`, and `explicit` selection with server-side eligibility and redundancy rules.

Superseded by explicit product decision:

- an earlier draft assumed identity-based access and plan ownership; the explicit product decision supersedes that assumption, so the endpoint uses possession-based short-lived plan tokens plus IP/global abuse and spend controls.

Deferred:

- visual types outside the agreed five-type catalog, object-storage delivery, brand kits, authoritative prose fact extraction, plan-editing UI, vision QA, and automatic regeneration.

Rejected:

- modifying system Process/Chat generation as part of this initiative;
- mixing legacy and source/plan modes in one handler;
- trusting client-supplied renderer or validation rules;
- treating the current manual-coordinate strict renderer or a coding skill as the target Gantt/layout engine;
- claiming byte-identical replay for AI-generated images.
