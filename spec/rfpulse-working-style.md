---
name: rfpulse-working-style
description: "How the RFPulse owner wants Claude to work — plan first, ask questions, then implement"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc8bec01-ba0c-4b11-9437-fa2cae1d3d80
---

The user wants a **plan-first workflow**: understand scope → propose improvements → create an implementation plan → ask clarifying questions → only then implement. They are comfortable delegating prioritization ("up to you") once direction questions are answered.

**Why:** They act as product owner and want to steer direction (trajectory, AI focus, security trade-offs) but not micro-manage execution.

**How to apply:** For substantial work, present an assessment and plan with targeted questions before writing code. Respect explicit exclusions (e.g. keep README credentials) even when they conflict with standard best practice — note the trade-off once, don't re-litigate. See [[rfpulse-product-direction]].
