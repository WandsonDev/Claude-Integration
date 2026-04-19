import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface TunnelResult {
  url: string;
  mcpUrl: string;
  process?: ReturnType<typeof spawn>;
}

async function isCloudflaredInstalled(): Promise<boolean> {
  try {
    await execAsync("cloudflared --version");
    return true;
  } catch {
    return false;
  }
}

export async function startTempTunnel(port: number): Promise<TunnelResult> {
  if (!(await isCloudflaredInstalled())) {
    throw new Error(
      "cloudflared is not installed.\n" +
      "Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error("Timeout: cloudflared did not return a URL within 20 seconds"));
      }
    }, 20_000);

    const onData = (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        const url = match[0];
        resolve({ url, mcpUrl: `${url}/mcp`, process: child });
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (err) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

export async function loginCloudflare(): Promise<void> {
  await execAsync("cloudflared tunnel login");
}

export async function startNamedTunnel(name: string, port: number): Promise<TunnelResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "run", "--url", `http://localhost:${port}`, name], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error("Timeout: named tunnel did not start within 20 seconds"));
      }
    }, 20_000);

    const onData = (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[^\s]+\.cfargotunnel\.com/) ??
                    text.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        const url = match[0];
        resolve({ url, mcpUrl: `${url}/mcp`, process: child });
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      if (!resolved) { clearTimeout(timeout); reject(err); }
    });
  });
}
