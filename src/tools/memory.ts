import fs from "fs/promises";
import path from "path";

const MEMORY_MAX_CHARS = 2000;

interface Memory {
  session: string;
  pending: string;
  last_files: string[];
  ctx: string[];
}

function memoryFile(root: string) {
  return path.join(root, "CLAUDE_MEMORY.json");
}

async function loadMemory(root: string): Promise<Memory> {
  try {
    const raw = await fs.readFile(memoryFile(root), "utf8");
    return JSON.parse(raw) as Memory;
  } catch {
    return { session: "", pending: "", last_files: [], ctx: [] };
  }
}

async function saveMemory(root: string, mem: Memory) {
  while (JSON.stringify(mem).length > MEMORY_MAX_CHARS && mem.ctx.length > 0) {
    mem.ctx.shift();
  }
  await fs.writeFile(memoryFile(root), JSON.stringify(mem, null, 2), "utf8");
}

export const memoryTools = (root: string) => [
  {
    name: "memory_read",
    description: "Read the persistent session memory (context, pending tasks, recent files)",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    handler: async () => {
      const mem = await loadMemory(root);
      return JSON.stringify(mem, null, 2);
    },
  },
  {
    name: "memory_write",
    description: "Update session memory with current context, pending tasks, and recent files",
    inputSchema: {
      type: "object" as const,
      properties: {
        session: { type: "string", description: "Current task or phase description" },
        pending: { type: "string", description: "What remains to be done or where work stopped" },
        last_files: {
          type: "array",
          items: { type: "string" },
          description: "Relative paths of files modified in this session",
        },
        ctx_entry: { type: "string", description: "A short context note to append to history" },
      },
    },
    handler: async (args: {
      session?: string;
      pending?: string;
      last_files?: string[];
      ctx_entry?: string;
    }) => {
      const mem = await loadMemory(root);
      if (args.session !== undefined) mem.session = args.session;
      if (args.pending !== undefined) mem.pending = args.pending;
      if (args.last_files) mem.last_files = args.last_files;
      if (args.ctx_entry) mem.ctx.push(args.ctx_entry);
      await saveMemory(root, mem);
      return "Memory updated";
    },
  },
];
