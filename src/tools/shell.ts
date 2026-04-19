import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const BLOCKED_PATTERNS = [
  /flutter\s+clean/,
  /flutter\s+pub\s+get/,
  /flutter\s+pub\s+upgrade/,
  /rm\s+-rf\s+\//,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
  /mkfs/,
  /dd\s+if=/,
];

function assertSafeCommand(cmd: string) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      throw new Error(`Command blocked for safety: matches pattern ${pattern}`);
    }
  }
}

export const shellTools = (root: string) => [
  {
    name: "run_command",
    description: "Execute a shell command inside the project directory (60s timeout)",
    inputSchema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Shell command to run" },
        cwd: { type: "string", description: "Working directory relative to project root (default: root)" },
      },
      required: ["command"],
    },
    handler: async (args: { command: string; cwd?: string }) => {
      assertSafeCommand(args.command);
      const cwd = args.cwd ? path.resolve(root, args.cwd) : root;
      try {
        const { stdout, stderr } = await execAsync(args.command, { cwd, timeout: 60_000 });
        return (stdout + stderr).trim() || "(no output)";
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message?: string };
        return `Error:\n${err.stderr ?? err.stdout ?? err.message ?? String(e)}`;
      }
    },
  },
  {
    name: "run_command_async",
    description: "Run a long-running command in the background, output saved to a log file",
    inputSchema: {
      type: "object" as const,
      properties: {
        command: { type: "string" },
        log_file: { type: "string", description: "Log file name (saved in project root, default: async.log)" },
      },
      required: ["command"],
    },
    handler: async (args: { command: string; log_file?: string }) => {
      assertSafeCommand(args.command);
      const log = path.join(root, args.log_file ?? "async.log");
      const child = exec(`(${args.command}) >> "${log}" 2>&1`, { cwd: root });
      return `Started (PID ${child.pid}). Output → ${args.log_file ?? "async.log"}`;
    },
  },
  {
    name: "read_log",
    description: "Read the last N lines of a log file",
    inputSchema: {
      type: "object" as const,
      properties: {
        log_file: { type: "string", description: "Log file name in project root (default: async.log)" },
        lines: { type: "number", description: "Number of lines to read (default: 50)" },
      },
    },
    handler: async (args: { log_file?: string; lines?: number }) => {
      const log = path.join(root, args.log_file ?? "async.log");
      const content = await fs.readFile(log, "utf8");
      const all = content.split("\n");
      return all.slice(-(args.lines ?? 50)).join("\n");
    },
  },
  {
    name: "get_env",
    description: "List environment variables, optionally filtered by prefix",
    inputSchema: {
      type: "object" as const,
      properties: {
        prefix: { type: "string", description: "Filter by prefix (e.g. NODE, PATH)" },
      },
    },
    handler: async (args: { prefix?: string }) => {
      const env = process.env;
      const entries = Object.entries(env)
        .filter(([k]) => !args.prefix || k.startsWith(args.prefix))
        .map(([k, v]) => `${k}=${v}`);
      return entries.join("\n") || "No variables found";
    },
  },
  {
    name: "set_root",
    description: "Change the active project root to another directory for this session",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Absolute path to the new project root" },
      },
      required: ["path"],
    },
    handler: async (args: { path: string }) => {
      process.env.PROJECT_ROOT = args.path;
      return `Project root changed to: ${args.path}`;
    },
  },
];
