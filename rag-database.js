const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'rag-documents.db'));

// Initialize RAG database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
`);

// RAG Database operations
const ragDB = {
  // Add new document
  addDocument(title, content) {
    const stmt = db.prepare(`
      INSERT INTO documents (title, content)
      VALUES (?, ?)
    `);
    return stmt.run(title, content);
  },

  // Get all documents (list)
  getAllDocuments() {
    const stmt = db.prepare(`
      SELECT id, title, created_at, updated_at
      FROM documents
      ORDER BY created_at DESC
    `);
    return stmt.all();
  },

  // Get document by ID (full content)
  getDocument(id) {
    const stmt = db.prepare(`
      SELECT * FROM documents WHERE id = ?
    `);
    return stmt.get(id);
  },

  // Update document
  updateDocument(id, title, content) {
    const stmt = db.prepare(`
      UPDATE documents
      SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(title, content, id);
  },

  // Delete document
  deleteDocument(id) {
    const stmt = db.prepare(`
      DELETE FROM documents WHERE id = ?
    `);
    return stmt.run(id);
  },

  // Search documents with relevance scoring
  searchDocuments(query) {
    try {
      const lowerQuery = query.toLowerCase();
      
      // Helper function to escape regex special characters
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Split query into individual words for matching, filter out punctuation-only words
      const words = lowerQuery
        .split(/\s+/)
        .filter(w => w.length > 0 && /[a-z0-9]/i.test(w)) // Keep only words with alphanumeric
        .map(w => w.replace(/[^a-z0-9]/gi, '')); // Remove non-alphanumeric characters from words
      
      // Query all documents WITH content from database
      const stmt = db.prepare(`
        SELECT id, title, content, created_at
        FROM documents
        ORDER BY created_at DESC
      `);
      const allDocs = stmt.all();
      
      // Score each document based on word matches
      const scoredDocs = allDocs.map(doc => {
        const docTitle = (doc.title || '').toLowerCase();
        const docContent = (doc.content || '').toLowerCase();
        
        let score = 0;
        
        // Count word matches in title (weight: 3x)
        words.forEach(word => {
          if (word) {
            const escapedWord = escapeRegex(word);
            const titleMatches = (docTitle.match(new RegExp(escapedWord, 'g')) || []).length;
            score += titleMatches * 3;
          }
        });
        
        // Count word matches in content (weight: 1x)
        words.forEach(word => {
          if (word) {
            const escapedWord = escapeRegex(word);
            const contentMatches = (docContent.match(new RegExp(escapedWord, 'g')) || []).length;
            score += contentMatches * 1;
          }
        });
        
        return { ...doc, score };
      })
      .filter(doc => doc.score > 0) // Only keep docs with matches
      .sort((a, b) => b.score - a.score); // Sort by relevance (highest first)
      
      return scoredDocs.slice(0, 3); // Return top 3 most relevant
    } catch (err) {
      console.error('❌ Search error:', err);
      return [];
    }
  },

  // Get document count
  getDocumentCount() {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM documents
    `);
    const result = stmt.get();
    return result.count;
  },

  // Get total documents size (for info)
  getDocumentsInfo() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_docs,
        SUM(LENGTH(content)) as total_size_bytes
      FROM documents
    `);
    return stmt.get();
  }
};

module.exports = ragDB;
