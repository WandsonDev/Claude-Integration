# Claude Integration

A CLI tool that launches a full [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for [Claude.ai](https://claude.ai), with Cloudflare tunnel support for instant public access — no server setup required.

Give Claude complete, secure access to any project directory: read and write files, run commands, search code, manage memory, and more.

---

## Features

- Interactive setup — guided prompts for directory, port, tunnel, and permissions
- `--auto` mode — one command, sensible defaults, just provide the directory
- Cloudflare tunnel — temporary public URLs with zero configuration (or named tunnels)
- Granular permissions — choose exactly which tool groups Claude can use
- Persistent memory — Claude remembers context across sessions
- Clean architecture — each tool group is its own module, easy to extend
- TypeScript — fully typed, readable, and maintainable

---

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Interactive setup
node dist/cli.js

# Auto mode (temp tunnel + all permissions, just ask for directory)
node dist/cli.js --auto

# Auto mode with directory
node dist/cli.js --auto --dir /path/to/your/project
```

Or install globally:

```bash
npm install -g .
claude-integration --auto --dir /path/to/project
```

---

## Usage

```
Usage: claude-integration [options]

Options:
  -d, --dir <path>          Project directory path
  -p, --port <number>       MCP server port (default: 3001)
  -a, --auto                Auto mode: temp tunnel + all permissions
  --tunnel <type>           Tunnel type: temp | named | none (default: temp)
  --tunnel-name <name>      Named tunnel identifier
  --permissions <preset>    Permission preset: all | safe | readonly | custom
  --login                   Login to Cloudflare (run once for named tunnels)
  -V, --version             Output version number
  -h, --help                Display help
```

### Examples

```bash
# Full interactive setup
claude-integration

# Auto mode — fastest way to get started
claude-integration --auto --dir ~/my-project

# Local only (no tunnel)
claude-integration --dir ~/my-project --tunnel none

# Read-only access
claude-integration --dir ~/my-project --permissions readonly

# Named tunnel (persistent URL)
claude-integration --login                                # run once
claude-integration --dir ~/my-project --tunnel named --tunnel-name my-tunnel
```

---

## Connecting to Claude.ai

1. Start the server (any mode above)
2. Copy the **Public URL** shown in the terminal (e.g. `https://xxxx.trycloudflare.com/mcp`)
3. Go to **Claude.ai → Settings → Integrations → Add MCP Server**
4. Paste the URL and save

Claude will now have full access to your project.

---

## Permissions

| Preset     | Tools included                                              |
|------------|-------------------------------------------------------------|
| `all`      | Read, Write, Delete, Shell, Python, Memory                  |
| `safe`     | Read, Write, Memory (no delete, no shell)                   |
| `readonly` | Read, Memory                                                |
| `custom`   | Interactive selection of specific tool groups               |

---

## Available Tools (28 total)

### Filesystem Read (9 tools)
| Tool              | Description                                        |
|-------------------|----------------------------------------------------|
| `read_file`       | Read complete file contents                        |
| `read_file_range` | Read specific line range from a large file         |
| `list_dir`        | List directory with sizes and dates                |
| `tree`            | Visual directory tree (configurable depth)         |
| `file_info`       | File metadata: size, dates, permissions            |
| `search_files`    | Find files by name or glob pattern                 |
| `search_in_files` | Recursive grep across the project                  |
| `diff_files`      | Unified diff between two files                     |
| `stats`           | Project statistics: total size, files by extension |

### Filesystem Write (7 tools)
| Tool             | Description                                      |
|------------------|--------------------------------------------------|
| `write_file`     | Create or overwrite a file                       |
| `append_file`    | Append content to a file                         |
| `patch_file`     | Replace a unique text block (safe, exact match)  |
| `replace_in_file`| Replace all or first occurrence of text          |
| `create_dir`     | Create directory recursively                     |
| `move`           | Move or rename files and directories             |
| `copy`           | Copy files or directories                        |

### Filesystem Delete (1 tool)
| Tool     | Description                                        |
|----------|----------------------------------------------------|
| `delete` | Delete file or directory (requires `confirm: true`)|

### Shell (5 tools)
| Tool                | Description                                     |
|---------------------|-------------------------------------------------|
| `run_command`       | Execute shell command (60s timeout)             |
| `run_command_async` | Run long-running command in background          |
| `read_log`          | Read last N lines of a background command log   |
| `get_env`           | List environment variables (filterable)         |
| `set_root`          | Change active project root mid-session          |

### Python (1 tool)
| Tool     | Description                                         |
|----------|-----------------------------------------------------|
| `run_py` | Execute inline Python code or a `.py` script file   |

### Memory (2 tools)
| Tool           | Description                                         |
|----------------|-----------------------------------------------------|
| `memory_read`  | Read persistent session context                     |
| `memory_write` | Update session context, pending tasks, recent files |

### Flutter (3 tools — optional)
| Tool             | Description                        |
|------------------|------------------------------------|
| `flutter_analyze`| Run `flutter analyze`              |
| `flutter_doctor` | Run `flutter doctor`               |
| `flutter_test`   | Run `flutter test` with filters    |

> Flutter tools require Flutter SDK installed. Enable via `--permissions custom`.

---

## Security

- All file operations are restricted to the project directory (`PROJECT_ROOT`)
- Paths are resolved and validated — no directory traversal possible
- Dangerous shell commands are blocked (e.g. `rm -rf /`, fork bombs)
- `delete` tool requires explicit `confirm: true` parameter

---

## Project Structure

```
claude-integration/
├── src/
│   ├── cli.ts           # CLI entry point and argument parsing
│   ├── setup.ts         # Interactive setup prompts
│   ├── server.ts        # MCP HTTP server
│   ├── tunnel.ts        # Cloudflare tunnel management
│   ├── types.ts         # Types, permission presets, tool groups
│   └── tools/
│       ├── index.ts     # Tool registry and builder
│       ├── filesystem.ts# File read/write/delete tools
│       ├── shell.ts     # Shell execution tools
│       ├── python.ts    # Python execution tool
│       ├── flutter.ts   # Flutter SDK tools (optional)
│       └── memory.ts    # Persistent memory tools
├── README.md
├── LICENSE
├── package.json
└── tsconfig.json
```

---

## Requirements

- Node.js 18+
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (for tunnel support)

---

## License

MIT — see [LICENSE](./LICENSE)
