# Socket.IO Real-time Chat Implementation

## Overview
Chat UI telah diupdate untuk menggunakan Socket.IO untuk komunikasi real-time yang lebih responsif dengan server Ollama.

## Fitur Utama

✅ **Real-time Streaming**
- Pesan dimulai streaming langsung dari server
- Tidak perlu menunggu response lengkap

✅ **Responsive Communication**
- WebSocket connection untuk latency rendah
- Automatic reconnection handling
- Fallback ke REST API jika Socket.IO tidak tersedia

✅ **Session Management**
- Session ID otomatis disimpan di localStorage
- Conversation history disimpan di database

✅ **Error Handling**
- Graceful fallback ke callback `config.onChat` jika Socket.IO gagal
- Error events yang informatif

## Instalasi

```bash
npm install
```

Dependencies yang ditambahkan:
- `socket.io@^4.7.2` - WebSocket library untuk Node.js

## Cara Kerja

### Server-side (index.js)

Server mendengarkan event Socket.IO:

```javascript
socket.on('send_message', (data) => {
  const { sessionId, userMessage, conversationHistory, model } = data;
  
  // Proxy ke Ollama API
  // Stream response kembali ke client via socket.emit('message_chunk')
});
```

Event yang dipancarkan server:
- `connected` - Konfirmasi koneksi
- `message_chunk` - Chunk dari response (streaming)
- `message_complete` - Response selesai
- `error` - Error dari server
- `running_models` - List model yang running
- `models_list` - List semua model

### Client-side (chat-ui.js)

Client mengirim pesan via Socket.IO:

```javascript
socket.emit('send_message', {
  sessionId: sessionId,
  userMessage: text,
  conversationHistory: conversationHistory,
  model: config.model || 'llama3.2:latest'
});
```

Client mendengarkan streaming response:

```javascript
socket.on('message_chunk', (data) => {
  // Update UI dengan chunk baru
  responseText += data.chunk;
  renderMessages();
});

socket.on('message_complete', (data) => {
  // Selesai, simpan ke history
});
```

## Konfigurasi

### Di ollama-chat.js

```javascript
chatLocal({
  enableHistory: true,
  model: 'llama3.2:latest',  // Opsional, default llama3.2:latest
  sessionId: 'custom-session' // Opsional, auto-generated jika tidak ada
});
```

### Custom onChat Callback (fallback)

Jika Socket.IO tidak tersedia, aplikasi fallback ke config.onChat:

```javascript
chatLocal({
  enableHistory: true,
  onChat: async (message, onChunk, sendQuickReply) => {
    // Custom implementation
    // Ketika Chat UI mengirim pesan
  }
});
```

## Architecture

```
┌─────────────────┐
│   Browser       │
│  (Chat UI)      │
│   + chat-ui.js  │
└────────┬────────┘
         │ Socket.IO WebSocket
         │
┌────────▼────────┐
│  Node.js Server │
│  (index.js)     │
│  + Socket.IO    │
└────────┬────────┘
         │ HTTP REST
         │
┌────────▼────────┐
│  Ollama API     │
│  /api/chat      │
└─────────────────┘
```

## Flow Diagram: Chat Message

```
User Input
  ↓
sendMessage() in chat-ui.js
  ↓
Check if Socket.IO connected?
  ├─ YES → emit 'send_message' via Socket.IO
  │   ↓
  │   Server receives 'send_message'
  │   ↓
  │   Proxy to Ollama /api/chat
  │   ↓
  │   Stream NDJSON response
  │   ↓
  │   For each chunk:
  │     emit 'message_chunk' to client
  │   ↓
  │   When done:
  │     emit 'message_complete'
  │     Save to database
  │   ↓
  │   Client renders streaming chunks
  │
  └─ NO → Use config.onChat fallback (REST API)
      ↓
      Browser makes REST call
      ↓
      Render response
```

## Session Storage

Session ID disimpan di localStorage dengan key: `chat_session_id`

```javascript
sessionId = localStorage.getItem('chat_session_id') || 
            'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('chat_session_id', sessionId);
```

## Database Integration

Pesan disimpan ke SQLite database otomatis:

```javascript
conversationDB.addMessage(sessionId, 'user', userMessage);
conversationDB.addMessage(sessionId, 'assistant', botResponse);
```

## Troubleshooting

### Socket.IO tidak connect?

1. Pastikan server running: `node index.js`
2. Check CORS settings di index.js
3. Check browser console untuk error messages
4. Aplikasi akan fallback ke config.onChat secara otomatis

### Streaming lambat?

1. Check Ollama model status: `ollama ps`
2. Check network latency: F12 → Network tab
3. Check CPU/Memory usage

### Browser console error: "io is not defined"?

Socket.IO client script mungkin gagal load. Check:
1. Server running dengan Socket.IO
2. `/socket.io/socket.io.js` accessible
3. index.html include Socket.IO script: `<script src="/socket.io/socket.io.js"></script>`

## Testing

### Test Socket.IO Connection

Buka browser console dan jalankan:

```javascript
// Check Socket.IO connection
console.log(socket); // Harus ada object Socket.IO
console.log(socket.connected); // Harus true
console.log(sessionId); // Harus ada session ID

// Test manual message
socket.emit('send_message', {
  sessionId: sessionId,
  userMessage: 'Hello!',
  conversationHistory: [],
  model: 'llama3.2:latest'
});
```

### Test Model List

```javascript
socket.emit('request_models');
socket.on('models_list', (data) => {
  console.log('Models:', data);
});
```

## Performance Notes

- **Latency**: Socket.IO WebSocket ~50-100ms lebih cepat dari REST polling
- **Bandwidth**: NDJSON streaming lebih efisien dari full response JSON
- **Memory**: Server-side connection tracking di `activeConnections` Map
- **Scalability**: Dapat di-scale dengan Socket.IO namespace dan room features

## Future Enhancements

- [ ] Implement typing indicators dengan Socket.IO
- [ ] Add collaborative editing dengan shared conversations
- [ ] Real-time user presence indicators  
- [ ] Message reactions/reactions via Socket.IO
- [ ] Implement Socket.IO rooms untuk group chats
- [ ] Add reconnection exponential backoff
- [ ] Implement message acknowledgment (ACK)
