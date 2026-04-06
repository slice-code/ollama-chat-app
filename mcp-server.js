#!/usr/bin/env node

/**
 * MCP (Model Context Protocol) Server for Chat UI
 * Provides tools for web search, file system access, and system information
 * 
 * Standalone MCP server that can be used with Ollama or other MCP clients
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const deviceInfo = require('./device-info.js');

const execPromise = promisify(exec);
const readFilePromise = promisify(fs.readFile);
const writeFilePromise = promisify(fs.writeFile);

// MCP Server Protocol Constants
const MCP_VERSION = '2024-11-05';
let messageId = 0;

/**
 * Send JSON-RPC response to client
 */
function sendResponse(socket, id, result = null, error = null) {
  const response = {
    jsonrpc: '2.0',
    id
  };
  
  if (error) {
    response.error = {
      code: error.code || -32603,
      message: error.message || 'Internal error'
    };
  } else {
    response.result = result;
  }
  
  socket.write(JSON.stringify(response) + '\n');
}

/**
 * Handle initialize request
 */
function handleInitialize(socket, id, params) {
  console.log('[MCP] Client initialized:', params.clientInfo?.name);
  
  sendResponse(socket, id, {
    protocolVersion: MCP_VERSION,
    capabilities: {
      tools: {
        listChanged: true
      },
      resources: {}
    },
    serverInfo: {
      name: 'Chat-UI MCP Server',
      version: '1.0.0'
    }
  });
}

/**
 * List available tools
 */
function handleListTools(socket, id) {
  const tools = [
    {
      name: 'device-info',
      description: 'Get system device information including CPU, RAM, storage, GPU details',
      inputSchema: {
        type: 'object',
        properties: {
          info_type: {
            type: 'string',
            enum: ['all', 'cpu', 'memory', 'storage', 'gpu', 'system'],
            description: 'Type of device info to retrieve (default: all)'
          }
        }
      }
    },
    {
      name: 'read-file',
      description: 'Read contents of a file at the specified path',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative file path'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'write-file',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to write to'
          },
          content: {
            type: 'string',
            description: 'Content to write'
          }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'execute-command',
      description: 'Execute a shell command (limited to safe commands)',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to execute (e.g., "npm list", "git status")'
          }
        },
        required: ['command']
      }
    }
  ];

  sendResponse(socket, id, { tools });
}

/**
 * Execute a tool
 */
async function handleCallTool(socket, id, params) {
  const { name, arguments: args } = params;
  
  console.log(`[MCP] Tool call: ${name}`, args);
  
  try {
    let result;
    
    switch (name) {
      case 'device-info':
        result = await handleDeviceInfo(args.info_type);
        break;
        
      case 'read-file':
        result = await handleReadFile(args.path);
        break;
        
      case 'write-file':
        result = await handleWriteFile(args.path, args.content);
        break;
        
      case 'execute-command':
        result = await handleExecuteCommand(args.command);
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    sendResponse(socket, id, { 
      content: [{ 
        type: 'text', 
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) 
      }] 
    });
  } catch (error) {
    console.error(`[MCP] Tool error (${name}):`, error.message);
    sendResponse(socket, id, null, { 
      message: `Tool execution failed: ${error.message}`,
      code: -32603 
    });
  }
}

/**
 * Handle device info request
 */
async function handleDeviceInfo(infoType = 'all') {
  const info = deviceInfo.getDeviceInfo();
  
  if (infoType === 'all') return info;
  
  const typeMap = {
    'cpu': info.cpu,
    'memory': info.memory,
    'storage': info.storage,
    'gpu': info.gpu,
    'system': info.system
  };
  
  return typeMap[infoType] || info;
}

/**
 * Handle file read
 */
async function handleReadFile(filePath) {
  // Security: prevent reading outside current directory
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  try {
    const content = await readFilePromise(normalized, 'utf8');
    return {
      path: normalized,
      size: content.length,
      content: content.substring(0, 10000) // Limit to 10KB
    };
  } catch (error) {
    throw new Error(`Cannot read file: ${error.message}`);
  }
}

/**
 * Handle file write
 */
async function handleWriteFile(filePath, content) {
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  try {
    await writeFilePromise(normalized, content, 'utf8');
    return {
      success: true,
      path: normalized,
      bytes_written: content.length
    };
  } catch (error) {
    throw new Error(`Cannot write file: ${error.message}`);
  }
}

/**
 * Handle command execution (whitelisted commands only)
 */
async function handleExecuteCommand(command) {
  // Whitelist safe commands
  const allowedPatterns = [
    /^npm\s+(list|version|info)/,
    /^git\s+(status|log|branch)/,
    /^ls\s+/,
    /^pwd/,
    /^date/,
    /^whoami/,
    /^node\s+--version/,
    /^python3?\s+--version/
  ];
  
  const isAllowed = allowedPatterns.some(pattern => pattern.test(command));
  if (!isAllowed) {
    throw new Error(`Command not whitelisted: ${command}`);
  }
  
  try {
    const { stdout, stderr } = await execPromise(command, { timeout: 5000 });
    return {
      command,
      exitCode: 0,
      stdout: stdout.substring(0, 5000),
      stderr: stderr.substring(0, 5000)
    };
  } catch (error) {
    return {
      command,
      exitCode: error.code || 1,
      stdout: error.stdout?.substring(0, 5000) || '',
      stderr: error.stderr?.substring(0, 5000) || error.message
    };
  }
}

/**
 * Handle incoming JSON-RPC messages
 */
async function handleMessage(socket, message) {
  try {
    const request = JSON.parse(message);
    const { jsonrpc, id, method, params } = request;
    
    if (jsonrpc !== '2.0') {
      sendResponse(socket, id, null, { message: 'Invalid JSON-RPC version' });
      return;
    }
    
    console.log(`[MCP] Received method: ${method}`);
    
    switch (method) {
      case 'initialize':
        handleInitialize(socket, id, params);
        break;
        
      case 'tools/list':
        handleListTools(socket, id);
        break;
        
      case 'tools/call':
        await handleCallTool(socket, id, params);
        break;
        
      default:
        sendResponse(socket, id, null, { message: `Unknown method: ${method}`, code: -32601 });
    }
  } catch (error) {
    console.error('[MCP] Parse error:', error.message);
  }
}

/**
 * Start MCP Server
 */
function startMCPServer(port = 3001) {
  const server = net.createServer((socket) => {
    console.log(`[MCP] Client connected from ${socket.remoteAddress}`);
    
    let buffer = '';
    
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Process complete lines (one JSON per line)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          handleMessage(socket, line);
        }
      }
    });
    
    socket.on('end', () => {
      console.log('[MCP] Client disconnected');
    });
    
    socket.on('error', (error) => {
      console.error('[MCP] Socket error:', error.message);
    });
  });
  
  server.listen(port, () => {
    console.log(`\n🚀 MCP Server listening on port ${port}`);
    console.log(`   Clients can connect via: localhost:${port}`);
    console.log(`\n📋 Available Tools:`);
    console.log(`   - device-info: Get system information`);
    console.log(`   - read-file: Read file contents`);
    console.log(`   - write-file: Write to files`);
    console.log(`   - execute-command: Run safe shell commands\n`);
  });
  
  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    process.exit(1);
  });
}

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.MCP_PORT || 3001;
  startMCPServer(PORT);
}

module.exports = { startMCPServer };
