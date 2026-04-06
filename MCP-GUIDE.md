# MCP (Model Context Protocol) Integration Guide

## Overview

MCP (Model Context Protocol) adalah standardized protocol untuk model AI (seperti Ollama) untuk access external tools dan resources. Implementasi ini menyediakan:

- **Web Search Tool** - Search the internet untuk current information
- **Device Info Tool** - Get system device information (CPU, RAM, GPU, Storage)
- **Read/Write Files** - Access file system (dalam MCP server)
- **Execute Commands** - Run safe shell commands (dalam MCP server)

## Architecture

### Components

1. **MCP Server** (`mcp-server.js`)
   - Standalone Node.js server yang menjalankan tools
   - Listening pada port 3001 (default)
   - Implements JSON-RPC 2.0 protocol

2. **MCP Client** (dalam `ollama-chat.js`)
   - Frontend triggers MCP tools via `/api/mcp/call` endpoint
   - Detects keywords yang memerlukan MCP (search, device info, etc)
   - Auto-calls MCP tool dan formats hasil

3. **Backend Adapter** (`index.js`)
   - REST endpoint `/api/mcp/call` untuk trigger MCP tools
   - Bridges frontend dengan MCP server

## Quick Start

### 1. Start the Main Server

```bash
cd /home/gugus/chat-ui
npm install  # if needed
node index.js
```

Server akan jalan di `http://localhost:3000`

### 2. Start MCP Server (Optional - for advanced usage)

```bash
# Di terminal lain
node mcp-server.js
# MCP Server akan listen di port 3001
```

### 3. Test di Chat

User cukup bertanya seperti:
- "Search tentang berita terbaru AI"
- "Cari informasi Python tutorial"
- "Berapa RAM saya?" (triggers device-info)
- "Apa itu JavaScript?"

Chat akan auto-detect dan call MCP tools yang sesuai.

## How It Works

### For Web Search

```
User: "Cari artikel tentang machine learning"
  ↓
Frontend detect keywords: "cari", "artikel", "machine learning"
  ↓
Call /api/mcp/call with tool: "web-search", args: {query: "..."}
  ↓
Backend call MCP web-search tool
  ↓
Format results dengan markdown
  ↓
Stream hasil ke user dengan sumber URL
```

### For Device Info

```
User: "CPU cores?"
  ↓
Frontend detect keywords: "cpu", "cores" OR "berapa"
  ↓
Call /api/device-info
  ↓
Format device specs
  ↓
Stream hasil ke user
```

## Configuration

### Environment Variables

```bash
# Set custom MCP Server port (default: 3001)
export MCP_PORT=3001

# Set Brave Search API key for real web search (optional)
export BRAVE_SEARCH_API_KEY=your_key_here

# Set main server port (default: 3000)
export PORT=3000

# Set Ollama host
export OLLAMA_HOST=http://localhost:11434
```

### Setting API Keys

#### For Real Web Search (Brave Search)

1. Get API key dari https://api.search.brave.com
2. Set environment variable:
   ```bash
   export BRAVE_SEARCH_API_KEY=your_api_key
   node index.js
   ```
3. Now web search akan return hasil real dari Brave Search

**Kalau tidak set API key**: Web search akan return placeholder/mock results dengan link ke Google Search

## Available MCP Tools

### 1. web-search

**Description**: Search the web untuk information

**Parameters**:
- `query` (string, required): Search query

**Example**:
```javascript
callMCPTool('web-search', { query: 'latest AI news' })
```

**Response**:
```json
{
  "success": true,
  "query": "latest AI news",
  "count": 5,
  "results": [
    {
      "rank": 1,
      "title": "Article Title",
      "url": "https://...",
      "description": "..."
    }
  ]
}
```

### 2. device-info

**Description**: Get system device information

**Parameters**:
- `info_type` (string, optional): Type of info - 'all', 'cpu', 'memory', 'storage', 'gpu', 'system'

**Example**:
```javascript
callMCPTool('device-info', { info_type: 'memory' })
```

**Response**:
```json
{
  "total": "16 GB",
  "used": "8 GB",
  "free": "8 GB",
  "usage": "50.00%"
}
```

### 3. read-file (MCP Server only)

**Description**: Read file contents

**Parameters**:
- `path` (string, required): File path

### 4. write-file (MCP Server only)

**Description**: Write to file

**Parameters**:
- `path` (string): File path
- `content` (string): Content to write

### 5. execute-command (MCP Server only)

**Description**: Execute safe shell commands

**Parameters**:
- `command` (string): Command to run

**Whitelisted commands**: npm, git, ls, pwd, date, node, python

## Keyword Detection

Frontend automatically triggers MCP tools when user mentions:

### Web Search Keywords
- search, cari, google, find
- apa, bagaimana, berapa
- berita, news, latest, current, terbaru
- artikel, informasi, penjelasan

### Device Info Keywords
- device, system, cpu, processor
- ram, memory, storage, disk, gpu
- status, specs, information, info
- berapa, apa, bagaimana, spek

## API Endpoints

### Call MCP Tool

```
POST /api/mcp/call
Content-Type: application/json

{
  "tool": "web-search" | "device-info",
  "args": {
    "query": "...",     // for web-search
    "info_type": "..."  // for device-info
  }
}
```

**Response**:
```json
{
  "success": true,
  "tool": "web-search",
  "result": { /* tool result */ }
}
```

## Troubleshooting

### Web Search Returns Mock/Demo Results

**Cause**: BRAVE_SEARCH_API_KEY not set

**Solution**:
```bash
# Get free API key dari https://api.search.brave.com
export BRAVE_SEARCH_API_KEY=your_key
node index.js
```

### MCP Server Not Starting

**Check**:
1. Port 3001 not in use: `lsof -i :3001`
2. Dependencies installed: `npm list`
3. Node.js version >= 14

### Tools Not Triggering

**Check**:
1. Message contains keywords (check console logs)
2. `/api/mcp/call` endpoint responding (check network tab)
3. Backend logs untuk error messages

## Advanced: Direct MCP Server Usage

Untuk deeper integration atau custom tools, bisa connect directly ke MCP server:

```javascript
// Client code
const net = require('net');

const socket = net.createConnection(3001, 'localhost');

// Send initialize
socket.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { clientInfo: { name: 'MyClient' } }
}) + '\n');

// Listen for response
socket.on('data', (data) => {
  const response = JSON.parse(data.toString());
  console.log('MCP Response:', response);
});
```

## Example Conversations

### Web Search Example

```
User: "Apa yang terbaru tentang GPT-4?"
AI: 🔍 **Web Search Results**
    1. **GPT-4 Turbo Latest Updates**
    📎 https://...
    Terbaru updates dari OpenAI tentang GPT-4 Turbo...
```

### Device Info Example

```
User: "Berapa cores CPU saya?"
AI: 📱 **Device Information**

   **CPU:**
   - Model: Intel Core i7
   - Cores: 8
   - Speed: 3600 MHz
   - Usage: 23.45%
```

## Next Steps

1. **Enable Web Search**: Set `BRAVE_SEARCH_API_KEY`
2. **Add Custom Tools**: Edit `mcp-server.js` untuk add more tools
3. **Integrate with RAG**: Combine MCP search dengan RAG documents
4. **Deploy**: Run MCP server di background dengan process manager (PM2, systemd, etc)

## Additional Resources

- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Brave Search API](https://api.search.brave.com)
- [Node.js Net Module](https://nodejs.org/api/net.html)

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-06
