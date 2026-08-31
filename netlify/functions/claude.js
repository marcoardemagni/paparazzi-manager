const https = require('https');

exports.handler = async function(event) {
  const body = JSON.parse(event.body);
  
  // Handle article fetch requests
  if(body.type === 'fetch') {
    return new Promise((resolve) => {
      const url = new URL(body.url);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        }
      };
      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({
          statusCode: 200,
          body: data
        }));
      }).on('error', (e) => resolve({
        statusCode: 500,
        body: e.message
      }));
    });
  }

  // Handle Claude API requests
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: data
      }));
    });
    req.on('error', (e) => resolve({ statusCode: 500, body: e.message }));
    req.write(payload);
    req.end();
  });
};