// Lucky Car Ladestatistik · Upload & Auto-Erfassung + GitHub-Speicher
// Liest Rechnungs-PDFs im Browser, erkennt Lieferant/Gesellschaft/Betrag/Datum/Nr.,
// prüft auf Doppelanlagen und speichert dauerhaft (lokal + optional privates GitHub-Repo).
(function(){
  const D = window.LCData || {};
  const eu  = D.eu  || (v => '€ ' + (v||0).toLocaleString('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2}));
  const num = D.num || ((v,d=0)=> (v||0).toLocaleString('de-AT',{minimumFractionDigits:d,maximumFractionDigits:d}));

  const CFG_KEY    = 'lc_gh_cfg_v1';      // {owner,repo,branch,token}
  const UPLOAD_KEY = 'lc_uploads_v1';     // local cache: array of added invoice records
  const CZK = 24.70, HUF = 400;

  // ---------------------------------------------------------------- config
  // === Für eine geteilte/gehostete Version EINMALIG hier eintragen ===
  // (owner/repo/branch sind unkritisch; token/aiKey nur eintragen, wenn der Link
  //  ausschließlich intern geteilt wird — sonst leer lassen und pro Gerät setzen.)
  const EMBEDDED_CONFIG = {
    owner:  'chorvatkatai-sudo',
    repo:   'Lucky-car-ladekosten',
    branch: 'main',
    token:  '',           // <-- für Hintergrund-Betrieb hier Token einsetzen
    aiKey:  '',           // <-- für Hintergrund-Betrieb hier Anthropic-Key einsetzen
    aiModel:'claude-sonnet-4-5'
  };
  function getCfg(){
    let ls={}; try{ ls=JSON.parse(localStorage.getItem(CFG_KEY))||{}; }catch(e){}
    const m={...EMBEDDED_CONFIG};
    for(const k in ls){ if(ls[k]!=null && ls[k]!=='') m[k]=ls[k]; }
    return m;
  }
  function setCfg(c){ localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
  function ghReady(){ const c=getCfg(); return !!(c.owner && c.repo && c.token); }

  // ---------------------------------------------------------------- local cache
  function getLocal(){ try{ return JSON.parse(localStorage.getItem(UPLOAD_KEY)) || []; }catch(e){ return []; } }
  function setLocal(a){ localStorage.setItem(UPLOAD_KEY, JSON.stringify(a)); }

  // Merge added invoices into the in-memory register (called before first render)
  function mergeStored(){
    const reg = window.RECHNUNGEN_DATA;
    if(!reg) return;
    if(!reg._seedCount) reg._seedCount = reg.invoices.length; // remember shipped seed size
    // rebuild: seed (first _seedCount) + added
    reg.invoices = reg.invoices.slice(0, reg._seedCount).concat(getLocal());
  }

  // ---------------------------------------------------------------- GitHub API
  function ghHeaders(){ const c=getCfg(); return { 'Authorization':'Bearer '+c.token, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' }; }
  function encPath(p){ return p.split('/').map(encodeURIComponent).join('/'); }
  function apiUrl(path){ const c=getCfg(); return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${encPath(path)}`; }

  function b64encode(str){ return btoa(unescape(encodeURIComponent(str))); }
  function b64decode(b64){ return decodeURIComponent(escape(atob(b64))); }
  function bytesToB64(bytes){
    let bin=''; const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk){ bin += String.fromCharCode.apply(null, bytes.subarray(i,i+chunk)); }
    return btoa(bin);
  }

  async function ghGetFile(path){ // -> {json|text, sha} or null if 404
    const c=getCfg();
    const res = await fetch(apiUrl(path)+'?ref='+encodeURIComponent(c.branch||'main'), { headers: ghHeaders() });
    if(res.status===404) return null;
    if(!res.ok) throw new Error('GitHub '+res.status+' '+(await res.text()).slice(0,160));
    const j = await res.json();
    return { content: b64decode(j.content||''), sha: j.sha };
  }
  async function ghPutFile(path, contentB64, message, sha){
    const c=getCfg();
    const body = { message, content: contentB64, branch: c.branch||'main' };
    if(sha) body.sha = sha;
    const res = await fetch(apiUrl(path), { method:'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
    if(!res.ok) throw new Error('GitHub PUT '+res.status+' '+(await res.text()).slice(0,160));
    return res.json();
  }
  // Test connection
  async function ghTest(){
    const c=getCfg();
    const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: ghHeaders() });
    if(!res.ok) throw new Error('Status '+res.status);
    const j = await res.json();
    return { private: j.private, perm: (j.permissions&&j.permissions.push)?'schreibbar':'nur lesen' };
  }

  const DATA_PATH = 'data/rechnungen.json';
  let _dataSha = null;

  // Pull authoritative added-list from repo, replace local cache, re-merge
  async function ghPull(){
    const f = await ghGetFile(DATA_PATH);
    if(f){
      _dataSha = f.sha;
      let parsed = {}; try{ parsed = JSON.parse(f.content); }catch(e){}
      const added = Array.isArray(parsed.added) ? parsed.added : [];
      setLocal(added);
    }else{
      _dataSha = null; // file not yet created
    }
    mergeStored();
  }
  // Push current local added-list to repo
  async function ghPush(message){
    const payload = { schema:'lc-rechnungen-1', updated:new Date().toISOString(), added:getLocal() };
    if(_dataSha===null){ const ex=await ghGetFile(DATA_PATH); if(ex) _dataSha=ex.sha; }
    const r = await ghPutFile(DATA_PATH, b64encode(JSON.stringify(payload,null,1)), message||'Update Rechnungsregister', _dataSha);
    _dataSha = r.content && r.content.sha;
    return r;
  }
  async function ghPutPdf(filename, file){
    const buf = new Uint8Array(await file.arrayBuffer());
    const path = 'uploads/'+filename;
    let sha=null; const ex=await ghGetFile(path).catch(()=>null); if(ex) sha=ex.sha;
    await ghPutFile(path, bytesToB64(buf), 'Beleg '+filename, sha);
    return path;
  }

  // One-click migration: push ALL existing register PDFs into the repo (run from this project, where the PDFs are reachable)
  async function migrateExisting(cb){
    const inv = (window.RECHNUNGEN_DATA && window.RECHNUNGEN_DATA.invoices) || [];
    const paths = [...new Set(inv.map(i=>i.pdf).filter(p=>p && p.indexOf('uploads/')===0))];
    let ok=0; const fail=[];
    for(let k=0;k<paths.length;k++){
      const p = paths[k]; if(cb) cb(k+1, paths.length, p);
      try{
        const res = await fetch(encodeURI(p));
        if(!res.ok){ fail.push(p.split('/').pop()+' (nicht gefunden)'); continue; }
        const bytes = new Uint8Array(await (await res.blob()).arrayBuffer());
        let sha=null; const ex=await ghGetFile(p).catch(()=>null); if(ex) sha=ex.sha;
        await ghPutFile(p, bytesToB64(bytes), 'Bestand: '+p.split('/').pop(), sha);
        ok++;
      }catch(e){ fail.push(p.split('/').pop()+' ('+(e.message||'Fehler')+')'); }
    }
    // also store the full register snapshot for reference
    try{ await ghPutFile('data/register-bestand.json', b64encode(JSON.stringify({updated:new Date().toISOString(), invoices:inv},null,1)), 'Register-Bestand Snapshot', (await ghGetFile('data/register-bestand.json').catch(()=>null)||{}).sha); }catch(e){}
    return { ok, fail, total:paths.length };
  }

  // ================================================================ KI (Variante C — optional)
  function aiKey(){ return getCfg().aiKey || ''; }
  function aiModel(){ return getCfg().aiModel || 'claude-sonnet-4-5'; }
  function aiAvailable(){ return !!aiKey() || !!(window.claude && window.claude.complete); }

  async function anthropicCall(prompt){
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':aiKey(), 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:aiModel(), max_tokens:700, messages:[{role:'user',content:prompt}] })
    });
    if(!res.ok) throw new Error('KI '+res.status+' '+(await res.text()).slice(0,140));
    const j=await res.json();
    return (j.content && j.content[0] && j.content[0].text) || '';
  }

  function aiPrompt(text, filename){
    return `Du bist Buchhaltungs-Assistent für einen Autohaus-Fuhrpark (Lucky Car). Extrahiere aus dem Rechnungstext die Felder und gib AUSSCHLIESSLICH gültiges JSON zurück (keine Erklärung, kein Markdown).\nZuordnung der Gesellschaft:\n- Lieferant Wien Energie -> "Franchise"\n- Lieferant DKV: Kundennummer/Konto 4100051519 -> "LCCC"; Konto 4302432612 -> "Franchise"\n- Lieferant Tesla / Supercharger -> "Fleet"\nJSON-Form: {"lief":"","ges":"Franchise|LCCC|Fleet|ASS","typ":"","nr":"","datum":"YYYY-MM-DD","betrag":0,"waehrung":"EUR|CZK|HUF","konto":"","vertrag":""}\nbetrag = Bruttobetrag inkl. USt als Dezimalzahl mit Punkt. Unbekanntes leer lassen.\nDATEINAME: ${filename}\nRECHNUNGSTEXT:\n${(text||'').slice(0,6000)}`;
  }

  async function aiExtract(text, filename){
    let raw='';
    if(aiKey()) raw = await anthropicCall(aiPrompt(text, filename));
    else if(window.claude && window.claude.complete) raw = await window.claude.complete(aiPrompt(text, filename));
    else return null;
    const m = raw.match(/\{[\s\S]*\}/); if(!m) return null;
    try{ return JSON.parse(m[0]); }catch(e){ return null; }
  }

  function recompute(r){
    if(r.betrag!=null && typeof r.betrag!=='number'){ const n=parseFloat((''+r.betrag).replace(',','.')); r.betrag=isFinite(n)?n:null; }
    r.eur = r.betrag==null?null:(r.waehrung==='CZK'?+(r.betrag/CZK).toFixed(2):r.waehrung==='HUF'?+(r.betrag/HUF).toFixed(2):r.betrag);
    r.monat = r.datum? (''+r.datum).slice(0,7):'';
    const warn=[]; if(!r.nr)warn.push('Beleg-Nr. fehlt'); if(r.betrag==null)warn.push('Betrag fehlt'); if(!r.datum)warn.push('Datum fehlt');
    const conf = (warn.length>=2||!r.lief||r.lief==='Unbekannt')?'niedrig':warn.length===1?'mittel':'hoch';
    return { rec:r, confidence:conf, warnings:warn };
  }

  function mergeAI(parsed, ai){
    const r = { ...parsed.rec };
    if(ai.lief && (!r.lief || r.lief==='Unbekannt')) r.lief=(''+ai.lief).trim();
    if(ai.ges && ['Franchise','LCCC','Fleet','ASS'].includes(ai.ges)) r.ges=ai.ges;
    if(ai.typ && !r.typ) r.typ=(''+ai.typ).trim();
    if(ai.nr && !r.nr) r.nr=(''+ai.nr).trim();
    if(ai.konto && !r.konto) r.konto=(''+ai.konto).trim();
    if(ai.vertrag && !r.vertrag) r.vertrag=(''+ai.vertrag).trim();
    if(ai.datum && !r.datum) r.datum=(''+ai.datum).slice(0,10);
    if(ai.waehrung && /^(EUR|CZK|HUF)$/.test(ai.waehrung)) r.waehrung=ai.waehrung;
    if(r.betrag==null && ai.betrag!=null && ai.betrag!==''){ const n=parseFloat((''+ai.betrag).replace(',','.')); if(isFinite(n)) r.betrag=n; }
    const out = recompute(r); out.aiUsed=true; return out;
  }

  // ================================================================ PARSER
  function parseAmountDE(s){ if(!s) return null; s=(''+s).replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isFinite(n)?n:null; }
  function parseDateDE(s){ const m=(''+s).match(/([0-3]?\d)\.([01]?\d)\.((?:20)?\d\d)/); if(!m) return ''; let y=m[3]; if(y.length===2)y='20'+y; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
  function firstMatch(text, res){ for(const re of res){ const m=text.match(re); if(m) return m; } return null; }

  // Returns a normalized invoice record (best effort) + meta {confidence, warnings}
  function parseInvoice(text, filename){
    const t = (text||'').replace(/\u00a0/g,' ');
    const low = t.toLowerCase();
    const fn = filename||'';
    let rec = { lief:'', ges:'', typ:'', nr:'', datum:'', monat:'', betrag:null, waehrung:'EUR', eur:null, konto:'', vertrag:'', pdf:'', neu:true, auto:true, note:'' };
    const warn = [];

    const isWien = /wien energie/i.test(t) || /servicerechnung f.r e-mobilit/i.test(t) || /7100\d{6}/.test(t);
    const isDKV  = /\bdkv\b/i.test(t) || /belegnummer dkv/i.test(low) || /4100051519|4302432612/.test(t) || /26\/\d{9}/.test(t);
    const isTesla= /tesla/i.test(t) || /supercharger/i.test(low) || /^(SUBSCRIPTION_)?(4015|4020|4032)[A-Z]?\d/.test(fn);

    if(isWien){
      rec.lief='Wien Energie'; rec.ges='Franchise'; rec.typ='Stromrechnung';
      const nr = firstMatch(t, [/Nr\.?\s*(7100\d{6})/i, /(7100\d{6})/]);
      if(nr) rec.nr = nr[1];
      const dt = firstMatch(t, [/vom\s+([0-3]?\d\.[01]?\d\.20\d\d)/i, /Rechnungsdatum[:\s]*([0-3]?\d\.[01]?\d\.20\d\d)/i]);
      if(dt) rec.datum = parseDateDE(dt[1]);
      const am = firstMatch(t, [/Rechnungsbetrag\s*\(inkl\.?\s*USt\.?\)\s*([\d.]+,\d{2})/i, /Rechnungsbetrag[^0-9]{0,20}([\d.]+,\d{2})/i, /Gesamtbetrag[^0-9]{0,20}([\d.]+,\d{2})/i]);
      if(am) rec.betrag = parseAmountDE(am[1]);
      const kd = t.match(/Kundennummer[:\s]*(\d{6,})/i); if(kd) rec.konto = kd[1];
      const vt = [...t.matchAll(/Vertrag Wien Energie:\s*(AT-VIE-[A-Z0-9-]+)/gi)].map(m=>m[1].replace('AT-VIE-','')); if(vt.length) rec.vertrag = [...new Set(vt)].join(' · ');
    } else if(isDKV){
      rec.lief='DKV'; rec.typ='Sammelrechnung';
      if(/4100051519/.test(t)){ rec.ges='LCCC'; rec.konto='4100051519'; }
      else if(/4302432612/.test(t)){ rec.ges='Franchise'; rec.konto='4302432612'; }
      else if(/competence/i.test(t)){ rec.ges='LCCC'; }
      else if(/franchise/i.test(t)){ rec.ges='Franchise'; }
      const nr = firstMatch(t, [/26\/(\d{9})/, /Rechnungsnummer[:\s]*\S*?(\d{9})/i]);
      if(nr) rec.nr = '26/'+nr[1];
      const dt = firstMatch(t, [/Rechnungsdatum[:\s]*([0-3]?\d\.[01]?\d\.20\d\d)/i, /Abrechnungsdatum[:\s]*([0-3]?\d\.[01]?\d\.20\d\d)/i, /([0-3]?\d\.[01]?\d\.20\d\d)/]);
      if(dt) rec.datum = parseDateDE(dt[1]);
      const am = firstMatch(t, [/Rechnungsbetrag[^0-9]{0,20}([\d.]+,\d{2})/i, /Gesamtsumme[^0-9]{0,30}([\d.]+,\d{2})/i, /Gesamtbetrag[^0-9]{0,20}([\d.]+,\d{2})/i, /([\d.]+,\d{2})\s*EUR/]);
      if(am) rec.betrag = parseAmountDE(am[1]);
    } else if(isTesla){
      rec.lief='Tesla'; rec.ges='Fleet'; rec.typ='Einzelbeleg';
      const nr = firstMatch(fn, [/((?:4015|4020|4032)[A-Z]?\d{8,})/, /(\d{15})/]) || firstMatch(t, [/((?:4015|4020|4032)[A-Z]?\d{8,})/]);
      if(nr) rec.nr = nr[1];
      // amount: filename "_12,52€" / "16.79€" / "630.96CZK"
      const fam = fn.match(/_?€?([\d.,]+)\s*(€|CZK)?(?:-[0-9a-f]{8})?\.pdf$/i) || fn.match(/_([\d.,]+)€/);
      if(/czk/i.test(fn)){ rec.waehrung='CZK'; }
      if(fam){ let raw=fam[1]; raw = raw.includes(',')&&raw.includes('.') ? raw.replace(/\./g,'').replace(',','.') : raw.replace(',','.'); const n=parseFloat(raw); if(isFinite(n)) rec.betrag=n; }
      const dt = firstMatch(t, [/Rechnungsdatum[:\s]*([0-3]?\d\.[01]?\d\.20\d\d)/i, /([0-3]?\d\.[01]?\d\.20\d\d)/]);
      if(dt) rec.datum = parseDateDE(dt[1]);
    } else {
      rec.lief='Unbekannt'; rec.ges='Franchise';
      const am = t.match(/([\d.]+,\d{2})\s*(?:EUR|€)/); if(am) rec.betrag = parseAmountDE(am[1]);
      const dt = t.match(/([0-3]?\d\.[01]?\d\.20\d\d)/); if(dt) rec.datum = parseDateDE(dt[1]);
      warn.push('Lieferant nicht erkannt — bitte Felder prüfen.');
    }

    // currency conversion
    rec.eur = rec.betrag==null ? null : (rec.waehrung==='CZK' ? +(rec.betrag/CZK).toFixed(2) : rec.waehrung==='HUF' ? +(rec.betrag/HUF).toFixed(2) : rec.betrag);
    rec.monat = rec.datum ? rec.datum.slice(0,7) : '';
    if(!rec.nr) warn.push('Beleg-Nr. nicht gefunden.');
    if(rec.betrag==null) warn.push('Betrag nicht gefunden.');
    if(!rec.datum) warn.push('Datum nicht gefunden.');
    let conf = 'hoch';
    if(warn.length>=2 || rec.lief==='Unbekannt') conf='niedrig';
    else if(warn.length===1) conf='mittel';
    return { rec, confidence:conf, warnings:warn };
  }

  // ---------------------------------------------------------------- dedupe
  function allInvoices(){ return (window.RECHNUNGEN_DATA && window.RECHNUNGEN_DATA.invoices) || []; }
  function normNr(s){ return (''+s).replace(/[\s\/]/g,'').toLowerCase(); }
  function findDuplicate(rec){
    const inv = allInvoices();
    if(rec.nr){ const hit = inv.find(i=>i.nr && normNr(i.nr)===normNr(rec.nr) && i.lief===rec.lief); if(hit) return hit; }
    // amount+date+supplier fallback
    if(rec.eur!=null && rec.datum){ const hit = inv.find(i=>i.lief===rec.lief && i.datum===rec.datum && Math.abs((i.eur||0)-rec.eur)<0.01); if(hit) return hit; }
    return null;
  }

  // ---------------------------------------------------------------- PDF text
  async function extractText(file){
    if(!window.pdfjsLib) throw new Error('PDF-Bibliothek nicht geladen');
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let out='';
    for(let p=1;p<=pdf.numPages;p++){ const page=await pdf.getPage(p); const tc=await page.getTextContent(); out += tc.items.map(i=>i.str).join(' ')+'\n'; }
    return out;
  }

  // ---------------------------------------------------------------- commit one accepted record
  async function commitRecord(rec, file){
    // safe filename
    const safe = (rec.lief+'_'+(rec.nr||Date.now())).replace(/[^a-zA-Z0-9._-]/g,'_')+'.pdf';
    if(ghReady()){
      try{
        const path = await ghPutPdf(safe, file);
        rec.pdf = path;
      }catch(e){ rec.pdf=''; rec._pdfErr = e.message; }
    } else {
      rec.pdf=''; // local mode: no durable PDF store; link omitted
    }
    const arr = getLocal(); arr.push(rec); setLocal(arr);
    mergeStored();
    if(ghReady()){ await ghPush('Beleg erfasst: '+rec.lief+' '+(rec.nr||'')); }
    return rec;
  }

  // ================================================================ TESLA SESSIONS (CSV)
  const SESS_KEY = 'lc_sessions_v1';
  function getSess(){ try{ return JSON.parse(localStorage.getItem(SESS_KEY)) || []; }catch(e){ return []; } }
  function setSess(a){ localStorage.setItem(SESS_KEY, JSON.stringify(a)); }

  // VIN -> {kfz, fahrer, ges, src} aus den bereits vorhandenen Sessions ableiten
  function vinMeta(){
    const map={}; const base=(window.SESSIONS_DATA && window.SESSIONS_DATA.s) || [];
    for(const s of base){ if(s.v && !map[s.v]) map[s.v]={k:s.k,f:s.f,g:s.g,src:s.src}; }
    return map;
  }
  // robuster CSV-Parser (mit Anführungszeichen)
  function parseCsvRows(text){
    const rows=[]; let field='', row=[], inQ=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(inQ){ if(ch==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; } else field+=ch; }
      else if(ch==='"') inQ=true;
      else if(ch===','){ row.push(field); field=''; }
      else if(ch==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else if(ch!=='\r') field+=ch;
    }
    if(field.length||row.length){ row.push(field); rows.push(row); }
    return rows;
  }
  function teslaCsvToSessions(text){
    const rows=parseCsvRows(text).filter(r=>r.length>5);
    if(!rows.length) return { sessions:[], error:'Datei leer' };
    const head=rows[0].map(h=>h.trim());
    const idx=n=>head.findIndex(h=>h.toLowerCase()===n.toLowerCase());
    const iVin=idx('Vin'), iStart=idx('ChargeStartDateTime'), iStop=idx('ChargeStopDateTime'),
          iCountry=idx('Country'), iSite=idx('SiteLocationName'), iQty=idx('QuantityBase'),
          iUnit=idx('UnitCostBase'), iTot=idx('Total Inc. VAT');
    if(iVin<0 || iStart<0 || iTot<0) return { sessions:[], error:'Kein Tesla-Ladereport (Spalten Vin/Start/Total fehlen)' };
    const vm=vinMeta(), out=[];
    for(let r=1;r<rows.length;r++){
      const c=rows[r]; if(c.length < head.length-3) continue;
      const vin=(c[iVin]||'').trim(), start=(c[iStart]||'').trim();
      if(!vin || !start) continue;
      const stop=(c[iStop]||'').trim();
      const kw=parseFloat((c[iQty]||'').replace(/[^0-9.]/g,'')) || 0;
      const eu=parseFloat((c[iTot]||'').replace(/[^0-9.,-]/g,'').replace(',','.')) || 0;
      const unit=(c[iUnit]||'').toLowerCase();
      const kd = /\/\s*min|\/\s*h\b|minute|stunde/.test(unit) ? 'zeit' : 'kwh';
      const meta=vm[vin] || { k:vin, f:'(?)', g:'', src:'Tesla' };
      const d=new Date(start), stp=stop?new Date(stop):null;
      const dm = (stp && isFinite(stp) && isFinite(d)) ? Math.max(0, Math.round((stp-d)/60000)) : 0;
      out.push({
        i: vin+'_'+start, m: start.slice(0,7), src: meta.src||'Tesla', v:vin, k:meta.k, f:meta.f, g:meta.g,
        c:(c[iCountry]||'').trim(), st:(c[iSite]||'').trim().replace(/^"|"$/g,''), s:start, e:stop,
        kw:+kw.toFixed(4), eu:+eu.toFixed(2), im:0, dm, kd,
        h: isFinite(d)?d.getHours():0, wd: isFinite(d)?d.getDay():0
      });
    }
    return { sessions:out };
  }
  async function ghPushSessions(){
    const payload={ schema:'lc-sessions-1', updated:new Date().toISOString(), added:getSess() };
    const sha=(await ghGetFile('data/sessions.json').catch(()=>null)||{}).sha;
    await ghPutFile('data/sessions.json', b64encode(JSON.stringify(payload)), 'Tesla-Sessions aktualisiert', sha);
  }
  async function ghPullSessions(){
    const f=await ghGetFile('data/sessions.json').catch(()=>null);
    if(f){ try{ const j=JSON.parse(f.content); if(Array.isArray(j.added)) setSess(j.added); }catch(e){} }
  }
  async function ingestSessions(file){
    const text=await file.text();
    const { sessions, error }=teslaCsvToSessions(text);
    if(error) throw new Error(error);
    if(!sessions.length) throw new Error('Keine Lade-Sessions gefunden');
    const existing=new Set(((window.SESSIONS_DATA && window.SESSIONS_DATA.s)||[]).map(s=>s.i));
    const stored=getSess(); const ids=new Set(stored.map(s=>s.i));
    let added=0, eur=0;
    for(const s of sessions){ if(!existing.has(s.i) && !ids.has(s.i)){ stored.push(s); ids.add(s.i); added++; eur+=s.eu; } }
    setSess(stored);
    if(ghReady()) await ghPushSessions();
    return { found:sessions.length, added, eur:+eur.toFixed(2) };
  }

  // ================================================================ UI
  const $ = (h)=>{ const d=document.createElement('div'); d.innerHTML=h.trim(); return d.firstChild; };
  function toast(msg){
    let t=document.querySelector('.toast'); if(!t){ t=$('<div class="toast"></div>'); document.body.appendChild(t); }
    t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600);
  }
  const GES_OPTS = ['Franchise','LCCC','Fleet','ASS'];
  const LIEF_OPTS = ['Wien Energie','DKV','Tesla','Unbekannt'];

  let _host=null;
  function renderUpload(host){
    _host = host;
    const c = getCfg();
    const added = getLocal();
    const connected = ghReady();
    const pdfCount = [...new Set(allInvoices().map(i=>i.pdf).filter(p=>p && p.indexOf('uploads/')===0))].length;
    host.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:14px;margin:0 0 4px;">
        <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0;flex:1;">Hochladen</h1>
        <button id="up-gear" class="btn-mini">⚙ Einstellungen</button>
      </div>
      <p style="margin:0 0 14px;color:var(--ink-3);font-size:14px;max-width:880px;">
        Rechnung (PDF) oder Tesla-Ladereport (CSV) hier ablegen — alles wird automatisch erkannt, geprüft und dauerhaft gesichert.
      </p>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px;font-size:12.5px;color:var(--ink-3);">
        <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${connected?'var(--good)':'var(--warn)'};"></span>${connected?'Dauerspeicher verbunden':'nur lokal — nicht dauerhaft'}</span>
        <span style="color:var(--ink-4);">·</span>
        <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${aiAvailable()?'var(--good)':'var(--ink-4)'};"></span>${aiAvailable()?'KI-Erfassung aktiv':'KI aus'}</span>
      </div>

      <!-- Dropzone -->
      <div class="up-zone" id="up-zone">
        <div class="ic">⬆</div>
        <h2>Datei hochladen</h2>
        <p>PDF (Rechnung) oder Tesla-CSV (Ladereport) hierher ziehen oder klicken — mehrere gleichzeitig möglich</p>
        <label class="up-pick">Datei auswählen<input type="file" id="up-input" accept="application/pdf,.csv,text/csv" multiple hidden></label>
        <div class="sup">Rechnungen: Wien Energie · DKV · Tesla — Sessions: Tesla-Ladereport (CSV)</div>
      </div>

      <div id="up-results" style="margin-top:16px;"></div>

      <!-- Einstellungen (eingeklappt) -->
      <div id="up-settings" style="display:none;margin-top:18px;">

      <!-- Verbindung -->
      <div class="card" style="border-top:3px solid ${connected?'var(--good)':'var(--warn)'};margin-bottom:14px;">
        <div class="card-h"><h3>Dauerspeicher</h3>
          <span class="h-sub" id="gh-status">${connected?'GitHub verbunden':'Nur lokal (nicht dauerhaft)'}</span>
          <span class="h-meta" id="gh-meta" style="margin-left:auto;">${connected?(c.owner+'/'+c.repo+' · '+(c.branch||'main')):'kein Repo'}</span>
        </div>
        ${connected ? '' : `<div class="alert-box" style="margin-bottom:14px;"><div class="icon">!</div><div class="body"><h4>Noch nicht dauerhaft gesichert</h4><p>Ohne GitHub-Verbindung liegen neue Uploads nur in diesem Browser und können verloren gehen. Unten verbinden — dann landet jeder Upload dauerhaft &amp; gerätübergreifend im Repo.</p></div></div>`}
        <div style="display:grid;grid-template-columns:1fr 1fr 0.6fr;gap:10px;margin-bottom:10px;">
          <div class="up-f"><label>GitHub Owner</label><input id="gh-owner" value="${c.owner||'chorvatkatai-sudo'}"></div>
          <div class="up-f"><label>Repository</label><input id="gh-repo" value="${c.repo||'Lucky-car-ladekosten'}"></div>
          <div class="up-f"><label>Branch</label><input id="gh-branch" value="${c.branch||'main'}"></div>
        </div>
        <div class="up-f" style="margin-bottom:12px;"><label>Fine-grained Token (contents: read &amp; write, nur dieses Repo)</label><input id="gh-token" type="password" placeholder="${c.token?'•••••••• gespeichert':'github_pat_...'}" value=""></div>
        <div class="up-act" style="margin-top:0;">
          <button class="up-btn go" id="gh-save">Verbinden &amp; speichern</button>
          <button class="up-btn skip" id="gh-test">Verbindung testen</button>
          ${connected?'<button class="up-btn skip" id="gh-pull">Vom Repo laden</button><button class="up-btn skip" id="gh-disc">Trennen</button>':''}
          <span class="up-note" id="gh-test-out"></span>
        </div>
        ${connected?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--rule);">
          <button class="up-btn go" id="gh-migrate">Bestehende ${pdfCount} Belege ins Repo übertragen</button>
          <span class="up-note" id="gh-migrate-out" style="margin-left:8px;">Lädt alle vorhandenen PDFs + Register einmalig ins Repo.</span>
        </div>`:''}
      </div>

      <!-- KI Auto-Erfassung -->
      <div class="card" style="border-top:3px solid ${aiAvailable()?'var(--good)':'var(--rule)'};margin-bottom:14px;">
        <div class="card-h"><h3>Automatische Erfassung (KI)</h3>
          <span class="h-sub">${aiAvailable()?'aktiv':'optional'}</span>
          <span class="h-meta" style="margin-left:auto;">${aiKey()?'eigener API-Schlüssel ✓':((window.claude&&window.claude.complete)?'Umgebungs-KI':'aus')}</span>
        </div>
        <p style="margin:-4px 0 12px;font-size:13px;color:var(--ink-3);">Sichere Belege werden ohne Klick übernommen &amp; ins Repo gespeichert. Unsichere oder unbekannte Formate liest die KI automatisch aus. Für dauerhaften Betrieb eigenen Anthropic-API-Schlüssel eintragen (bleibt nur in deinem Browser).</p>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="up-f"><label>Anthropic API-Schlüssel (optional)</label><input id="ai-key" type="password" placeholder="${aiKey()?'•••••••• gespeichert':'sk-ant-...'}" value=""></div>
          <div class="up-f"><label>Modell</label><input id="ai-model" value="${aiModel()}"></div>
        </div>
        <div class="up-act" style="margin-top:0;">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="ai-auto" ${getCfg().autoCommit!==false?'checked':''} style="width:16px;height:16px;accent-color:var(--yellow);"> Sichere Belege automatisch übernehmen</label>
          <button class="up-btn go" id="ai-save">KI speichern</button>
          ${aiKey()?'<button class="up-btn skip" id="ai-clear">Schlüssel entfernen</button>':''}
          <span class="up-note" id="ai-out"></span>
        </div>
      </div>

      <!-- Backup + Bestand -->
      <div class="grid-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h"><h3>Erfasster Bestand</h3><span class="h-sub">im Register</span></div>
          <div style="display:flex;gap:24px;">
            <div class="stat-line"><span class="big">${allInvoices().length}</span><span class="sml">Rechnungen gesamt</span></div>
            <div class="stat-line"><span class="big">${added.length}</span><span class="sml">selbst hochgeladen</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h3>Sicherheitskopie</h3><span class="h-sub">Backstop</span></div>
          <div class="up-act" style="margin-top:0;">
            <button class="up-btn go" id="bk-exp">Alles als JSON exportieren</button>
            <label class="up-btn skip" style="cursor:pointer;">JSON importieren<input id="bk-imp" type="file" accept="application/json" hidden></label>
          </div>
          <p class="up-note" style="margin-top:10px;">Lädt/sichert alle selbst hochgeladenen Rechnungen als Datei.</p>
        </div>
      </div>
      </div>
    `;
    wire(host);
  }

  function wire(host){
    const $$ = id => host.querySelector('#'+id);
    const _gear=$$('up-gear'), _settings=$$('up-settings');
    if(_gear) _gear.onclick=()=>{ _settings.style.display = (_settings.style.display==='none'?'block':'none'); };
    // connection
    $$('gh-save').onclick = ()=>{
      const old=getCfg();
      const cfg = { ...old, owner:$$('gh-owner').value.trim(), repo:$$('gh-repo').value.trim(), branch:($$('gh-branch').value.trim()||'main') };
      const tk = $$('gh-token').value.trim();
      cfg.token = tk || old.token || '';
      if(!cfg.owner||!cfg.repo||!cfg.token){ toast('Owner, Repo und Token nötig'); return; }
      setCfg(cfg); toast('Verbindung gespeichert'); renderUpload(host);
    };
    $$('gh-test').onclick = async ()=>{
      const old=getCfg();
      const cfg = { ...old, owner:$$('gh-owner').value.trim(), repo:$$('gh-repo').value.trim(), branch:($$('gh-branch').value.trim()||'main'), token:($$('gh-token').value.trim()||old.token) };
      setCfg(cfg);
      const out=$$('gh-test-out'); out.innerHTML='<span class="spinner"></span> teste…';
      try{ const r=await ghTest(); out.innerHTML = `<b style="color:var(--good);">OK</b> · Repo ${r.private?'privat ✓':'<b style="color:var(--warn);">öffentlich — bitte auf privat stellen!</b>'} · ${r.perm}`; }
      catch(e){ out.innerHTML = '<b style="color:var(--warn);">Fehler:</b> '+e.message; }
    };
    if($$('gh-pull')) $$('gh-pull').onclick = async ()=>{
      const out=$$('gh-test-out'); out.innerHTML='<span class="spinner"></span> lade…';
      try{ await ghPull(); out.innerHTML='<b style="color:var(--good);">Geladen</b>'; toast('Vom Repo geladen'); refreshBadges(); renderUpload(host); }
      catch(e){ out.innerHTML='<b style="color:var(--warn);">Fehler:</b> '+e.message; }
    };
    if($$('gh-disc')) $$('gh-disc').onclick = ()=>{ const c=getCfg(); delete c.token; setCfg(c); toast('Token entfernt'); renderUpload(host); };
    if($$('ai-save')) $$('ai-save').onclick = ()=>{
      const c=getCfg(); const k=$$('ai-key').value.trim();
      if(k) c.aiKey=k; c.aiModel=($$('ai-model').value.trim()||'claude-sonnet-4-5'); c.autoCommit=$$('ai-auto').checked;
      setCfg(c); toast('KI-Einstellungen gespeichert'); renderUpload(host);
    };
    if($$('ai-auto')) $$('ai-auto').onchange = ()=>{ const c=getCfg(); c.autoCommit=$$('ai-auto').checked; setCfg(c); };
    if($$('ai-clear')) $$('ai-clear').onclick = ()=>{ const c=getCfg(); delete c.aiKey; setCfg(c); toast('KI-Schlüssel entfernt'); renderUpload(host); };
    if($$('gh-migrate')) $$('gh-migrate').onclick = async ()=>{
      const out=$$('gh-migrate-out'), btn=$$('gh-migrate'); btn.disabled=true;
      out.innerHTML='<span class="spinner"></span> übertrage…';
      try{
        const r=await migrateExisting((k,n,p)=>{ out.innerHTML='<span class="spinner"></span> '+k+'/'+n+' · '+p.split('/').pop(); });
        out.innerHTML='<b style="color:var(--good);">'+r.ok+'/'+r.total+' übertragen ✓</b>'+(r.fail.length?' · <span style="color:#ff8a7e;">'+r.fail.length+' fehlgeschlagen</span>':'');
        toast('Bestand übertragen: '+r.ok+'/'+r.total);
      }catch(e){ out.innerHTML='<b style="color:var(--warn);">Fehler:</b> '+e.message; }
      btn.disabled=false;
    };
    // dropzone
    const zone=$$('up-zone'), input=$$('up-input');
    zone.onclick = (e)=>{ if(e.target.tagName!=='INPUT' && !e.target.closest('label')) input.click(); };
    input.onchange = ()=> routeFiles([...input.files]);
    ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag');}));
    ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag');}));
    zone.addEventListener('drop', e=> routeFiles([...e.dataTransfer.files]));
    // backup
    $$('bk-exp').onclick = ()=>{
      const blob=new Blob([JSON.stringify({schema:'lc-rechnungen-1',updated:new Date().toISOString(),added:getLocal()},null,1)],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='lucky-car-rechnungen-backup.json'; a.click();
    };
    $$('bk-imp').onchange = async (e)=>{
      const f=e.target.files[0]; if(!f) return;
      try{ const j=JSON.parse(await f.text()); if(Array.isArray(j.added)){ const cur=getLocal(); const seen=new Set(cur.map(x=>normNr(x.nr)+x.lief)); j.added.forEach(x=>{ if(!seen.has(normNr(x.nr)+x.lief)) cur.push(x); }); setLocal(cur); mergeStored(); if(ghReady()) await ghPush('Import Backup'); toast('Importiert: '+j.added.length); refreshBadges(); renderUpload(host); } }
      catch(err){ toast('Import fehlgeschlagen'); }
    };
  }

  const resultState = []; // {id, file, parsed, status}
  async function handleFiles(files){
    if(!files.length) return;
    const box = _host.querySelector('#up-results');
    const auto = getCfg().autoCommit!==false;
    for(const file of files){
      const id = 'r'+Math.random().toString(36).slice(2,8);
      const card = $(`<div class="up-card work" id="${id}"><div class="uh"><span class="spinner"></span><span class="fn">${file.name}</span><span class="ust work">Analysiere…</span></div></div>`);
      box.prepend(card);
      try{
        const text = await extractText(file);
        let parsed = parseInvoice(text, file.name);
        if(parsed.confidence!=='hoch' && aiAvailable()){
          const ust=card.querySelector('.ust'); if(ust) ust.textContent='KI liest…';
          try{ const ai = await aiExtract(text, file.name); if(ai) parsed = mergeAI(parsed, ai); }catch(e){ /* KI optional — deterministisch weiter */ }
        }
        const dup = findDuplicate(parsed.rec);
        if(auto && !dup && parsed.confidence==='hoch'){
          await commitRecord({ ...parsed.rec }, file);
          renderAutoCard(card, parsed.rec, parsed.aiUsed);
          refreshBadges(); if(window.LCApp && window.LCApp.refreshRechnungen) window.LCApp.refreshRechnungen();
          toast('Automatisch erfasst: '+parsed.rec.lief);
        } else {
          renderResultCard(card, { id, file, rec:parsed.rec, confidence:parsed.confidence, warnings:parsed.warnings, dup, aiUsed:parsed.aiUsed });
        }
      }catch(e){
        card.className='up-card dup';
        card.innerHTML=`<div class="uh"><span class="fn">${file.name}</span><span class="ust dup">Fehler</span></div><p class="up-note">${e.message}</p>`;
      }
    }
  }

  async function handleCsvFiles(files){
    const box=_host.querySelector('#up-results');
    let totalAdded=0;
    for(const file of files){
      const id='c'+Math.random().toString(36).slice(2,8);
      const card=$(`<div class="up-card work" id="${id}"><div class="uh"><span class="spinner"></span><span class="fn">${file.name}</span><span class="ust work">Tesla-CSV…</span></div></div>`);
      box.prepend(card);
      try{
        const r=await ingestSessions(file);
        totalAdded+=r.added;
        card.className='up-card ok';
        card.innerHTML=`<div class="uh"><span class="fn">${file.name}</span><span class="ust ok">${r.added?'Erfasst ✓':'Keine neuen'}</span></div>
          <div class="up-note"><b>${r.added}</b> neue Sessions (von ${r.found}) · <b>${eu(r.eur)}</b> Ladekosten${ghReady()?' · im Repo gesichert':''}${r.added?' · Dashboard wird aktualisiert…':''}</div>`;
      }catch(e){
        card.className='up-card dup';
        card.innerHTML=`<div class="uh"><span class="fn">${file.name}</span><span class="ust dup">Fehler</span></div><p class="up-note">${e.message}</p>`;
      }
    }
    if(totalAdded>0){ toast(totalAdded+' Sessions erfasst — lädt neu…'); setTimeout(()=>location.reload(), 1700); }
  }
  function routeFiles(files){
    const pdfs=files.filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
    const csvs=files.filter(f=>/\.csv$/i.test(f.name)||f.type==='text/csv');
    if(pdfs.length) handleFiles(pdfs);
    if(csvs.length) handleCsvFiles(csvs);
    if(!pdfs.length && !csvs.length) toast('Nur PDF (Rechnungen) oder CSV (Tesla-Sessions)');
  }

  function renderAutoCard(card, rec, aiUsed){
    card.className='up-card ok';
    card.innerHTML = `<div class="uh"><span class="fn">${rec.lief} · ${rec.nr||''}</span><span class="ust ok">${ghReady()?'Gespeichert ✓':'Erfasst ✓'}</span></div>
      <div class="up-note">Automatisch erfasst${aiUsed?' <span class="badge auto" style="margin:0 2px;">KI</span>':''}: <b>${rec.ges}</b> · <b>${eu(rec.eur||0)}</b> · ${rec.datum||'—'}${ghReady()?' · im Repo gesichert':''}</div>`;
  }

  function renderResultCard(card, st){
    const { rec, confidence, warnings, dup } = st;
    const statusClass = dup ? 'dup' : (confidence==='niedrig' ? 'work' : 'ok');
    const statusText  = dup ? 'Doppelanlage' : (confidence==='hoch' ? 'Erkannt' : 'Bitte prüfen');
    card.className = 'up-card '+statusClass;
    card.innerHTML = `
      <div class="uh">
        <span class="fn">${st.file.name}</span>
        <span class="ust ${statusClass}">${statusText}</span>
      </div>
      ${dup ? `<div class="up-note" style="margin-bottom:10px;color:#ff8a7e;">⚠ Bereits im Register: <b>${dup.lief} ${dup.nr||''}</b> · ${eu(dup.eur||0)} (${dup.datum||'—'}). Nicht erneut anlegen.</div>` : ''}
      ${warnings.length && !dup ? `<div class="up-note" style="margin-bottom:10px;">${warnings.join(' · ')}</div>` : ''}
      <div class="up-fields">
        <div class="up-f"><label>Lieferant</label><select data-f="lief">${LIEF_OPTS.map(o=>`<option ${o===rec.lief?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="up-f"><label>Gesellschaft</label><select data-f="ges">${GES_OPTS.map(o=>`<option ${o===rec.ges?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="up-f"><label>Beleg-Nr.</label><input data-f="nr" value="${rec.nr||''}"></div>
        <div class="up-f"><label>Datum</label><input data-f="datum" value="${rec.datum||''}" placeholder="JJJJ-MM-TT"></div>
        <div class="up-f"><label>Betrag</label><input data-f="betrag" value="${rec.betrag!=null?rec.betrag:''}"></div>
        <div class="up-f"><label>Währung</label><select data-f="waehrung">${['EUR','CZK','HUF'].map(o=>`<option ${o===rec.waehrung?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="up-f"><label>Konto</label><input data-f="konto" value="${rec.konto||''}"></div>
        <div class="up-f"><label>Typ</label><input data-f="typ" value="${rec.typ||''}"></div>
      </div>
      <div class="up-act">
        <button class="up-btn go">${dup?'Trotzdem übernehmen':'Übernehmen'}</button>
        <button class="up-btn skip">Verwerfen</button>
        <span class="up-note"></span>
      </div>`;
    const note = card.querySelector('.up-act .up-note');
    card.querySelector('.up-btn.skip').onclick = ()=> card.remove();
    card.querySelector('.up-btn.go').onclick = async ()=>{
      const r = { ...rec, neu:true, auto:true };
      card.querySelectorAll('[data-f]').forEach(el=>{ r[el.dataset.f] = el.value; });
      r.betrag = parseFloat((''+r.betrag).replace(',','.')); if(!isFinite(r.betrag)) r.betrag=0;
      r.eur = r.waehrung==='CZK'? +(r.betrag/CZK).toFixed(2) : r.waehrung==='HUF'? +(r.betrag/HUF).toFixed(2) : r.betrag;
      r.monat = (r.datum||'').slice(0,7);
      note.innerHTML='<span class="spinner"></span> speichere…';
      try{
        await commitRecord(r, st.file);
        card.className='up-card ok';
        note.innerHTML = ghReady() ? '<b style="color:var(--good);">Gespeichert im Repo ✓</b>' : '<b style="color:var(--good);">Übernommen (lokal)</b>';
        card.querySelector('.up-btn.go').disabled=true; card.querySelector('.up-btn.go').textContent='Übernommen';
        refreshBadges();
        // refresh Rechnungen tab if already rendered
        if(window.LCApp && window.LCApp.refreshRechnungen) window.LCApp.refreshRechnungen();
        toast('Rechnung übernommen');
      }catch(e){ note.innerHTML='<b style="color:var(--warn);">Fehler:</b> '+e.message; }
    };
  }

  function refreshBadges(){
    const b=document.getElementById('badge-rechnungen');
    if(b && window.RECHNUNGEN_DATA){ const dn=(window.RECHNUNGEN_DATA.duplicates||[]).length; b.textContent = window.RECHNUNGEN_DATA.cleaned?'OK':(dn?dn+' Dup':'OK'); }
  }

  // On load: hydrate from local cache immediately, then (if connected) pull from repo
  // Token-loser Lese-Pfad: lädt die Daten direkt aus dem (öffentlichen) Repo,
  // wenn die Seite über GitHub Pages / einen Webhost ausgeliefert wird.
  async function loadPublicData(){
    let got=false;
    try{ const r=await fetch('data/rechnungen.json',{cache:'no-store'}); if(r.ok){ const j=await r.json(); if(Array.isArray(j.added)){ setLocal(j.added); mergeStored(); got=true; } } }catch(e){}
    try{ const r=await fetch('data/sessions.json',{cache:'no-store'}); if(r.ok){ const j=await r.json(); if(Array.isArray(j.added)){ setSess(j.added); got=true; } } }catch(e){}
    return got;
  }
  function applyAfterSync(){
    const cur=new Set(((window.SESSIONS_DATA&&window.SESSIONS_DATA.s)||[]).map(s=>s.i));
    const needReload = getSess().some(s=>!cur.has(s.i));
    if(needReload && !sessionStorage.getItem('lc_sess_reload')){ sessionStorage.setItem('lc_sess_reload','1'); location.reload(); return; }
    refreshBadges(); if(window.LCApp&&window.LCApp.refreshRechnungen) window.LCApp.refreshRechnungen();
  }

  mergeStored();
  if(ghReady()){
    Promise.allSettled([ghPull(), ghPullSessions()]).then(applyAfterSync);
  } else {
    // Betrachter ohne Token (öffentliches Pages-Hosting): Daten direkt lesen
    loadPublicData().then(applyAfterSync);
  }

  window.LCUpload = { mergeStored, renderUpload, parseInvoice, ghReady };
  window.LCApp = window.LCApp || {};
  window.LCApp.renderUpload = renderUpload;
})();
