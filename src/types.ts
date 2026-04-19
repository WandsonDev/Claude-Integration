export type PermissionSet = "all" | "readonly" | "safe" | "custom";

export type TunnelMode = "temp" | "named" | "none";

export interface Config {
  dir: string;
  port: number;
  tunnel: TunnelMode;
  tunnelName?: string;
  permissions: PermissionSet;
  enabledGroups: ToolGroup[];
  auto: boolean;
}

export type ToolGroup =
  | "filesystem-read"
  | "filesystem-write"
  | "filesystem-delete"
  | "shell"
  | "flutter"
  | "python"
  | "memory"
  | "git";

export const TOOL_GROUPS: Record<ToolGroup, string> = {
  "filesystem-read": "Filesystem Read (list, read, search, diff, stats)",
  "filesystem-write": "Filesystem Write (write, append, patch, replace, move, copy, mkdir)",
  "filesystem-delete": "Filesystem Delete (delete files and folders)",
  shell: "Shell Execution (run commands, env vars, async tasks)",
  flutter: "Flutter (analyze, doctor, test)",
  python: "Python (run scripts and commands)",
  memory: "Memory (read/write persistent session context)",
  git: "Git (status, diff, log, add, commit, branch, checkout, stash)",
};

export const PERMISSION_PRESETS: Record<PermissionSet, ToolGroup[]> = {
  all: [
    "filesystem-read",
    "filesystem-write",
    "filesystem-delete",
    "shell",
    "flutter",
    "python",
    "memory",
    "git",
  ],
  readonly: ["filesystem-read", "memory"],
  safe: ["filesystem-read", "filesystem-write", "memory", "git"],
  custom: [],
};
