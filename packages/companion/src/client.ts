import type { CompanionEndpoint } from "./endpoint.js";
import {
  sanitizeDashboardResponse,
  type SanitizedDashboardData,
} from "./sanitize.js";

export type DashboardPollResult =
  | { kind: "online"; data: SanitizedDashboardData }
  | { kind: "offline"; diagnostic: string }
  | { kind: "api-unavailable"; diagnostic: string };

export interface DashboardRequestOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 1_500;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

export async function fetchCompanionSnapshot(
  endpoint: CompanionEndpoint,
  options: DashboardRequestOptions = {},
): Promise<DashboardPollResult> {
  const request = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await request(endpoint.dashboardApiUrl, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404) {
      return {
        kind: "api-unavailable",
        diagnostic: "Start the daemon with --dashboard.",
      };
    }
    if (!response.ok) {
      return {
        kind: "api-unavailable",
        diagnostic: `Dashboard API returned HTTP ${response.status}.`,
      };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        kind: "api-unavailable",
        diagnostic: "Dashboard API returned invalid JSON.",
      };
    }

    const data = sanitizeDashboardResponse(body);
    if (!data) {
      return {
        kind: "api-unavailable",
        diagnostic: "Dashboard API returned an unsupported response.",
      };
    }

    return { kind: "online", data };
  } catch (error) {
    return {
      kind: "offline",
      diagnostic: isAbortError(error)
        ? `Daemon did not respond within ${timeoutMs}ms.`
        : "Cannot reach the local AgentPulse daemon.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
