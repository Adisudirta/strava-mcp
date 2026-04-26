# Strava MCP

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Strava. Runs locally on your machine and connects to Claude Desktop via stdio.

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Strava API application](https://www.strava.com/settings/api)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Adisudirta/strava-mcp.git
cd strava-mcp
npm install
```

### 2. Create a Strava API application

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Fill in the form and set **Authorization Callback Domain** to `localhost`
3. Copy your **Client ID** and **Client Secret**

### 3. Build

```bash
npm run build
```

### 4. Configure Claude Desktop

Edit your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "strava": {
      "command": "node",
      "args": ["/absolute/path/to/strava-mcp/dist/index.js"],
      "env": {
        "STRAVA_CLIENT_ID": "your_client_id",
        "STRAVA_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## First use

In Claude, ask it to call the `connect_strava` tool. A browser window will open for you to authorize the app on Strava. After approving, you can close the browser and use all other tools.

---

## Available tools

| Tool                | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `connect_strava`    | Authorize with Strava via OAuth (run this first)            |
| `disconnect_strava` | Remove stored tokens                                        |
| `get_athlete`       | Get your full athlete profile                               |
| `list_activities`   | List your activities (supports pagination and date filters) |
| `get_activity`      | Get details of a specific activity by ID                    |
| `get_athlete_stats` | Get all-time and recent totals for runs, rides, and swims   |

---

## Development

```bash
npm run dev
```

Runs the server directly with `tsx` (no build step needed).
