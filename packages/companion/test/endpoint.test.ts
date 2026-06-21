import { describe, expect, it } from "vitest";

import { resolveCompanionEndpoint } from "../src/endpoint.js";

describe("companion endpoint resolution", () => {
  it("uses the default loopback dashboard endpoint", () => {
    expect(resolveCompanionEndpoint({})).toMatchObject({
      host: "127.0.0.1",
      port: 3768,
      baseUrl: "http://127.0.0.1:3768",
      dashboardApiUrl: "http://127.0.0.1:3768/dashboard/api",
      dashboardUrl: "http://127.0.0.1:3768/dashboard",
      issues: [],
    });
  });

  it("honors IPv4 and IPv6 loopback overrides", () => {
    expect(
      resolveCompanionEndpoint({
        AGENTPULSE_HOST: "::1",
        AGENTPULSE_PORT: "4768",
      }),
    ).toMatchObject({
      baseUrl: "http://[::1]:4768",
      issues: [],
    });
  });

  it("falls back safely for non-loopback hosts and invalid ports", () => {
    const endpoint = resolveCompanionEndpoint({
      AGENTPULSE_HOST: "0.0.0.0",
      AGENTPULSE_PORT: "invalid",
    });

    expect(endpoint.baseUrl).toBe("http://127.0.0.1:3768");
    expect(endpoint.issues).toHaveLength(2);
  });
});
