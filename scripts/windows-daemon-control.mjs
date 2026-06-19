import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";

const [action, ...args] = process.argv.slice(2);

if (action === "start") {
  const [binary, pidFile, stdoutPath, stderrPath, ...daemonArgs] = args;
  if (!binary || !pidFile || !stdoutPath || !stderrPath) {
    throw new Error("Missing Windows daemon start arguments.");
  }

  const stdout = openSync(stdoutPath, "a");
  const stderr = openSync(stderrPath, "a");
  const child = spawn(binary, daemonArgs, {
    detached: true,
    env: process.env,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  writeFileSync(pidFile, `${child.pid}\n`);
  process.exit(0);
}

if (action === "stop") {
  const [pidFile] = args;
  if (!pidFile) {
    throw new Error("Missing Windows daemon pid file.");
  }
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  if (!Number.isInteger(pid) || pid < 1) {
    throw new Error("Invalid Windows daemon pid.");
  }

  try {
    process.kill(pid, "SIGBREAK");
  } catch {
    process.exit(2);
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      process.exit(0);
    }
  }
  process.exit(3);
}

throw new Error(`Unsupported Windows daemon control action: ${String(action)}`);
