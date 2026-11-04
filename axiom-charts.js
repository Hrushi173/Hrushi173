(()=>{'use strict';
  const style=document.createElement('style');
  style.textContent='.chart-panel .range-controls{display:none!important}#axiom-tv-overlay{position:fixed;display:none;z-index:30;overflow:hidden;border:1px solid rgba(129,154,174,.2);border-radius:10px;background:#101820;box-shadow:0 10px 34px rgba(0,0,0,.25)}.chart-panel .chart-wrap{visibility:hidden!important}#axiom-tv-overlay .tradingview-widget-container,#axiom-tv-overlay .tradingview-widget-container__widget{width:100%;height:100%}#axiom-tv-overlay iframe{border:0}';
  document.head.appendChild(style);
  const overlay=document.createElement('div');overlay.id='axiom-tv-overlay';document.body.appendChild(overlay);
  const known={'^GSPC':'SP:SPX','^IXIC':'NASDAQ:IXIC','^DJI':'DJ:DJI','^NSEI':'NSE:NIFTY','^BSESN':'BSE:SENSEX','GC=F':'COMEX:GC1!','SI=F':'COMEX:SI1!','CL=F':'NYMEX:CL1!','NG=F':'NYMEX:NG1!','BZ=F':'NYMEX:BR1!'};
  let activeSymbol='',activeWrap=null;
  function tvSymbol(panel){
    const line=panel.querySelector('.instrument-title h2')?.parentElement?.querySelector('span')?.textContent?.trim()||'';
    const normalized=line.replace(/\s*\/\s*/g,''),parts=normalized.split(/\s+/),raw=(parts[0]||'').toUpperCase(),exch=(parts[1]||'').toUpperCase();
    const page=(document.querySelector('main .page-heading h1')?.textContent||'').toLowerCase();
    if(!raw)return null;if(known[raw])return known[raw];
    if(/crypto/.test(page)||/USDT$/.test(raw))return 'BINANCE:'+raw;
    if(/forex|currency/.test(page)||/=X$/.test(raw)){const pair=raw.replace(/=X$/,'').replace('/','');return pair.endsWith('INR')?'FX_IDC:'+pair:'FX:'+pair}
    if(/commodit/.test(page))return raw;
    if(/\.(NS|BO)$/.test(raw))return (raw.endsWith('.BO')?'BSE':'NSE')+':'+raw.replace(/\.(NS|BO)$/,'');
    if(exch==='NSE'||exch==='BSE')return exch+':'+raw;
    if(exch.includes('NASDAQ'))return 'NASDAQ:'+raw;
    if(exch.includes('NYSE'))return 'NYSE:'+raw;
    if(exch.includes('AMEX'))return 'AMEX:'+raw;
    return raw.includes(':')?raw:'NASDAQ:'+raw;
  }
  function mount(symbol){
    if(symbol===activeSymbol&&overlay.querySelector('.tradingview-widget-container'))return;
    activeSymbol=symbol;overlay.replaceChildren();
    const outer=document.createElement('div');outer.className='tradingview-widget-container';outer.style.cssText='width:100%;height:100%';
    const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';widget.style.cssText='width:100%;height:100%';outer.appendChild(widget);overlay.appendChild(outer);
    const script=document.createElement('script');script.type='text/javascript';script.async=true;script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.textContent=JSON.stringify({autosize:true,symbol,interval:'D',timezone:/india/.test((document.querySelector('main .page-heading h1')?.textContent||'').toLowerCase())?'Asia/Kolkata':'Etc/UTC',theme:'dark',style:'1',locale:'en',allow_symbol_change:true,calendar:false,details:false,hide_side_toolbar:true,hide_top_toolbar:false,hide_legend:false,hide_volume:false,hotlist:false,save_image:false,withdateranges:true,backgroundColor:'#101820',gridColor:'rgba(129,154,174,0.12)',studies:[]});
    widget.appendChild(script);
  }
  function scan(){
    const panel=document.querySelector('.chart-panel'),wrap=panel?.querySelector('.chart-wrap.price-chart, .chart-wrap');
    const chart=wrap?.querySelector('.price-chart');
    if(!panel||!wrap||!chart){overlay.style.display='none';activeWrap=null;return}
    const symbol=tvSymbol(panel);if(!symbol){overlay.style.display='none';return}
    const r=wrap.getBoundingClientRect();activeWrap=wrap;
    overlay.style.left=Math.max(0,r.left)+'px';overlay.style.top=Math.max(0,r.top)+'px';
    overlay.style.width=Math.max(0,Math.min(r.right,innerWidth)-Math.max(0,r.left))+'px';
    overlay.style.height=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(0,r.top))+'px';
    overlay.style.display=r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth?'block':'none';
    if(overlay.style.display==='block')mount(symbol);
  }
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  addEventListener('scroll',scan,{passive:true});addEventListener('resize',scan,{passive:true});
  setInterval(scan,300);scan();
})();