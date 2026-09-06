#!/usr/bin/env node

let rawInput = '';
for await (const chunk of process.stdin) {
  rawInput += chunk;
}

try {
  const input = JSON.parse(rawInput || '{}');
  const rawCommand = input.tool_input?.command ?? input.tool_input?.cmd ?? '';
  const command = Array.isArray(rawCommand) ? rawCommand.join('\n') : String(rawCommand);

  const gitAtCommandBoundary = '(?:^|[;|&]\\s*|\\r?\\n\\s*)git(?:\\.exe)?\\s+';
  const rules = [
    {
      pattern: new RegExp(`${gitAtCommandBoundary}commit\\b`, 'i'),
      reason: 'Direct git commit is blocked. Use the commit-proposal workflow and scripts/commit-approved.mjs after explicit human approval.',
    },
    {
      pattern: new RegExp(`${gitAtCommandBoundary}push\\b`, 'i'),
      reason: 'git push is outside the commit workflow and requires a separate explicit user request.',
    },
    {
      pattern: new RegExp(`${gitAtCommandBoundary}add\\s+(?:--\\s+)?(?:\\.|-A|--all)(?:\\s|$)`, 'i'),
      reason: 'Broad staging is blocked. Stage explicit task-owned paths with git add -- <path>...',
    },
    {
      pattern: new RegExp(`${gitAtCommandBoundary}reset\\s+--hard\\b`, 'i'),
      reason: 'Destructive git reset --hard is blocked.',
    },
    {
      pattern: new RegExp(`${gitAtCommandBoundary}clean\\s+-[^\\s]*f`, 'i'),
      reason: 'Destructive git clean is blocked.',
    },
  ];

  const violated = rules.find((rule) => rule.pattern.test(command));
  if (violated) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: violated.reason,
      },
    }));
  }
} catch (error) {
  process.stderr.write(`Git guard could not parse hook input: ${error.message}\n`);
  process.exitCode = 2;
}
