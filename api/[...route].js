const CACHE = globalThis.__axiomCache || (globalThis.__axiomCache = new Map());
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','LLY','AVGO','JPM','TSLA','WMT','XOM','V','MA','COST','ORCL','NFLX','AMD','KO'];
const INDIA = ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','ICICIBANK.NS','INFY.NS','SBIN.NS','BHARTIARTL.NS','ITC.NS','LT.NS','AXISBANK.NS','HINDUNILVR.NS','KOTAKBANK.NS','BAJFINANCE.NS','MARUTI.NS','SUNPHARMA.NS','TATAMOTORS.NS','WIPRO.NS','TITAN.NS','NTPC.NS','ONGC.NS'];
const BSE = ['RELIANCE.BO','TCS.BO','HDFCBANK.BO','ICICIBANK.BO','INFY.BO','SBIN.BO','BHARTIARTL.BO','ITC.BO','LT.BO','AXISBANK.BO','HINDUNILVR.BO','KOTAKBANK.BO','BAJFINANCE.BO','MARUTI.BO','SUNPHARMA.BO','TATAMOTORS.BO','WIPRO.BO','TITAN.BO','NTPC.BO','ONGC.BO'];
const SECTORS={RELIANCE:'Energy',TCS:'Information Technology',HDFCBANK:'Financial Services',ICICIBANK:'Financial Services',INFY:'Information Technology',SBIN:'Financial Services',BHARTIARTL:'Telecommunication',ITC:'Consumer Staples',LT:'Industrials',AXISBANK:'Financial Services',HINDUNILVR:'Consumer Staples',KOTAKBANK:'Financial Services',BAJFINANCE:'Financial Services',MARUTI:'Automotive',SUNPHARMA:'Healthcare',TATAMOTORS:'Automotive',WIPRO:'Information Technology',TITAN:'Consumer Discretionary',NTPC:'Utilities',ONGC:'Energy'};

