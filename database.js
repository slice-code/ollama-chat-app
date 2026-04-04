const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'chat-history.db'));

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    title TEXT,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_id ON sessions(session_id);
`);

// Conversation CRUD operations
const conversationDB = {
  // Create new session
  createSession(sessionId, title = 'New Chat', model = 'llama3.2:latest') {
    const stmt = db.prepare(`
      INSERT INTO sessions (session_id, title, model)
      VALUES (?, ?, ?)
    `);
    return stmt.run(sessionId, title, model);
  },

  // Get or create session
  getOrCreateSession(sessionId) {
    let session = this.getSession(sessionId);
    if (!session) {
      this.createSession(sessionId);
      session = this.getSession(sessionId);
    }
    return session;
  },

  // Get session by ID
  getSession(sessionId) {
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE session_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    return stmt.get(sessionId);
  },

  // List all sessions
  listSessions(limit = 50) {
    const stmt = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM conversations c WHERE c.session_id = s.session_id) as message_count
      FROM sessions s
      ORDER BY s.updated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // Add message to conversation
  addMessage(sessionId, role, content) {
    const stmt = db.prepare(`
      INSERT INTO conversations (session_id, role, content)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(sessionId, role, content);
    
    // Update session timestamp
    this.updateSessionTimestamp(sessionId);
    
    return result;
  },

  // Get conversation history for a session
  getHistory(sessionId, limit = 100) {
    const stmt = db.prepare(`
      SELECT role, content, timestamp 
      FROM conversations 
      WHERE session_id = ? 
      ORDER BY timestamp ASC 
      LIMIT ?
    `);
    return stmt.all(sessionId, limit).map(row => ({
      role: row.role,
      content: row.content,
      timestamp: row.timestamp
    }));
  },

  // Get recent messages with token estimation
  getRecentMessages(sessionId, limit = 20) {
    const stmt = db.prepare(`
      SELECT role, content 
      FROM conversations 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(sessionId, limit).reverse();
  },

  // Update session timestamp
  updateSessionTimestamp(sessionId) {
    const stmt = db.prepare(`
      UPDATE sessions 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE session_id = ?
    `);
    return stmt.run(sessionId);
  },

  // Update session title
  updateSessionTitle(sessionId, title) {
    const stmt = db.prepare(`
      UPDATE sessions 
      SET title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `);
    return stmt.run(title, sessionId);
  },

  // Delete session and its messages
  deleteSession(sessionId) {
    const deleteConversations = db.prepare(`
      DELETE FROM conversations WHERE session_id = ?
    `);
    const deleteSession = db.prepare(`
      DELETE FROM sessions WHERE session_id = ?
    `);
    
    db.transaction(() => {
      deleteConversations.run(sessionId);
      deleteSession.run(sessionId);
    })();
  },

  // Clear old messages (keep last N)
  clearOldMessages(sessionId, keepLast = 50) {
    const stmt = db.prepare(`
      DELETE FROM conversations 
      WHERE session_id = ? AND id NOT IN (
        SELECT id FROM conversations 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `);
    return stmt.run(sessionId, sessionId, keepLast);
  },

  // Get statistics
  getStats() {
    const stats = {};
    
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
    stats.totalSessions = totalSessions.count;
    
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM conversations').get();
    stats.totalMessages = totalMessages.count;
    
    const avgMessagesPerSession = db.prepare(`
      SELECT AVG(msg_count) as avg FROM (
        SELECT COUNT(*) as msg_count FROM conversations GROUP BY session_id
      )
    `).get();
    stats.avgMessagesPerSession = Math.round(avgMessagesPerSession.avg || 0);
    
    return stats;
  }
};

module.exports = conversationDB;
