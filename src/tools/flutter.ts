import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const flutterTools = (root: string) => [
  {
    name: "flutter_analyze",
    description: "Run flutter analyze to check for code issues",
    inputSchema: {
      type: "object" as const,
      properties: {
        fatal_infos: { type: "boolean", description: "Treat infos as fatal (default: false)" },
        fatal_warnings: { type: "boolean", description: "Treat warnings as fatal (default: false)" },
      },
    },
    handler: async (args: { fatal_infos?: boolean; fatal_warnings?: boolean }) => {
      const flags = [
        args.fatal_infos ? "--fatal-infos" : "",
        args.fatal_warnings ? "--fatal-warnings" : "",
      ]
        .filter(Boolean)
        .join(" ");
      try {
        const { stdout, stderr } = await execAsync(`flutter analyze ${flags}`, {
          cwd: root,
          timeout: 120_000,
        });
        return (stdout + stderr).trim();
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string };
        return (err.stdout ?? "") + (err.stderr ?? "");
      }
    },
  },
  {
    name: "flutter_doctor",
    description: "Run flutter doctor to check Flutter environment and dependencies",
    inputSchema: {
      type: "object" as const,
      properties: {
        verbose: { type: "boolean", description: "Show verbose output (default: false)" },
      },
    },
    handler: async (args: { verbose?: boolean }) => {
      try {
        const { stdout, stderr } = await execAsync(
          `flutter doctor${args.verbose ? " -v" : ""}`,
          { cwd: root, timeout: 60_000 }
        );
        return (stdout + stderr).trim();
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string };
        return (err.stdout ?? "") + (err.stderr ?? "");
      }
    },
  },
  {
    name: "flutter_test",
    description: "Run flutter tests with optional filter and coverage",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Run only tests matching this name pattern" },
        coverage: { type: "boolean", description: "Collect code coverage (default: false)" },
        file: { type: "string", description: "Run a specific test file" },
      },
    },
    handler: async (args: { filter?: string; coverage?: boolean; file?: string }) => {
      const parts = ["flutter test"];
      if (args.filter) parts.push(`--name "${args.filter}"`);
      if (args.coverage) parts.push("--coverage");
      if (args.file) parts.push(args.file);
      try {
        const { stdout, stderr } = await execAsync(parts.join(" "), {
          cwd: root,
          timeout: 300_000,
        });
        return (stdout + stderr).trim();
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string };
        return (err.stdout ?? "") + (err.stderr ?? "");
      }
    },
  },
];
