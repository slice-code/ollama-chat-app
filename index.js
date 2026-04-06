const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');

const PORT = 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const REQUEST_TIMEOUT = 120000; // 120 seconds timeout for Ollama requests

// Import database
const conversationDB = require('./database.js');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper function to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      callback(JSON.parse(body));
    } catch (e) {
      callback({});
    }
  });
}

// Proxy request to Ollama API with timeout protection
function proxyToOllama(path, method, body, res) {
  const url = new URL(path, OLLAMA_HOST);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // For streaming responses (NDJSON), handle properly
    if (proxyRes.headers['content-type']?.includes('application/x-ndjson') || 
        proxyRes.headers['content-type']?.includes('application/json')) {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      
      // For streaming, pass through with proper chunk handling
      if (method === 'POST' && path.includes('/api/chat')) {
        let buffer = '';
        proxyRes.on('data', (chunk) => {
          res.write(chunk);
        });
        proxyRes.on('end', () => {
          res.end();
        });
      } else {
        proxyRes.pipe(res);
      }
    } else {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    }
  });

  // Set timeout for the request
  proxyReq.setTimeout(REQUEST_TIMEOUT, () => {
    proxyReq.destroy();
    console.error('❌ Request timeout after ' + REQUEST_TIMEOUT + 'ms');
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Request timeout',
      message: 'Ollama request took too long to complete',
      hint: 'Make sure Ollama model is not overloaded'
    }));
  });

  proxyReq.on('error', (err) => {
    console.error('Ollama proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Cannot connect to Ollama',
        message: err.message,
        hint: 'Make sure Ollama is running on ' + OLLAMA_HOST
      }));
    }
  });

  if (body) {
    proxyReq.write(JSON.stringify(body));
  }
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Routes
  if (req.url === '/api/ollama/generate' && req.method === 'POST') {
    parseBody(req, (body) => {
      const { model, prompt, stream = true, context, options } = body;
      if (!model || !prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: model, prompt' }));
        return;
      }
      
      // Handle streaming response for /api/generate
      const url = new URL('/api/generate', OLLAMA_HOST);
      const proxyOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const proxyReq = http.request(proxyOptions, (proxyRes) => {
        // Set headers for streaming response - disable buffering
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': 'chunked',
          'Connection': 'keep-alive'
        });
        
        // Stream chunks directly to client immediately
        proxyRes.on('data', (chunk) => {
          res.write(chunk);
        });

        proxyRes.on('end', () => {
          res.end();
        });

        proxyRes.on('error', (err) => {
          console.error('Ollama response error:', err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
          }
          res.end();
        });
      });

      // Set timeout
      proxyReq.setTimeout(REQUEST_TIMEOUT, () => {
        proxyReq.destroy();
        console.error('❌ Request timeout after ' + REQUEST_TIMEOUT + 'ms');
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({
          error: 'Request timeout',
          message: 'Ollama request took too long to complete'
        }));
      });

      proxyReq.on('error', (err) => {
        console.error('Ollama proxy error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Cannot connect to Ollama',
            message: err.message
          }));
        }
      });

      // Send request body
      const requestBody = {
        model: model,
        prompt: prompt,
        stream: stream,
        ...(context !== undefined && { context }),
        ...(options && { options })
      };
      
      proxyReq.write(JSON.stringify(requestBody));
      proxyReq.end();
    });
    return;
  }

  if (req.url === '/api/ollama/chat' && req.method === 'POST') {
    parseBody(req, (body) => {
      const { model, messages, stream = true, options } = body;
      if (!model || !messages) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: model, messages' }));
        return;
      }
      
      // Handle streaming response for /api/chat
      const url = new URL('/api/chat', OLLAMA_HOST);
      const proxyOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const proxyReq = http.request(proxyOptions, (proxyRes) => {
        // Set headers for streaming response - disable buffering
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': 'chunked',
          'Connection': 'keep-alive'
        });
        
        // Stream chunks directly to client immediately
        proxyRes.on('data', (chunk) => {
          res.write(chunk);
        });

        proxyRes.on('end', () => {
          res.end();
        });

        proxyRes.on('error', (err) => {
          console.error('Ollama response error:', err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
          }
          res.end();
        });
      });

      // Set timeout
      proxyReq.setTimeout(REQUEST_TIMEOUT, () => {
        proxyReq.destroy();
        console.error('❌ Request timeout after ' + REQUEST_TIMEOUT + 'ms');
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({
          error: 'Request timeout',
          message: 'Ollama request took too long to complete'
        }));
      });

      proxyReq.on('error', (err) => {
        console.error('Ollama proxy error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Cannot connect to Ollama',
            message: err.message
          }));
        }
      });

      // Send request body
      const requestBody = {
        model: model,
        messages: messages,
        stream: stream,
        ...(options && { options })
      };
      
      proxyReq.write(JSON.stringify(requestBody));
      proxyReq.end();
    });
    return;
  }

  if (req.url === '/api/ollama/tags' && req.method === 'GET') {
    proxyToOllama('/api/tags', 'GET', null, res);
    return;
  }

  if (req.url === '/api/ollama/ps' && req.method === 'GET') {
    proxyToOllama('/api/ps', 'GET', null, res);
    return;
  }

  if (req.url === '/api/ollama/version' && req.method === 'GET') {
    proxyToOllama('/api/version', 'GET', null, res);
    return;
  }

  // Conversation History API (with SQLite)
  if (req.url.startsWith('/api/conversations') && req.method === 'GET') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get('session_id');
    
    if (sessionId) {
      // Get specific session history
      const history = conversationDB.getHistory(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
    } else {
      // List all sessions
      const sessions = conversationDB.listSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sessions }));
    }
    return;
  }

  if (req.url === '/api/conversations' && req.method === 'POST') {
    parseBody(req, (body) => {
      const { session_id, role, content } = body;
      
      if (!session_id || !role || !content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: session_id, role, content' }));
        return;
      }
      
      // Validate content length (prevent bloat)
      const contentStr = String(content).trim();
      if (contentStr.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Content cannot be empty' }));
        return;
      }
      
      if (contentStr.length > 50000) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Content too large (max 50KB)' }));
        return;
      }
      
      // Validate role
      if (!['user', 'assistant', 'bot', 'system'].includes(role.toLowerCase())) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid role. Must be user, assistant, bot, or system' }));
        return;
      }
      
      console.log('💾 Saving message:', { session_id, role, content_length: contentStr.length });
      
      // Ensure session exists before adding message
      const session = conversationDB.getOrCreateSession(session_id, 'Chat Session', 'llama3.2:latest');
      console.log('📋 Session:', session);
      
      // Add message to database
      const result = conversationDB.addMessage(session_id, role, contentStr);
      console.log('✓ Message saved, ID:', result.lastInsertRowid);
      
      // Auto-generate title from first user message
      if (role === 'user') {
        const currentSession = conversationDB.getSession(session_id);
        if (currentSession && currentSession.title === 'New Chat' && contentStr.length < 50) {
          conversationDB.updateSessionTitle(session_id, contentStr.substring(0, 30) + (contentStr.length > 30 ? '...' : ''));
          console.log('✏️ Updated session title');
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: result.lastInsertRowid }));
    });
    return;
  }

  if (req.url.match(/^\/api\/conversations\/[^\/]+$/) && req.method === 'DELETE') {
    const sessionId = req.url.split('/').pop();
    conversationDB.deleteSession(sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.url.match(/^\/api\/conversations\/[^\/]+\/title$/) && req.method === 'PUT') {
    const parts = req.url.split('/');
    const sessionId = parts[3];

    parseBody(req, (body) => {
      const rawTitle = typeof body.title === 'string' ? body.title : '';
      const title = rawTitle.trim();

      if (!sessionId || !title) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: session_id, title' }));
        return;
      }

      const finalTitle = title.slice(0, 80);
      const result = conversationDB.updateSessionTitle(sessionId, finalTitle);

      if (!result.changes) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, title: finalTitle }));
    });
    return;
  }

  if (req.url === '/api/stats' && req.method === 'GET') {
    const stats = conversationDB.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats }));
    return;
  }

  // Static file serving
  let filePath = req.url.split('?')[0];

  // Treat root-like URLs as index.html (including /?source=pwa from manifest start_url)
  if (!filePath || filePath === '/') {
    filePath = '/index.html';
  }

  // Normalize to a relative path so path.join cannot escape __dirname
  filePath = filePath.replace(/^\/+/, '');
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 Server Error</h1>');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Track active connections
const activeConnections = new Map();

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  activeConnections.set(socket.id, { connectedAt: Date.now() });

  // Send initial connection confirmation
  socket.emit('connected', { 
    socketId: socket.id, 
    message: 'Connected to chat server',
    timestamp: new Date().toISOString()
  });

  // Handle chat messages from client
  socket.on('send_message', (data) => {
    const { sessionId, userMessage, conversationHistory = [], model = 'llama3.2:latest' } = data;
    
    if (!sessionId || !userMessage) {
      socket.emit('error', { message: 'Missing sessionId or userMessage' });
      return;
    }

    console.log(`💬 Message from ${socket.id}: ${userMessage.substring(0, 50)}...`);

    // Save user message to database
    conversationDB.addMessage(sessionId, 'user', userMessage);

    // Build request to Ollama
    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    // Proxy to Ollama chat API with streaming
    const url = new URL('/api/chat', OLLAMA_HOST);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let fullResponse = '';
      let lineBuffer = '';
      let isStreamDone = false;
      
      proxyRes.on('data', (chunk) => {
        // Avoid processing after stream is done
        if (isStreamDone) return;
        
        const chunkStr = chunk.toString();
        fullResponse += chunkStr;
        lineBuffer += chunkStr;
        
        // Parse NDJSON lines from buffer
        const lines = lineBuffer.split('\n');
        
        // Keep the last incomplete line in buffer (might be incomplete)
        lineBuffer = lines.pop() || '';
        
        // Process complete lines
        lines.forEach(line => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return; // Skip empty lines
          
          try {
            const json = JSON.parse(trimmedLine);
            if (json.message && json.message.content) {
              // Debug: log each chunk being sent
              console.log(`📤 [EMIT] Chunk "${json.message.content.substring(0, 30)}..." (len=${json.message.content.length}), done=${json.done}`);
              // Emit streaming chunk to client - only once per line
              socket.emit('message_chunk', { 
                chunk: json.message.content,
                done: json.done || false
              });
              
              // Mark stream as done if this is the last message
              if (json.done === true) {
                isStreamDone = true;
              }
            }
          } catch (e) {
            console.warn('⚠️ Failed to parse NDJSON line:', trimmedLine.substring(0, 50), '...', e.message);
          }
        });
      });

      proxyRes.on('end', () => {
        // Process any remaining data in buffer
        if (lineBuffer.trim()) {
          try {
            const json = JSON.parse(lineBuffer.trim());
            if (json.message && json.message.content && !isStreamDone) {
              socket.emit('message_chunk', { 
                chunk: json.message.content,
                done: json.done || false
              });
              isStreamDone = true;
            }
          } catch (e) {
            console.warn('⚠️ Failed to parse final buffer:', lineBuffer.substring(0, 50), '...', e.message);
          }
        }
        
        // Save complete response to database
        try {
          if (fullResponse.trim()) {
            // Extract all content chunks and concatenate them
            const allLines = fullResponse.split('\n').filter(l => l.trim());
            let completeResponse = '';
            
            allLines.forEach(line => {
              try {
                const json = JSON.parse(line);
                if (json.message && json.message.content) {
                  completeResponse += json.message.content;
                }
              } catch (e) {
                // Skip unparseable lines
              }
            });
            
            if (completeResponse.trim()) {
              conversationDB.addMessage(sessionId, 'assistant', completeResponse.trim());
            }
          }
        } catch (e) {
          console.error('Error saving response to database:', e.message);
        }
        
        // Send completion signal
        socket.emit('message_complete', { 
          message: 'Response complete',
          timestamp: new Date().toISOString()
        });
        
        console.log(`✓ Stream complete, total response length: ${fullResponse.length} bytes`);
      });
    });

    proxyReq.setTimeout(REQUEST_TIMEOUT, () => {
      proxyReq.destroy();
      socket.emit('error', { message: 'Request timeout' });
    });

    proxyReq.on('error', (err) => {
      console.error('Ollama proxy error:', err.message);
      socket.emit('error', { 
        message: 'Cannot connect to Ollama',
        details: err.message
      });
    });

    // Send request to Ollama
    const requestBody = {
      model: model,
      messages: messages,
      stream: true
    };

    proxyReq.write(JSON.stringify(requestBody));
    proxyReq.end();
  });

  // Handle model list request
  socket.on('request_models', () => {
    proxyToOllamaSocket('/api/tags', 'GET', null, (response) => {
      socket.emit('models_list', response);
    });
  });

  // Handle running models request
  socket.on('request_running', () => {
    proxyToOllamaSocket('/api/ps', 'GET', null, (response) => {
      socket.emit('running_models', response);
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    activeConnections.delete(socket.id);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Error for socket ${socket.id}:`, error);
  });
});

// Helper function to proxy Ollama requests for Socket.IO
function proxyToOllamaSocket(path, method, body, callback) {
  const url = new URL(path, OLLAMA_HOST);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => data += chunk);
    proxyRes.on('end', () => {
      try {
        callback(JSON.parse(data));
      } catch (e) {
        callback({ error: 'Failed to parse response' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    callback({ error: err.message });
  });

  if (body) {
    proxyReq.write(JSON.stringify(body));
  }
  proxyReq.end();
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Ollama proxy: ${OLLAMA_HOST}`);
  console.log(`Database: ./data/chat-history.db`);
  console.log(`Socket.IO: ws://localhost:${PORT}`);
  console.log('');
  console.log('API Endpoints:');
  console.log('  Ollama APIs:');
  console.log('    GET  /api/ollama/tags     - List available models');
  console.log('    GET  /api/ollama/ps       - List running models');
  console.log('    GET  /api/ollama/version  - Ollama version');
  console.log('    POST /api/ollama/generate - Generate text');
  console.log('    POST /api/ollama/chat     - Chat completion');
  console.log('');
  console.log('  Conversation History (SQLite):');
  console.log('    GET  /api/conversations        - List all sessions');
  console.log('    GET  /api/conversations?session_id=X - Get session history');
  console.log('    POST /api/conversations        - Add message to conversation');
  console.log('    DELETE /api/conversations/:id  - Delete session');
  console.log('    GET  /api/stats                - Get statistics');
});
