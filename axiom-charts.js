(()=>{'use strict';
  const style=document.createElement('style');
  style.textContent='.chart-wrap.axiom-tv-chart{display:block!important;min-height:440px;padding:0!important}.axiom-tv-widget{width:100%;height:430px;min-height:380px}.axiom-tv-widget .tradingview-widget-container__widget{width:100%;height:calc(100% - 22px)}.axiom-tv-credit{height:20px;padding:2px 8px;color:#8497a7;font:10px/16px Arial,sans-serif;text-align:right}.axiom-tv-credit a{color:#9eb5c7}.chart-panel .range-controls{display:none!important}@media(max-width:700px){.chart-wrap.axiom-tv-chart{min-height:380px}.axiom-tv-widget{height:370px;min-height:340px}}';
  document.head.appendChild(style);
  const known={'^GSPC':'SP:SPX','^IXIC':'NASDAQ:IXIC','^DJI':'DJ:DJI','^NSEI':'NSE:NIFTY','^BSESN':'BSE:SENSEX','GC=F':'COMEX:GC1!','SI=F':'COMEX:SI1!','CL=F':'NYMEX:CL1!','NG=F':'NYMEX:NG1!'};
  function tvSymbol(panel){
    const line=panel.querySelector('.instrument-title h2')?.parentElement?.querySelector('span')?.textContent?.trim()||'';
    const normalized=line.replace(/\s*\/\s*/g,''),parts=normalized.split(/\s+/), raw=(parts[0]||'').toUpperCase(), exch=(parts[1]||'').toUpperCase();
    const page=(document.querySelector('main .page-heading h1')?.textContent||'').toLowerCase();
    if(!raw)return null;if(known[raw])return known[raw];
    if(/crypto/.test(page)||/USDT$/.test(raw))return 'BINANCE:'+raw.replace('/','');
    if(/forex|currency/.test(page)||/=X$/.test(raw)){const pair=raw.replace(/=X$/,'').replace('/','');return pair.endsWith('INR')?'FX_IDC:'+pair:'FX:'+pair}
    if(/commodit/.test(page)){if(raw==='BZ=F')return 'NYMEX:BR1!';return raw}
    if(/\.(NS|BO)$/.test(raw))return (raw.endsWith('.BO')?'BSE':'NSE')+':'+raw.replace(/\.(NS|BO)$/,'');
    if(exch==='NSE'||exch==='BSE')return exch+':'+raw;
    if(exch.includes('NASDAQ'))return 'NASDAQ:'+raw;
    if(exch.includes('NYSE'))return 'NYSE:'+raw;
    if(exch.includes('AMEX'))return 'AMEX:'+raw;
    return raw.includes(':')?raw:'NASDAQ:'+raw;
  }
  function install(panel){
    const host=panel.querySelector('.chart-wrap');if(!host)return;
    const symbol=tvSymbol(panel);if(!symbol)return;
    if(host.dataset.axiomTvSymbol===symbol&&host.querySelector('.tradingview-widget-container__widget'))return;
    host.dataset.axiomTvSymbol=symbol;host.classList.add('axiom-tv-chart');host.replaceChildren();
    const container=document.createElement('div');container.className='tradingview-widget-container axiom-tv-widget';
    const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';container.appendChild(widget);
    const credit=document.createElement('div');credit.className='axiom-tv-credit';
    const link=document.createElement('a');link.href='https://www.tradingview.com/symbols/'+encodeURIComponent(symbol.replace(':','-'))+'/';link.target='_blank';link.rel='noopener noreferrer';link.textContent=symbol+' chart';credit.append(link,document.createTextNode(' · powered by TradingView'));
    host.appendChild(container);
    const script=document.createElement('script');script.type='text/javascript';script.async=true;
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.textContent=JSON.stringify({autosize:true,symbol,interval:'D',timezone:/india/.test((document.querySelector('main .page-heading h1')?.textContent||'').toLowerCase())?'Asia/Kolkata':'Etc/UTC',theme:'dark',style:'1',locale:'en',allow_symbol_change:true,calendar:false,details:false,hide_side_toolbar:true,hide_top_toolbar:false,hide_legend:false,hide_volume:false,hotlist:false,save_image:false,withdateranges:true,backgroundColor:'#101820',gridColor:'rgba(129,154,174,0.12)',studies:[]});
    widget.appendChild(script);host.appendChild(credit);
  }
  function scan(){document.querySelectorAll('.chart-panel').forEach(install)}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  scan();setInterval(scan,1500);
})();