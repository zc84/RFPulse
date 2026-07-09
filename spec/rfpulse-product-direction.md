---
name: rfpulse-product-direction
description: RFPulse trajectory and owner decisions from the July 2026 improvement planning session
metadata: 
  node_type: memory
  type: project
  originSessionId: dc8bec01-ba0c-4b11-9437-fa2cae1d3d80
---

RFPulse is an **internal tool for a small Andersen presales team** — do not invest in multi-tenancy, SSO, i18n, or horizontal scaling. Single Render dyno + Postgres is the accepted deployment model.

Owner decisions (2026-07-09):
- The superadmin credentials **must remain documented in the README** — do not remove them or move them to env-only bootstrap.
- Git history stays as-is: no purging of the committed client tender DOCX in `test/` or old secrets.
- AI layer priority is **smarter routing** (make the coordinator's plan actually drive execution, conditional specialists, configurable pipelines) — not cost tracking, multi-provider, or token streaming.
- Batch prioritization was delegated ("up to you"): security hardening first, then smarter routing, then engineering foundation, then product quick wins.

Related: [[rfpulse-working-style]]
