import type { AgentEventInput, AgentStatus } from "@agentpulse/core";

import { codexHookInputSchema } from "./codex-hook-input.js";
import type { CodexAdapterResult } from "./map-codex-notification.js";

const CODEX_HOOK_STATUS = new Map<string, AgentStatus>([
  ["SessionStart", "running"],
  ["UserPromptSubmit", "running"],
  ["PreToolUse", "using_tool"],
  ["PermissionRequest", "waiting_permission"],
  ["PostToolUse", "running"],
  ["Stop", "completed"],
]);

export const CODEX_HOOK_TOOL_NAME_LIMIT = 120;

function safeToolName(toolName: string | undefined): string | undefined {
  const trimmed = toolName?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length <= CODEX_HOOK_TOOL_NAME_LIMIT
    ? trimmed
    : `${trimmed.slice(0, CODEX_HOOK_TOOL_NAME_LIMIT - 1)}…`;
}

export function mapCodexHook(input: unknown): CodexAdapterResult {
  const parsed = codexHookInputSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "invalid", reason: "Invalid Codex hook payload" };
  }

  const payload = parsed.data;
  const status = CODEX_HOOK_STATUS.get(payload.hook_event_name);
  if (!status) {
    return { kind: "ignored", reason: "Unsupported Codex hook event" };
  }

  const toolName = safeToolName(payload.tool_name);
  const event: AgentEventInput = {
    source: "codex",
    surface: "cli",
    status,
    title: payload.hook_event_name,
    ...(payload.session_id ? { sessionId: payload.session_id } : {}),
    ...(payload.cwd ? { projectPath: payload.cwd } : {}),
    ...(status === "using_tool" && toolName
      ? { message: `Using tool: ${toolName}` }
      : {}),
  };

  return { kind: "event", event };
}
