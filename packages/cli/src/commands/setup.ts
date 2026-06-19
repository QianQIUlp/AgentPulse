import { realpathSync } from "node:fs";
import { posix, resolve, win32 } from "node:path";
import { isSea } from "node:sea";
import { parseArgs } from "node:util";

import type { CommandIo } from "./types.js";

type SetupPlatform = "claude-code" | "codex" | "codex-hooks";
type RuntimePlatform = NodeJS.Platform;

export interface SetupRuntime {
  isSea(): boolean;
  execPath: string;
  entryPath: string | undefined;
  platform: RuntimePlatform;
}

export interface SetupSnippets {
  claudeCode: string;
  codex: string;
  codexHooks: string;
}

const SETUP_USAGE =
  "Usage: agentpulse setup <claude-code|codex|codex-hooks> --print [--binary <absolute-path|agentpulse>]";

function currentSetupRuntime(): SetupRuntime {
  return {
    isSea,
    execPath: process.execPath,
    entryPath: process.argv[1],
    platform: process.platform,
  };
}

function absoluteRealPath(
  path: string,
  platform: RuntimePlatform = process.platform,
): string {
  const absolute =
    platform === "win32"
      ? win32.isAbsolute(path)
        ? path
        : win32.resolve(path)
      : posix.isAbsolute(path)
        ? path
        : resolve(path);
  if (platform !== process.platform) {
    return absolute;
  }
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function isAbsoluteForPlatform(
  path: string,
  platform: RuntimePlatform,
): boolean {
  return platform === "win32" ? win32.isAbsolute(path) : posix.isAbsolute(path);
}

function validateToken(token: string): void {
  if (!token || /[\0\r\n]/u.test(token)) {
    throw new Error(
      "Setup command values cannot be empty or contain newlines.",
    );
  }
}

export function resolveAgentPulseCommand(
  binary: string | undefined,
  runtime: SetupRuntime = currentSetupRuntime(),
): string[] {
  if (binary !== undefined) {
    validateToken(binary);
    if (binary === "agentpulse") {
      return [binary];
    }
    if (!isAbsoluteForPlatform(binary, runtime.platform)) {
      throw new Error(
        "--binary must be an absolute path or the exact value `agentpulse` for PATH mode.",
      );
    }
    return [binary];
  }

  if (runtime.isSea()) {
    return [absoluteRealPath(runtime.execPath, runtime.platform)];
  }

  if (!runtime.entryPath) {
    throw new Error(
      "Unable to determine the current CLI entry path. Use --binary with an absolute executable path or `agentpulse`.",
    );
  }

  return [
    absoluteRealPath(runtime.execPath, runtime.platform),
    absoluteRealPath(runtime.entryPath, runtime.platform),
  ];
}

function quotePosixToken(token: string): string {
  validateToken(token);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/u.test(token)) {
    return token;
  }
  return `'${token.replaceAll("'", `'\"'\"'`)}'`;
}

function quoteWindowsToken(token: string): string {
  validateToken(token);
  return `"${token
    .replace(/(\\*)"/gu, '$1$1\\"')
    .replace(/(\\+)$/gu, "$1$1")}"`;
}

export function renderHookCommand(
  argv: readonly string[],
  platform: RuntimePlatform,
): string {
  const quote = platform === "win32" ? quoteWindowsToken : quotePosixToken;
  return argv.map(quote).join(" ");
}

function renderTomlArray(argv: readonly string[]): string {
  return `[${argv.map((token) => JSON.stringify(token)).join(", ")}]`;
}

function hookHandler(
  command: string,
  platform: RuntimePlatform,
  includeCommandWindows: boolean,
): Record<string, unknown> {
  return {
    type: "command",
    command,
    ...(platform === "win32" && includeCommandWindows
      ? { commandWindows: command }
      : {}),
  };
}

function hookGroup(
  command: string,
  platform: RuntimePlatform,
  matcher?: string,
  includeCommandWindows = false,
): Record<string, unknown>[] {
  return [
    {
      ...(matcher ? { matcher } : {}),
      hooks: [hookHandler(command, platform, includeCommandWindows)],
    },
  ];
}

function createClaudeCodeSnippet(
  command: readonly string[],
  platform: RuntimePlatform,
): string {
  const rendered = renderHookCommand(
    [...command, "ingest", "claude-code"],
    platform,
  );
  return JSON.stringify(
    {
      hooks: {
        SessionStart: hookGroup(rendered, platform),
        UserPromptSubmit: hookGroup(rendered, platform),
        Notification: hookGroup(rendered, platform),
        PermissionRequest: hookGroup(rendered, platform),
        PreToolUse: hookGroup(rendered, platform, "*"),
        PostToolUse: hookGroup(rendered, platform, "*"),
        Stop: hookGroup(rendered, platform),
        StopFailure: hookGroup(rendered, platform),
      },
    },
    null,
    2,
  );
}

