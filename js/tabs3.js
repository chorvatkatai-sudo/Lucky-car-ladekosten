// Lucky Car Ladestatistik · Tabs 3 — Abrechnung, Budget, Prüfung
(function(){
  const D = window.LCData;
  const {
    SESSIONS, IDLE_PENALTIES, MONTHS, MONTH_LABELS, MONTH_SHORT, COUNTRY_NAMES,
    eu, num, pct, sumBy, aggregate, withAvg, svgBars, svgSpark
  } = D;
  const FP = window.FUHRPARK_DATA || { fahrer:{}, filialen:{}, evs:{} };

  const COUNTRY_RX = /,\s*(Austria|Germany|Czech Republic|Slovenia|Italy|Hungary|Croatia)\s*$/;
  const cleanSite = st => (st || '').replace(COUNTRY_RX, '').trim() || '—';
  const fmtDate = iso => iso ? iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(2,4) : '—';
  const fmtTime = iso => iso ? iso.slice(11,16) : '—';

  // — Stammdaten-Anreicherung jeder Session (Kostenstelle = Filiale/Gesellschaft des Fahrers)
  function enrich(s) {
    const drv = FP.fahrer[s.f];
    const filId = drv && drv.fil;
    const fil = filId ? FP.filialen[filId] : null;
    return {
      ges: (drv && drv.ges) || s.g || '—',
      filId: filId || '—',
      filName: fil ? fil.name : 'ohne Stammdaten',
      ort: fil ? fil.ort : '',
      hasMaster: !!drv
    };
  }
  const ENR = new Map(SESSIONS.map(s => [s, enrich(s)]));

  function downloadCSV(filename, headers, rows) {
    const q = v => '"' + String(v==null?'':v).replace(/"/g,'""') + '"';
    const lines = [headers.map(q).join(';'), ...rows.map(r => r.map(q).join(';'))];
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const dec = v => String(v).replace('.', ',');

  // ============================================================================
  // ABRECHNUNG  (Kostenstellen nach Gesellschaft & Filiale)
  // ============================================================================
  function renderAbrechnung(host) {
    const total = withAvg(aggregate(SESSIONS));

    // Gesellschaft × Monat Matrix
    const gesList = [...new Set(SESSIONS.map(s => ENR.get(s).ges))].sort();
    const matrix = {};
    for (const g of gesList) { matrix[g] = {}; for (const m of MONTHS) matrix[g][m] = 0; }
    for (const s of SESSIONS) matrix[ENR.get(s).ges][s.m] += s.eu;
    const gesTotals = gesList.map(g => ({ g, total: sumBy(MONTHS, m => matrix[g][m]) })).sort((a,b)=>b.total-a.total);
    const monthTotals = {}; for (const m of MONTHS) monthTotals[m] = sumBy(gesList, g => matrix[g][m]);

    // Filiale-Aufschlüsselung
    const filMap = {};
    for (const s of SESSIONS) {
      const e = ENR.get(s);
      const key = e.filId + '|' + e.filName + '|' + e.ges;
      (filMap[key] ??= { filName:e.filName, ort:e.ort, ges:e.ges, sessions:[] }).sessions.push(s);
    }
    const filList = Object.values(filMap).map(f => ({
      ...f, ...withAvg(aggregate(f.sessions)),
      monthly: MONTHS.map(m => sumBy(f.sessions.filter(s=>s.m===m), s=>s.eu))
    })).sort((a,b)=>b.eur-a.eur);

    const gesColor = { LCCC:'#FFE500', FLEET:'#c0392b', FRANCHISE:'#1e5a9e', ASS:'#1f7a3c' };

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Abrechnung &amp; Kostenstellen</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">Lade-Kosten je Gesellschaft &amp; Filiale — Grundlage für die interne Weiterverrechnung. Zuordnung über die Stammdaten des Fahrers.</p>

      <div class="kpis" style="grid-template-columns:repeat(${gesTotals.length+1},1fr);">
        <div class="kpi hi"><div class="label">Gesamt</div><div class="val" style="font-size:26px;">${eu(total.eur)}</div><div class="extra">${total.n} Sessions · 6 Monate</div></div>
        ${gesTotals.map(g => `<div class="kpi"><div class="label">${g.g}</div><div class="val" style="font-size:24px;">${eu(g.total)}</div><div class="extra">${pct(g.total/total.eur)} vom Total</div></div>`).join('')}
      </div>

      <div class="card accent">
        <div class="card-h"><h3>Gesellschaft × Monat</h3>
          <span class="h-sub">Kosten-Matrix für die Verrechnung</span>
          <button id="ab-csv1" class="btn-mini" style="margin-left:auto;">Matrix als CSV</button>
        </div>
        <table class="dt">
          <thead><tr><th>Gesellschaft</th>${MONTHS.map(m=>`<th class="num">${MONTH_SHORT[m]}</th>`).join('')}<th class="num">Gesamt</th><th class="num">Anteil</th></tr></thead>
          <tbody>
          ${gesTotals.map(g => `<tr>
            <td><span class="badge ges-${g.g.toLowerCase()}">${g.g}</span></td>
            ${MONTHS.map(m=>`<td class="num">${matrix[g.g][m] ? eu(matrix[g.g][m]) : '<span class="muted">–</span>'}</td>`).join('')}
            <td class="num"><b>${eu(g.total)}</b></td>
            <td class="num">${pct(g.total/total.eur)}</td>
          </tr>`).join('')}
          </tbody>
          <tfoot><tr style="border-top:2px solid var(--ink);font-weight:700;">
            <td><b>Summe</b></td>
            ${MONTHS.map(m=>`<td class="num"><b>${eu(monthTotals[m])}</b></td>`).join('')}
            <td class="num"><b>${eu(total.eur)}</b></td><td class="num">100 %</td>
          </tr></tfoot>
        </table>
      </div>

      <div class="card">
        <div class="card-h"><h3>Aufschlüsselung nach Filiale</h3>
          <span class="h-sub">${filList.length} Kostenstellen</span>
          <button id="ab-csv2" class="btn-mini" style="margin-left:auto;">Filialen als CSV</button>
        </div>
        <table class="dt">
          <thead><tr><th>#</th><th>Filiale</th><th>Ort</th><th>Ges.</th><th class="num">Sess.</th><th class="num">kWh</th><th class="num">Gesamt €</th><th class="num">Ø €/kWh</th><th class="num">Anteil</th><th>6-Mon-Verlauf</th></tr></thead>
          <tbody>
          ${filList.map((f,i)=>`<tr>
            <td class="rank rank-${i<3?i+1:'x'}">${i+1}</td>
            <td><b>${f.filName}</b>${f.filName==='ohne Stammdaten'?' <span class="badge new" title="Fahrzeug noch nicht in Stammdaten erfasst">offen</span>':''}</td>
            <td>${f.ort||'—'}</td>
            <td><span class="badge ges-${(f.ges||'').toLowerCase()}">${f.ges}</span></td>
            <td class="num">${f.n}</td>
            <td class="num">${num(f.kwh,0)}</td>
            <td class="num"><b>${eu(f.eur)}</b></td>
            <td class="num">${f.kwh>0?f.avg_eur_kwh.toFixed(3):'—'}</td>
            <td class="num">${pct(f.eur/total.eur)}</td>
            <td>${svgSpark(f.monthly,{color:'#0d0d0d',width:90,height:24})}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="alert-box info">
        <div class="icon">i</div>
        <div class="body">
          <h4>Hinweis zur Zuordnung</h4>
          <p>Die Kostenstelle wird über den <b>Fahrer</b> und dessen hinterlegte Filiale/Gesellschaft in den Stammdaten zugeordnet. Sessions ohne Stammdaten-Treffer laufen unter „ohne Stammdaten" und sollten ergänzt werden, sobald die offenen Rechnungen/Fahrzeuge nachgepflegt sind.</p>
        </div>
      </div>
    `;
    host.innerHTML = html;

    host.querySelector('#ab-csv1').addEventListener('click', () => {
      downloadCSV('Abrechnung_Gesellschaft_Monat.csv',
        ['Gesellschaft', ...MONTHS.map(m=>MONTH_LABELS[m]||m), 'Gesamt'],
        gesTotals.map(g => [g.g, ...MONTHS.map(m=>dec(matrix[g.g][m].toFixed(2))), dec(g.total.toFixed(2))]));
    });
    host.querySelector('#ab-csv2').addEventListener('click', () => {
      downloadCSV('Abrechnung_Filialen.csv',
        ['Filiale','Ort','Gesellschaft','Sessions','kWh','EUR','EUR/kWh', ...MONTHS.map(m=>MONTH_SHORT[m])],
        filList.map(f => [f.filName, f.ort, f.ges, f.n, dec(f.kwh.toFixed(2)), dec(f.eur.toFixed(2)),
          f.kwh>0?dec(f.avg_eur_kwh.toFixed(3)):'', ...f.monthly.map(v=>dec(v.toFixed(2)))]));
    });
  }

  // ============================================================================
  // BUDGET & HOCHRECHNUNG
  // ============================================================================
  function getBudget(def) {
    const v = parseFloat(localStorage.getItem('lc_monthly_budget'));
    return v > 0 ? v : def;
  }
  function renderBudget(host) {
    const monthAggs = MONTHS.map(m => ({ key:m, eur: sumBy(SESSIONS.filter(s=>s.m===m), s=>s.eu),
      n: SESSIONS.filter(s=>s.m===m).length }));
    const total = sumBy(monthAggs, m=>m.eur);
    const avg = total / monthAggs.length;
    const last3 = monthAggs.slice(-3);
    const last3Avg = sumBy(last3, m=>m.eur) / last3.length;
    const defBudget = Math.round(avg/50)*50;

    function draw() {
      const budget = getBudget(defBudget);
      const projYear = avg * 12;
      const projRun = last3Avg * 12;
      const overMonths = monthAggs.filter(m=>m.eur > budget).length;
      const ytdBudget = budget * monthAggs.length;
      const ytdDelta = total - ytdBudget;

      host.innerHTML = `
        <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Budget &amp; Hochrechnung</h1>
        <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">Soll/Ist-Vergleich &amp; Jahres-Prognose auf Basis von ${monthAggs.length} erfassten Monaten (Dez 2025 – Mai 2026).</p>

        <div class="filter-bar" style="flex-wrap:wrap;">
          <label>Monatsbudget (€)</label>
          <input type="number" id="bg-input" value="${budget}" min="0" step="50" style="width:120px;" />
          <button id="bg-save" style="background:var(--yellow);color:var(--ink);border:0;padding:6px 14px;font-family:inherit;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">Übernehmen</button>
          <button id="bg-reset" style="background:transparent;color:var(--yellow);border:1px solid var(--yellow);padding:5px 12px;font-family:inherit;font-weight:600;font-size:11px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">Auf Ø zurücksetzen</button>
          <div class="filter-info">Ø Ist/Monat: <b>${eu(avg)}</b> · Run-Rate 3 Mon: <b>${eu(last3Avg)}</b></div>
        </div>

        <div class="kpis">
          <div class="kpi hi"><div class="label">Ist kumuliert</div><div class="val" style="font-size:26px;">${eu(total)}</div><div class="extra">${monthAggs.length} Monate</div></div>
          <div class="kpi"><div class="label">Ø Ist / Monat</div><div class="val" style="font-size:26px;">${eu(avg)}</div><div class="extra">über alle Monate</div></div>
          <div class="kpi ${ytdDelta>0?'warn':'good'}"><div class="label">Soll/Ist kumuliert</div><div class="val" style="font-size:24px;">${ytdDelta>0?'+':''}${eu(ytdDelta)}</div><div class="extra">vs. Budget ${eu(ytdBudget)}</div></div>
          <div class="kpi"><div class="label">Hochrechnung Jahr</div><div class="val" style="font-size:24px;">${eu(projYear)}</div><div class="extra">Ø × 12</div></div>
          <div class="kpi"><div class="label">Run-Rate Jahr</div><div class="val" style="font-size:24px;">${eu(projRun)}</div><div class="extra">letzte 3 Mon × 12</div></div>
          <div class="kpi ${projYear>budget*12?'warn':'good'}"><div class="label">Jahresbudget</div><div class="val" style="font-size:24px;">${eu(budget*12)}</div><div class="extra">${overMonths} von ${monthAggs.length} Mon über Budget</div></div>
        </div>

        <div class="card accent">
          <div class="card-h"><h3>Soll/Ist je Monat</h3><span class="h-sub">Balken = Ist · gestrichelte Linie = Budget (${eu(budget)})</span></div>
          <div class="chart-wrap">${budgetChart(monthAggs, budget)}</div>
        </div>

        <div class="card">
          <div class="card-h"><h3>Monats-Detail</h3><span class="h-sub">Abweichung &amp; kumulierter Verlauf</span></div>
          <table class="dt">
            <thead><tr><th>Monat</th><th class="num">Sessions</th><th class="num">Ist</th><th class="num">Budget</th><th class="num">Abweichung</th><th class="num">Auslastung</th><th class="num">Ist kumuliert</th></tr></thead>
            <tbody>
            ${(()=>{ let cum=0; return monthAggs.map(m=>{ cum+=m.eur; const d=m.eur-budget; const u=m.eur/budget;
              return `<tr>
                <td><b>${MONTH_LABELS[m.key]}</b></td>
                <td class="num">${m.n}</td>
                <td class="num"><b>${eu(m.eur)}</b></td>
                <td class="num muted">${eu(budget)}</td>
                <td class="num"><b style="color:${d>0?'var(--warn)':'var(--good)'};">${d>0?'+':''}${eu(d)}</b></td>
                <td class="num">${pct(u)}</td>
                <td class="num">${eu(cum)}</td>
              </tr>`; }).join(''); })()}
            </tbody>
          </table>
        </div>
      `;
      const input = host.querySelector('#bg-input');
      host.querySelector('#bg-save').addEventListener('click', () => {
        const v = parseFloat(input.value); if (v>0){ localStorage.setItem('lc_monthly_budget', v); draw(); }
      });
      host.querySelector('#bg-reset').addEventListener('click', () => { localStorage.removeItem('lc_monthly_budget'); draw(); });
      input.addEventListener('keydown', e => { if(e.key==='Enter') host.querySelector('#bg-save').click(); });
    }
    draw();
  }

  function budgetChart(months, budget) {
    const width=1200, height=260, padL=56, padR=24, padT=30, padB=46;
    const innerW = width-padL-padR, innerH = height-padT-padB;
    const max = Math.max(budget, ...months.map(m=>m.eur)) * 1.12;
    const colW = innerW / months.length;
    const yOf = v => padT + innerH - (v/max)*innerH;
    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart">`;
    svg += `<line x1="${padL}" y1="${padT+innerH}" x2="${width-padR}" y2="${padT+innerH}" stroke="#0d0d0d" stroke-width="1.5"/>`;
    months.forEach((m,i)=>{
      const bw = colW*0.6, x = padL + i*colW + (colW-bw)/2;
      const y = yOf(m.eur), h = padT+innerH-y;
      const over = m.eur > budget;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${over?'#c0392b':'#FFE500'}" stroke="#0d0d0d" stroke-width="1"/>`;
      svg += `<text x="${(x+bw/2).toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-weight="700" font-size="13" fill="#0d0d0d">€${Math.round(m.eur)}</text>`;
      svg += `<text x="${(x+bw/2).toFixed(1)}" y="${(padT+innerH+18).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="12" font-weight="600" fill="#0d0d0d">${MONTH_SHORT[m.key]}</text>`;
    });
    const by = yOf(budget);
    svg += `<line x1="${padL}" y1="${by.toFixed(1)}" x2="${width-padR}" y2="${by.toFixed(1)}" stroke="#0d0d0d" stroke-width="2" stroke-dasharray="7 5"/>`;
    svg += `<text x="${width-padR}" y="${(by-7).toFixed(1)}" text-anchor="end" font-family="Roboto Condensed" font-size="12" font-weight="700" fill="#0d0d0d">Budget €${Math.round(budget)}</text>`;
    svg += `</svg>`;
    return svg;
  }

  // ============================================================================
  // PRÜFUNG  (Anomalien & Datenqualität)
  // ============================================================================
  function renderPruefung(host) {
    const RATE_HI = 0.80;        // €/kWh Schwelle
    const IDLE_HI = 30;          // min
    const FX_COUNTRIES = ['CZ','HU','HR'];  // umgerechnete Währungen

    const expensive = SESSIONS.filter(s => s.kd==='kwh' && s.kw>0 && (s.eu/s.kw) > RATE_HI)
      .sort((a,b)=>(b.eu/b.kw)-(a.eu/a.kw));
    const zeroKwh = SESSIONS.filter(s => (!s.kw || s.kw===0) && s.eu > 0);
    const highIdle = SESSIONS.filter(s => s.im >= IDLE_HI).sort((a,b)=>b.im-a.im);
    const missing = SESSIONS.filter(s => !s.e || (s.kd==='kwh' && !s.kw) || !s.f || s.f==='(?)');
    const fx = SESSIONS.filter(s => FX_COUNTRIES.includes(s.c)).sort((a,b)=>b.eu-a.eu);

    // Duplikate: gleiches Kennz + Tag + gerundeter Betrag
    const seen = {}, dups = [];
    for (const s of SESSIONS) {
      const day = s.s ? s.s.slice(0,10) : '?';
      const key = s.k + '|' + day + '|' + Number(s.eu).toFixed(2);
      if (seen[key]) dups.push(s); else seen[key] = true;
    }

    const flagsTotal = expensive.length + highIdle.length + missing.length + dups.length;

    const tbl = (rows, cols) => `<table class="dt"><thead><tr>${cols.map(c=>`<th class="${c.cls||''}">${c.h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    const sRow = s => `<td><b>${fmtDate(s.s)}</b></td><td>${cleanSite(s.st)} <span class="badge country">${s.c}</span></td><td><b>${s.k}</b></td><td>${s.f}</td>`;

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Prüfung &amp; Datenqualität</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">Automatische Plausibilitäts-Checks für Rechnungskontrolle &amp; Datenpflege — auffällige Sessions auf einen Blick.</p>

      <div class="kpis">
        <div class="kpi ${flagsTotal? 'warn':'good'}"><div class="label">Prüf-Flags gesamt</div><div class="val">${flagsTotal}</div><div class="extra">von ${SESSIONS.length} Sessions</div></div>
        <div class="kpi"><div class="label">Teure kWh-Sess.</div><div class="val">${expensive.length}</div><div class="extra">&gt; ${RATE_HI.toFixed(2)} €/kWh</div></div>
        <div class="kpi"><div class="label">Mögl. Duplikate</div><div class="val">${dups.length}</div><div class="extra">Kennz.+Tag+Betrag</div></div>
        <div class="kpi"><div class="label">Hohe Idle-Zeit</div><div class="val">${highIdle.length}</div><div class="extra">≥ ${IDLE_HI} min</div></div>
        <div class="kpi"><div class="label">Fehlende Daten</div><div class="val">${missing.length}</div><div class="extra">Endzeit / kWh / Fahrer</div></div>
        <div class="kpi"><div class="label">FX-Umrechnung</div><div class="val">${fx.length}</div><div class="extra">CZ · HU · HR · prüfen</div></div>
      </div>

      <div class="card ${expensive.length?'alert':'success'}">
        <div class="card-h"><h3>① Teure kWh-Sessions</h3><span class="h-sub">über ${RATE_HI.toFixed(2)} €/kWh — Station/Abrechnung prüfen</span></div>
        ${expensive.length ? tbl(expensive.slice(0,25).map(s=>`<tr>${sRow(s)}<td class="num">${num(s.kw,1)}</td><td class="num"><b>${eu(s.eu)}</b></td><td class="num"><b style="color:var(--warn);">${(s.eu/s.kw).toFixed(2)}</b></td></tr>`).join(''),
          [{h:'Datum'},{h:'Standort'},{h:'Fzg'},{h:'Fahrer'},{h:'kWh',cls:'num'},{h:'€',cls:'num'},{h:'€/kWh',cls:'num'}])
          : '<div class="empty">Keine Auffälligkeiten — alle kWh-Sessions im normalen Preisbereich.</div>'}
      </div>

      <div class="card ${dups.length?'alert':'success'}">
        <div class="card-h"><h3>② Mögliche Doppelbuchungen</h3><span class="h-sub">gleiches Kennzeichen, Tag &amp; Betrag — manuell verifizieren</span></div>
        ${dups.length ? tbl(dups.map(s=>`<tr>${sRow(s)}<td class="num">${fmtTime(s.s)}</td><td class="num"><b>${eu(s.eu)}</b></td></tr>`).join(''),
          [{h:'Datum'},{h:'Standort'},{h:'Fzg'},{h:'Fahrer'},{h:'Uhrzeit',cls:'num'},{h:'€',cls:'num'}])
          : '<div class="empty">Keine Doppelbuchungen erkannt.</div>'}
      </div>

      <div class="grid-2">
        <div class="card ${highIdle.length?'alert':''}">
          <div class="card-h"><h3>③ Hohe Idle-Zeiten</h3><span class="h-sub">≥ ${IDLE_HI} min am Stecker</span></div>
          ${highIdle.length ? tbl(highIdle.slice(0,20).map(s=>`<tr><td><b>${fmtDate(s.s)}</b></td><td><b>${s.k}</b></td><td>${s.f}</td><td class="num"><b style="color:var(--warn);">${s.im} min</b></td></tr>`).join(''),
            [{h:'Datum'},{h:'Fzg'},{h:'Fahrer'},{h:'Idle',cls:'num'}])
            : '<div class="empty">Keine hohen Idle-Zeiten.</div>'}
        </div>
        <div class="card info">
          <div class="card-h"><h3>④ FX-Sessions (Ausland)</h3><span class="h-sub">umgerechnet — Kurs prüfen</span></div>
          ${fx.length ? tbl(fx.slice(0,20).map(s=>`<tr><td><b>${fmtDate(s.s)}</b></td><td><span class="badge country">${s.c}</span> ${cleanSite(s.st)}</td><td class="num">${num(s.kw,1)}</td><td class="num"><b>${eu(s.eu)}</b></td></tr>`).join(''),
            [{h:'Datum'},{h:'Standort'},{h:'kWh',cls:'num'},{h:'€',cls:'num'}])
            : '<div class="empty">Keine Auslands-Sessions.</div>'}
        </div>
      </div>

      <div class="card ${missing.length?'':'success'}">
        <div class="card-h"><h3>⑤ Unvollständige Datensätze</h3><span class="h-sub">fehlende Endzeit, kWh oder Fahrer — ergänzen</span></div>
        ${missing.length ? tbl(missing.slice(0,30).map(s=>`<tr>${sRow(s)}<td class="num">${s.kw?num(s.kw,1):'<b style="color:var(--warn);">fehlt</b>'}</td><td class="center">${s.e?'✓':'<b style="color:var(--warn);">fehlt</b>'}</td><td class="num"><b>${eu(s.eu)}</b></td></tr>`).join(''),
          [{h:'Datum'},{h:'Standort'},{h:'Fzg'},{h:'Fahrer'},{h:'kWh',cls:'num'},{h:'Endzeit',cls:'center'},{h:'€',cls:'num'}])
          : '<div class="empty">Alle Datensätze vollständig.</div>'}
        ${missing.length>30?`<div class="small muted" style="margin-top:8px;">Zeigt 30 von ${missing.length}</div>`:''}
      </div>
    `;
    host.innerHTML = html;
  }

  // — Export
  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, { renderAbrechnung, renderBudget, renderPruefung });
})();
