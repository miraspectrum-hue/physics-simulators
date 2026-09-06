---
name: physics-validation
description: Design or independently validate physical equations, constants, units, approximations, numerical algorithms, expected values, and tolerances for simulator work. Use when physical behavior is created or reviewed; do not use for purely visual UI work.
---

# Physics validation

Treat an AI-generated formula or expected value as a hypothesis, not an oracle.
Read [references/checklist.md](references/checklist.md) and apply the sections
relevant to the assigned physical model.

For design and test-case work, record:

- authoritative or primary sources with enough detail to locate them again;
- symbol definitions, units, coordinate conventions, sign conventions, and
  validity range;
- assumptions, approximations, singularities, and boundary behavior;
- an independent oracle strategy and tolerance rationale;
- deterministic seeds and reproducibility requirements for stochastic models.

For review, independently recompute representative values and dimensional
relationships. Do not accept an expected value merely because it matches the
implementation. If no adequate source or independent check is available, return
`needs-human` with the uncertainty and options instead of approving.
