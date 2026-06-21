import type { CodexAdapterResult } from "./map-codex-notification.js";
import { mapCodexHook } from "./map-codex-hook.js";

export function ingestCodexHookJson(
  json: string,
  hookEventOverride?: string,
): CodexAdapterResult {
  let payload: unknown;

  try {
    payload = JSON.parse(json);
  } catch {
    if (hookEventOverride !== undefined) {
      return mapCodexHook({}, hookEventOverride);
    }
    return { kind: "invalid", reason: "Invalid Codex hook JSON" };
  }

  const result = mapCodexHook(payload, hookEventOverride);
  if (result.kind === "invalid" && hookEventOverride !== undefined) {
    return mapCodexHook({}, hookEventOverride);
  }
  return result;
}
