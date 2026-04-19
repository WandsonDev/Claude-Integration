import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function safePath(root: string, target: string): string {
  const resolved = path.resolve(root, target);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error(`Access denied: path is outside project root`);
  }
  return resolved;
}

export const filesystemReadTools = (root: string) => [
  {
    name: "read_file",
    description: "Read the complete contents of a file",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path (relative to project root)" },
        encoding: { type: "string", description: "File encoding (default: utf8)", default: "utf8" },
      },
      required: ["path"],
    },
    handler: async (args: { path: string; encoding?: BufferEncoding }) => {
      const file = safePath(root, args.path);
      const content = await fs.readFile(file, args.encoding ?? "utf8");
      return content;
    },
  },
  {
    name: "read_file_range",
    description: "Read specific lines from a file (useful for large files)",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        start_line: { type: "number", description: "First line (1-indexed)" },
        end_line: { type: "number", description: "Last line (inclusive)" },
      },
      required: ["path", "start_line", "end_line"],
    },
    handler: async (args: { path: string; start_line: number; end_line: number }) => {
      const file = safePath(root, args.path);
      const content = await fs.readFile(file, "utf8");
      const lines = content.split("\n");
      return lines.slice(args.start_line - 1, args.end_line).join("\n");
    },
  },
  {
    name: "list_dir",
    description: "List directory contents with file sizes and modification dates",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path (default: project root)" },
      },
    },
    handler: async (args: { path?: string }) => {
      const dir = safePath(root, args.path ?? ".");
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const result = await Promise.all(
        entries.map(async (e) => {
          const full = path.join(dir, e.name);
          const stat = await fs.stat(full);
          return {
            name: e.name,
            type: e.isDirectory() ? "dir" : "file",
            size: stat.size,
            modified: stat.mtime.toISOString(),
          };
        })
      );
      return JSON.stringify(result, null, 2);
    },
  },
  {
    name: "tree",
    description: "Visual tree view of project directory structure",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Root path for tree (default: project root)" },
        depth: { type: "number", description: "Max depth (default: 3)" },
      },
    },
    handler: async (args: { path?: string; depth?: number }) => {
      const dir = safePath(root, args.path ?? ".");
      const depth = args.depth ?? 3;
      const lines: string[] = [];

      async function walk(current: string, prefix: string, level: number) {
        if (level > depth) return;
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const isLast = i === entries.length - 1;
          const connector = isLast ? "└── " : "├── ";
          lines.push(`${prefix}${connector}${e.name}`);
          if (e.isDirectory()) {
            await walk(
              path.join(current, e.name),
              prefix + (isLast ? "    " : "│   "),
              level + 1
            );
          }
        }
      }

      lines.push(path.basename(dir));
      await walk(dir, "", 1);
      return lines.join("\n");
    },
  },
  {
    name: "file_info",
    description: "Get detailed metadata about a file or directory",
    inputSchema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    handler: async (args: { path: string }) => {
      const file = safePath(root, args.path);
      const stat = await fs.stat(file);
      return JSON.stringify(
        {
          path: args.path,
          size: stat.size,
          created: stat.birthtime.toISOString(),
          modified: stat.mtime.toISOString(),
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
          permissions: stat.mode.toString(8),
        },
        null,
        2
      );
    },
  },
  {
    name: "search_files",
    description: "Find files by name pattern across the project",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "File name or glob pattern to search for" },
        path: { type: "string", description: "Directory to search in (default: project root)" },
      },
      required: ["pattern"],
    },
    handler: async (args: { pattern: string; path?: string }) => {
      const dir = safePath(root, args.path ?? ".");
      const { stdout } = await execAsync(`find "${dir}" -name "${args.pattern}" 2>/dev/null`);
      return stdout || "No files found";
    },
  },
  {
    name: "search_in_files",
    description: "Search for text content across files (recursive grep)",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Text or regex pattern to search" },
        path: { type: "string", description: "Directory to search in (default: project root)" },
        case_sensitive: { type: "boolean", description: "Case sensitive search (default: true)" },
        file_pattern: { type: "string", description: "Limit to files matching pattern (e.g. *.dart)" },
      },
      required: ["query"],
    },
    handler: async (args: { query: string; path?: string; case_sensitive?: boolean; file_pattern?: string }) => {
      const dir = safePath(root, args.path ?? ".");
      const flags = args.case_sensitive === false ? "-ri" : "-r";
      const include = args.file_pattern ? `--include="${args.file_pattern}"` : "";
      const { stdout } = await execAsync(`grep ${flags} ${include} "${args.query}" "${dir}" 2>/dev/null`);
      return stdout || "No matches found";
    },
  },
  {
    name: "diff_files",
    description: "Show unified diff between two files",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_a: { type: "string" },
        file_b: { type: "string" },
      },
      required: ["file_a", "file_b"],
    },
    handler: async (args: { file_a: string; file_b: string }) => {
      const a = safePath(root, args.file_a);
      const b = safePath(root, args.file_b);
      try {
        const { stdout } = await execAsync(`diff -u "${a}" "${b}"`);
        return stdout || "Files are identical";
      } catch (e: unknown) {
        const err = e as { stdout?: string; code?: number };
        if (err.code === 1) return err.stdout ?? "";
        throw e;
      }
    },
  },
  {
    name: "stats",
    description: "Get project statistics: total size, file count by extension",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
      },
    },
    handler: async (args: { path?: string }) => {
      const dir = safePath(root, args.path ?? ".");
      const { stdout } = await execAsync(
        `find "${dir}" -type f | awk -F. '{print $NF}' | sort | uniq -c | sort -rn`
      );
      const { stdout: size } = await execAsync(`du -sh "${dir}"`);
      return `Total size: ${size.split("\t")[0]}\n\nFiles by extension:\n${stdout}`;
    },
  },
];

