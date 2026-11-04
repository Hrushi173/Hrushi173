(function () {
  'use strict';

  const PRODUCTS = [
    ['Product / service 1', 25000, 5.0, 42],
    ['Product / service 2', 15000, 0, 48],
    ['Product / service 3', 0, 0, 40]
  ];
  const DEFAULTS = { year: 2026, opex: 125000, opexGrowth: 4, capex: 6, usefulLife: 5, tax: 25, interest: 9, debt: 100000, equity: 150000, cash: 50000, ppe: 100000, receivables: 8, inventory: 6, payables: 5, borrowings: 0, repayment: 5, equityRaise: 0, grant: 0 };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  const n = (v, d=0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const fmt = v => Number.isFinite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '—';
  const pct = v => Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—';

  function field(id, label, value, suffix='', step='any') {
    return `<label class="ax-model-field"><span>${label}</span><div><input type="number" id="${id}" value="${value}" data-default="${value}" step="${step}"><small>${suffix}</small></div></label>`;
  }
  function ensure() {
    const title = document.getElementById('ax-title');
    const content = document.getElementById('ax-content');
    if (!title || !content || title.textContent !== 'Company research') return;
    const route = document.getElementById('ax-rout');
    if (!route || document.getElementById('ax-forecast-model')) return;
    const box = document.createElement('section');
    box.id = 'ax-forecast-model';
    box.className = 'ax-box ax-model-shell';
    box.innerHTML = `<div class="ax-model-top"><div><div class="ax-kicker">AXIOMDESK · OPERATING MODEL</div><h3>Five-year integrated forecast</h3><p class="ax-muted">Based on your multi-product workbook: revenue build, operating costs, capex, debt and equity feed linked income statement, balance sheet and cash flow projections.</p></div><div class="ax-model-actions"><label>Case<select id="ax-case"><option value="base">Base</option><option value="down">Downside</option><option value="up">Upside</option></select></label><button class="ax-btn" id="ax-export-model">Export CSV</button><button class="ax-btn" id="ax-reset-model">Reset</button></div></div>
      <details class="ax-model-assumptions" open><summary>Operating assumptions <span>Editable · model recalculates as you type</span></summary>
      <div class="ax-model-products"><div class="ax-kicker">PRODUCT REVENUE BUILD · AMOUNTS IN MODEL CURRENCY</div><div class="ax-model-product-head"><span>Product / service</span><span>Starting revenue</span><span>Annual growth</span><span>Variable cost %</span></div><div id="ax-products"></div><button class="ax-btn" id="ax-add-product">＋ Add product line</button></div>
      <div class="ax-model-inputs">${field('ax-year','First forecast year',DEFAULTS.year,'year','1')}${field('ax-opex','Starting annual fixed operating cost',DEFAULTS.opex,'amount')}${field('ax-opex-growth','Annual fixed cost growth',DEFAULTS.opexGrowth,'%','0.1')}${field('ax-capex','Capex as % of revenue',DEFAULTS.capex,'%','0.1')}${field('ax-life','Asset useful life',DEFAULTS.usefulLife,'years','1')}${field('ax-tax','Cash tax rate',DEFAULTS.tax,'%','0.1')}${field('ax-interest','Interest rate on average debt',DEFAULTS.interest,'%','0.1')}${field('ax-debt','Opening debt',DEFAULTS.debt,'amount')}${field('ax-equity','Opening paid-in equity',DEFAULTS.equity,'amount')}${field('ax-cash','Opening cash',DEFAULTS.cash,'amount')}${field('ax-ppe','Opening net fixed assets',DEFAULTS.ppe,'amount')}${field('ax-ar','Receivables as % of revenue',DEFAULTS.receivables,'%','0.1')}${field('ax-inventory','Inventory as % of revenue',DEFAULTS.inventory,'%','0.1')}${field('ax-ap','Payables as % of variable costs',DEFAULTS.payables,'%','0.1')}${field('ax-borrow','Annual new borrowings',DEFAULTS.borrowings,'amount')}${field('ax-repay','Debt repayment as % of opening debt',DEFAULTS.repayment,'%','0.1')}${field('ax-raise','Annual equity raise',DEFAULTS.equityRaise,'amount')}${field('ax-grant','Annual grants',DEFAULTS.grant,'amount')}</div></details>
      <div id="ax-model-output" class="ax-model-output"></div><p class="ax-model-footnote">Forecast illustration, not company-reported guidance. All amounts and assumptions are editable. Opening balance sheet uses cash, receivables, inventory, fixed assets, payables, debt and paid-in equity; opening retained earnings is the balancing amount. Validate against audited filings before relying on the results.</p>`;
    content.insertBefore(box, route);
    const products = document.getElementById('ax-products');
    PRODUCTS.forEach((p,i)=>addProductRow(products,p,i));
    document.getElementById('ax-add-product').onclick=()=>{if(products.children.length>=15)return;addProductRow(products,['Product / service '+(products.children.length+1),0,0,45],products.children.length);calculate()};
    box.addEventListener('input', calculate);
    box.addEventListener('change', calculate);
    document.getElementById('ax-reset-model').onclick=()=>{box.querySelectorAll('input[type=number]').forEach((el)=>{const key=el.dataset.key;if(key&&DEFAULTS[key]!==undefined)el.value=DEFAULTS[key];else if(el.dataset.default!==undefined)el.value=el.dataset.default});document.getElementById('ax-case').value='base';calculate()};
    document.getElementById('ax-export-model').onclick=exportModel;
    calculate();
  }
  function addProductRow(host,p,i) {
    const row=document.createElement('div');row.className='ax-model-product';row.innerHTML=`<input aria-label="Product name" value="${esc(p[0])}" data-product="name"><input type="number" aria-label="Starting revenue" value="${p[1]}" step="any" data-product="revenue"><input type="number" aria-label="Annual growth percent" value="${p[2]}" step="0.1" data-product="growth"><input type="number" aria-label="Variable cost percent" value="${p[3]}" step="0.1" data-product="cost"><button type="button" class="ax-model-remove" aria-label="Remove product">×</button>`;
    row.querySelector('.ax-model-remove').onclick=()=>{if(host.children.length>1){row.remove();calculate()}};
    host.appendChild(row);
  }
  function read() {
    const v=id=>n(document.getElementById(id)?.value);
    return {year:v('ax-year'),opex:v('ax-opex'),opexGrowth:v('ax-opex-growth')/100,capex:v('ax-capex')/100,life:Math.max(1,v('ax-life')),tax:v('ax-tax')/100,interest:v('ax-interest')/100,debt:v('ax-debt'),equity:v('ax-equity'),cash:v('ax-cash'),ppe:v('ax-ppe'),ar:v('ax-ar')/100,inventory:v('ax-inventory')/100,ap:v('ax-ap')/100,borrow:v('ax-borrow'),repay:v('ax-repay')/100,raise:v('ax-raise'),grant:v('ax-grant'),case:document.getElementById('ax-case')?.value||'base',products:[...document.querySelectorAll('#ax-products .ax-model-product')].map(row=>({name:row.querySelector('[data-product=name]').value||'Product',revenue:n(row.querySelector('[data-product=revenue]').value),growth:n(row.querySelector('[data-product=growth]').value)/100,cost:n(row.querySelector('[data-product=cost]').value)/100}))};
  }
  function model(a) {
    const down=a.case==='down',up=a.case==='up',growthScale=down?.65:up?1.25:1,marginShift=down?.04:up?-.02:0,opexFactor=down?1.1:up?.96:1;
    let cash=a.cash,debt=a.debt,ppe=a.ppe,ar=0,inventory=0,ap=0,paidIn=a.equity;
    let rev0=a.products.reduce((s,p)=>s+p.revenue,0),vc0=a.products.reduce((s,p)=>s+p.revenue*Math.max(0,Math.min(.95,p.cost+marginShift)),0);
    ar=rev0*a.ar;inventory=vc0*a.inventory;ap=vc0*a.ap;
    let retained=cash+ar+inventory+ppe-ap-debt-paidIn;
    const years=[]; let prevRevenue=rev0,prevAr=ar,prevInventory=inventory,prevAp=ap;
    for(let y=0;y<5;y++){
      const year=a.year+y,productRevenue=a.products.map(p=>p.revenue*Math.pow(1+p.growth*growthScale,y));
      const revenue=productRevenue.reduce((s,x)=>s+x,0),variableCosts=a.products.reduce((s,p,i)=>s+productRevenue[i]*Math.max(0,Math.min(.95,p.cost+marginShift)),0),grossProfit=revenue-variableCosts,opex=a.opex*Math.pow(1+a.opexGrowth*(down?1.2:1),y)*opexFactor,ebitda=grossProfit-opex,capex=revenue*a.capex,depreciation=(ppe+capex/2)/a.life,ebit=ebitda-depreciation,openingDebt=debt,newBorrowings=a.borrow,repayment=Math.min(openingDebt,openingDebt*a.repay),averageDebt=(openingDebt+openingDebt+newBorrowings-repayment)/2,interest=averageDebt*a.interest,ebt=ebit-interest,tax=Math.max(0,ebt*a.tax),netIncome=ebt-tax;
      const nextAr=revenue*a.ar,nextInventory=variableCosts*a.inventory,nextAp=variableCosts*a.ap,deltaNwc=(nextAr-prevAr)+(nextInventory-prevInventory)-(nextAp-prevAp);
      const cfo=netIncome+depreciation-deltaNwc,fcf=cfo-capex,financing=newBorrowings-repayment+a.raise+a.grant,cashEnd=cash+fcf+financing;
      const ppeEnd=Math.max(0,ppe+capex-depreciation),debtEnd=openingDebt+newBorrowings-repayment;paidIn+=a.raise+a.grant;retained+=netIncome;
      const assets=cashEnd+nextAr+nextInventory+ppeEnd,liabilities=nextAp+debtEnd+paidIn+retained,check=assets-liabilities;
      const equityEnd=paidIn+retained,yearsRatio={revenueGrowth:prevRevenue?revenue/prevRevenue-1:null,grossMargin:revenue?grossProfit/revenue:null,ebitdaMargin:revenue?ebitda/revenue:null,netMargin:revenue?netIncome/revenue:null,de:equityEnd?debtEnd/equityEnd:null,currentRatio:(cashEnd+nextAr+nextInventory)/(nextAp+debtEnd*a.repay||NaN),roe:equityEnd?netIncome/equityEnd:null,fcf};
      years.push({year,productRevenue,revenue,variableCosts,grossProfit,opex,ebitda,depreciation,ebit,interest,tax,netIncome,cfo,capex,fcf,cash:cashEnd,ar:nextAr,inventory:nextInventory,ppe:ppeEnd,ap:nextAp,debt:debtEnd,equity:equityEnd,assets,liabilities,check,ratios:yearsRatio});
      cash=cashEnd;debt=debtEnd;ppe=ppeEnd;prevAr=nextAr;prevInventory=nextInventory;prevAp=nextAp;prevRevenue=revenue;
    }
    return years;
  }
  const rows=[['Revenue','revenue'],['Variable costs','variableCosts'],['Gross profit','grossProfit'],['Fixed operating costs','opex'],['EBITDA','ebitda'],['Depreciation','depreciation'],['EBIT','ebit'],['Interest expense','interest'],['Cash taxes','tax'],['Net income','netIncome'],['Operating cash flow','cfo'],['Capital expenditure','capex'],['Free cash flow','fcf'],['Cash at year end','cash'],['Trade receivables','ar'],['Inventory','inventory'],['Net fixed assets','ppe'],['Trade payables','ap'],['Debt','debt'],['Paid-in equity + retained earnings','equity'],['Total assets','assets'],['Liabilities + equity','liabilities'],['Balance check','check']];
  function calculate() {
    const target=document.getElementById('ax-model-output');if(!target)return;
    const a=read(),ys=model(a),last=ys[4],initialRevenue=a.products.reduce((s,p)=>s+p.revenue,0),cagr=initialRevenue?Math.pow(last.revenue/initialRevenue,1/5)-1:null;
    const head=`<thead><tr><th>Income statement · cash flow · balance sheet</th>${ys.map(y=>`<th>${y.year}</th>`).join('')}</tr></thead>`;
    const body=rows.map(([label,key])=>`<tr class="${['revenue','grossProfit','ebitda','ebit','netIncome','fcf','assets','liabilities','check'].includes(key)?'ax-model-total':''}"><th>${label}</th>${ys.map(y=>`<td class="${key==='check'&&Math.abs(y.check)>.02?'ax-model-warn':''}">${fmt(y[key])}</td>`).join('')}</tr>`).join('');
    const ratios=[['Revenue CAGR',cagr],['Gross margin',last.ratios.grossMargin],['EBITDA margin',last.ratios.ebitdaMargin],['Net margin',last.ratios.netMargin],['Debt / equity',last.ratios.de],['Current ratio',last.ratios.currentRatio],['ROE',last.ratios.roe],['Year 5 FCF',last.ratios.fcf]];
    const checks=ys.every(y=>Math.abs(y.check)<.02),insights=[];
    insights.push(cagr!==null?`Revenue compounds at ${pct(cagr)} over five years in the ${a.case} case.`:'Add starting product revenue to calculate revenue growth.');
    insights.push(last.netIncome>=0?'Year 5 is profitable after interest and cash taxes.':'Year 5 remains loss-making; review gross margin, operating cost scale and financing assumptions.');
    insights.push(last.fcf>=0?'Year 5 free cash flow is positive after working capital and capex.':'Year 5 free cash flow is negative; growth consumes cash under these assumptions.');
    if(!checks)insights.push('Balance sheet does not reconcile. Review opening balances and model assumptions.');
    const profile=symbolProfile();
    target.innerHTML=`<div class="ax-model-kpis">${ratios.map(([k,v])=>`<div class="ax-metric"><small>${k}</small><b>${k.includes('margin')||k.includes('CAGR')||k==='ROE'?pct(v):k==='Year 5 FCF'?fmt(v):Number.isFinite(v)?fmt(v)+(k==='Current ratio'?'×':'×'):'—'}</b></div>`).join('')}</div><div class="ax-model-subhead"><div><div class="ax-kicker">LINKED OUTPUTS · ${a.case.toUpperCase()} CASE</div><p class="ax-muted">Income statement · balance sheet · cash flow · all values in model currency.</p></div><span class="ax-model-check ${checks?'ok':'warn'}">${checks?'BALANCED · 5/5 YEARS':'CHECK OPEN'}</span></div><div class="ax-model-table-wrap"><table class="ax-model-table">${head}<tbody>${body}</tbody></table></div><div class="ax-model-subhead"><div class="ax-kicker">MODEL READ-THROUGH</div></div><div class="ax-model-insights">${insights.map(t=>`<div>↗ &nbsp;${esc(t)}</div>`).join('')}</div><div class="ax-model-sources">${profile}</div>`;
  }
  function symbolProfile() {
    const symbol=document.getElementById('ax-symbol')?.value?.trim().toUpperCase()||'';if(!symbol)return '<span class="ax-muted">Search for a company to open its Screener.in profile and exchange pages.</span>';
    const ticker=symbol.replace(/\.(NS|BO)$/,'').replace(/[^A-Z0-9&-]/g,'');
    const screener=`https://www.screener.in/company/${encodeURIComponent(ticker)}/`,nse=`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(ticker)}`,bse=`https://www.bseindia.com/stock-share-price/${encodeURIComponent(ticker)}`;
    return `<span class="ax-kicker">PRIMARY DATA DESKS</span><a href="${screener}" target="_blank" rel="noopener noreferrer">Screener.in financials &amp; company news ↗</a><a href="${nse}" target="_blank" rel="noopener noreferrer">NSE company data ↗</a><a href="${bse}" target="_blank" rel="noopener noreferrer">BSE company data ↗</a><small>Exchange and Screener pages open at their source. This terminal uses its connected quote provider for charts/quotes; use an exchange-authorized feed for redistribution or programmatic delivery.</small>`;
  }
  function exportModel() {
    const a=read(),ys=model(a),lines=[['Statement line',...ys.map(y=>y.year)],...rows.map(([label,key])=>[label,...ys.map(y=>y[key])])];
    const csv=lines.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='AxiomDesk-five-year-integrated-model.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }
  new MutationObserver(ensure).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{const hit=e.target?.closest?.('.ax-hit');if(hit){const input=document.getElementById('ax-symbol');if(input)input.value=hit.textContent.split(' · ')[0].trim()}if(e.target?.id==='ax-search')setTimeout(()=>{const symbol=document.getElementById('ax-symbol')?.value;if(symbol){const output=document.getElementById('ax-model-output');if(output)output.querySelector('.ax-model-sources')?.replaceWith(Object.assign(document.createElement('div'),{className:'ax-model-sources',innerHTML:symbolProfile()}))}},500)});
  const style=document.createElement('style');style.textContent=`
  #ax-forecast-model{position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(18,35,49,.88),rgba(10,20,31,.9));border-color:rgba(136,208,213,.24);box-shadow:0 16px 60px rgba(2,10,17,.36),inset 0 1px rgba(255,255,255,.08)}
  #ax-forecast-model:before{content:"";position:absolute;inset:-60% auto auto -20%;width:55%;height:300px;background:radial-gradient(ellipse,rgba(82,209,199,.13),transparent 70%);pointer-events:none;animation:ax-model-glow 9s ease-in-out infinite alternate}
  @keyframes ax-model-glow{to{transform:translate(100%,30px) scale(1.25);opacity:.6}}
  .ax-model-top,.ax-model-subhead{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;position:relative}.ax-model-top h3{color:#e5f4f4;margin:7px 0;font-size:18px}.ax-model-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ax-model-actions label{color:#9bb2c0;font-size:10px}.ax-model-actions select{display:block;margin-top:5px;padding:6px}.ax-model-assumptions{position:relative;margin-top:15px;border:1px solid #3c5159;border-radius:9px;background:rgba(6,16,25,.38)}.ax-model-assumptions summary{padding:11px;color:#d8e9eb;cursor:pointer;font-size:11px}.ax-model-assumptions summary span{float:right;color:#728c9b;font-size:9px}.ax-model-products,.ax-model-inputs{padding:10px 12px 14px;border-top:1px solid #33464e}.ax-model-product-head,.ax-model-product{display:grid;grid-template-columns:minmax(100px,1.5fr) repeat(3,minmax(90px,1fr)) 24px;gap:7px;align-items:center}.ax-model-product-head{margin:9px 0;color:#7593a0;font-size:9px}.ax-model-product{margin:6px 0}.ax-model-product input,.ax-model-field input{width:100%;min-width:0;background:#0d1b25!important;border:1px solid #304b55!important;color:#dcecee!important;border-radius:5px;padding:7px;font-size:10px}.ax-model-product input:focus,.ax-model-field input:focus{border-color:#5fd3c3!important;box-shadow:0 0 0 2px #5fd3c322}.ax-model-remove{color:#c0d0d2;padding:3px}.ax-model-inputs{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:9px}.ax-model-field{display:block;color:#91a8b5;font-size:9px}.ax-model-field>span{display:block;min-height:25px}.ax-model-field>div{display:flex;align-items:center;gap:5px}.ax-model-field small{white-space:nowrap;color:#637f8c;font-size:8px}.ax-model-output{position:relative;margin-top:15px}.ax-model-kpis{display:grid;grid-template-columns:repeat(4,minmax(100px,1fr));gap:7px;margin:12px 0}.ax-model-kpis .ax-metric{background:rgba(10,23,33,.7);border:1px solid #30454c;border-radius:7px;padding:9px}.ax-model-kpis .ax-metric b{color:#d6eee8}.ax-model-subhead{align-items:center;margin:14px 0 8px}.ax-model-check{font:9px 'IBM Plex Mono',monospace;color:#7fe0bc}.ax-model-check.warn{color:#ffc477}.ax-model-table-wrap{overflow:auto;max-height:500px;border:1px solid #32434a;border-radius:8px}.ax-model-table{width:100%;border-collapse:collapse;min-width:690px;font-size:10px}.ax-model-table th,.ax-model-table td{padding:8px 9px;border-bottom:1px solid #283b43;text-align:right;white-space:nowrap}.ax-model-table thead th{position:sticky;top:0;background:#152631;color:#82a4ad;z-index:1}.ax-model-table th:first-child{text-align:left;min-width:220px}.ax-model-table tbody th{font-weight:450;color:#9fb5bc}.ax-model-table tbody td{font-variant-numeric:tabular-nums;color:#c7d8d9}.ax-model-table tr:hover{background:#1c3338}.ax-model-table tr.ax-model-total{background:rgba(54,115,108,.12)}.ax-model-table tr.ax-model-total th,.ax-model-table tr.ax-model-total td{color:#d8eee8;font-weight:600}.ax-model-table .ax-model-warn{color:#ffbb73}.ax-model-insights{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ax-model-insights>div{padding:10px;border:1px solid #3a4d50;border-radius:7px;color:#b9d0ce;background:rgba(20,44,43,.4);font-size:10px;line-height:1.6}.ax-model-sources{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin-top:14px;padding-top:12px;border-top:1px solid #33474a}.ax-model-sources a{color:#89dacf;border:1px solid #39595b;border-radius:5px;padding:7px 9px;font-size:9px}.ax-model-sources small{width:100%;color:#748d92;font-size:9px;line-height:1.6}.ax-model-footnote{color:#718995;font-size:9px;line-height:1.7;margin-top:12px}
  @media(max-width:700px){.ax-model-top,.ax-model-subhead{display:block}.ax-model-actions{margin-top:10px}.ax-model-inputs{grid-template-columns:repeat(2,minmax(120px,1fr))}.ax-model-kpis{grid-template-columns:repeat(2,minmax(100px,1fr))}.ax-model-insights{grid-template-columns:1fr}.ax-model-product-head,.ax-model-product{grid-template-columns:minmax(100px,1.2fr) repeat(3,minmax(70px,1fr)) 22px;gap:4px}.ax-model-products{overflow:auto}.ax-model-product-head,.ax-model-product{min-width:450px}}
  @media(prefers-reduced-motion:reduce){#ax-forecast-model:before{animation:none}}
  `;document.head.appendChild(style);
})();

