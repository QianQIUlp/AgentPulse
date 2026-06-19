import {
  normalizeAgentEvent,
  SessionStore,
  type AgentEvent,
  type AgentEventInput,
  type AgentSession,
} from "@agentpulse/core";
import { ConsoleNotifier, type Notifier } from "@agentpulse/notifier";

export interface IngestResult {
  event: AgentEvent;
  session: AgentSession;
}

export class AgentPulseService {
  readonly #notifier: Notifier;
  readonly #sessions: SessionStore;

  constructor(
    options: {
      notifier?: Notifier;
      sessions?: SessionStore;
    } = {},
  ) {
    this.#notifier = options.notifier ?? new ConsoleNotifier();
    this.#sessions = options.sessions ?? new SessionStore();
  }

  async ingest(input: AgentEventInput): Promise<IngestResult> {
    const event = normalizeAgentEvent(input);
    const session = this.#sessions.apply(event);

    await this.#notifier.notify(event, session);

    return { event, session };
  }

  listSessions(): AgentSession[] {
    return this.#sessions.list();
  }
}
