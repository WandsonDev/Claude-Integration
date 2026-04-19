import { filesystemReadTools, filesystemWriteTools, filesystemDeleteTools } from "./filesystem.js";
import { shellTools } from "./shell.js";
import { flutterTools } from "./flutter.js";
import { pythonTools } from "./python.js";
import { memoryTools } from "./memory.js";
import { gitTools } from "./git.js";
import type { ToolGroup } from "../types.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<string>;
}

export function buildToolset(root: string, groups: ToolGroup[]): Tool[] {
  const tools: Tool[] = [];
  const has = (g: ToolGroup) => groups.includes(g);

  if (has("filesystem-read")) tools.push(...(filesystemReadTools(root) as unknown as Tool[]));
  if (has("filesystem-write")) tools.push(...(filesystemWriteTools(root) as unknown as Tool[]));
  if (has("filesystem-delete")) tools.push(...(filesystemDeleteTools(root) as unknown as Tool[]));
  if (has("shell")) tools.push(...(shellTools(root) as unknown as Tool[]));
  if (has("flutter")) tools.push(...(flutterTools(root) as unknown as Tool[]));
  if (has("python")) tools.push(...(pythonTools(root) as unknown as Tool[]));
  if (has("memory")) tools.push(...(memoryTools(root) as unknown as Tool[]));
  if (has("git")) tools.push(...(gitTools(root) as unknown as Tool[]));

  return tools;
}
