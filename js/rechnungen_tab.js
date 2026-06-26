// Lucky Car Ladestatistik · Rechnungen & Belege — Lieferanten-Rechnungsregister je Gesellschaft
(function(){
  const D = window.LCData;
  const { eu, num } = D;
  const R = window.RECHNUNGEN_DATA || { invoices:[], duplicates:[], czkRate:24.7 };
  const INV = R.invoices, DUP = R.duplicates;

  const GES = ['Franchise','LCCC','Fleet','ASS'];
  const GES_COLOR = { LCCC:'#FFE500', Fleet:'#c0392b', Franchise:'#1e5a9e', ASS:'#1f7a3c' };
  const GES_FULL = {
    Franchise:'Lucky Car Franchise &amp; Beteiligung GmbH',
    LCCC:'LC Competence Center GmbH &amp; Co. KG',
    Fleet:'Lucky Car Fleet',
    ASS:'ASS (Assistance)'
  };
  const LIEF_BADGE = { 'Wien Energie':'ges-ass', 'DKV':'ges-franchise', 'Tesla':'ges-fleet' };
  const M_LABEL = {
    '2026-01':'Jan 26','2026-02':'Feb 26','2026-03':'Mär 26',
    '2026-04':'Apr 26','2026-05':'Mai 26','2026-06':'Jun 26'
  };
  const fmtD = d => d ? d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4) : '—';
  const money = i => i.waehrung==='CZK'
    ? `${num(i.betrag,2)} CZK <span class="muted" style="font-weight:400;">≈ ${eu(i.eur)}</span>`
    : eu(i.betrag);

  function pdfLink(pdf, label){
    if(!pdf) return '<span class="muted">—</span>';
    return `<a href="${pdf.replace(/"/g,'%22')}" target="_blank" rel="noopener" style="color:var(--info);font-weight:700;text-decoration:none;">${label||'PDF'} ↗</a>`;
  }

  function renderRechnungen(host){
    const totalEur = INV.reduce((a,i)=>a+i.eur,0);
    const neu = INV.filter(i=>i.neu);
    const lieferanten = [...new Set(INV.map(i=>i.lief))];
    const gesWithInv = GES.filter(g=>INV.some(i=>i.ges===g));
    const dupFiles = DUP.reduce((a,d)=>a+(d.removed?d.removed.length:0),0);

    // ---- Lieferant × Gesellschaft matrix ----
    const cells = {}; lieferanten.forEach(l=>{ cells[l]={}; GES.forEach(g=>cells[l][g]=0); });
    INV.forEach(i=>{ cells[i.lief][i.ges]+=i.eur; });

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Rechnungen &amp; Belege</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;max-width:880px;">
        Lieferanten-Rechnungsregister — jede Strom- und Ladekarten-Rechnung der Anbieter <b>Wien&nbsp;Energie</b>, <b>DKV</b> und <b>Tesla</b>
        systematisch der verrechnenden <b>Gesellschaft</b> zugeordnet. Doppelt abgelegte Belege wurden erkannt und automatisch <b>bereinigt</b>.
      </p>

      <div class="kpis">
        <div class="kpi"><div class="label">Rechnungen erfasst</div><div class="val">${INV.length}</div><div class="extra">${lieferanten.length} Lieferanten · ${gesWithInv.length} Gesellschaften</div></div>
        <div class="kpi hi"><div class="label">Gesamtbetrag (brutto)</div><div class="val" style="font-size:26px;">${eu(totalEur)}</div><div class="extra">CZK @ ${num(R.czkRate,2)}</div></div>
        <div class="kpi good"><div class="label">Neu zugeordnet</div><div class="val">${neu.length}</div><div class="extra">in diesem Lauf</div></div>
        <div class="kpi good"><div class="label">Doppelanlagen</div><div class="val">${dupFiles} ✓</div><div class="extra">bereinigt · 0 offen</div></div>
        <div class="kpi"><div class="label">Wien Energie</div><div class="val" style="font-size:22px;">${eu(cells['Wien Energie']?Object.values(cells['Wien Energie']).reduce((a,b)=>a+b,0):0)}</div><div class="extra">${INV.filter(i=>i.lief==='Wien Energie').length} Strom-Rechn.</div></div>
        <div class="kpi"><div class="label">DKV</div><div class="val" style="font-size:22px;">${eu(cells['DKV']?Object.values(cells['DKV']).reduce((a,b)=>a+b,0):0)}</div><div class="extra">${INV.filter(i=>i.lief==='DKV').length} Sammelrechn.</div></div>
      </div>
    `;

    // ============ DOPPELANLAGEN (bereinigt) ============
    html += `
      <div class="card success" style="margin-bottom:18px;">
        <div class="card-h"><h3>Doppelanlagen-Prüfung</h3>
          <span class="h-sub">${DUP.length} Gruppen erkannt · ${dupFiles} überzählige Dateien entfernt · 0 offen</span>
        </div>
        ${DUP.length ? `
        <p style="margin:-4px 0 12px;font-size:13px;color:var(--ink-2);">
          Mehrfach abgelegte Belege wurden automatisch bereinigt — je Gruppe verbleibt <b>genau eine</b> Datei (grün). Die überzähligen Kopien wurden gelöscht.
        </p>
        <table class="dt">
          <thead><tr>
            <th>Art</th><th>Gesellschaft</th><th>Lieferant</th><th>Beleg-Nr.</th>
            <th class="num">Betrag</th><th>Behalten</th><th>Entfernt</th>
          </tr></thead>
          <tbody>
          ${DUP.map(d=>{
            const artBadge = d.art==='kopie' ? '<span class="badge kind-zeit">Kopie</span>'
              : '<span class="badge kind-zeit">Hash-Dup</span>';
            const ges = `<span class="badge ges-${d.ges.toLowerCase()}">${d.ges}</span>`;
            const betr = d.betrag!=null ? (d.waehrung==='CZK'?num(d.betrag,2)+' CZK':eu(d.betrag)) : '<span class="muted">—</span>';
            const kept = `<div class="mono" style="font-size:11px;color:var(--good);font-weight:600;">✓ ${d.kept.split('/').pop()}</div>`;
            const removed = d.removed.map(f=>`<div class="mono" style="font-size:11px;color:var(--ink-4);text-decoration:line-through;">${f.split('/').pop()}</div>`).join('');
            return `<tr>
              <td>${artBadge}</td>
              <td>${ges}</td>
              <td>${d.lief}</td>
              <td class="mono" style="font-size:12px;">${d.nr}</td>
              <td class="num"><b>${betr}</b></td>
              <td>${kept}</td>
              <td>${removed}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
        ` : '<div class="empty">Keine Doppelanlagen erkannt — jeder Beleg ist genau einmal vorhanden.</div>'}
      </div>
    `;

    // ============ LIEFERANT × GESELLSCHAFT MATRIX ============
    html += `
      <div class="card accent" style="margin-bottom:18px;">
        <div class="card-h"><h3>Zuordnungs-Matrix</h3><span class="h-sub">Brutto-Summe je Lieferant &amp; Gesellschaft</span></div>
        <table class="dt">
          <thead><tr><th>Lieferant</th>${GES.map(g=>`<th class="num">${g}</th>`).join('')}<th class="num">Gesamt</th></tr></thead>
          <tbody>
          ${lieferanten.map(l=>{
            const row = GES.map(g=>cells[l][g]);
            const tot = row.reduce((a,b)=>a+b,0);
            return `<tr><td><b>${l}</b></td>${row.map(v=>`<td class="num">${v?eu(v):'<span class="muted">—</span>'}</td>`).join('')}<td class="num"><b>${eu(tot)}</b></td></tr>`;
          }).join('')}
          <tr style="border-top:2px solid var(--ink);">
            <td><b>Gesamt</b></td>
            ${GES.map(g=>{const v=lieferanten.reduce((a,l)=>a+cells[l][g],0);return `<td class="num"><b>${v?eu(v):'<span class="muted">—</span>'}</b></td>`;}).join('')}
            <td class="num"><b>${eu(totalEur)}</b></td>
          </tr>
          </tbody>
        </table>
      </div>
    `;

    // ============ PER GESELLSCHAFT ============
    for(const g of gesWithInv){
      const rows = INV.filter(i=>i.ges===g).sort((a,b)=> (a.lief.localeCompare(b.lief)) || (a.datum||'zzz').localeCompare(b.datum||'zzz') || a.nr.localeCompare(b.nr));
      const tot = rows.reduce((a,i)=>a+i.eur,0);
      const neuN = rows.filter(i=>i.neu).length;
      html += `
        <div class="card" style="border-left:6px solid ${GES_COLOR[g]};margin-bottom:16px;">
          <div class="card-h">
            <h3>${g}</h3>
            <span class="h-sub">${GES_FULL[g]}</span>
            <span class="h-meta" style="margin-left:auto;">${rows.length} Rechnungen${neuN?` · <b style="color:var(--ink);background:var(--yellow);padding:1px 6px;">${neuN} neu</b>`:''} · <b style="color:var(--ink);">${eu(tot)}</b></span>
          </div>
          <table class="dt">
            <thead><tr>
              <th>Datum</th><th>Lieferant</th><th>Typ</th><th>Beleg-Nr.</th>
              <th>Konto / Vertrag</th><th>Monat</th><th class="num">Betrag</th><th class="center">Beleg</th>
            </tr></thead>
            <tbody>
            ${rows.map(i=>`<tr>
              <td class="nowrap">${fmtD(i.datum)}</td>
              <td><span class="badge ${LIEF_BADGE[i.lief]||''}">${i.lief}</span>${i.neu?' <span class="badge new">NEU</span>':''}</td>
              <td class="small">${i.typ}</td>
              <td class="mono" style="font-size:12px;">${i.nr}${i.note?`<div class="muted" style="font-size:11px;">${i.note}</div>`:''}</td>
              <td class="mono" style="font-size:11px;color:var(--ink-3);">${i.konto||'—'}${i.vertrag?`<div>${i.vertrag}</div>`:''}</td>
              <td class="small nowrap">${M_LABEL[i.monat]||'<span class="muted">—</span>'}</td>
              <td class="num"><b>${money(i)}</b></td>
              <td class="center">${pdfLink(i.pdf)}</td>
            </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // ASS note
    if(!INV.some(i=>i.ges==='ASS')){
      html += `
        <div class="alert-box info">
          <div class="icon">i</div>
          <div class="body">
            <h4>ASS — keine Rechnungen in diesem Stapel</h4>
            <p>Für die Gesellschaft <b>ASS</b> sind in den Stammdaten Wien-Energie- und Energie-Burgenland-Ladeverträge hinterlegt,
            in diesem Beleg-Stapel liegen jedoch noch keine ASS-Rechnungen vor. Sobald Belege eintreffen, hier ergänzen.</p>
          </div>
        </div>
      `;
    }

    // Reconciliation hint
    html += `
      <div class="alert-box" style="background:var(--yellow-3);border-color:var(--yellow);">
        <div class="icon" style="color:var(--ink);border-color:var(--ink);">!</div>
        <div class="body">
          <h4 style="color:var(--ink);">Zur Zuordnungs-Logik</h4>
          <p>Die Gesellschaft ergibt sich aus dem <b>Rechnungsempfänger</b> auf dem Beleg (Wien Energie &amp; DKV) bzw. dem
          Tesla-Fleet-Konto. Alle 23 Wien-Energie-Servicerechnungen laufen auf die <b>Franchise</b>-Gesellschaft
          (4 Kundenkonten), die DKV-Sammelrechnungen auf <b>LCCC</b> (Konto 4100051519) und <b>Franchise</b> (Konto 4302432612).
          Strom-/Ladekarten-Rechnungen sind die <b>Lieferanten-Seite</b> und damit unabhängig von den Lade-Sessions im Tab „Abrechnung".</p>
        </div>
      </div>
    `;

    host.innerHTML = html;
  }

  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, { renderRechnungen });

  // Re-render the Rechnungen tab in place (after a new upload is committed)
  function refreshRechnungen(){
    const host = document.getElementById('tab-rechnungen');
    if(host && host.innerHTML.trim()) renderRechnungen(host);
  }
  window.LCApp.refreshRechnungen = refreshRechnungen;
})();