function createCodexNotifySnippet(command: readonly string[]): string {
  return `notify = ${renderTomlArray([...command, "ingest", "codex"])}`;
}

function createCodexHooksSnippet(
  command: readonly string[],
  platform: RuntimePlatform,
): string {
  const rendered = renderHookCommand(
    [...command, "ingest", "codex-hook"],
    platform,
  );
  const group = () => hookGroup(rendered, platform, undefined, true);

  return JSON.stringify(
    {
      hooks: {
        SessionStart: group(),
        UserPromptSubmit: group(),
        PreToolUse: group(),
        PermissionRequest: group(),
        PostToolUse: group(),
        Stop: group(),
      },
    },
    null,
    2,
  );
}

export function createSetupSnippets(
  binary?: string,
  runtime: SetupRuntime = currentSetupRuntime(),
): SetupSnippets {
  const command = resolveAgentPulseCommand(binary, runtime);
  return {
    claudeCode: createClaudeCodeSnippet(command, runtime.platform),
    codex: createCodexNotifySnippet(command),
    codexHooks: createCodexHooksSnippet(command, runtime.platform),
  };
}

const CLAUDE_CODE_SETUP_GUIDANCE = `AgentPulse only printed a mergeable snippet; it did not read or modify Claude Code configuration.
Merge it manually into ~/.claude/settings.json (Windows: %USERPROFILE%\\.claude\\settings.json), .claude/settings.json, or .claude/settings.local.json.
If a hooks object or any matching event already exists, preserve it and append the AgentPulse handler. Do not replace the whole file.
Use \`--binary agentpulse\` only when the hook environment can reliably resolve AgentPulse from PATH.
Next: start \`agentpulse daemon --notifier console\`, run \`agentpulse doctor\`, then use Claude Code \`/hooks\` to confirm the handlers are loaded.`;

const CODEX_SETUP_GUIDANCE = `AgentPulse only printed a mergeable snippet; it did not read or modify Codex configuration.
Merge it manually into ~/.codex/config.toml (Windows: %USERPROFILE%\\.codex\\config.toml, or $CODEX_HOME/config.toml when CODEX_HOME is set).
If notify already exists, do not overwrite it. Codex accepts one external notifier command, so keep the existing command or route both through a wrapper.
Do not place notify in project .codex/config.toml; Codex ignores machine-local notification commands there.
Use \`--binary agentpulse\` only when Codex can reliably resolve AgentPulse from PATH.
Next: start \`agentpulse daemon --notifier console\`, run \`agentpulse doctor\`, then complete one Codex CLI turn.`;

const CODEX_HOOKS_SETUP_GUIDANCE = `AgentPulse only printed a mergeable hooks.json snippet; it did not read or modify Codex configuration.
Merge it manually into ~/.codex/hooks.json or a trusted project .codex/hooks.json while preserving existing hook groups.
Codex requires non-managed command hooks to be reviewed and trusted. Open \`/hooks\`, inspect the exact AgentPulse commands, and trust them only if they match your installation.
AgentPulse observes hook events only. It does not return permission decisions, context, or turn-control output, and it does not bypass Codex hook trust.
Use \`--binary agentpulse\` only when Codex can reliably resolve AgentPulse from PATH.`;

export function executeSetupCommand(
  args: readonly string[],
  io: CommandIo,
  runtime: SetupRuntime = currentSetupRuntime(),
): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      binary: { type: "string" },
      print: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const [platform, ...extra] = positionals;

  if (!values.print || extra.length > 0 || !platform) {
    throw new Error(SETUP_USAGE);
  }

  if (
    platform !== "claude-code" &&
    platform !== "codex" &&
    platform !== "codex-hooks"
  ) {
    throw new Error(`Unsupported setup platform: ${platform}`);
  }

  const snippets = createSetupSnippets(values.binary, runtime);
  const selected = platform as SetupPlatform;
  if (selected === "claude-code") {
    io.write(snippets.claudeCode);
    io.warn(CLAUDE_CODE_SETUP_GUIDANCE);
  } else if (selected === "codex") {
    io.write(snippets.codex);
    io.warn(CODEX_SETUP_GUIDANCE);
  } else {
    io.write(snippets.codexHooks);
    io.warn(CODEX_HOOKS_SETUP_GUIDANCE);
  }

  return 0;
}
