const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

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

// Proxy request to Ollama API
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
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Ollama proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Cannot connect to Ollama',
      message: err.message,
      hint: 'Make sure Ollama is running on ' + OLLAMA_HOST
    }));
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
      const { model, prompt, stream = true, context } = body;
      if (!model || !prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: model, prompt' }));
        return;
      }
      proxyToOllama('/api/generate', 'POST', { model, prompt, stream, context }, res);
    });
    return;
  }

  if (req.url === '/api/ollama/chat' && req.method === 'POST') {
    parseBody(req, (body) => {
      const { model, messages, stream = true } = body;
      if (!model || !messages) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: model, messages' }));
        return;
      }
      proxyToOllama('/api/chat', 'POST', { model, messages, stream }, res);
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
      
      console.log('💾 Saving message:', { session_id, role, content_length: content.length });
      
      // Ensure session exists before adding message
      const session = conversationDB.getOrCreateSession(session_id, 'Chat Session', 'llama3.2:latest');
      console.log('📋 Session:', session);
      
      // Add message to database
      const result = conversationDB.addMessage(session_id, role, content);
      console.log('✓ Message saved, ID:', result.lastInsertRowid);
      
      // Auto-generate title from first user message
      if (role === 'user') {
        const currentSession = conversationDB.getSession(session_id);
        if (currentSession && currentSession.title === 'New Chat' && content.length < 50) {
          conversationDB.updateSessionTitle(session_id, content.substring(0, 30) + (content.length > 30 ? '...' : ''));
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

  if (req.url === '/api/stats' && req.method === 'GET') {
    const stats = conversationDB.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats }));
    return;
  }

  // Static file serving
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = filePath.split('?')[0];
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

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Ollama proxy: ${OLLAMA_HOST}`);
  console.log(`Database: ./data/chat-history.db`);
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
