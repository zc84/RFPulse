# ADR 0001: AI-native runtime boundary

Status: Accepted

The planner owns semantic decisions: requirement interpretation, capability selection, task dependencies, knowledge selection, proposal structure, artifact intent, and repair tasks. The runtime owns safety invariants: authentication, schema validation, DAG validation, persistence, locks, cancellation, retry and budget limits, deterministic calculations, and artifact rendering.

RFPulse remains a modular Node.js/PostgreSQL monolith. The v2 runtime is selected through the `ai_runtime_v2_enabled` setting and the legacy runtime remains available as a rollback path during cutover. Shadow mode is controlled by `ai_runtime_v2_shadow_mode`.
