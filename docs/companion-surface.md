# Multi-Agent Companion Surface

The AgentPulse companion is a small, local Electron window for monitoring
multiple coding-agent sessions while working in other applications. It is a
compact status surface, not a replacement for the browser dashboard and not a
pet-first interface.

## Run the prototype

Install and build the workspace:

```bash
pnpm install
pnpm build
```

Start the daemon with its read-only dashboard API in one terminal:

```bash
node packages/cli/dist/index.js daemon --dashboard --notifier none
```

Start the companion in another terminal:

```bash
pnpm companion:dev
```

The companion polls `http://127.0.0.1:3768/dashboard/api` every two seconds.
It honors `AGENTPULSE_HOST` only when the value is `127.0.0.1` or `::1`, and
honors a valid `AGENTPULSE_PORT`. The browser dashboard does not need to be
open, and the companion never opens it automatically.

If the daemon is running without `--dashboard`, the companion reports that its
API is unavailable and shows the required startup flag.

## Compact and expanded modes

Compact mode is a bottom-right command strip showing:

- the global status summary;
- running, action-needed, and failed counts;
- the highest-priority current session.

Expanded mode adds a sorted list of current sessions. Each row shows only
allowlisted dashboard presentation fields: agent source, surface, normalized
status, task title or workspace, safe activity label, event age, and a short
action or staleness hint.

The existing `/dashboard` page remains the fallback for detailed inspection,
setup snippets, doctor results, and complete current-session cards.

## State priority

Daemon connectivity is separate from session state:

1. daemon unreachable: **Daemon offline**;
2. dashboard endpoint or response unavailable: **Companion API unavailable**;
3. reachable dashboard API: derive the summary from current sessions.

Session priority is:

1. permission needed;
2. user input needed;
3. failed or rate limited;
4. stale running or tool-use session;
5. running or using a tool;
6. completed within five minutes;
7. idle or older completed session;
8. unknown.

Equal-priority sessions are ordered by their newest event. Global session
summaries use the same ordering: **Needs you**, failure, **Possibly stale**,
`n running`, **Recently completed**, then **All quiet**.

Staleness remains a presentation heuristic. The companion does not inspect
agent processes, recover sessions, or determine whether an adapter is truly
connected.

## Window and tray behavior

The window is frameless, draggable, non-resizable, always on top by default,
and positioned near the primary display's bottom-right work area. It can
expand, collapse, and hide.

AgentPulse attempts to create a tray menu with Show/Hide, Always on Top, Open
Dashboard, and Quit. Tray support varies by Linux desktop environment. If tray
creation is unavailable, the floating window still starts and hide/close exits
cleanly instead of leaving an inaccessible background process.

## Security and privacy

The Electron renderer has Node integration disabled, context isolation and
sandboxing enabled, navigation blocked, and a restrictive Content Security
Policy. It loads local files only.

The main process validates `/dashboard/api`, projects it into a companion-only
view model, and sends only that view model across the preload bridge. The
renderer never receives raw API responses, `lastMessage`, error bodies,
prompts, transcripts, tool input/output, hook bodies, or platform payloads.

## Prototype limits

- The daemon must be started separately with `--dashboard`.
- State is in memory only and disappears when the daemon stops.
- There is no autostart, installer, release artifact, or persistence.
- The companion displays permission needs but cannot approve or deny them.
- Tray availability and visible window behavior require verification on a
  desktop session; headless environments can validate only build and pure
  state logic.
