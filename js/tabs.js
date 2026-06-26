// Lucky Car Ladestatistik · Tab renderers & navigation
(function(){
  const D = window.LCData;
  const {
    SESSIONS, IDLE_PENALTIES, MONTHS, MONTH_LABELS, MONTH_SHORT,
    COUNTRY_NAMES, QUARTERS,
    eu, num, pct, pct1,
    sumBy, aggregate, withAvg,
    byMonth, byMonths, byField,
    getVehicleMeta, byHour, byWeekday, masterStats,
    svgBars, svgStackedBars, svgDonut, svgSpark, svgHeatmap, svgAreaLine
  } = D;

  const COUNTRY_COLORS = {
    AT:'#FFE500', DE:'var(--c-de,#0d0d0d)', CZ:'#1e5a9e', SI:'#1f7a3c',
    IT:'#c0392b', HU:'#8a4a8a', HR:'#e87a30'
  };

  const STATS = masterStats();

  // ============================================================================
  // ÜBERSICHT
  // ============================================================================
  function renderUebersicht(host) {
    const monthsSorted = MONTHS;
    const monthAggs = monthsSorted.map(m => ({
      key:m, label:MONTH_SHORT[m], full:MONTH_LABELS[m],
      ...withAvg(aggregate(byMonth(m)))
    }));

    const countryAggs = byField('c').filter(c => c.eur > 0);
    const vehAggs = getVehicleMeta();
    const driverAggs = byField('f').filter(d => d.key && d.key !== '(?)');

    const totalZeit = sumBy(SESSIONS.filter(s=>s.kd==='zeit'), s=>s.eu);
    const totalIdle = sumBy(IDLE_PENALTIES, r=>r.eu);
    const totalVermeidbar = totalZeit + totalIdle;
    const vermeidbarPct = totalVermeidbar / STATS.eur;

    // Monthly trend chart data
    const trendData = monthAggs.map(m => ({
      label: m.label, value: m.eur,
      sublabel: `${m.n} sess · ${(m.kwh/1000).toFixed(1)} MWh`
    }));

    // Country donut
    const donut = countryAggs.map(c => ({
      value: c.eur, color: COUNTRY_COLORS[c.key] || '#888'
    }));

    let html = `
      <!-- HEADLINE -->
      <div style="margin-bottom:18px;">
        <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">6-Monats-Übersicht</h1>
        <p style="margin:0;color:var(--ink-3);font-size:14px;">Dezember 2025 — Mai 2026 · Tesla Supercharger · LCCC + LC Fleet · <b>Stand: 28.05.2026</b></p>
      </div>

      <!-- KPIs -->
      <div class="kpis">
        <div class="kpi hi">
          <div class="label">Gesamtkosten</div>
          <div class="val">${eu(STATS.eur)}</div>
          <div class="extra">inkl. USt · 6 Monate</div>
        </div>
        <div class="kpi">
          <div class="label">Energie</div>
          <div class="val">${num(STATS.kwh, 0)}<span class="u">kWh</span></div>
          <div class="extra">${(STATS.kwh/1000).toFixed(1)} MWh insgesamt</div>
        </div>
        <div class="kpi">
          <div class="label">Sessions</div>
          <div class="val">${STATS.n}</div>
          <div class="extra">${(STATS.n/6).toFixed(0)} ⌀ pro Monat</div>
        </div>
        <div class="kpi">
          <div class="label">Fahrzeuge</div>
          <div class="val">${STATS.vehicles}</div>
          <div class="extra">${STATS.drivers} Fahrer · ${STATS.countries} Länder</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Preis</div>
          <div class="val">${STATS.avg_eur_kwh.toFixed(2)}<span class="u">€/kWh</span></div>
          <div class="extra">SC-Tarif inkl. Zeit</div>
        </div>
        <div class="kpi warn">
          <div class="label">Vermeidbare Kosten</div>
          <div class="val">${eu(totalVermeidbar)}</div>
          <div class="extra">${pct(vermeidbarPct)} vom Total · Zeit-Tarif &amp; Blockier</div>
        </div>
      </div>

      <!-- Monthly trend chart -->
      <div class="card accent">
        <div class="card-h">
          <h3>Monatsverlauf · 6 Monate</h3>
          <span class="h-sub">Kosten in € pro Lade-Monat</span>
          <span class="h-meta">SKALA · MAX € ${Math.max(...monthAggs.map(m=>m.eur)).toFixed(0)}</span>
        </div>
        <div class="chart-wrap">
          ${svgAreaLine(trendData, { width:1200, height:264, format:v=>'€'+Math.round(v)})}
        </div>
      </div>

      <!-- Country + leaderboards -->
      <div class="grid-3">
        <div class="card">
          <div class="card-h"><h3>Nach Land</h3><span class="h-sub">${countryAggs.length} aktiv</span></div>
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="flex-shrink:0;">${svgDonut(donut, { size:160, stroke:28 })}</div>
            <ul style="list-style:none;padding:0;margin:0;font-size:13px;flex:1;">
              ${countryAggs.slice(0,7).map(c => {
                const cpct = c.eur / STATS.eur;
                return `<li style="margin-bottom:5px;display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:${COUNTRY_COLORS[c.key]};border:1px solid var(--ink);flex-shrink:0;"></span>
                  <b style="width:24px;flex-shrink:0;">${c.key}</b>
                  <span style="flex:1;min-width:0;color:var(--ink-3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.n} sess</span>
                  <b style="font-variant-numeric:tabular-nums;flex-shrink:0;min-width:78px;text-align:right;">${eu(c.eur)}</b>
                  <span style="color:var(--ink-3);width:38px;text-align:right;font-size:11px;flex-shrink:0;">${pct(cpct)}</span>
                </li>`;
              }).join('')}
            </ul>
          </div>
        </div>

        <div class="card">
          <div class="card-h"><h3>Top 5 Fahrzeuge</h3><span class="h-sub">nach Kosten</span></div>
          ${vehAggs.slice(0,5).map((v,i) => `
            <div class="leader ${i===0?'top':''}">
              <div class="rk">${i+1}</div>
              <div class="nm"><b>${v.kfz}</b> <span class="badge ges-${v.ges.toLowerCase()}">${v.ges}</span><small>${v.fahrer} · ${v.n} Sess · ${num(v.kwh,0)} kWh</small></div>
              <div class="vl">${eu(v.eur)}<small>${v.avg_eur_kwh.toFixed(2)} €/kWh</small></div>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-h"><h3>Top 5 Fahrer</h3><span class="h-sub">nach Kosten</span></div>
          ${driverAggs.slice(0,5).map((d,i) => `
            <div class="leader ${i===0?'top':''}">
              <div class="rk">${i+1}</div>
              <div class="nm"><b>${d.key}</b><small>${d.n} Sess · ${num(d.kwh,0)} kWh · ${d.vermeidbar>0 ? eu(d.vermeidbar)+' vermeidbar' : 'effizient'}</small></div>
              <div class="vl">${eu(d.eur)}<small>${d.avg_eur_kwh.toFixed(2)} €/kWh</small></div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Quick summary row -->
      <div class="grid-3" style="margin-top:0;">
        <div class="card info">
          <div class="card-h"><h3>Geografische Reichweite</h3><span class="h-sub">Aktionsradius</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div class="stat-line"><span class="big">${STATS.countries}</span><span class="sml">Länder</span></div>
              <div style="margin-top:4px;font-size:12px;color:var(--ink-3);">${Object.keys(COUNTRY_NAMES).filter(c=>countryAggs.find(x=>x.key===c)).map(c=>c).join(' · ')}</div>
            </div>
            <div>
              <div class="stat-line"><span class="big">${STATS.stations}</span><span class="sml">SC-Stationen</span></div>
              <div style="margin-top:4px;font-size:12px;color:var(--ink-3);">Unique Tesla-Supercharger</div>
            </div>
          </div>
          <hr class="divider"/>
          <div style="font-size:12px;color:var(--ink-3);">
            <b style="color:var(--ink);">Erstmals im Mai 2026:</b> Tschechien, Ungarn, Kroatien &amp; Italien (G-164XJ + FLEET-Tour AT→DE→CZ).
          </div>
        </div>

        <div class="card ${vermeidbarPct > 0.15 ? 'alert' : 'success'}">
          <div class="card-h"><h3>Effizienz-Status</h3><span class="h-sub">Vermeidbare Kosten</span></div>
          <div style="font-size:36px;font-weight:900;color:${vermeidbarPct > 0.15 ? 'var(--warn)' : 'var(--good)'};">${pct(vermeidbarPct)}</div>
          <div style="font-size:13px;color:var(--ink-2);margin-bottom:10px;">
            ${eu(totalVermeidbar)} entstanden durch Zeit-Tarif (langsame Ladestationen) und Blockier-Gebühren.
          </div>
          <div style="display:flex;gap:14px;font-size:12px;">
            <div><b>Zeit-Tarif:</b> ${eu(totalZeit)}<br/><span class="muted">${SESSIONS.filter(s=>s.kd==='zeit').length} Sessions</span></div>
            <div><b>Blockier:</b> ${eu(totalIdle)}<br/><span class="muted">${IDLE_PENALTIES.length} Vorfälle</span></div>
          </div>
          <hr class="divider"/>
          <div style="font-size:12px;color:var(--ink-3);">
            <b style="color:var(--good);">↘ Trend:</b> Zeit-Tarif-Anteil sinkt von 23 % (Dez) auf 0 % (Mai) — Fahrer wechseln zu schnelleren SCs.
          </div>
        </div>

        <div class="card">
          <div class="card-h"><h3>Datenquellen</h3><span class="h-sub">Lückenlos · 100 % gematcht</span></div>
          <table class="dt" style="font-size:13px;">
            <tr><td>LCCC-CSVs</td><td class="num"><b>${SESSIONS.filter(s=>s.src==='Tesla LCCC').length}</b> Sessions</td></tr>
            <tr><td>FLEET-Einzelrechnungen</td><td class="num"><b>${SESSIONS.filter(s=>s.src==='Tesla Fleet').length}</b> Sessions</td></tr>
            <tr><td>Idle-Penalties (Detail)</td><td class="num"><b>${IDLE_PENALTIES.length}</b> Vorfälle</td></tr>
            <tr><td>FIN-Match-Rate</td><td class="num"><b style="color:var(--good);">100 %</b></td></tr>
            <tr><td>Währungsumrechnung</td><td class="num" style="font-size:11px;">CZK @ 24,70 · HUF @ 400</td></tr>
          </table>
        </div>
      </div>
    `;

    host.innerHTML = html;
  }

  // ============================================================================
  // MONAT
  // ============================================================================
  let _currentMonth = MONTHS[MONTHS.length-1];

  function renderMonat(host) {
    const monthsSorted = MONTHS;
    let html = `
      <div class="filter-bar">
        <label>Monat wählen</label>
        <select id="monat-select">
          ${monthsSorted.map(m => `<option value="${m}" ${m===_currentMonth?'selected':''}>${MONTH_LABELS[m]}</option>`).join('')}
        </select>
        <div class="filter-info"><b>${SESSIONS.filter(s=>s.m===_currentMonth).length}</b> Sessions in <b>${MONTH_LABELS[_currentMonth]}</b></div>
      </div>
      <div id="monat-content"></div>
    `;
    host.innerHTML = html;
    document.getElementById('monat-select').addEventListener('change', e => {
      _currentMonth = e.target.value;
      renderMonatContent();
    });
    renderMonatContent();
  }

  function renderMonatContent() {
    const host = document.getElementById('monat-content');
    const month = _currentMonth;
    const sess = byMonth(month);
    const agg = withAvg(aggregate(sess));

    // By day
    const byDate = {};
    for (const s of sess) {
      if (!s.s) continue;
      const d = s.s.slice(0,10);
      (byDate[d] ??= {n:0, eur:0, kwh:0}).n++;
      byDate[d].eur += s.eu;
      byDate[d].kwh += s.kw;
    }
    const days = Object.keys(byDate).sort();
    const dayData = days.map(d => ({
      label: d.slice(8) + '.' + d.slice(5,7), value: byDate[d].eur,
      sublabel: `${byDate[d].n}S · ${byDate[d].kwh.toFixed(0)} kWh`
    }));

    // By country
    const countryAggs = byField('c', sess).filter(c => c.eur > 0);
    const donutSeg = countryAggs.map(c => ({ value:c.eur, color: COUNTRY_COLORS[c.key] || '#888' }));

    // By vehicle in this month
    const vehMonth = byField('k', sess).filter(v => v.key && v.key !== '(?)');

    // By weekday + by hour
    const wd = byWeekday(sess);
    const hr = byHour(sess);

    // Zeit/idle sessions
    const zeitSess = sess.filter(s => s.kd === 'zeit');
    const idlePens = IDLE_PENALTIES.filter(r => r.m === month);

    // Top stations
    const stations = byField('st', sess).slice(0, 10);

    let html = `
      <!-- KPIs for month -->
      <div class="kpis">
        <div class="kpi hi">
          <div class="label">Kosten</div>
          <div class="val">${eu(agg.eur)}</div>
          <div class="extra">${MONTH_LABELS[month]}</div>
        </div>
        <div class="kpi">
          <div class="label">Energie</div>
          <div class="val">${num(agg.kwh, 0)}<span class="u">kWh</span></div>
          <div class="extra">${(agg.kwh / agg.n).toFixed(1)} kWh Ø Session</div>
        </div>
        <div class="kpi">
          <div class="label">Sessions</div>
          <div class="val">${agg.n}</div>
          <div class="extra">${agg.kwh_n} kWh + ${agg.zeit_n} Zeit-Tarif</div>
        </div>
        <div class="kpi">
          <div class="label">Fahrzeuge</div>
          <div class="val">${vehMonth.length}</div>
          <div class="extra">${countryAggs.length} Länder</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Preis</div>
          <div class="val">${agg.avg_eur_kwh.toFixed(2)}<span class="u">€/kWh</span></div>
          <div class="extra">Vol. kWh-Sessions</div>
        </div>
        <div class="kpi ${agg.vermeidbar_pct > 0.10 ? 'warn' : 'good'}">
          <div class="label">Vermeidbar</div>
          <div class="val">${eu(agg.vermeidbar + sumBy(idlePens, r=>r.eu))}</div>
          <div class="extra">${pct((agg.vermeidbar + sumBy(idlePens, r=>r.eu))/agg.eur)} vom Total</div>
        </div>
      </div>

      <!-- Daily chart -->
      ${days.length ? `
      <div class="card accent">
        <div class="card-h">
          <h3>Tagesverlauf · ${MONTH_LABELS[month]}</h3>
          <span class="h-sub">${days.length} aktive Tage · Spitzentag ${(() => {
            const top = days.reduce((a,b)=>byDate[a].eur>byDate[b].eur?a:b);
            return top.slice(8)+'.'+top.slice(5,7)+'. · '+eu(byDate[top].eur);
          })()}</span>
        </div>
        <div class="chart-wrap">${svgBars(dayData, {width:1200, height:220, padL:36, padR:20, showLabels:false, format:v=>'€'+Math.round(v)})}</div>
      </div>` : ''}

      <div class="grid-12">
        <!-- Vehicles in this month -->
        <div class="card">
          <div class="card-h"><h3>Fahrzeug-Aktivität</h3><span class="h-sub">${vehMonth.length} aktive im Monat</span></div>
          <table class="dt">
            <thead><tr><th>Kennz.</th><th>Fahrer</th><th>Ges.</th><th class="num">Sess.</th><th class="num">kWh</th><th class="num">€</th><th class="num">Ø €/kWh</th><th class="num">Anteil</th></tr></thead>
            <tbody>
            ${vehMonth.map(v => {
              const first = v.rows[0];
              const w = (v.eur / vehMonth[0].eur) * 100;
              return `<tr>
                <td><b>${v.key}</b></td>
                <td>${first.f}</td>
                <td><span class="badge ges-${first.g.toLowerCase()}">${first.g}</span></td>
                <td class="num">${v.n}</td>
                <td class="num">${v.kwh.toFixed(0)}</td>
                <td class="num"><b>${eu(v.eur)}</b></td>
                <td class="num">${v.avg_eur_kwh.toFixed(2)}</td>
                <td><div class="bar yellow" style="width:80px;"><i style="width:${w.toFixed(0)}%"></i></div></td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Country split -->
        <div class="card">
          <div class="card-h"><h3>Länder</h3><span class="h-sub">${countryAggs.length} aktiv</span></div>
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
            <div style="flex-shrink:0;">${svgDonut(donutSeg, { size:130, stroke:24 })}</div>
            <ul style="list-style:none;padding:0;margin:0;font-size:13px;flex:1;">
              ${countryAggs.map(c => `<li style="margin-bottom:5px;display:flex;align-items:center;gap:5px;">
                <span style="width:10px;height:10px;background:${COUNTRY_COLORS[c.key]};border:1px solid var(--ink);flex-shrink:0;"></span>
                <b style="width:22px;flex-shrink:0;">${c.key}</b>
                <span style="flex:1;min-width:0;color:var(--ink-3);font-size:11px;">${c.n}S</span>
                <b style="flex-shrink:0;">${eu(c.eur)}</b>
              </li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      ${zeitSess.length || idlePens.length ? `
      <div class="alert-box">
        <div class="icon">!</div>
        <div class="body">
          <h4>Vermeidbare Kosten in diesem Monat</h4>
          <p>
            <b>${zeitSess.length}</b> Zeit-Tarif-Sessions à ${eu(sumBy(zeitSess, s=>s.eu))} ·
            <b>${idlePens.length}</b> Blockier-Gebühren à ${eu(sumBy(idlePens, r=>r.eu))} ·
            Gesamt-Verlust: <b>${eu(sumBy(zeitSess, s=>s.eu) + sumBy(idlePens, r=>r.eu))}</b>
          </p>
        </div>
      </div>` : ''}

      ${zeitSess.length ? `
      <div class="card">
        <div class="card-h"><h3>Zeit-Tarif-Sessions</h3><span class="h-sub">langsame SCs · min-basiert · vermeidbar</span></div>
        <table class="dt">
          <thead><tr><th>Datum</th><th>Standort</th><th>L</th><th>Fzg</th><th>Fahrer</th><th class="num">Dauer</th><th class="num">€</th></tr></thead>
          <tbody>
          ${zeitSess.sort((a,b)=>(b.s||'').localeCompare(a.s||'')).map(s => `<tr>
            <td><b>${s.s ? s.s.slice(8,10)+'.'+s.s.slice(5,7)+'.' : '—'}</b></td>
            <td>${s.st || '—'}</td>
            <td><span class="badge country">${s.c || '—'}</span></td>
            <td><b>${s.k}</b></td>
            <td>${s.f}</td>
            <td class="num">${s.dm ? s.dm+' min' : (s.im ? s.im+' min' : '—')}</td>
            <td class="num"><b>${eu(s.eu)}</b></td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <!-- Top stations -->
      <div class="card">
        <div class="card-h"><h3>Top-Stationen</h3><span class="h-sub">${stations.length} der ${byField('st', sess).length}</span></div>
        <table class="dt">
          <thead><tr><th>Rang</th><th>Standort</th><th class="num">Sessions</th><th class="num">kWh</th><th class="num">€</th><th class="num">Ø €/kWh</th></tr></thead>
          <tbody>
          ${stations.map((s,i)=>{
            const country = s.rows[0].c;
            return `<tr>
              <td class="rank rank-${i<3?i+1:'x'}">${i+1}</td>
              <td>${s.key.replace(/,\\s*(Austria|Germany|Czech Republic|Slovenia|Italy|Hungary|Croatia)/, '')} <span class="badge country">${country}</span></td>
              <td class="num">${s.n}</td>
              <td class="num">${s.kwh.toFixed(0)}</td>
              <td class="num"><b>${eu(s.eur)}</b></td>
              <td class="num">${s.avg_eur_kwh.toFixed(2)}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Heatmap of when -->
      <div class="card">
        <div class="card-h"><h3>Wann wird geladen?</h3><span class="h-sub">Heatmap · Wochentag × Stunde</span></div>
        <div style="overflow-x:auto;">
          ${svgHeatmap((() => {
            // Build 7×24 grid (Mon=0)
            const grid = Array(7).fill(0).map(()=>Array(24).fill(0).map(()=>({n:0,eur:0})));
            for (const s of sess) {
              if (s.h == null || s.wd == null) continue;
              const wd = s.wd === 0 ? 6 : s.wd - 1; // shift Sun to last
              grid[wd][s.h].n++;
              grid[wd][s.h].eur += s.eu;
            }
            return grid;
          })(), { cellSize:30 })}
        </div>
      </div>
    `;
    host.innerHTML = html;
  }

  // ============================================================================
  // QUARTAL
  // ============================================================================
  function renderQuartal(host) {
    const quartals = Object.entries(QUARTERS).map(([k,q]) => ({
      key:k, label:q.label, months:q.months,
      ...withAvg(aggregate(byMonths(q.months)))
    }));

    // Months in each quarter for spark
    const quartalMonthly = quartals.map(q => ({
      ...q,
        monthly: q.months.map(m => ({ monthKey: m, ...withAvg(aggregate(byMonth(m))) }))
    }));

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Quartalsanalyse</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">Q4 2025 (1 Monat) → Q1 2026 (3 Monate) → Q2 2026 (2 Monate · laufend)</p>

      <div class="grid-3">
      ${quartalMonthly.map((q,i) => {
        const prev = i > 0 ? quartalMonthly[i-1] : null;
        const avgMonth = q.eur / q.months.length;
        const prevAvgMonth = prev ? prev.eur / prev.months.length : null;
        const delta = prevAvgMonth ? ((avgMonth - prevAvgMonth) / prevAvgMonth) : null;
        return `
        <div class="card ${i===quartalMonthly.length-1?'accent':''}">
          <div class="card-h"><h3>${q.label}</h3><span class="h-sub">${q.months.length} Mon · ${q.n} Sess.</span></div>
          <div style="font-size:38px;font-weight:900;line-height:1;letter-spacing:-1px;">${eu(q.eur)}</div>
          ${delta !== null ? `<div style="margin-top:6px;font-size:13px;">
            <span class="pill ${delta < 0 ? 'good' : 'warn'}">${delta > 0 ? '↑' : '↓'} ${Math.abs(delta*100).toFixed(0)} %</span>
            <span style="color:var(--ink-3);margin-left:6px;">vs. ${prev.label} (${eu(prevAvgMonth)}/Mon)</span>
          </div>` : '<div style="margin-top:6px;font-size:13px;color:var(--ink-3);">Baseline</div>'}
          <hr class="divider"/>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
            <div><b>${num(q.kwh,0)}</b> kWh<br/><span class="muted">${q.avg_eur_kwh.toFixed(2)} €/kWh</span></div>
            <div><b>${eu(avgMonth)}</b><br/><span class="muted">Ø pro Monat</span></div>
            <div><b>${q.zeit_n}</b> Zeit-Sess<br/><span class="muted">${eu(q.zeit_eur)} vermeidbar</span></div>
            <div><b>${(q.vermeidbar_pct*100).toFixed(0)} %</b><br/><span class="muted">Effizienz-Index</span></div>
          </div>
          <hr class="divider"/>
          <div style="display:flex;gap:8px;align-items:flex-end;height:60px;">
            ${q.monthly.map(mo => {
              const max = Math.max(...quartalMonthly.flatMap(x=>x.monthly.map(y=>y.eur)));
              const h = (mo.eur / max) * 56;
              return `<div style="flex:1;text-align:center;">
                <div style="height:${h}px;background:var(--yellow);border:1px solid var(--ink);"></div>
                <div style="font-size:10px;color:var(--ink-3);margin-top:3px;font-weight:600;letter-spacing:0.5px;">${MONTH_SHORT[mo.monthKey] || ''}</div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
      </div>

      <!-- Quarter comparison -->
      <div class="card">
        <div class="card-h"><h3>Detail-Vergleich</h3><span class="h-sub">Quartal × Kennzahl</span></div>
        <table class="dt">
          <thead><tr><th>Kennzahl</th>${quartalMonthly.map(q=>`<th class="num">${q.label}</th>`).join('')}<th class="num">Trend</th></tr></thead>
          <tbody>
            <tr><td><b>Gesamtkosten</b></td>${quartalMonthly.map(q=>`<td class="num">${eu(q.eur)}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.eur), { color:'var(--chart-ink,#0d0d0d)' })}</td></tr>
            <tr><td><b>Ø pro Monat</b></td>${quartalMonthly.map(q=>`<td class="num">${eu(q.eur/q.months.length)}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.eur/q.months.length), { color:'var(--chart-ink,#0d0d0d)' })}</td></tr>
            <tr><td>Energie (kWh)</td>${quartalMonthly.map(q=>`<td class="num">${num(q.kwh,0)}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.kwh), { color:'var(--chart-ink,#0d0d0d)' })}</td></tr>
            <tr><td>Sessions</td>${quartalMonthly.map(q=>`<td class="num">${q.n}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.n), { color:'var(--chart-ink,#0d0d0d)' })}</td></tr>
            <tr><td>Ø €/kWh</td>${quartalMonthly.map(q=>`<td class="num">${q.avg_eur_kwh.toFixed(3)}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.avg_eur_kwh), { color:'var(--chart-ink,#0d0d0d)' })}</td></tr>
            <tr><td>Zeit-Tarif Sessions</td>${quartalMonthly.map(q=>`<td class="num">${q.zeit_n}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.zeit_n), { color:'#c0392b' })}</td></tr>
            <tr><td>Zeit-Tarif Kosten</td>${quartalMonthly.map(q=>`<td class="num">${eu(q.zeit_eur)}</td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>q.zeit_eur), { color:'#c0392b' })}</td></tr>
            <tr style="background:var(--good-bg);"><td><b>Effizienz</b> (kWh-Anteil)</td>${quartalMonthly.map(q=>`<td class="num"><b>${pct(1-q.vermeidbar_pct)}</b></td>`).join('')}<td class="num">${svgSpark(quartalMonthly.map(q=>1-q.vermeidbar_pct), { color:'#1f7a3c' })}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Geographic expansion -->
      <div class="card info">
        <div class="card-h"><h3>Geografische Entwicklung</h3><span class="h-sub">Aktionsradius pro Quartal</span></div>
        <table class="dt">
          <thead><tr><th>Quartal</th><th>Aktive Länder</th><th class="num">Anzahl</th><th class="num">Δ</th></tr></thead>
          <tbody>
          ${quartalMonthly.map((q,i) => {
            const sess = byMonths(q.months);
            const countries = [...new Set(sess.map(s=>s.c))].sort();
            const prev = i > 0 ? quartalMonthly[i-1] : null;
            const prevCountries = prev ? [...new Set(byMonths(prev.months).map(s=>s.c))] : [];
            const newCountries = countries.filter(c => !prevCountries.includes(c));
            return `<tr>
              <td><b>${q.label}</b></td>
              <td>${countries.map(c => newCountries.includes(c) ? `<b style="background:var(--yellow);padding:1px 6px;font-weight:700;">${c}</b>` : `<span style="padding:1px 6px;">${c}</span>`).join(' ')}</td>
              <td class="num"><b>${countries.length}</b></td>
              <td class="num">${i === 0 ? '—' : (newCountries.length ? `<b style="color:var(--good);">+${newCountries.length}</b>` : '0')}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    `;
    host.innerHTML = html;
  }

  // ============================================================================
  // EXPORT
  // ============================================================================
  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, {
    renderUebersicht, renderMonat, renderQuartal
  });
})();
