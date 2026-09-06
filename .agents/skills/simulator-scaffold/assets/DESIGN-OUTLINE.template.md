# <Simulator name> design outline

## Context and constraints

<References to SPEC requirement IDs and repository constraints.>

## Layer boundaries

```text
domain/  Physical model and deterministic functions
app/     Validation, state, and presentation data
ui/      Components, controls, and accessibility
scene/   Visualization and rendering
```

## Public contracts

| Contract | Inputs and units | Outputs and units | Errors and boundaries |
|---|---|---|---|
| <name> | <value> | <value> | <behavior> |

## Physical and numerical decisions

- Sources:
- Model and validity range:
- Approximation and tolerance:
- Independent oracle strategy:
- Reproducibility:

## Verification strategy

- Unit and property tests:
- UI behavior tests:
- Browser and human acceptance:

## Open decisions

- <Decision, owner, options, recommendation>
