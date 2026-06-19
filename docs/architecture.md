# AgentPulse Architecture

AgentPulse is a local activity hub for AI coding agents. Integrations observe
platform activity, convert it to one event model, and send it to a local daemon.
The daemon owns session aggregation and notification dispatch.

## Data flow

```text
agent hook / plugin / wrapper / manual emit
                    |
                    v
                  adapter
                    |
                    v
             AgentEventInput
                    |
                    v
           normalizeAgentEvent
                    |
                    v
               AgentEvent
                    |
          +---------+---------+
          |                   |
          v                   v
    SessionStore          Notifier
          |
          v
    GET /sessions
```

Adapters only translate platform activity. They do not own session state,
notifications, UI, sound, or hardware output.

## Package responsibilities

- `@agentpulse/core`: public schemas and types, event normalization, internal
  session key derivation, and in-memory session aggregation.
- `@agentpulse/daemon`: local HTTP receiver and process-lifetime service state.
- `@agentpulse/notifier`: notification policy and output interfaces.
- `@agentpulse/adapter-generic-cli`: best-effort command lifecycle observation.
- `@agentpulse/cli`: daemon, emit, status, and run commands.
- `@agentpulse/shared`: configuration defaults shared by runtime packages.

Dependencies flow toward `core`; adapters and output packages do not depend on
each other.

## Event boundary

`AgentEventInput` is the untrusted ingestion shape. It may contain a
platform-provided `sessionId` and a transient `rawEvent`. The normalization
boundary validates the input, supplies defaults, computes `sessionKey`, and
returns an `AgentEvent`.

`AgentEvent` is safe to store and return from the daemon. It never contains
`rawEvent`. v0.1 has no raw-event debug mode, so raw payloads are discarded
during normalization and are never placed in session state or notifier output.

## Session identity

`sessionId` and `sessionKey` are separate concepts:

- `sessionId` is an optional identifier supplied by a platform or adapter.
- `sessionKey` is an AgentPulse-owned key used to aggregate session updates.

When `sessionId` exists, AgentPulse hashes a namespaced identity containing
source, surface, and sessionId. The internal key is never the raw external ID.
Without a sessionId, source, surface, and normalized project path provide a
stable fallback. If neither identity source exists, normalization creates a
temporary key for that event.

## Session lifecycle

The active states are `running`, `using_tool`, `waiting_input`, and
`waiting_permission`. Terminal states are `completed` and `failed`. `idle`,
`rate_limited`, and `unknown` are retained as reported states but do not imply
automatic deletion.

For an accepted event, the store:

1. updates `lastEventAt`, status, and the latest descriptive fields;
2. sets `startedAt` when a session first becomes active;
3. sets `completedAt` for `completed` or `failed`;
4. retains a failure message as `error`;
5. clears terminal metadata when a newer active event reopens a session.

An event older than the stored `lastEventAt` cannot roll session state backward.
The daemon keeps all sessions in memory for its entire process lifetime. v0.1
has no retention limit, garbage collection, or persistence.

## Runtime interfaces

The daemon listens on `127.0.0.1:3768` by default:

- `POST /events` accepts `AgentEventInput` and returns `{ event, session }`.
- `GET /sessions` returns sessions ordered by most recent event.

The host and port can be overridden with `AGENTPULSE_HOST` and
`AGENTPULSE_PORT`. Binding beyond loopback is intended only for trusted
development environments because v0.1 has no authentication.

## Deferred architecture

SSE/WebSocket broadcasting, persistence, OS notifications, desktop and IDE
surfaces, retention policies, and precise platform adapters are intentionally
deferred. Their future implementations must consume the same normalized event
and notifier boundaries.
