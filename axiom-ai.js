(()=>{'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const styles=document.createElement('style');
  styles.textContent=`
  #ax-ai-launch{position:fixed;z-index:1200;right:292px;bottom:16px;display:flex;align-items:center;gap:7px;padding:10px 13px;border:1px solid rgba(113,210,196,.45);border-radius:999px;color:#d9f5f1;background:linear-gradient(135deg,rgba(22,64,68,.96),rgba(21,35,49,.97));box-shadow:0 8px 28px #0006;font:600 11px 'DM Sans',sans-serif;cursor:pointer}
  #ax-ai-launch:hover{border-color:#8ce8d6;box-shadow:0 0 22px rgba(78,219,197,.2);transform:translateY(-1px)}
  #ax-ai-overlay{position:fixed;inset:0;z-index:1300;display:none;place-items:center;padding:20px;background:rgba(3,8,13,.72);backdrop-filter:blur(12px)}
  #ax-ai-overlay.open{display:grid}
  .ax-ai-dialog{width:min(760px,96vw);max-height:min(86vh,900px);overflow:auto;padding:20px;border:1px solid rgba(127,186,196,.28);border-radius:16px;background:linear-gradient(145deg,rgba(17,34,47,.98),rgba(10,20,30,.98));box-shadow:0 30px 90px rgba(0,0,0,.55);color:#d8e8ed;font-family:'DM Sans',sans-serif}
  .ax-ai-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.ax-ai-kicker{color:#80d9ca;font:9px 'IBM Plex Mono',monospace;letter-spacing:.1em}.ax-ai-head h2{margin:5px 0;color:#f1f7f9;font-size:21px}.ax-ai-head p{margin:0;color:#91a6b1;font-size:11px;line-height:1.55}.ax-ai-close{border:1px solid #435663;border-radius:8px;padding:6px 9px;color:#b9c9d2;cursor:pointer}
  .ax-ai-form{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:17px}.ax-ai-field{display:grid;gap:6px;color:#8fa7b4;font:9px 'IBM Plex Mono',monospace;letter-spacing:.05em}.ax-ai-field.full{grid-column:1/-1}.ax-ai-field input,.ax-ai-field select,.ax-ai-field textarea{width:100%;border:1px solid #374b57;border-radius:8px;padding:10px;color:#dfedf0;background:#0b1822;font:12px 'DM Sans',sans-serif;outline:none}.ax-ai-field input:focus,.ax-ai-field select:focus,.ax-ai-field textarea:focus{border-color:#68cdbd;box-shadow:0 0 0 2px #68cdbd22}.ax-ai-field textarea{min-height:110px;resize:vertical;line-height:1.5}.ax-ai-note{grid-column:1/-1;margin:0;color:#7f929d;font-size:10px;line-height:1.55}.ax-ai-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px}.ax-ai-status{color:#8ea5b0;font:9px 'IBM Plex Mono',monospace}.ax-ai-run{border:1px solid #6dcfc0;border-radius:8px;padding:10px 14px;background:linear-gradient(110deg,#a4eadc,#6dcfc0);color:#0c2429;font-weight:700;font-size:11px;cursor:pointer}.ax-ai-run:disabled{opacity:.5;cursor:wait}.ax-ai-result{display:none;margin-top:15px;padding:14px;border:1px solid #354b56;border-radius:10px;background:rgba(5,14,21,.62)}.ax-ai-result.visible{display:block}.ax-ai-result h3{margin:0 0 8px;color:#a8d9d3;font-size:10px;letter-spacing:.08em}.ax-ai-result pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#dae7e9;font:12px/1.65 'DM Sans',sans-serif}.ax-ai-sources{margin-top:10px;color:#8299a4;font:9px/1.5 'IBM Plex Mono',monospace}.ax-ai-sources a{color:#90d8cc;margin-right:10px}
  @media(max-width:700px){#ax-ai-launch{right:12px;bottom:76px}.ax-ai-form{grid-template-columns:1fr}.ax-ai-field.full,.ax-ai-note,.ax-ai-actions{grid-column:1}.ax-ai-actions{align-items:stretch;flex-direction:column}.ax-ai-run{width:100%}}
  @media(prefers-reduced-motion:reduce){#ax-ai-launch{transform:none!important}}
  `;
  document.head.appendChild(styles);
  const launch=document.createElement('button');launch.id='ax-ai-launch';launch.type='button';launch.setAttribute('aria-haspopup','dialog');launch.innerHTML='✧ <span>AI Research</span>';
  const overlay=document.createElement('div');overlay.id='ax-ai-overlay';overlay.innerHTML=`<section class="ax-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ax-ai-title"><div class="ax-ai-head"><div><div class="ax-ai-kicker">AXIOMDESK · AGENTROUTER</div><h2 id="ax-ai-title">AI research copilot</h2><p>Ask a focused question about a listed company. The assistant will use the selected ticker, public quote data and recent public headlines.</p></div><button class="ax-ai-close" type="button" aria-label="Close AI copilot">Close</button></div><div class="ax-ai-form"><label class="ax-ai-field">TICKER<input id="ax-ai-symbol" maxlength="28" placeholder="e.g. RELIANCE.NS or AAPL"></label><label class="ax-ai-field">MODEL<select id="ax-ai-model"><option value="">Loading available models…</option></select></label><label class="ax-ai-field full">YOUR QUESTION<textarea id="ax-ai-prompt" maxlength="3500">Summarize the latest company-specific developments, key operating drivers, material risks, and what evidence would change the investment thesis. Separate supplied facts from inference.</textarea></label><p class="ax-ai-note">Your ticker and question, plus provider-supplied public quote/headline context, are sent to AgentRouter and its selected model. Uploaded workbooks and editable three-statement assumptions are not sent. AI responses can be wrong and are not investment advice.</p><div class="ax-ai-actions"><span class="ax-ai-status" id="ax-ai-status">Ready when models load.</span><button class="ax-ai-run" id="ax-ai-run" type="button" disabled>Generate research brief</button></div></div><div class="ax-ai-result" id="ax-ai-result" aria-live="polite"><h3>MODEL RESPONSE</h3><pre id="ax-ai-answer"></pre><div class="ax-ai-sources" id="ax-ai-sources"></div></div></section>`;
  document.body.append(launch,overlay);
  const modelEl=overlay.querySelector('#ax-ai-model'),status=overlay.querySelector('#ax-ai-status'),run=overlay.querySelector('#ax-ai-run'),result=overlay.querySelector('#ax-ai-result'),answer=overlay.querySelector('#ax-ai-answer'),sources=overlay.querySelector('#ax-ai-sources'),symbolEl=overlay.querySelector('#ax-ai-symbol');
  let loaded=false;
  function activeSymbol(){
    const research=document.getElementById('ax-symbol')?.value?.trim();
    if(research)return research.toUpperCase();
    const line=document.querySelector('.instrument-title h2')?.parentElement?.querySelector('span')?.textContent?.split('\n')[0]?.trim()||'';
    return line.replace(/\s*\/\s*/g,'').split(/\s+/)[0]?.toUpperCase()||'';
  }
  async function loadModels(){
    status.textContent='Connecting to AgentRouter…';run.disabled=true;
    try{
      const r=await fetch('/api/ai/models',{headers:{accept:'application/json'}}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Could not load models');
      modelEl.replaceChildren();
      (d.models||[]).forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.name||m.id;modelEl.appendChild(o)});
      if(!d.models?.length)throw new Error('No models are available for this API key.');
      loaded=true;run.disabled=false;status.textContent=d.models.length+' models available · choose one';
    }catch(e){modelEl.innerHTML='<option value="">Unavailable</option>';status.textContent=e.message||'AI connection unavailable';}
  }
  function open(){
    overlay.classList.add('open');symbolEl.value=activeSymbol();result.classList.remove('visible');
    if(!loaded)loadModels();overlay.querySelector('#ax-ai-prompt').focus();
  }
  function close(){overlay.classList.remove('open');launch.focus()}
  launch.addEventListener('click',open);overlay.querySelector('.ax-ai-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))close()});
  run.addEventListener('click',async()=>{
    const prompt=overlay.querySelector('#ax-ai-prompt').value.trim(),symbol=symbolEl.value.trim().toUpperCase(),model=modelEl.value;
    if(!model||!prompt)return;
    run.disabled=true;status.textContent='Researching public market context…';answer.textContent='';sources.textContent='';result.classList.add('visible');
    try{
      const r=await fetch('/api/ai/chat',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({model,prompt,symbol})}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'AI request failed');
      answer.textContent=d.answer||'No response returned.';
      const links=(d.sources?.headlines||[]).filter(s=>s.url).slice(0,5);
      sources.textContent=d.sources?.quote?'Quote source: '+d.sources.quote+' · '+links.length+' headline source(s) linked below.':'No quote snapshot supplied.';
      links.forEach(s=>{const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.publisher||'Source';sources.appendChild(a)});
      status.textContent='Complete · '+(d.model||model);
    }catch(e){answer.textContent=e.message||'AI request failed';status.textContent='Request failed';}
    finally{run.disabled=false}
  });
})();