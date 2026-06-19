import type { AgentEvent, AgentSession } from "@agentpulse/core";

export interface Notifier {
  notify(event: AgentEvent, session: AgentSession): void | Promise<void>;
}
