/**
 * MCP Web Search Integration
 * Uses Brave Search API or fallback simple search
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Search web using Brave Search API
 */
async function searchWeb(query) {
  if (!query || query.trim().length === 0) {
    return { error: 'Query cannot be empty' };
  }

  try {
    // If Brave API key available use it
    if (BRAVE_API_KEY) {
      return await searchBraveAPI(query);
    } else {
      // Fallback to Google search simulation
      return await searchFallback(query);
    }
  } catch (error) {
    console.error('❌ Web search error:', error.message);
    return { error: error.message };
  }
}

/**
 * Search using Brave Search API
 */
async function searchBraveAPI(query) {
  return new Promise((resolve, reject) => {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.append('q', query);
    url.searchParams.append('count', '5');
    url.searchParams.append('result_filter', 'web');

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const results = result.web?.map((item, idx) => ({
            rank: idx + 1,
            title: item.title,
            url: item.url,
            description: item.description
          })) || [];

          resolve({ success: true, query, count: results.length, results });
        } catch (e) {
          reject(new Error('Failed to parse search results'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Fallback search (returns cached results or mock data)
 * In production, integrate with actual search API
 */
async function searchFallback(query) {
  // Mock search results for demo
  // In production, use Google Custom Search, Bing, etc.
  const mockResults = [
    {
      rank: 1,
      title: `Hasil pencarian: "${query}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      description: 'Silakan klik untuk melihat hasil pencarian lengkap di Google. MCP Web Search membutuhkan API key yang valid.'
    },
    {
      rank: 2,
      title: 'Cara setup Brave Search API',
      url: 'https://api.search.brave.com/documentation',
      description: 'Dapatkan API key gratis dari Brave Search untuk mengaktifkan fitur pencarian web.'
    },
    {
      rank: 3,
      title: 'Alternative Search APIs',
      url: 'https://www.programmableweb.com/category/search',
      description: 'Berbagai Search API yang tersedia: Google, Bing, DuckDuckGo, Serp, Yelp, dll.'
    }
  ];

  console.log(`⚠️ Using fallback search (set BRAVE_SEARCH_API_KEY for real results)`);
  return { success: true, query, count: mockResults.length, results: mockResults, fallback: true };
}

/**
 * Format search results for display
 */
function formatSearchResults(searchData) {
  if (searchData.error) {
    return `**Search Error:** ${searchData.error}`;
  }

  let output = `🔍 **Web Search Results for: "${searchData.query}"**\n`;
  output += `Found ${searchData.count} results${searchData.fallback ? ' (demo mode)' : ''}\n\n`;

  if (searchData.results.length === 0) {
    return output + 'No results found.';
  }

  searchData.results.forEach((result, idx) => {
    output += `**${idx + 1}. ${result.title}**\n`;
    output += `📎 ${result.url}\n`;
    output += `${result.description}\n\n`;
  });

  if (searchData.fallback) {
    output += `\n⚠️ **Note:** This is demo/fallback mode. Set \`BRAVE_SEARCH_API_KEY\` environment variable for real search results:\n`;
    output += `\`\`\`bash\nexport BRAVE_SEARCH_API_KEY=your_api_key\nnode index.js\n\`\`\`\n`;
  }

  return output;
}

module.exports = {
  searchWeb,
  formatSearchResults
};
