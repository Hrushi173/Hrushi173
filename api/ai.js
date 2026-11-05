const GATEWAY = 'https://co.agentrouter.org/v1';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai';
const WINDOW = globalThis.__axiomTeamRate || (globalThis.__axiomTeamRate = new Map());

function originAllowed(req) {
  const origin = String(req.headers?.origin || '');
  const appOrigin = /^https:\/\/axiomdesk-market-terminal(?:-[a-z0-9-]+)?\.vercel\.app$/i;
  if (!origin && req.method === 'GET') return appOrigin.test('https://' + String(req.headers?.host || ''));
  return appOrigin.test(origin) || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}
function rateAllowed(req) {
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
  const now = Date.now(), a = (WINDOW.get(ip) || []).filter(t => now - t < 3600000);
  if (a.length >= 12) { WINDOW.set(ip, a); return false; }
  a.push(now); WINDOW.set(ip, a);
  if (WINDOW.size > 2000) for (const [k, v] of WINDOW) if (!v.length || now - v[v.length - 1] > 3600000) WINDOW.delete(k);
  return true;
}
function send(res, status, body) { res.statusCode = status; res.setHeader('cache-control', 'no-store'); res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
function bodyOf(req) { if (req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
function provider() {
  if (process.env.GEMINI_API_KEY) return { key:process.env.GEMINI_API_KEY, base:GEMINI, name:'Google Gemini' };
  if (process.env.AGENTROUTER_API_KEY) return { key:process.env.AGENTROUTER_API_KEY, base:GATEWAY, name:'AgentRouter' };
  return null;
}
async function models(provider) {
  const r = await fetch(provider.base + '/models', { headers: { authorization: 'Bearer ' + provider.key, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) { const e = new Error('Gateway HTTP ' + r.status); e.gatewayStatus = r.status; throw e; }
  const d = await r.json();
  return (Array.isArray(d.data) ? d.data : []).map(x => ({ id: String(x.id || ''), name: String(x.name || x.id || '') })).filter(x => /^[A-Za-z0-9._:/-]{2,120}$/.test(x.id)).slice(0, 100);
}
async function completion(provider, model, role, context, maxTokens = 500) {
  const r = await fetch(provider.base + '/chat/completions', {
    method: 'POST', headers: { authorization: 'Bearer ' + provider.key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: maxTokens, messages: [
      { role: 'system', content: role + ' Use only supplied evidence. Explicitly label missing facts and uncertainty. Do not invent data, citations, catalysts, or price targets. Keep the report concise and decision-useful. This is research, not personalized financial advice.' },
      { role: 'user', content: context }
    ] }), signal: AbortSignal.timeout(22000)
  });
  if (!r.ok) throw new Error('AgentRouter completion returned HTTP ' + r.status);
  const d = await r.json(), c = d.choices?.[0]?.message?.content;
  const answer = Array.isArray(c) ? c.map(x => typeof x === 'string' ? x : x.text || '').join('') : String(c || '').trim();
  if (!answer) throw new Error('Empty agent response');
  return answer.slice(0, 9000);
}
function stats(candles, price, days, capital, riskPct) {
  const cs = (candles || []).filter(x => [x.open, x.high, x.low, x.close].every(Number.isFinite)).slice(-100);
  const ret = [];
  for (let i = 1; i < cs.length; i++) if (cs[i - 1].close > 0) ret.push(Math.log(cs[i].close / cs[i - 1].close));
  const mean = ret.length ? ret.reduce((a, b) => a + b, 0) / ret.length : 0;
  const vol = ret.length > 1 ? Math.sqrt(ret.reduce((a, b) => a + (b - mean) ** 2, 0) / (ret.length - 1)) : null;
  const tr = [];
  for (let i = Math.max(1, cs.length - 14); i < cs.length; i++) tr.push(Math.max(cs[i].high - cs[i].low, Math.abs(cs[i].high - cs[i - 1].close), Math.abs(cs[i].low - cs[i - 1].close)));
  const atr = tr.length ? tr.reduce((a, b) => a + b, 0) / tr.length : null;
  const sma = n => cs.length >= n ? cs.slice(-n).reduce((a, x) => a + x.close, 0) / n : null;
  const rangePct = vol == null ? null : 100 * (Math.exp(1.645 * vol * Math.sqrt(days)) - 1);
  const riskBudget = capital * riskPct / 100, stopGap = atr && atr > 0 ? atr * 1.5 : null;
  const shares = stopGap ? Math.max(0, Math.floor(Math.min(riskBudget / stopGap, capital / price))) : null;
  const longStop = stopGap ? +(price - stopGap).toFixed(4) : null, shortStop = stopGap ? +(price + stopGap).toFixed(4) : null;
  return { observations: ret.length, dailyVolatilityPct: vol == null ? null : +(vol * 100).toFixed(2), historicalRangePct90: rangePct == null ? null : +rangePct.toFixed(2), rangeLow90: rangePct == null ? null : +(price * Math.exp(-1.645 * vol * Math.sqrt(days))).toFixed(4), rangeHigh90: rangePct == null ? null : +(price * Math.exp(1.645 * vol * Math.sqrt(days))).toFixed(4), sma20: sma(20), sma50: sma(50), sma200: sma(200), atr14: atr == null ? null : +atr.toFixed(4), horizonDays: days, riskBudget: +riskBudget.toFixed(2), riskPct, accountSize: capital, stopGap: stopGap == null ? null : +stopGap.toFixed(4), longStop, longTarget2R: stopGap ? +(price + stopGap * 2).toFixed(4) : null, shortStop, shortTarget2R: stopGap ? +(price - stopGap * 2).toFixed(4) : null, maxSharesAtRisk: shares, paperNotional: shares == null ? null : +(shares * price).toFixed(2) };
}
const PEERS = {
  it: ['TCS','INFY','WIPRO','HCLTECH','TECHM'], tech: ['AAPL','MSFT','NVDA','GOOGL','AMZN'],
  financials: ['HDFCBANK','ICICIBANK','SBIN','AXISBANK','KOTAKBANK','BAJFINANCE'], banks: ['HDFCBANK','ICICIBANK','SBIN','AXISBANK','KOTAKBANK'],
  pharma: ['SUNPHARMA','DRREDDY','CIPLA','DIVISLAB','APOLLOHOSP'], auto: ['MARUTI','TATAMOTORS','M&M','BAJAJ-AUTO','EICHERMOT'],
  energy: ['RELIANCE','ONGC','NTPC','POWERGRID','TATAPOWER'], staples: ['ITC','HINDUNILVR','NESTLEIND','BRITANNIA','TATACONSUM']
};
function peerSymbols(symbol) {
  const suffix = /\.BO$/i.test(symbol) ? '.BO' : /\.NS$/i.test(symbol) ? '.NS' : '';
  const root = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
  const groups = Object.values(PEERS), group = groups.find(a => a.includes(root));
  return [...new Set([root, ...(group || [])].map(x => x + suffix))].slice(0, 12);
}
function sectorFor(symbol) {
  const root = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
  for (const [sector, names] of Object.entries({ 'Information Technology':PEERS.it, Technology:PEERS.tech, 'Financial Services':PEERS.financials, Banking:PEERS.banks, Healthcare:PEERS.pharma, Automotive:PEERS.auto, Energy:PEERS.energy, 'Consumer Staples':PEERS.staples })) if (names.includes(root)) return sector;
  return 'Not classified from the available feed';
}
async function appData(origin, symbol, peers) {
  const q = '/api/market?type=quotes&symbols=' + encodeURIComponent(peers.join(','));
  const c = '/api/market?type=chart&symbol=' + encodeURIComponent(symbol) + '&range=1y';
  const n = '/api/news-wire?symbol=' + encodeURIComponent(symbol);
  const get = async path => { const r = await fetch(origin + path, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(18000) }); if (!r.ok) throw new Error('Market endpoint HTTP ' + r.status); return r.json(); };
  const [quotes, chart, news] = await Promise.allSettled([get(q), get(c), get(n)]);
  return { quotes: quotes.status === 'fulfilled' ? quotes.value.quotes || [] : [], candles: chart.status === 'fulfilled' ? chart.value.candles || [] : [], news: news.status === 'fulfilled' ? news.value.news || [] : [], errors: [quotes, chart, news].map((x, i) => x.status === 'rejected' ? ['quotes','chart','news'][i] + ': ' + x.reason.message : null).filter(Boolean) };
}
async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!originAllowed(req)) return send(res, 403, { error: 'Request origin is not allowed.' });
  const aiProvider = provider();
  if (!aiProvider) return send(res, 503, { error: 'AI provider is not configured.' });
  if (req.method === 'GET') {
    try { return send(res, 200, { provider:aiProvider.name, models: await models(aiProvider) }); }
    catch (e) { return send(res, 502, { error: e.gatewayStatus ? aiProvider.name + ' model discovery returned HTTP ' + e.gatewayStatus + '.' : aiProvider.name + ' model discovery failed. Check provider connectivity.' }); }
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Use GET to list models or POST to run the research team.' });
  if (!rateAllowed(req)) return send(res, 429, { error: 'Research-team limit reached. Try again later.' });
  const b = bodyOf(req), symbol = String(b.symbol || '').trim().toUpperCase(), model = String(b.model || '').trim();
  const days = Math.min(20, Math.max(1, Number(b.horizonDays) || 5)), capital = Math.min(1e10, Math.max(0, Number(b.accountSize) || 100000)), riskPct = Math.min(2, Math.max(.1, Number(b.riskPct) || .5));
  if (!/^[A-Z0-9^=._-]{1,28}$/.test(symbol)) return send(res, 400, { error: 'Enter a ticker such as RELIANCE.NS, RELIANCE.BO, or AAPL.' });
  if (!/^[A-Za-z0-9._:/-]{2,120}$/.test(model)) return send(res, 400, { error: 'Choose a model from the available model list.' });
  try {
    const available = await models(aiProvider);
    if (!available.some(x => x.id === model)) return send(res, 400, { error: 'That model is not available for this gateway key.' });
    const origin = String(req.headers.origin || '');
    const peers = peerSymbols(symbol), data = await appData(origin, symbol, peers);
    const root = symbol.replace(/\.(NS|BO)$/i, ''), quote = data.quotes.find(x => String(x.symbol).toUpperCase() === symbol) || data.quotes[0];
    if (!quote || !Number.isFinite(Number(quote.price))) return send(res, 502, { error: 'No current quote was returned for ' + symbol + '. Confirm the exchange suffix (.NS / .BO) and retry.', sourceErrors: data.errors });
    const s = stats(data.candles, Number(quote.price), days, capital, riskPct);
    const peerFacts = data.quotes.map(x => ({ symbol:x.symbol, name:x.name, exchange:x.exchange, price:x.price, changePercent:x.changePercent, marketCap:x.marketCap, pe:x.pe, rsi14:x.rsi14, volume:x.volume, sector:x.sector })).filter(x => Number.isFinite(Number(x.price)));
    const newsFacts = data.news.slice(0, 8).map(x => ({ title:x.title, publisher:x.publisher, publishedAt:x.publishedAt, url:x.url, summary:x.summary }));
    const facts = { symbol, company:quote.name, exchange:quote.exchange, sector:quote.sector || sectorFor(symbol), currency:quote.currency, price:quote.price, changePercent:quote.changePercent, marketCap:quote.marketCap, pe:quote.pe, dividendYield:quote.dividendYield, rsi14:quote.rsi14, sma20:s.sma20, sma50:s.sma50, sma200:s.sma200, atr14:s.atr14, source:quote.source, timestamp:quote.timestamp };
    const shared = JSON.stringify({ company:facts, peerSnapshot:peerFacts, headlines:newsFacts, horizonDays:days, historicalRisk:s, coverage:data.errors });
    const prompt = 'Ticker '+symbol+'; build a concise sector/peer screen. Compare only supplied peer snapshot fields, identify sector classification confidence, note missing peers or fields; no unverified company claims.\n\n'+shared;
    const roles = [
      ['Sector screener','You are the sector screener agent.'],
      ['Fundamental analyst','You are the fundamental analyst agent. Assess only supplied market fundamentals. Explicitly say if income statement, balance sheet, and cash flow data are absent; do not infer intrinsic value without them.'],
      ['Technical analyst','You are the technical analyst agent. Interpret supplied price, RSI, moving averages, ATR and historical volatility. Give a conditional '+days+'-session outlook; distinguish a statistical range from a directional forecast.'],
      ['Trading risk manager','You are the trading risk manager agent. Use the supplied account size, risk percentage, risk budget, stop distance and share count. Check arithmetic, explain gap/slippage/overnight risk, and say if available data is insufficient to define a trade.']
    ];
    const reports = await Promise.all(roles.map(async ([name, role]) => {
      try { return { name, status:'complete', report:await completion(aiProvider, model, role, prompt, 420) }; }
      catch (e) { return { name, status:'unavailable', report:'Agent unavailable: provider request failed. No conclusion is supplied.' }; }
    }));
    const synthesisContext = JSON.stringify({ ticker:symbol, company:facts, forecastAndRisk:s, sourceErrors:data.errors, reports });
    let trader;
    try { trader = await completion(aiProvider, model, 'You are the final paper-trading desk agent. Reconcile all reports, surface disagreement, and return: action (WATCH / PAPER LONG / PAPER SHORT / NO TRADE), conditional entry trigger, stop, target, reward:risk, thesis invalidation, and what to monitor during the '+days+'-session horizon. Never state that a live trade was executed. If evidence is weak, agents conflict, quote/history is incomplete, or data is stale, choose WATCH or NO TRADE. Do not override the deterministic risk limits.', synthesisContext, 600); }
    catch (e) { trader = 'Final trader synthesis unavailable. Do not open a paper position; review the agent reports and deterministic risk values manually.'; }
    return send(res, 200, { symbol, model, provider:aiProvider.name, horizonDays:days, generatedAt:new Date().toISOString(), facts, historicalRisk:s, sector:sectorFor(symbol), reports, trader:{name:'Trader / portfolio manager',status:trader.startsWith('Final trader synthesis unavailable')?'unavailable':'complete',report:trader,paperOnly:true}, sources:{quote:facts.source||null,headlines:newsFacts.map(x=>({publisher:x.publisher,publishedAt:x.publishedAt,url:x.url}))}, dataCoverage:data.errors });
  } catch (e) {
    return send(res, 502, { error: 'The research team could not complete this run. Check the gateway/model and market-data connection, then retry.' });
  }
}
module.exports = handler;
