// opencode-karakuri — auto-run karakuri digest + audit after file mutations.
//
// A native OpenCode plugin. It hooks `tool.execute.after`, and when a
// file-mutating tool ran, schedules a debounced background pass of:
//   1. karakuri digest .   (refresh CODEBASE.md)
//   2. karakuri audit .    (clean-code limits + clippy)
//
// Output is appended to a log file; the session is never blocked and the
// plugin never raises. See docs/karakuri-auto.md for the full rationale.
//
// Guarded by env:
//   KARAKURI_AUTO=0        disable entirely
//   KARAKURI_DEBOUNCE_MS   debounce window (default 4000)

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const MUTATING_TOOLS = new Set(["edit", "write", "patch", "multiedit"]);
const PROJECT_MARKERS = [".git", "Cargo.toml", "pyproject.toml", "package.json"];
const DEBOUNCE_MS = Number(process.env.KARAKURI_DEBOUNCE_MS || 4000);
const LOG_PATH = join(os.homedir(), ".local", "share", "opencode", "karakuri-auto.log");

function isEnabled() {
  return process.env.KARAKURI_AUTO !== "0";
}

function log(message) {
  try {
    mkdirSync(join(os.homedir(), ".local", "share", "opencode"), { recursive: true });
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // never throw from the logger
  }
}

function looksLikeProject(dir) {
  return PROJECT_MARKERS.some((marker) => existsSync(join(dir, marker)));
}

function runCommand(dir, subcommand) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn("karakuri", [subcommand, "."], { cwd: dir });
    } catch (err) {
      log(`${subcommand}: spawn failed: ${err && err.message}`);
      resolve(-1);
      return;
    }
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk) => { out += chunk.toString(); });
    child.on("error", (err) => {
      log(`${subcommand}: error: ${err && err.message}`);
      resolve(-1);
    });
    child.on("close", (code) => {
      const tail = out.trim().split("\n").slice(-8).join("\n      ");
      log(`${subcommand}: exit ${code}${tail ? `\n      ${tail}` : ""}`);
      resolve(code);
    });
  });
}

async function runPass(dir) {
  await runCommand(dir, "digest");
  await runCommand(dir, "audit");
}

function createScheduler(dir) {
  let timer = null;
  let running = false;
  let pending = false;

  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await runPass(dir);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      run();
    }, DEBOUNCE_MS);
  };

  return schedule;
}

export const KarakuriPlugin = async ({ directory, worktree }) => {
  const dir = worktree || directory || process.cwd();
  const schedule = createScheduler(dir);

  return {
    "tool.execute.after": async (input) => {
      if (!isEnabled()) return;
      if (!input || !MUTATING_TOOLS.has(input.tool)) return;
      if (!looksLikeProject(dir)) return;
      schedule();
    },
  };
};

export default KarakuriPlugin;
