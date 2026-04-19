#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { runInteractiveSetup, buildAutoConfig } from "./setup.js";
import { startServer } from "./server.js";
import { startTempTunnel, startNamedTunnel, loginCloudflare } from "./tunnel.js";
import type { Config } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

function printBanner() {
  console.log(
    chalk.cyan.bold(`
  ╔═══════════════════════════════════╗
  ║     Claude Integration v${pkg.version}      ║
  ║  MCP Server + Cloudflare Tunnel   ║
  ╚═══════════════════════════════════╝
`)
  );
}

function printResult(config: Config, mcpUrl: string | null) {
  const local = `http://localhost:${config.port}/mcp`;
  console.log("");
  console.log(chalk.green.bold("  Server running"));
  console.log(`  ${chalk.dim("Project:")}   ${chalk.white(config.dir)}`);
  console.log(`  ${chalk.dim("Port:")}      ${chalk.white(config.port)}`);
  console.log(`  ${chalk.dim("Tools:")}     ${chalk.white(config.enabledGroups.join(", "))}`);
  console.log("");
  console.log(`  ${chalk.dim("Local URL:")} ${chalk.white(local)}`);
  if (mcpUrl) {
    console.log(`  ${chalk.dim("Public URL:")} ${chalk.cyan.bold(mcpUrl)}`);
    console.log("");
    console.log(chalk.yellow("  Paste the Public URL into Claude.ai:"));
    console.log(chalk.yellow("  Settings → Integrations → Add MCP Server"));
  }
  console.log("");
  console.log(chalk.dim("  Press Ctrl+C to stop"));
  console.log("");
}

async function main() {
  printBanner();

  program
    .name("claude-integration")
    .description("Launch a full MCP server for Claude.ai with Cloudflare tunnel support")
    .version(pkg.version)
    .option("-d, --dir <path>", "Project directory path")
    .option("-p, --port <number>", "MCP server port", "3001")
    .option("-a, --auto", "Auto mode: temp tunnel + all permissions (only asks for --dir if missing)")
    .option("--tunnel <type>", "Tunnel type: temp | named | none", "temp")
    .option("--tunnel-name <name>", "Named tunnel identifier (requires cloudflared login)")
    .option("--permissions <preset>", "Permission preset: all | safe | readonly | custom", "all")
    .option("--login", "Login to Cloudflare (run this once for named tunnels)")
    .parse(process.argv);

  const opts = program.opts<{
    dir?: string;
    port: string;
    auto?: boolean;
    tunnel: string;
    tunnelName?: string;
    permissions: string;
    login?: boolean;
  }>();

  if (opts.login) {
    const spinner = ora("Opening Cloudflare login...").start();
    try {
      await loginCloudflare();
      spinner.succeed("Cloudflare login successful");
    } catch {
      spinner.fail("Cloudflare login failed");
    }
    process.exit(0);
  }

  let config: Config;

  if (opts.auto) {
    let dir = opts.dir;
    if (!dir) {
      const { input } = await import("@inquirer/prompts");
      dir = await input({
        message: "Project directory path:",
        default: process.cwd(),
      });
    }
    config = {
      ...buildAutoConfig(dir, parseInt(opts.port, 10)),
      tunnel: (opts.tunnel as Config["tunnel"]) ?? "temp",
      tunnelName: opts.tunnelName,
    };
  } else {
    // always interactive — only pre-fill dir if explicitly passed via --dir
    config = await runInteractiveSetup({
      dir: opts.dir,
      port: parseInt(opts.port, 10),
    });
  }

  const serverSpinner = ora(`Starting MCP server on port ${config.port}...`).start();
  try {
    await startServer(config);
    serverSpinner.succeed(`MCP server started on port ${config.port}`);
  } catch (err) {
    serverSpinner.fail(`Failed to start server: ${String(err)}`);
    process.exit(1);
  }

  let mcpUrl: string | null = null;

  if (config.tunnel !== "none") {
    const tunnelSpinner = ora("Creating Cloudflare tunnel...").start();
    try {
      let result;
      if (config.tunnel === "named" && config.tunnelName) {
        result = await startNamedTunnel(config.tunnelName, config.port);
      } else {
        result = await startTempTunnel(config.port);
      }
      mcpUrl = result.mcpUrl;
      tunnelSpinner.succeed(`Tunnel active: ${result.url}`);
    } catch (err) {
      tunnelSpinner.fail(`Tunnel failed: ${String(err)}`);
      console.log(chalk.yellow(`  Local URL still available: http://localhost:${config.port}/mcp`));
    }
  }

  printResult(config, mcpUrl);

  process.on("SIGINT", () => {
    console.log(chalk.dim("\n  Shutting down..."));
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch((err) => {
  console.error(chalk.red(`\n  Error: ${String(err)}\n`));
  process.exit(1);
});
