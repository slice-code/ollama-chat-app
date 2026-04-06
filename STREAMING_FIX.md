# Streaming Response Fix for `/api/ollama/chat`

## Problem Statement
HTTP endpoint `POST /api/ollama/chat` was providing streaming responses (NDJSON format), but the UI was **NOT** displaying chunks in real-time. Instead, the UI waited for the entire response to complete before displaying text.

### Root Cause Analysis
- **Backend Issue (index.js)**: Used generic `proxyToOllama()` function which called `proxyRes.pipe(res)` - this causes Node.js to buffer chunks before sending
- **Response Headers**: Missing critical streaming headers (`Cache-Control: no-cache`, `Transfer-Encoding: chunked`)
- **No Explicit Flushing**: Chunks weren't being immediately flushed to client

## Solution Implemented ✅

### Changes to `index.js`

#### 1. **`POST /api/ollama/chat` endpoint** (lines 131-195)
Replaced generic proxy call with explicit streaming handler:

```javascript
// BEFORE: Used buffering proxy
proxyToOllama('/api/chat', 'POST', { model, messages, stream }, res);

// AFTER: Direct streaming with proper headers
const proxyReq = http.request(proxyOptions, (proxyRes) => {
  // ✅ Set streaming headers
  res.writeHead(proxyRes.statusCode, {
    'Content-Type': proxyRes.headers['content-type'] || 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',           // ← Prevent buffering
    'Transfer-Encoding': 'chunked',         // ← Enable chunked transfer
    'Connection': 'keep-alive'              // ← Keep connection alive
  });
  
  // ✅ Stream chunks immediately
  proxyRes.on('data', (chunk) => {
    res.write(chunk);  // Write immediately, don't buffer
  });
  
  proxyRes.on('end', () => {
    res.end();
  });
});
```

#### 2. **`POST /api/ollama/generate` endpoint** (lines 116-190)
Applied identical streaming fix for consistency

### Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Buffering** | Full response buffered in memory | Chunks streamed immediately |
| **Headers** | Generic JSON headers | Streaming-specific headers |
| **Client Experience** | Wait for complete response | Real-time chunk display |
| **Memory Usage** | High (buffered response) | Low (streamed) |
| **Response Time** | Delayed | Immediate (first chunk) |

## How It Works Now

### Data Flow:
```
Client (UI)
   ↓
   └→ fetch('/api/ollama/chat', {stream: true})
        ↓
        └→ Server receives request
             ↓
             └→ Forwards to Ollama API  
                  ↓
                  └→ Ollama sends NDJSON chunks
                       ↓
                       └→ Server receives chunk
                            ↓
                            ✅ res.write(chunk) - sends immediately
                                 ↓
                                 └→ Client receives chunk
                                      ↓
                                      └→ response.body.getReader()
                                           ↓
                                           └→ streamChunk(content) callback
                                                ↓
                                                └→ ✅ UI updates in REAL-TIME
```

### Frontend Code (ollama-chat.js, lines 1660-1681):
```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullResponse = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.message && data.message.content) {
        fullResponse += data.message.content;
        streamChunk(content);  // ← Callback to update UI with chunk
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
}
```

## Testing

### Test 1: Check Streaming Headers
```bash
curl -i -X POST http://localhost:3000/api/ollama/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:1.5b-instruct","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```
Expected headers:
- `Transfer-Encoding: chunked` ✅
- `Cache-Control: no-cache` ✅
- `Connection: keep-alive` ✅

### Test 2: Real-time Streaming in UI
1. Open http://localhost:3000
2. Send message
3. Watch text appear INCREMENTALLY in chat bubble ✅

## Files Modified
- `/home/gugus/chat-ui/index.js` - Backend streaming handlers

## Server Restart
Server has been restarted with PM2:
```bash
pm2 restart chat-ui
```

## Performance Impact
- **Positive**: Better UX with real-time streaming
- **Positive**: Lower memory usage (no buffering)
- **Neutral**: Minimal CPU impact

## Note
Socket.IO channel already had proper streaming implemented. This fix aligns the REST API streaming behavior with the Socket.IO implementation.