async function upstream(url, ttl=15000) {
  const key=String(url), old=CACHE.get(key);
  if(old && Date.now()-old.at<ttl) return old.value;
  const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 AxiomDesk/1.0','accept':'application/json'},signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error('Market provider responded '+response.status);
  const value=await response.json(); CACHE.set(key,{at:Date.now(),value}); return value;
}
function calcRsi(values) {
  const closes=values.filter(Number.isFinite);
  if(closes.length<15)return null;
  let avgGain=0,avgLoss=0;
  for(let i=1;i<=14;i++){const change=closes[i]-closes[i-1];if(change>0)avgGain+=change;else avgLoss-=change;}
  avgGain/=14;avgLoss/=14;
  for(let i=15;i<closes.length;i++){const change=closes[i]-closes[i-1],gain=Math.max(0,change),loss=Math.max(0,-change);avgGain=(avgGain*13+gain)/14;avgLoss=(avgLoss*13+loss)/14;}
  if(avgGain===0&&avgLoss===0)return 50;
  if(avgLoss===0)return 100;
  if(avgGain===0)return 0;
  return +(100-100/(1+avgGain/avgLoss)).toFixed(2);
}
function technicals(r) {
  const q=r.indicators?.quote?.[0]||{}, close=q.close||[], high=q.high||[], low=q.low||[], open=q.open||[], volume=q.volume||[];
  let end=close.length; while(end>0&&(!Number.isFinite(close[end-1])||!Number.isFinite(high[end-1])||!Number.isFinite(low[end-1])))end--;
  const c=close.slice(0,end),h=high.slice(0,end),l=low.slice(0,end),o=open.slice(0,end),v=volume.slice(0,end), price=c.at(-1), prev=c.at(-2);
  const avg=(a,n,offset=0)=>{const x=a.slice(Math.max(0,a.length-offset-n),a.length-offset).filter(Number.isFinite);return x.length===n?x.reduce((s,z)=>s+z,0)/n:null};
  const sma20=avg(c,20),sma50=avg(c,50),sma200=avg(c,200),avgVol=avg(v,20,1),atrBars=[];
  for(let j=Math.max(1,c.length-14);j<c.length;j++)atrBars.push(Math.max(h[j]-l[j],Math.abs(h[j]-c[j-1]),Math.abs(l[j]-c[j-1])));
  const atr=atrBars.length===14?atrBars.reduce((s,x)=>s+x,0)/14:null;
  const priorHigh=h.slice(Math.max(0,h.length-21),Math.max(0,h.length-1)),priorLow=l.slice(Math.max(0,l.length-21),Math.max(0,l.length-1));
  const lastRange=h.at(-1)-l.at(-1),lastSeven=h.slice(-7).map((x,j)=>x-l[h.length-7+j]);
  const priorSma20=avg(c,20,1),currentVolume=v.at(-1);
  const previousHigh=h.at(-2),previousLow=l.at(-2);
  const bars=(r.timestamp||[]).slice(0,end).map((time,j)=>({time,open:o[j],high:h[j],low:l[j],close:c[j]}));
  const valid=x=>[x.open,x.high,x.low,x.close,x.time].every(Number.isFinite)&&x.low<=x.high;
  const history=bars.slice(0,-1),blocks=[];let swingHigh=null,swingLow=null;
  const atrFor=arr=>{if(arr.length<15)return null;const tr=arr.slice(1).map((x,j)=>Math.max(x.high-x.low,Math.abs(x.high-arr[j].close),Math.abs(x.low-arr[j].close)));if(tr.length<14)return null;let value=tr.slice(0,14).reduce((a,b)=>a+b,0)/14;for(const x of tr.slice(14))value=(value*13+x)/14;return value;};
  if(history.length>=18&&history.every(valid))for(let j=4;j<history.length;j++){
    const bar=history[j],pivot=j-2,left=history[pivot-2],window=history.slice(pivot-2,pivot+3).filter((_,k)=>k!==2);
    if(window.every(x=>x.high<history[pivot].high))swingHigh={value:history[pivot].high,index:pivot};
    if(window.every(x=>x.low>history[pivot].low))swingLow={value:history[pivot].low,index:pivot};
    for(const block of blocks){if(block.status==='invalidated'||j<=block.confirmed)continue;if(block.side==='bullish'?bar.close<block.low:bar.close>block.high)block.status='invalidated';else if(bar.low<=block.high&&bar.high>=block.low)block.status='tested';}
    const atrValue=atrFor(history.slice(0,j));if(atrValue===null||Math.abs(bar.close-bar.open)<atrValue*.6)continue;
    const side=swingHigh&&bar.close>swingHigh.value&&history[j-1].close<=swingHigh.value?'bullish':swingLow&&bar.close<swingLow.value&&history[j-1].close>=swingLow.value?'bearish':null;if(!side)continue;
    for(let k=j-1;k>=Math.max(0,j-5);k--){const origin=history[k];if(side==='bullish'?origin.close<origin.open:origin.close>origin.open){blocks.push({side,low:origin.low,high:origin.high,origin:k,confirmed:j,status:'fresh'});break;}}
  }
  const distance=(side,freshOnly=false)=>{const candidates=blocks.filter(x=>x.side===side&&(!freshOnly||x.status==='fresh')).slice(-3);if(!Number.isFinite(price)||!candidates.length)return null;return Math.min(...candidates.map(x=>100*Math.max(0,x.low-price,price-x.high)/price));};
  const priceAction={breakout20:priorHigh.length>=20&&price>Math.max(...priorHigh),breakdown20:priorLow.length>=20&&price<Math.min(...priorLow),insideBar:Number.isFinite(previousHigh)&&h.at(-1)<=previousHigh&&l.at(-1)>=previousLow,narrow7:lastSeven.length===7&&lastRange<=Math.min(...lastSeven),crossUp20:Number.isFinite(sma20)&&Number.isFinite(priorSma20)&&price>sma20&&prev<=priorSma20,crossDown20:Number.isFinite(sma20)&&Number.isFinite(priorSma20)&&price<sma20&&prev>=priorSma20,bullDistance:distance('bullish'),bearDistance:distance('bearish'),freshBullDistance:distance('bullish',true),freshBearDistance:distance('bearish',true),closedTime:r.timestamp?.at(-1)||null};
  return {sma20,sma50,sma200,gapPercent:Number.isFinite(o.at(-1))&&Number.isFinite(prev)&&prev?100*(o.at(-1)/prev-1):null,relativeVolume:Number.isFinite(currentVolume)&&avgVol?currentVolume/avgVol:null,turnover:Number.isFinite(price)&&Number.isFinite(currentVolume)?price*currentVolume:null,priceAction,atrPercent:atr&&price?100*atr/price:null};
}
async function binanceQuote(symbol) {
  const d=await upstream('https://data-api.binance.vision/api/v3/ticker/24hr?symbol='+encodeURIComponent(symbol),5000);
  const price=Number(d.lastPrice),previous=Number(d.prevClosePrice),change=Number(d.priceChange),changePercent=Number(d.priceChangePercent);
  if(!Number.isFinite(price))throw new Error('Binance returned no quote for '+symbol);
  return{symbol,name:symbol.replace('USDT',' / USDT'),exchange:'Binance Spot',currency:'USDT',price,change:Number.isFinite(change)?change:null,changePercent:Number.isFinite(changePercent)?changePercent:null,previous:Number.isFinite(previous)?previous:null,high:Number(d.highPrice)||null,low:Number(d.lowPrice)||null,volume:Number(d.volume)||null,marketCap:null,pe:null,dividendYield:null,rsi14:null,distanceHigh52:null,high52:null,low52:null,fiftyTwoWeekHigh:null,fiftyTwoWeekLow:null,timestamp:Math.floor(Number(d.closeTime||Date.now())/1000),source:'Binance Spot',delay:'Live exchange data'};
}
async function quote(symbol) {
  const s=String(symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9^=._-]{1,28}$/.test(s))throw new Error('Invalid ticker symbol');
  if(/^[A-Z0-9]{2,20}USDT$/.test(s))return binanceQuote(s);
  const data=await upstream('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(s)+'?range=1y&interval=1d',20000);
  const r=data.chart?.result?.[0]; if(!r)throw new Error(data.chart?.error?.description||('No quote returned for '+s));
  const m=r.meta||{},closes=(r.indicators?.quote?.[0]?.close||[]).filter(Number.isFinite),price=m.regularMarketPrice??closes.at(-1),prev=closes.length>1?closes.at(-2):(m.previousClose??m.chartPreviousClose),tech=technicals(r);
  const changePercent=Number.isFinite(m.regularMarketChangePercent)?m.regularMarketChangePercent:(Number.isFinite(price)&&Number.isFinite(prev)&&prev?100*(price/prev-1):null);
  return {symbol:s,name:m.longName||m.shortName||s,exchange:m.fullExchangeName||m.exchangeName||(/\.BO$/i.test(s)?'BSE':/\.NS$/i.test(s)?'NSE':m.exchangeName||''),sector:SECTORS[s.replace(/\.(NS|BO)$/i,'')]||'Unclassified',currency:m.currency||'',price,change:m.regularMarketChange??(Number.isFinite(price)&&Number.isFinite(prev)?price-prev:null),changePercent,previous:prev,high:m.regularMarketDayHigh??null,low:m.regularMarketDayLow??null,volume:m.regularMarketVolume??null,marketCap:m.marketCap??null,pe:m.trailingPE??m.forwardPE??null,dividendYield:m.dividendYield??null,rsi14:calcRsi(closes),distanceHigh52:Number.isFinite(m.fiftyTwoWeekHigh)&&m.fiftyTwoWeekHigh?100*(price/m.fiftyTwoWeekHigh-1):null,distanceLow52:Number.isFinite(m.fiftyTwoWeekLow)&&m.fiftyTwoWeekLow?100*(price/m.fiftyTwoWeekLow-1):null,high52:m.fiftyTwoWeekHigh??null,low52:m.fiftyTwoWeekLow??null,fiftyTwoWeekHigh:m.fiftyTwoWeekHigh??null,fiftyTwoWeekLow:m.fiftyTwoWeekLow??null,timestamp:m.regularMarketTime||Date.now()/1000,source:'Yahoo Finance chart',delay:'Indicative; exchange delay varies',...tech};
}
async function search(q){const query=String(q||'').trim().toUpperCase();if(/^[A-Z0-9&._-]+\.(NS|BO)$/.test(query))return[{symbol:query,name:query.replace(/\.(NS|BO)$/,''),exchange:query.endsWith('.BO')?'BSE':'NSE',type:'EQUITY'}];const d=await upstream('https://query1.finance.yahoo.com/v1/finance/search?q='+encodeURIComponent(q)+'&quotesCount=12&newsCount=0',30000);return(d.quotes||[]).filter(x=>x.quoteType==='EQUITY'||x.quoteType==='ETF').map(x=>({symbol:x.symbol,name:x.longname||x.shortname||x.symbol,exchange:x.exchDisp||x.exchange,sector:x.sectorDisp||x.sector,industry:x.industryDisp||x.industry,type:x.quoteType}));}
async function news(symbol='stock market'){const q=String(symbol).replace(/\.(NS|BO)$/i,'').trim();const d=await upstream('https://query1.finance.yahoo.com/v1/finance/search?q='+encodeURIComponent(q)+'&quotesCount=0&newsCount=12',20000);return(d.news||[]).map((n,i)=>{const publisher=String(n.publisher||'Yahoo Finance').trim()||'Yahoo Finance';return{id:n.uuid||n.link||publisher+'-'+(n.providerPublishTime||i),title:String(n.title||'Untitled headline'),publisher,source:publisher,category:'Markets',url:n.link||'',timestamp:Number.isFinite(n.providerPublishTime)?n.providerPublishTime:null,publishedAt:n.providerPublishTime?new Date(n.providerPublishTime*1000).toISOString():null,summary:String(n.summary||''),symbol};});}
const NEWS_FEEDS=[['mint','Mint','https://www.livemint.com/rss/markets'],['rbi','RBI','https://www.rbi.org.in/pressreleases_rss.xml'],['fed','Federal Reserve','https://www.federalreserve.gov/feeds/press_all.xml'],['ecb','European Central Bank','https://www.ecb.europa.eu/rss/press.html'],['boe','Bank of England','https://www.bankofengland.co.uk/rss/news']];
function xmlText(value=''){return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();}
function xmlTag(block,name){const m=block.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return m?xmlText(m[1]):'';}
async function rssFeed([id,publisher,url]){const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 AxiomDesk/1.0','accept':'application/rss+xml, application/atom+xml, application/xml, text/xml'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Publisher responded '+response.status);const xml=await response.text(),blocks=[...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map(x=>x[1]);if(!blocks.length)throw new Error('No publisher items received');const items=blocks.slice(0,30).map((block,index)=>{const title=xmlTag(block,'title'),linkTag=block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i),link=xmlTag(block,'link')||linkTag?.[1]||'',rawDate=xmlTag(block,'pubDate')||xmlTag(block,'published')||xmlTag(block,'updated')||xmlTag(block,'dc:date'),timestamp=rawDate&&Number.isFinite(Date.parse(rawDate))?Math.floor(Date.parse(rawDate)/1000):null,summary=xmlTag(block,'description')||xmlTag(block,'summary')||xmlTag(block,'content:encoded'),category=id==='rbi'?'Policy':/policy|rate|central bank|inflation|regulat|reserve bank/i.test(title)?'Policy':'Markets';return{id:id+'-'+(link||timestamp||index),title,publisher,publisherId:id,source:publisher,category,url:link,timestamp,publishedAt:timestamp?new Date(timestamp*1000).toISOString():null,summary,symbol:null};}).filter(x=>x.title&&x.url);return items;}
async function newsWire(symbol='stock market'){const query=String(symbol||'stock market').replace(/\.(NS|BO)$/i,'').trim()||'stock market',results=await Promise.allSettled(NEWS_FEEDS.map(feed=>rssFeed(feed)));let items=[],sources=[];for(let i=0;i<results.length;i++){const r=results[i],[id,publisher]=NEWS_FEEDS[i];if(r.status==='fulfilled'){items.push(...r.value);sources.push({id:'news-source-'+id,publisher,category:'Markets',state:'ok',count:r.value.length});}else sources.push({id:'news-source-'+id,publisher,category:'Markets',state:'error',count:0,error:r.reason?.message||'Publisher unavailable'});}try{const fallback=await news(query);items.push(...fallback);sources.push({id:'news-source-yahoo',publisher:'Yahoo Finance',category:'Markets',state:fallback.length?'ok':'error',count:fallback.length});}catch(e){sources.push({id:'news-source-yahoo',publisher:'Yahoo Finance',category:'Markets',state:'error',count:0,error:e.message});}const seen=new Set();items=items.filter(x=>{const key=(x.url||x.title).toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});if(query.toLowerCase()!=='stock market')items=items.filter(x=>`${x.title} ${x.summary||''}`.toLowerCase().includes(query.toLowerCase()));items=items.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,80);return{news:items,sources,fetchedAt:Date.now(),symbol:query};}
async function binanceChart(symbol,range){
  const frames={'1d':['5m',288],'5d':['1h',120],'1mo':['4h',180],'3mo':['1d',90],'6mo':['1d',180],'1y':['1d',365],'2y':['1d',730],'5y':['1w',260],'10y':['1w',520],'max':['1w',1000]};
  const [interval,limit]=frames[range]||frames['1y'];
  const base='https://data-api.binance.vision/api/v3/';
  const [rows,day]=await Promise.all([
    upstream(base+'klines?symbol='+encodeURIComponent(symbol)+'&interval='+interval+'&limit='+limit,10000),
    upstream(base+'ticker/24hr?symbol='+encodeURIComponent(symbol),5000).catch(()=>null)
  ]);
  const candles=(Array.isArray(rows)?rows:[]).map(k=>({time:Math.floor(Number(k[0])/1000),open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),volume:Number(k[5])})).filter(c=>Number.isFinite(c.time)&&Number.isFinite(c.close));
  if(!candles.length)throw new Error('Binance returned no candles for '+symbol);
  const last=candles[candles.length-1],previous=candles.length>1?candles[candles.length-2].close:null,price=Number(day?.lastPrice)||last.close,change=Number.isFinite(Number(day?.priceChange))?Number(day.priceChange):Number.isFinite(previous)?price-previous:null,changePercent=Number.isFinite(Number(day?.priceChangePercent))?Number(day.priceChangePercent):Number.isFinite(previous)&&previous?100*(price/previous-1):null;
  return{symbol,name:symbol.replace('USDT',' / USDT'),exchange:'Binance Spot',currency:'USDT',timestamp:Math.floor(Number(day?.closeTime||Date.now())/1000),price,change,changePercent,previous,volume:Number.isFinite(Number(day?.volume))?Number(day.volume):last.volume,high:Number(day?.highPrice)||last.high,low:Number(day?.lowPrice)||last.low,source:'Binance Spot',candles};
}
async function route(req,res){
  const u=new URL(req.url,'https://axiom.invalid'); const p=u.pathname;
  if(req.method!=='GET'){res.statusCode=405;return{error:'Method not allowed'};}
  if(p==='/health'||p==='/api/health')return{ok:true,service:'AxiomDesk Vercel data service',time:new Date().toISOString()};
  if(p==='/api/market'){
    const type=u.searchParams.get('type');
    if(type==='search')return{results:await search(u.searchParams.get('q')||'')};
    if(type==='quotes'){const symbols=(u.searchParams.get('symbols')||'').split(',').filter(Boolean).slice(0,20);return{quotes:await Promise.all(symbols.map(async s=>{try{return await quote(s)}catch(e){return{symbol:s,error:e.message}}}))};}
    if(type==='chart'){const symbol=u.searchParams.get('symbol')||'',requested=u.searchParams.get('range')||'1y',aliases={'1D':'1d','1W':'5d','1M':'1mo','3M':'3mo','1Y':'1y','5Y':'5y'},r=aliases[requested]||requested,allowed=new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','max']);if(/^[A-Z0-9]{2,20}USDT$/.test(symbol))return await binanceChart(symbol,allowed.has(r)?r:'1y');const d=await upstream('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+(allowed.has(r)?r:'1y')+'&interval=1d');const v=d.chart?.result?.[0];if(!v)throw new Error(d.chart?.error?.description||'No chart data');const q=v.indicators?.quote?.[0]||{},m=v.meta||{},closes=(q.close||[]).filter(Number.isFinite),price=m.regularMarketPrice??closes.at(-1),previous=closes.length>1?closes.at(-2):null;return{symbol:m.symbol||v.meta.symbol,timestamp:m.regularMarketTime||Math.floor(Date.now()/1000),name:m.longName||m.shortName||m.symbol,price,change:m.regularMarketChange??(Number.isFinite(price)&&Number.isFinite(previous)?price-previous:null),changePercent:Number.isFinite(m.regularMarketChangePercent)?m.regularMarketChangePercent:(Number.isFinite(price)&&Number.isFinite(previous)&&previous?100*(price/previous-1):null),previous,currency:m.currency,volume:m.regularMarketVolume??null,high:m.regularMarketDayHigh??null,low:m.regularMarketDayLow??null,high52:m.fiftyTwoWeekHigh??null,low52:m.fiftyTwoWeekLow??null,fiftyTwoWeekHigh:m.fiftyTwoWeekHigh??null,fiftyTwoWeekLow:m.fiftyTwoWeekLow??null,source:'Yahoo Finance chart',candles:(v.timestamp||[]).map((t,i)=>({time:t,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]})).filter(x=>Number.isFinite(x.close)),meta:m};}
    throw new Error('Unsupported market request type');
  }
  if(p==='/api/equities'){const m=u.searchParams.get('market')||'us',universe=u.searchParams.get('universe')||'',symbols=u.searchParams.get('symbols');if(symbols)return{rows:await Promise.all(symbols.split(',').slice(0,20).map(async s=>{try{return await quote(s)}catch(e){return{symbol:s,error:e.message}}}))};if(m==='us')return{rows:await Promise.all(US.map(async s=>{try{return await quote(s)}catch(e){return{symbol:s,error:e.message}}}))};const listed=universe==='bse_sensex'?BSE:INDIA,exchange=universe==='bse_sensex'?'BSE':'NSE';return{instruments:listed.map(symbol=>({symbol,name:symbol.replace(/\.(NS|BO)$/,''),exchange,currency:'INR'}))};}
  if(p==='/api/news-wire')return await newsWire(u.searchParams.get('symbol')||'stock market');
  if(p==='/api/forex-calendar'){const rows=await upstream('https://nfs.faireconomy.media/ff_calendar_thisweek.json',60000);return{events:(Array.isArray(rows)?rows:[]).map((e,i)=>({id:String(e.id||e.title+'-'+e.date+'-'+i),time:e.date?new Date(e.date).getTime():null,currency:e.country||'',country:e.country||'',title:e.title||'',event:e.title||'',impact:e.impact||'Unknown',forecast:e.forecast||'',previous:e.previous||'',actual:e.actual||'',source:'Forex Factory calendar'})).filter(e=>Number.isFinite(e.time)),fetchedAt:Date.now(),stale:false,source:'Forex Factory calendar'};}
  if(p.startsWith('/api/binance/')){const path=p.slice('/api/binance'.length);if(!/^\/api\/v3\/[a-zA-Z0-9/_-]+$/.test(path))throw new Error('Unsupported Binance endpoint');for(const host of ['https://data-api.binance.vision','https://api.binance.com']){try{const r=await fetch(host+path+u.search,{signal:AbortSignal.timeout(15000)});if(r.ok)return await r.json()}catch{}}throw new Error('Binance market service is unavailable');}
  res.statusCode=404;return{error:'Not found'};
}
module.exports=async function(req,res){res.setHeader('cache-control','no-store');try{const body=await route(req,res);res.statusCode=res.statusCode||200;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(body));}catch(e){res.statusCode=502;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({error:e.message||'Market data service failed'}));}};

