const CACHE = globalThis.__axiomCache || (globalThis.__axiomCache = new Map());
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','LLY','AVGO','JPM','TSLA','WMT','XOM','V','MA','COST','ORCL','NFLX','AMD','KO'];
const INDIA = ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','ICICIBANK.NS','INFY.NS','SBIN.NS','BHARTIARTL.NS','ITC.NS','LT.NS','AXISBANK.NS','HINDUNILVR.NS','KOTAKBANK.NS','BAJFINANCE.NS','MARUTI.NS','SUNPHARMA.NS','TATAMOTORS.NS','WIPRO.NS','TITAN.NS','NTPC.NS','ONGC.NS'];

async function upstream(url, ttl=15000) {
  const key=String(url), old=CACHE.get(key);
  if(old && Date.now()-old.at<ttl) return old.value;
  const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 AxiomDesk/1.0','accept':'application/json'},signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error('Market provider responded '+response.status);
  const value=await response.json(); CACHE.set(key,{at:Date.now(),value}); return value;
}
function calcRsi(values) {
  if(values.length<15)return null;
  let gains=0,losses=0;
  for(let i=values.length-14;i<values.length;i++){const d=values[i]-values[i-1];if(d>0)gains+=d;else losses-=d;}
  return losses?+(100-100/(1+gains/losses)).toFixed(2):100;
}
async function quote(symbol) {
  const s=String(symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9^=._-]{1,28}$/.test(s))throw new Error('Invalid ticker symbol');
  const data=await upstream('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(s)+'?range=1y&interval=1d',20000);
  const r=data.chart?.result?.[0]; if(!r)throw new Error(data.chart?.error?.description||('No quote returned for '+s));
  const m=r.meta||{},closes=(r.indicators?.quote?.[0]?.close||[]).filter(Number.isFinite),price=m.regularMarketPrice??closes.at(-1),prev=closes.length>1?closes.at(-2):(m.previousClose??m.chartPreviousClose);
  const changePercent=Number.isFinite(m.regularMarketChangePercent)?m.regularMarketChangePercent:(Number.isFinite(price)&&Number.isFinite(prev)&&prev?100*(price/prev-1):null);
  return {symbol:s,name:m.longName||m.shortName||s,exchange:m.fullExchangeName||m.exchangeName||'',currency:m.currency||'',price,changePercent,volume:m.regularMarketVolume??null,marketCap:null,pe:null,dividendYield:null,rsi14:calcRsi(closes),distanceHigh52:Number.isFinite(m.fiftyTwoWeekHigh)&&m.fiftyTwoWeekHigh?100*(price/m.fiftyTwoWeekHigh-1):null,high52:m.fiftyTwoWeekHigh??null,low52:m.fiftyTwoWeekLow??null,timestamp:m.regularMarketTime||Date.now()/1000,source:'Yahoo Finance chart',delay:'Indicative; exchange delay varies'};
}
async function search(q){const d=await upstream('https://query1.finance.yahoo.com/v1/finance/search?q='+encodeURIComponent(q)+'&quotesCount=12&newsCount=0',30000);return(d.quotes||[]).filter(x=>x.quoteType==='EQUITY'||x.quoteType==='ETF').map(x=>({symbol:x.symbol,name:x.longname||x.shortname||x.symbol,exchange:x.exchDisp||x.exchange,sector:x.sectorDisp||x.sector,industry:x.industryDisp||x.industry,type:x.quoteType}));}
async function news(symbol='stock market'){const q=String(symbol).replace(/\.(NS|BO)$/i,'').trim();const d=await upstream('https://query1.finance.yahoo.com/v1/finance/search?q='+encodeURIComponent(q)+'&quotesCount=0&newsCount=12',20000);return(d.news||[]).map((n,i)=>{const publisher=String(n.publisher||'Yahoo Finance').trim()||'Yahoo Finance';return{id:n.uuid||n.link||publisher+'-'+(n.providerPublishTime||i),title:String(n.title||'Untitled headline'),publisher,source:publisher,category:'Markets',url:n.link||'',timestamp:Number.isFinite(n.providerPublishTime)?n.providerPublishTime:null,publishedAt:n.providerPublishTime?new Date(n.providerPublishTime*1000).toISOString():null,summary:String(n.summary||''),symbol};});}
async function route(req,res){
  const u=new URL(req.url,'https://axiom.invalid'); const p=u.pathname;
  if(req.method!=='GET'){res.statusCode=405;return{error:'Method not allowed'};}
  if(p==='/health'||p==='/api/health')return{ok:true,service:'AxiomDesk Vercel data service',time:new Date().toISOString()};
  if(p==='/api/market'){
    const type=u.searchParams.get('type');
    if(type==='search')return{results:await search(u.searchParams.get('q')||'')};
    if(type==='quotes'){const symbols=(u.searchParams.get('symbols')||'').split(',').filter(Boolean).slice(0,20);return{quotes:await Promise.all(symbols.map(async s=>{try{return await quote(s)}catch(e){return{symbol:s,error:e.message}}}))};}
    if(type==='chart'){const symbol=u.searchParams.get('symbol')||'',r=u.searchParams.get('range')||'1y',allowed=new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','max']);const d=await upstream('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+(allowed.has(r)?r:'1y')+'&interval=1d');const v=d.chart?.result?.[0];if(!v)throw new Error(d.chart?.error?.description||'No chart data');const q=v.indicators?.quote?.[0]||{};return{symbol:v.meta.symbol,timestamp:Date.now(),candles:(v.timestamp||[]).map((t,i)=>({time:t,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]})).filter(x=>Number.isFinite(x.close)),meta:v.meta};}
    throw new Error('Unsupported market request type');
  }
  if(p==='/api/equities'){const m=u.searchParams.get('market')||'us',symbols=u.searchParams.get('symbols');if(symbols)return{rows:await Promise.all(symbols.split(',').slice(0,20).map(async s=>{try{return await quote(s)}catch(e){return{symbol:s,error:e.message}}}))};if(m==='us')return{rows:await Promise.all(US.map(async s=>{try{return await quote(s)}catch(e){return{symbol:s,error:e.message}}}))};return{instruments:INDIA.map(symbol=>({symbol,name:symbol.replace('.NS',''),exchange:'NSE'}))};}
  if(p==='/api/news-wire'){const symbol=u.searchParams.get('symbol')||'stock market',items=await news(symbol),publishers=[...new Set(items.map(item=>item.publisher))];return{news:items,sources:publishers.map((publisher,i)=>({id:'news-source-'+i,publisher,category:'Markets',state:'ok',count:items.filter(item=>item.publisher===publisher).length})),fetchedAt:Date.now(),symbol};}
  if(p==='/api/forex-calendar'){const rows=await upstream('https://nfs.faireconomy.media/ff_calendar_thisweek.json',60000);return{events:(Array.isArray(rows)?rows:[]).map((e,i)=>({id:String(e.id||e.title+'-'+e.date+'-'+i),time:e.date?new Date(e.date).getTime():null,currency:e.country||'',country:e.country||'',title:e.title||'',event:e.title||'',impact:e.impact||'Unknown',forecast:e.forecast||'',previous:e.previous||'',actual:e.actual||'',source:'Forex Factory calendar'})).filter(e=>Number.isFinite(e.time)),fetchedAt:Date.now(),stale:false,source:'Forex Factory calendar'};}
  if(p.startsWith('/api/binance/')){const path=p.slice('/api/binance'.length);if(!/^\/api\/v3\/[a-zA-Z0-9/_-]+$/.test(path))throw new Error('Unsupported Binance endpoint');for(const host of ['https://data-api.binance.vision','https://api.binance.com']){try{const r=await fetch(host+path+u.search,{signal:AbortSignal.timeout(15000)});if(r.ok)return await r.json()}catch{}}throw new Error('Binance market service is unavailable');}
  res.statusCode=404;return{error:'Not found'};
}
module.exports=async function(req,res){res.setHeader('cache-control','no-store');try{const body=await route(req,res);res.statusCode=res.statusCode||200;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(body));}catch(e){res.statusCode=502;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({error:e.message||'Market data service failed'}));}};

