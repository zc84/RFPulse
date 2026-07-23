I mapped the current implementation and I’m ready to proceed with a concrete refactor plan.

### What I found
- In `server/routes/ai.js`, `POST /chat` currently gates diagram flow with `detectDiagramRequest(content)` first.
- Only when that heuristic matches do we call `coordinatorChatArtifactStep(...)`.
- Diagram generation itself is centralized in `executeDiagramGenerationForMarkdown(...)`, which is good and reusable.
- Normal chat fallback still calls `chat-agent` directly.
- Existing tests in `server/tests/aiFlow.test.js` validate:
  - `detectDiagramRequest`
  - `buildChatDiagramSourceMarkdown`
  - `buildDiagramChatResponseMessage`
  - plus broader coordinator routing normalization in orchestrator tests.

### Goal
Implement a **coordinator-routed diagram flow** where coordinator artifact routing is the decision authority, and route logic uses a shared execution path for diagram generation.

### Deliverables
1. **Route refactor (`server/routes/ai.js`)**
   - Introduce a shared chat-artifact routing branch that invokes coordinator routing in a consistent way.
   - Keep `executeDiagramGenerationForMarkdown(...)` as the single execution path for artifact generation.
   - Reduce/retire direct heuristic gating (`detectDiagramRequest`) from the control path so coordinator decides action (`generate_diagrams` vs `chat_reply`).
2. **Orchestrator alignment (`server/services/aiOrchestrator.js`)**
   - Ensure fallback behavior remains safe (if routing fails ⇒ `chat_reply`).
   - Reuse existing decision normalization (`normalizeChatArtifactDecision`) and keep inferred diagram-type fallback.
3. **Tests update (`server/tests/aiFlow.test.js` + any new targeted tests)**
   - Update/remove tests tied to legacy pre-gate behavior if no longer authoritative.
   - Add/adjust tests to assert coordinator-routed behavior expectations and unchanged helpers:
     - decision normalization behavior stays deterministic
     - diagram source/message helpers still correct
     - non-diagram chat still falls through properly.

### Success criteria
- `POST /chat` uses coordinator-routed artifact decision as the primary path for diagram generation.
- Diagram generation still runs through the existing shared execution function.
- Chat fallback behavior remains unchanged for normal replies.
- Tests pass (`server/tests/aiFlow.test.js` and related runtime tests as needed).

### Constraints I’ll preserve
- No schema contract break for `coordinatorChatArtifactDecisionSchema`.
- No changes to persisted document behavior for generated artifacts.
- Keep cancellation/abort handling intact (`throwIfAborted`, operation registration).
- Keep backward-safe fallback when coordinator routing fails.

If this plan looks good, please **toggle to Act mode** and I’ll implement the refactor and test updates now.