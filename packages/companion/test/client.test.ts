import { describe, expect, it } from "vitest";

import { fetchCompanionSnapshot } from "../src/client.js";
import { resolveCompanionEndpoint } from "../src/endpoint.js";

const endpoint = resolveCompanionEndpoint({});

function validResponse(): Response {
  return Response.json({
    health: { status: "ok" },
    sessions: [],
  });
}

describe("companion dashboard client", () => {
  it("returns sanitized online data for a valid response", async () => {
    await expect(
      fetchCompanionSnapshot(endpoint, {
        fetch: async () => validResponse(),
      }),
    ).resolves.toEqual({
      kind: "online",
      data: { sessions: [] },
    });
  });

  it("maps network failures to daemon offline", async () => {
    const result = await fetchCompanionSnapshot(endpoint, {
      fetch: async () => {
        throw new TypeError("connection refused");
      },
    });

    expect(result).toMatchObject({
      kind: "offline",
      diagnostic: "Cannot reach the local AgentPulse daemon.",
    });
  });

  it("aborts slow requests and reports the timeout", async () => {
    const result = await fetchCompanionSnapshot(endpoint, {
      timeoutMs: 5,
      fetch: async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    });

    expect(result).toEqual({
      kind: "offline",
      diagnostic: "Daemon did not respond within 5ms.",
    });
  });

  it("provides a dashboard startup hint for HTTP 404", async () => {
    await expect(
      fetchCompanionSnapshot(endpoint, {
        fetch: async () => new Response("Not found", { status: 404 }),
      }),
    ).resolves.toEqual({
      kind: "api-unavailable",
      diagnostic: "Start the daemon with --dashboard.",
    });
  });

  it("rejects invalid JSON and unsupported response shapes", async () => {
    await expect(
      fetchCompanionSnapshot(endpoint, {
        fetch: async () =>
          new Response("{", {
            headers: { "content-type": "application/json" },
          }),
      }),
    ).resolves.toEqual({
      kind: "api-unavailable",
      diagnostic: "Dashboard API returned invalid JSON.",
    });

    await expect(
      fetchCompanionSnapshot(endpoint, {
        fetch: async () => Response.json({ sessions: [] }),
      }),
    ).resolves.toEqual({
      kind: "api-unavailable",
      diagnostic: "Dashboard API returned an unsupported response.",
    });
  });
});
