/**
 * Simple ML-based Intent Classifier
 * Classifies user messages into: device_info, web_search, rag_search, or general_chat
 * Uses Naive Bayes with TF-IDF scoring
 */

/**
 * Training data untuk Naive Bayes classifier
 */
const TRAINING_DATA = {
  device_info: [
    'berapa ram saya', 'cpu cores saya', 'gpu info', 'device status', 'spek pc',
    'memory usage', 'disk space', 'processor speed', 'uptime system',
    'berapa storage', 'konfigurasi device', 'sistem operasi apa',
    'ram berapa', 'cpu suhu', 'temperature processor', 'free memory',
    'used storage', 'sistem saya', 'device saya', 'pc saya',
    'how much ram do i have', 'what is my cpu', 'system specifications',
    'monitor system', 'cek hardware', 'informasi device'
  ],
  rag_search: [
    'lihat knowledge base', 'cari di dokumen', 'dari file yang disimpan',
    'lihat di database kami', 'informasi dari dokumen', 'dari knowledge base',
    'di dokumen yang ada', 'lihat dokumen', 'dari file', 'informasi dari database',
    'cek dokumen kami', 'search di knowledge base',
    // Geography & general knowledge (moved to RAG)
    'berapa populasi indonesia', 'berapa populasi dunia', 'populasi negara',
    'penduduk berapa banyak', 'jumlah penduduk indonesia', 'berapa jiwa negara',
    'kota mana terbesar', 'negara berapa luas', 'wilayah geografis',
    'apa ibu kota indonesia', 'sejarah negara', 'fakta tentang kota',
    // General knowledge queries
    'informasi tentang', 'tahu tentang', 'cari tentang', 'apa itu',
    'kapan', 'dimana', 'siapa', 'bagaimana', 'kenapa'
  ],
  general_chat: [
    'apa kabar', 'halo', 'hi there', 'hello', 'siapa nama kamu',
    'kamu siapa', 'bantuan', 'help me', 'terima kasih', 'thanks',
    'ok ok', 'bagus bagus', 'sip sip', 'maaf', 'sorry', 'mohon maaf'
  ]
};

/**
 * High-confidence keywords untuk override ML jika score rendah
 */
const HIGH_CONFIDENCE_KEYWORDS = {
  device_info: [
    // Specific device terms ONLY (no "berapa" alone)
    'ram saya', 'cpu saya', 'storage saya', 'gpu saya',
    'berapa ram', 'berapa cpu', 'berapa memory', 'berapa storage',
    'device saya', 'pc saya', 'sistem saya', 'spek pc',
    'uptime', 'temperature', 'usage', 'performance'
  ],
  rag_search: [
    'knowledge base', 'dokumen kami', 'file yang disimpan', 'database kami',
    // Geography & knowledge keywords
    'populasi', 'penduduk', 'ibu kota', 'negara', 'kota', 'geografis', 'wilayah', 'luas', 'batas',
    'sejarah', 'fakta tentang', 'informasi tentang',
    // All web search keywords moved to RAG
    'anime', 'manga', 'film', 'musik', 'game', 'buku', 'novel', 'komik',
    'python', 'javascript', 'docker', 'kubernetes', 'react', 'java', 'golang',
    'berita', 'artikel', 'tutorial', 'news', 'resep', 'recipe'
  ]
};

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Calculate word frequencies (TF)
 */
function calculateTF(tokens) {
  const tf = {};
  const total = tokens.length;
  
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1 / total;
  });
  
  return tf;
}

/**
 * Calculate Naive Bayes score for each category
 */
function classifyWithNaiveBayes(userMessage) {
  const tokens = tokenize(userMessage);
  const tf = calculateTF(tokens);
  
  const scores = {};
  
  // Calculate score for each category
  for (const [category, trainingTexts] of Object.entries(TRAINING_DATA)) {
    let categoryScore = 0;
    let totalWords = 0;
    
    // Combine all training texts for this category
    const allTrainingTokens = trainingTexts
      .flatMap(text => tokenize(text));
    
    // Count word frequencies in training data
    const trainingTF = calculateTF(allTrainingTokens);
    
    // Calculate match score
    for (const [token, frequency] of Object.entries(tf)) {
      if (trainingTF[token]) {
        // Higher score if word appears in training data
        categoryScore += frequency * trainingTF[token];
        totalWords++;
      }
    }
    
    // Normalize by word count
    scores[category] = totalWords > 0 ? categoryScore / totalWords : 0;
  }
  
  return scores;
}

