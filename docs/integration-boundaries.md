# Integration Boundaries

AgentPulse observes agent activity. It does not attempt to control every agent
or promise lifecycle precision that a platform does not expose.

## Integration levels

### Precise integration

Uses a documented platform hook, notification protocol, or plugin API that
provides explicit lifecycle events. Precision is limited to the guarantees of
that public interface.

No precise platform adapter ships in v0.1.

### Best-effort integration

Infers activity through supported but incomplete observation points such as a
wrapper command, process watcher, terminal watcher, or documented log stream.
These integrations can miss activity that occurs outside their observation
boundary.

The v0.1 generic CLI wrapper is best-effort. It reports only the lifecycle of
the command it starts:

- successful spawn: `running`;
- exit code zero: `completed`;
- non-zero exit code: `failed`;
- terminating signal: `failed`;
- spawn error: `failed`.

It does not inspect an agent's internal tools, permission prompts, or model
state.

### Manual integration

The user or another program explicitly calls `agentpulse emit`. AgentPulse
validates and aggregates the event but cannot verify the caller's interpretation
of platform state.

## Prohibited foundations

Core functionality must not depend on:

- private API reverse engineering;
- binary patching or process injection;
- window OCR or screen scraping;
- simulated clicks or keystrokes;
- undocumented desktop application internals.

Process, log, terminal, wrapper, and system-notification observation may be
offered only as clearly labeled best-effort integrations.

## Adapter contract

An adapter translates its source payload to `AgentEventInput`. It may use a raw
platform payload while translating, but `rawEvent` is transient in v0.1.
Adapters must not persist it or depend on downstream raw-payload access.

Adapters must not:

- update the session store directly;
- send desktop or console notifications directly;
- implement UI, sound, or hardware output;
- claim support for lifecycle events they cannot observe.

Source packages are added only when an implementation exists and is tested.
Claude Code, Codex, OpenCode, Cursor, VS Code agents, and desktop applications
are roadmap items rather than supported v0.1 integrations.
