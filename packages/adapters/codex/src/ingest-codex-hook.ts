import type { CodexAdapterResult } from "./map-codex-notification.js";
import { mapCodexHook } from "./map-codex-hook.js";

export function ingestCodexHookJson(json: string): CodexAdapterResult {
  let payload: unknown;

  try {
    payload = JSON.parse(json);
  } catch {
    return { kind: "invalid", reason: "Invalid Codex hook JSON" };
  }

  return mapCodexHook(payload);
}
