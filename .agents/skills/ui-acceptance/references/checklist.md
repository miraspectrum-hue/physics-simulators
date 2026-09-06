# Human UI acceptance checklist

Select only items affected by the task.

- Primary success path and visible result
- Initial, loading, empty, disabled, and error states
- Minimum and maximum supported input values
- Keyboard-only operation, focus order, and visible focus
- Accessible name, role, state, instructions, and error association
- Text clipping, overflow, and responsive behavior at agreed viewports
- Color contrast and meaning that does not rely on color alone
- Browser console errors and unhandled promise rejections
- Animation, resizing, parameter controls, and reset behavior
- Canvas/WebGL fallback and unsupported-device messaging when applicable

Report:

```text
Task:
Build/commit:
URL:
Browser and viewport:
Automated checks:
Steps:
Expected result:
Known limitations:
Human result: pending
```

Only the human may change `Human result` from `pending` to `accepted` or
`rejected`.
