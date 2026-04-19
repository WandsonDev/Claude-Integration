import { input, select, checkbox, confirm } from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import type { Config, ToolGroup, TunnelMode } from "./types.js";
import { PERMISSION_PRESETS, TOOL_GROUPS } from "./types.js";

export async function runInteractiveSetup(partial: Partial<Config>): Promise<Config> {
  console.log("");

  const rawDir = partial.dir ?? await input({
    message: "Project directory path:",
    default: process.cwd(),
    validate: (v) => {
      if (!v.trim()) return "Directory is required";
      if (!fs.existsSync(path.resolve(v))) return `Directory not found: ${path.resolve(v)}`;
      return true;
    },
  });
  const dir = path.resolve(rawDir);

  const port = partial.port ?? parseInt(
    await input({
      message: "MCP server port:",
      default: "3001",
      validate: (v) => {
        const n = parseInt(v);
        if (isNaN(n) || n < 1024 || n > 65535) return "Enter a valid port (1024–65535)";
        return true;
      },
    }),
    10
  );

  const tunnelChoice = await select<TunnelMode>({
    message: "Cloudflare tunnel:",
    choices: [
      { name: "Temporary link (no login required — default)", value: "temp" },
      { name: "Named tunnel (requires cloudflared login)", value: "named" },
      { name: "No tunnel (local only)", value: "none" },
    ],
    default: "temp",
  });

  let tunnelName: string | undefined;
  if (tunnelChoice === "named") {
    tunnelName = await input({
      message: "Tunnel name (created via cloudflared tunnel create):",
      validate: (v) => v.trim() ? true : "Tunnel name is required",
    });
  }

  const permChoice = await select<"all" | "readonly" | "safe" | "custom">({
    message: "Permissions (tool access level):",
    choices: [
      {
        name: "All  — full access (read, write, delete, shell, python, memory)",
        value: "all",
      },
      {
        name: "Safe — read + write, no delete, no shell",
        value: "safe",
      },
      {
        name: "Read-only — read files and memory only",
        value: "readonly",
      },
      {
        name: "Custom — choose specific tool groups",
        value: "custom",
      },
    ],
    default: "all",
  });

  let enabledGroups: ToolGroup[];
  if (permChoice === "custom") {
    enabledGroups = await checkbox<ToolGroup>({
      message: "Select tool groups to enable:",
      choices: (Object.entries(TOOL_GROUPS) as [ToolGroup, string][]).map(([value, name]) => ({
        name,
        value,
        checked: value === "filesystem-read" || value === "memory",
      })),
    });
    if (enabledGroups.length === 0) {
      console.log("  No tools selected — defaulting to read-only");
      enabledGroups = PERMISSION_PRESETS.readonly;
    }
  } else {
    enabledGroups = PERMISSION_PRESETS[permChoice];
  }

  return {
    dir,
    port,
    tunnel: tunnelChoice,
    tunnelName,
    permissions: permChoice,
    enabledGroups,
    auto: false,
  };
}

export function buildAutoConfig(dir: string, port = 3001): Config {
  return {
    dir: path.resolve(dir),
    port,
    tunnel: "temp",
    permissions: "all",
    enabledGroups: PERMISSION_PRESETS.all,
    auto: true,
  };
}
