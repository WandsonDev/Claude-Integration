import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const pythonTools = (root: string) => [
  {
    name: "run_py",
    description: "Execute a Python script or inline Python command",
    inputSchema: {
      type: "object" as const,
      properties: {
        script: { type: "string", description: "Python code to execute inline (use \\n for newlines)" },
        file: { type: "string", description: "Path to a .py file to run (relative to project root)" },
        args: { type: "string", description: "Arguments to pass to the script" },
      },
    },
    handler: async (args: { script?: string; file?: string; args?: string }) => {
      if (!args.script && !args.file) throw new Error("Provide either 'script' or 'file'");
      let cmd: string;
      if (args.file) {
        cmd = `python3 "${args.file}" ${args.args ?? ""}`;
      } else {
        const escaped = (args.script ?? "").replace(/"/g, '\\"');
        cmd = `python3 -c "${escaped}" ${args.args ?? ""}`;
      }
      try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: root, timeout: 60_000 });
        return (stdout + stderr).trim() || "(no output)";
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message?: string };
        return `Error:\n${err.stderr ?? err.stdout ?? err.message ?? String(e)}`;
      }
    },
  },
];