export const filesystemWriteTools = (root: string) => [
  {
    name: "write_file",
    description: "Create or overwrite a file with given content",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
    handler: async (args: { path: string; content: string }) => {
      const file = safePath(root, args.path);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, args.content, "utf8");
      return `File written: ${args.path}`;
    },
  },
  {
    name: "append_file",
    description: "Append content to the end of an existing file",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
    handler: async (args: { path: string; content: string }) => {
      const file = safePath(root, args.path);
      await fs.appendFile(file, args.content, "utf8");
      return `Appended to: ${args.path}`;
    },
  },
  {
    name: "patch_file",
    description: "Replace an exact unique text block in a file (fails if not uniquely found)",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        old_text: { type: "string", description: "Exact text to find (must be unique in file)" },
        new_text: { type: "string", description: "Text to replace it with" },
      },
      required: ["path", "old_text", "new_text"],
    },
    handler: async (args: { path: string; old_text: string; new_text: string }) => {
      const file = safePath(root, args.path);
      const content = await fs.readFile(file, "utf8");
      const count = (content.split(args.old_text).length - 1);
      if (count === 0) throw new Error("Text not found in file");
      if (count > 1) throw new Error(`Text found ${count} times — must be unique. Use replace_in_file instead`);
      await fs.writeFile(file, content.replace(args.old_text, args.new_text), "utf8");
      return `Patched: ${args.path}`;
    },
  },
  {
    name: "replace_in_file",
    description: "Replace all or first occurrence of text in a file",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
        all: { type: "boolean", description: "Replace all occurrences (default: true)" },
      },
      required: ["path", "old_text", "new_text"],
    },
    handler: async (args: { path: string; old_text: string; new_text: string; all?: boolean }) => {
      const file = safePath(root, args.path);
      let content = await fs.readFile(file, "utf8");
      if (args.all !== false) {
        content = content.split(args.old_text).join(args.new_text);
      } else {
        content = content.replace(args.old_text, args.new_text);
      }
      await fs.writeFile(file, content, "utf8");
      return `Replaced in: ${args.path}`;
    },
  },
  {
    name: "create_dir",
    description: "Create a directory (and any missing parent directories)",
    inputSchema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    handler: async (args: { path: string }) => {
      const dir = safePath(root, args.path);
      await fs.mkdir(dir, { recursive: true });
      return `Directory created: ${args.path}`;
    },
  },
  {
    name: "move",
    description: "Move or rename a file or directory",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string" },
        destination: { type: "string" },
      },
      required: ["source", "destination"],
    },
    handler: async (args: { source: string; destination: string }) => {
      const src = safePath(root, args.source);
      const dst = safePath(root, args.destination);
      await fs.rename(src, dst);
      return `Moved: ${args.source} → ${args.destination}`;
    },
  },
  {
    name: "copy",
    description: "Copy a file or directory",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string" },
        destination: { type: "string" },
      },
      required: ["source", "destination"],
    },
    handler: async (args: { source: string; destination: string }) => {
      const src = safePath(root, args.source);
      const dst = safePath(root, args.destination);
      await execAsync(`cp -r "${src}" "${dst}"`);
      return `Copied: ${args.source} → ${args.destination}`;
    },
  },
];

export const filesystemDeleteTools = (root: string) => [
  {
    name: "delete",
    description: "Delete a file or directory (recursive)",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion" },
      },
      required: ["path", "confirm"],
    },
    handler: async (args: { path: string; confirm: boolean }) => {
      if (!args.confirm) throw new Error("Set confirm: true to confirm deletion");
      const target = safePath(root, args.path);
      await fs.rm(target, { recursive: true, force: true });
      return `Deleted: ${args.path}`;
    },
  },
];
