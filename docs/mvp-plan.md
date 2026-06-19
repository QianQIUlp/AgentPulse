# AgentPulse v0.1 Plan

## Goal

Deliver the smallest local event-to-session loop:

1. start a local daemon;
2. submit a normalized or manual activity event;
3. inspect all sessions observed during that daemon process;
4. wrap a command and report running, completed, or failed state;
5. emit console notifications for actionable states.

## Included

- pnpm TypeScript monorepo targeting Node.js 22;
- validated event and session models;
- distinct external `sessionId` and internal `sessionKey`;
- process-lifetime in-memory session aggregation;
- `POST /events` and `GET /sessions`;
- `agentpulse daemon`, `emit`, `status`, and `run`;
- console notifier policy;
- generic CLI best-effort adapter;
- unit, integration, and end-to-end validation.

## Excluded

- desktop, tray, floating window, and IDE interfaces;
- Claude Code, Codex, OpenCode, or other platform-specific adapters;
- persistent storage and daemon restart recovery;
- session limits, `maxSessions`, `retentionMs`, or garbage collection;
- SSE, WebSocket, webhooks, mobile push, and hardware output;
- OS notification and sound;
- raw event storage or debug output;
- authentication for non-loopback access.

## Acceptance criteria

- `agentpulse daemon` starts the local service.
- `agentpulse emit` sends a valid event without exposing `rawEvent`.
- `agentpulse status` lists active and terminal sessions retained in memory.
- `agentpulse run --source generic-cli -- <command>` reports `running`, then
  `completed` or `failed`, and preserves the wrapped command's exit result.
- Failed command messages contain command, duration, and exit code or signal.
- A daemon connection failure warns but does not prevent a wrapped command.
- Formatting, strict type checks, tests, and build all pass in CI.

## Delivery sequence

Implementation proceeds as small commits: tooling, documentation, core,
notifier, daemon, generic adapter, CLI, then setup and verification guidance.
No commit is made until formatting, type checking, and tests pass for that
stage.