/**
 * Get best matching intent with confidence
 * Smart context-aware classification
 */
function getIntent(userMessage, confidenceThreshold = 0.1) {
  const lowerMessage = userMessage.toLowerCase();
  
  // Device keywords (specifics only)
  const deviceKeywords = ['ram saya', 'cpu saya', 'storage saya', 'gpu saya', 'berapa ram', 'berapa cpu', 'berapa memory', 'berapa storage'];
  const hasDeviceKeyword = deviceKeywords.some(kw => lowerMessage.includes(kw));
  
  // Step 1: If has specific device keywords → device_info
  if (hasDeviceKeyword) {
    console.log(`  ✓ Specific device keyword detected`);
    return {
      intent: 'device_info',
      score: 0.95,
      confidence: 'high',
      method: 'keyword_device'
    };
  }
  
  // Step 2: Check for geography/population keywords (local RAG first)
  const geographyKeywords = ['populasi', 'penduduk', 'ibu kota', 'negara', 'kota', 'geografis', 'wilayah', 'luas', 'batas'];
  const hasGeographyKeyword = geographyKeywords.some(kw => lowerMessage.includes(kw));
  if (hasGeographyKeyword) {
    console.log(`  ✓ Geography keyword detected → rag_search (local knowledge base first)`);
    return {
      intent: 'rag_search',
      score: 0.90,
      confidence: 'high',
      method: 'keyword_geography'
    };
  }
  
  // Step 3: Check other high-confidence keywords
  for (const [category, keywords] of Object.entries(HIGH_CONFIDENCE_KEYWORDS)) {
    if (category === 'device_info') continue; // Already handled above
    
    const hasKeyword = keywords.some(keyword => lowerMessage.includes(keyword));
    if (hasKeyword) {
      const matchedKeyword = keywords.find(kw => lowerMessage.includes(kw));
      console.log(`  ✓ High-confidence keyword "${matchedKeyword}" detected for ${category}`);
      return {
        intent: category,
        score: 0.95,
        confidence: 'high',
        method: `keyword_${category}`
      };
    }
  }
  
  // Step 4: Fallback to Naive Bayes scoring
  const scores = classifyWithNaiveBayes(userMessage);
  
  // Sort by score
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a);
  
  const [bestIntent, bestScore] = sorted[0];
  
  // Step 5: Context-aware bias
  // If has "berapa" + geography words → check RAG first
  if (lowerMessage.includes('berapa') && hasGeographyKeyword) {
    return {
      intent: 'rag_search',
      score: 0.85,
      confidence: 'high',
      method: 'bias_berapa_geography_rag',
      allScores: Object.fromEntries(sorted)
    };
  }
  
  // If has "berapa" without device context → bias to RAG
  if (lowerMessage.includes('berapa') && bestScore < 0.3) {
    return {
      intent: 'rag_search',
      score: 0.70,
      confidence: 'medium',
      method: 'bias_berapa_rag',
      allScores: Object.fromEntries(sorted)
    };
  }
  
  // If has "cari" + low score → bias to RAG
  if (lowerMessage.includes('cari') && bestScore < confidenceThreshold) {
    return {
      intent: 'rag_search',
      score: 0.65,
      confidence: 'medium',
      method: 'bias_cari_rag',
      allScores: Object.fromEntries(sorted)
    };
  }
  
  return {
    intent: bestIntent,
    score: bestScore,
    confidence: bestScore >= confidenceThreshold ? 'high' : 'low',
    method: 'naive_bayes',
    allScores: Object.fromEntries(sorted)
  };
}

/**
 * Classify message and return action
 */
function classifyMessage(userMessage) {
  const result = getIntent(userMessage);
  
  console.log(`[ML] Intent Classification:`);
  console.log(`  Message: "${userMessage}"`);
  console.log(`  Method: ${result.method} | Predicted: ${result.intent} (score: ${result.score.toFixed(4)})`);
  console.log(`  Confidence: ${result.confidence}`);
  
  return {
    shouldCallDevice: result.intent === 'device_info' && result.confidence !== 'low',
    shouldSearchRAG: result.intent === 'rag_search' && result.confidence !== 'low',
    intent: result.intent,
    confidence: result.confidence,
    score: result.score,
    method: result.method,
    allScores: result.allScores
  };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classifyMessage,
    getIntent,
    classifyWithNaiveBayes,
    tokenize,
    calculateTF
  };
}
