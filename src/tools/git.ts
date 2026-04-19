import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function git(root: string, args: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`git ${args}`, { cwd: root, timeout: 30_000 });
    return (stdout + stderr).trim() || "(no output)";
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return `Error:\n${err.stderr ?? err.stdout ?? err.message ?? String(e)}`;
  }
}

export const gitTools = (root: string) => [
  {
    name: "git_status",
    description: "Show working tree status (modified, staged, untracked files)",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    handler: async () => git(root, "status --short --branch"),
  },
  {
    name: "git_diff",
    description: "Show unstaged changes, or diff of a specific file",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to diff (optional — omit for full diff)" },
        staged: { type: "boolean", description: "Show staged changes instead of unstaged (default: false)" },
      },
    },
    handler: async (args: { path?: string; staged?: boolean }) => {
      const flag = args.staged ? "--staged" : "";
      const target = args.path ? `-- "${args.path}"` : "";
      return git(root, `diff ${flag} ${target}`.trim());
    },
  },
  {
    name: "git_log",
    description: "Show recent commit history",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of commits to show (default: 10)" },
        path: { type: "string", description: "Filter commits by file path (optional)" },
      },
    },
    handler: async (args: { limit?: number; path?: string }) => {
      const n = args.limit ?? 10;
      const target = args.path ? `-- "${args.path}"` : "";
      return git(root, `log --oneline -${n} ${target}`.trim());
    },
  },
  {
    name: "git_add",
    description: "Stage files for commit",
    inputSchema: {
      type: "object" as const,
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "File paths to stage. Use ['.'] to stage all changes.",
        },
      },
      required: ["paths"],
    },
    handler: async (args: { paths: string[] }) => {
      const targets = args.paths.map((p) => `"${p}"`).join(" ");
      return git(root, `add ${targets}`);
    },
  },
  {
    name: "git_commit",
    description: "Create a commit with a message (stages must be done via git_add first)",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Commit message" },
      },
      required: ["message"],
    },
    handler: async (args: { message: string }) => {
      const safe = args.message.replace(/"/g, '\\"');
      return git(root, `commit -m "${safe}"`);
    },
  },
  {
    name: "git_branch",
    description: "List branches or create a new one",
    inputSchema: {
      type: "object" as const,
      properties: {
        create: { type: "string", description: "Name of new branch to create (optional)" },
      },
    },
    handler: async (args: { create?: string }) => {
      if (args.create) return git(root, `checkout -b "${args.create}"`);
      return git(root, "branch -a");
    },
  },
  {
    name: "git_checkout",
    description: "Switch to a branch or restore a file to last commit",
    inputSchema: {
      type: "object" as const,
      properties: {
        target: { type: "string", description: "Branch name or file path" },
        restore_file: { type: "boolean", description: "If true, restores the file instead of switching branch" },
      },
      required: ["target"],
    },
    handler: async (args: { target: string; restore_file?: boolean }) => {
      if (args.restore_file) return git(root, `checkout -- "${args.target}"`);
      return git(root, `checkout "${args.target}"`);
    },
  },
  {
    name: "git_stash",
    description: "Stash or restore uncommitted changes",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description: "Action: 'push' to stash changes, 'pop' to restore, 'list' to show stashes",
        },
        message: { type: "string", description: "Optional label when pushing a stash" },
      },
      required: ["action"],
    },
    handler: async (args: { action: string; message?: string }) => {
      if (args.action === "push") {
        const msg = args.message ? `-m "${args.message}"` : "";
        return git(root, `stash push ${msg}`.trim());
      }
      if (args.action === "pop") return git(root, "stash pop");
      if (args.action === "list") return git(root, "stash list");
      return `Unknown action: ${args.action}. Use 'push', 'pop', or 'list'.`;
    },
  },
];
