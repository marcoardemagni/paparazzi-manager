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
        res.on('end', () => resolve({ statusCode: 200, body: data }));
      }).on('error', (e) => resolve({ statusCode: 500, body: e.message }));
    });
  }

  // Handle meteo requests via Open-Meteo geocoding + forecast
  if(body.type === 'meteo') {
    const city = encodeURIComponent(body.city || 'Torino');
    
    // Step 1: geocode city
    const geoData = await new Promise((resolve) => {
      https.get(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=it&format=json`, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
      }).on('error', () => resolve({}));
    });
    
    const results = geoData.results;
    if(!results || !results.length) {
      return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({weather:[], current_condition:[]}) };
    }
    const { latitude, longitude } = results[0];
    
    // Step 2: get forecast
    const forecastData = await new Promise((resolve) => {
      const path = `/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&current_weather=true&timezone=Europe%2FRome&forecast_days=7`;
      https.get(`https://api.open-meteo.com${path}`, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
      }).on('error', () => resolve({}));
    });
    
    const daily = forecastData.daily || {};
    const dates = daily.time || [];
    const weather = dates.map((date, i) => ({
      date,
      maxtempC: String(Math.round(daily.temperature_2m_max[i])),
      mintempC: String(Math.round(daily.temperature_2m_min[i])),
      weatherCode: daily.weathercode ? String(daily.weathercode[i]) : '0'
    }));
    
    const cur = forecastData.current_weather || {};
    const current_condition = cur.temperature !== undefined ? [{
      temp_C: String(Math.round(cur.temperature)),
      weatherCode: String(cur.weathercode || 0)
    }] : [];
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weather, current_condition })
    };
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
      res.on('end', () => resolve({ statusCode: 200, headers: {'Content-Type':'application/json'}, body: data }));
    });
    req.on('error', (e) => resolve({ statusCode: 500, body: e.message }));
    req.write(payload);
    req.end();
  });
};
