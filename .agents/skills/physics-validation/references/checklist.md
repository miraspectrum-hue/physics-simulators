# Physics and numerical validation checklist

## Model definition

- Define every symbol and unit.
- State coordinate system, orientation, and sign conventions.
- State the model's validity range and excluded regimes.
- Identify approximations and expected error or uncertainty.
- Cite the source of equations and constants; record edition, section, or URL
  where practical.

## Independent checks

Use at least two applicable methods:

- analytic value at a known or limiting case;
- dimensional analysis;
- conservation, monotonicity, symmetry, reversibility, or invariance property;
- independently written high-precision or reference calculation;
- comparison with published data within its uncertainty;
- metamorphic relation between transformed inputs and outputs.

Expected values must not be generated only by importing or reusing the function
under test.

## Numerical behavior

- Define finite input domain and behavior for invalid, NaN, and infinite values.
- Test minima, maxima, critical points, and values immediately around boundaries.
- Explain absolute versus relative tolerance and scale it to the expected value.
- Control iteration limits, convergence criteria, and non-convergence behavior.
- Fix random seeds and record algorithm/version when stochastic behavior exists.

## Review outcome

Reject approval when a source cannot be traced, units are inconsistent, the
oracle shares the implementation path, tolerance hides meaningful error, or the
model is used outside its stated validity range.
