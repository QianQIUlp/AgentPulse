import type { CommandIo } from "./types.js";

const CLAUDE_HOOK_COMMAND = {
  type: "command",
  command: "agentpulse ingest claude-code",
};

function hook(matcher?: string) {
  return [
    {
      ...(matcher ? { matcher } : {}),
      hooks: [CLAUDE_HOOK_COMMAND],
    },
  ];
}

export const CLAUDE_CODE_SETUP_SNIPPET = JSON.stringify(
  {
    hooks: {
      SessionStart: hook(),
      UserPromptSubmit: hook(),
      Notification: hook(),
      PermissionRequest: hook(),
      PreToolUse: hook("*"),
      PostToolUse: hook("*"),
      Stop: hook(),
      StopFailure: hook(),
    },
  },
  null,
  2,
);

export const CODEX_SETUP_SNIPPET = 'notify = ["agentpulse", "ingest", "codex"]';

const CLAUDE_CODE_SETUP_GUIDANCE = `AgentPulse only printed a mergeable snippet; it did not read or modify Claude Code configuration.
Merge it manually into ~/.claude/settings.json (Windows: %USERPROFILE%\\.claude\\settings.json), .claude/settings.json, or .claude/settings.local.json.
If a hooks object or any matching event already exists, preserve it and append the AgentPulse handler. Do not replace the whole file.
Next: start \`agentpulse daemon --notifier console\`, run \`agentpulse doctor\`, then use Claude Code \`/hooks\` to confirm the handlers are loaded.`;

const CODEX_SETUP_GUIDANCE = `AgentPulse only printed a mergeable snippet; it did not read or modify Codex configuration.
Merge it manually into ~/.codex/config.toml (Windows: %USERPROFILE%\\.codex\\config.toml, or $CODEX_HOME/config.toml when CODEX_HOME is set).
If notify already exists, do not overwrite it. Codex accepts one external notifier command, so keep the existing command or route both through a wrapper.
Do not place notify in project .codex/config.toml; Codex ignores machine-local notification commands there.
Next: start \`agentpulse daemon --notifier console\`, run \`agentpulse doctor\`, then complete one Codex CLI turn.`;

export function executeSetupCommand(
  args: readonly string[],
  io: CommandIo,
): number {
  const [platform, flag, ...extra] = args;

  if (flag !== "--print" || extra.length > 0) {
    throw new Error("Usage: agentpulse setup <claude-code|codex> --print");
  }

  if (platform === "claude-code") {
    io.write(CLAUDE_CODE_SETUP_SNIPPET);
    io.warn(CLAUDE_CODE_SETUP_GUIDANCE);
    return 0;
  }

  if (platform === "codex") {
    io.write(CODEX_SETUP_SNIPPET);
    io.warn(CODEX_SETUP_GUIDANCE);
    return 0;
  }

  throw new Error(`Unsupported setup platform: ${String(platform)}`);
}
