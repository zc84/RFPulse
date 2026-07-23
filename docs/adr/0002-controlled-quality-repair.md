# ADR 0002: Controlled quality repair

Status: Accepted

Quality findings are persisted by gate and converted into targeted repair tasks. A run may perform at most two repair cycles, after which the result is surfaced with its unresolved findings. The final independent Validator audit remains separate from the repair loop.
