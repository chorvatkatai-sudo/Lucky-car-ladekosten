// Lucky Car Ladestatistik · Tabs 2 — Fahrzeuge, Fahrer, Standorte, Blockier-Kosten
// Der alte Reiter "Spar-Tipps" wurde am 04.11.2026 entfernt: er rechnete mit
// erfundenen Multiplikatoren (pauschal x 0,45), nannte Orte und Monate fest
// verdrahtet und widersprach dem belegten Reiter "Tipps" (js/effizienz.js).
(function(){
  const D = window.LCData;
  const {
    SESSIONS, IDLE_PENALTIES, MONTHS, MONTH_LABELS, MONTH_SHORT,
    MONTHS_N, PERIOD_LONG, PERIOD_SHORT, MONATE_TXT, GES_TXT, STAND,
    COUNTRY_NAMES,
    eu, num, pct, pct1, kwhp,
    sumBy, aggregate, withAvg,
    byMonth, byField,
    getVehicleMeta, byHour, byWeekday, masterStats,
    svgBars, svgStackedBars, svgDonut, svgSpark, svgHeatmap
  } = D;

  // SK fehlte bis 04.11.2026 -> die Legende rendert dann "background:undefined".
  // Neue Laender bitte hier ergaenzen; CFARBE() faengt es sonst mit Grau ab.
  const COUNTRY_COLORS = {
    AT:'#FFE500', DE:'#0d0d0d', CZ:'#1e5a9e', SI:'#1f7a3c',
    IT:'#c0392b', HU:'#8a4a8a', HR:'#e87a30', SK:'#2a9d8f'
  };
  const CFARBE = k => COUNTRY_COLORS[k] || '#888';

  const STATS = masterStats();

  // ============================================================================
  // FAHRZEUGE
  // ============================================================================
  function renderFahrzeuge(host) {
    const vehicles = getVehicleMeta();
    // Monthly per vehicle
    function vehSpark(v) {
      const monthly = MONTHS.map(m => sumBy(v.sessions.filter(s=>s.m===m), s=>s.eu));
      return svgSpark(monthly, { color:'#0d0d0d', width:90, height:24 });
    }

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Fahrzeug-Analyse</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;"><b>${vehicles.length}</b> Fahrzeuge mit Lade-Aktivität (Tesla &amp; DKV) · ${MONATE_TXT} Beobachtungszeitraum</p>

      <div class="kpis">
        <div class="kpi hi">
          <div class="label">Aktive Fahrzeuge</div>
          <div class="val">${vehicles.length}</div>
          <div class="extra">${vehicles.filter(v=>v.ges==='LCCC').length} LCCC · ${vehicles.filter(v=>v.ges==='FLEET').length} FLEET</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Kosten / Fzg</div>
          <div class="val">${eu(STATS.eur/vehicles.length)}</div>
          <div class="extra">${MONATE_TXT}</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Sessions / Fzg</div>
          <div class="val">${num(STATS.n/vehicles.length, 0)}</div>
          <div class="extra">~ ${num(STATS.n/vehicles.length/MONTHS_N, 1)} pro Monat</div>
        </div>
        <div class="kpi">
          <div class="label">Top-Verbraucher</div>
          <div class="val" style="font-size:24px;">${vehicles[0].kfz}</div>
          <div class="extra">${eu(vehicles[0].eur)} · ${vehicles[0].fahrer}</div>
        </div>
        <div class="kpi">
          <div class="label">Sparsamster</div>
          <div class="val" style="font-size:24px;">${(()=>{const v=[...vehicles].sort((a,b)=>a.avg_eur_kwh-b.avg_eur_kwh)[0];return v.kfz;})()}</div>
          <div class="extra">${(()=>{const v=[...vehicles].sort((a,b)=>a.avg_eur_kwh-b.avg_eur_kwh)[0];return kwhp(v.avg_eur_kwh, 3)+' €/kWh';})()}</div>
        </div>
        <div class="kpi">
          <div class="label">Aktiv-Quote</div>
          <div class="val">${pct(vehicles.length/26)}</div>
          <div class="extra">${vehicles.length} / 26 EV-Flotte</div>
        </div>
      </div>

      <!-- Stacked bars: cost per vehicle with kwh vs zeit -->
      <div class="card accent">
        <div class="card-h"><h3>Kosten je Fahrzeug</h3><span class="h-sub">aufgeschlüsselt nach kWh vs. Zeit-Tarif</span></div>
        <div class="chart-wrap">
          ${svgStackedBars(vehicles.map(v => ({
            label: v.kfz,
            segments: [
              { value: v.kwh_eur, color:'#FFE500', label: v.kwh_eur > 50 ? '€'+v.kwh_eur.toFixed(0) : '' },
              ...(v.zeit_eur > 0 ? [{ value: v.zeit_eur, color:'#c0392b', label: v.zeit_eur > 30 ? '€'+v.zeit_eur.toFixed(0)+' Z' : '' }] : [])
            ]
          })), { width: 1200, height: 40 + vehicles.length * 38, padL: 100, padT: 16, padB: 16 })}
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--ink-3);display:flex;gap:24px;">
          <span><span style="display:inline-block;width:12px;height:12px;background:#FFE500;border:1px solid var(--ink);vertical-align:-2px;margin-right:4px;"></span> kWh-Tarif (effizient)</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#c0392b;border:1px solid var(--ink);vertical-align:-2px;margin-right:4px;"></span> Zeit-Tarif (vermeidbar)</span>
        </div>
      </div>

      <!-- Full vehicle table -->
      <div class="card">
        <div class="card-h"><h3>Detail-Tabelle</h3><span class="h-sub">sortiert nach Gesamtkosten</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Kennz.</th><th>Fahrer</th><th>Ges.</th>
            <th>FIN</th><th>Länder</th>
            <th class="num">Sess.</th><th class="num">kWh</th><th class="num">Ø/Sess</th>
            <th class="num">Gesamt</th><th class="num">Ø €/kWh</th>
            <th class="num">Zeit-%</th><th>${MONTHS_N}-Mon-Verlauf</th>
          </tr></thead>
          <tbody>
          ${vehicles.map((v,i) => `<tr>
            <td class="rank rank-${i<3?i+1:'x'}">${i+1}</td>
            <td><b style="font-size:15px;">${v.kfz}</b></td>
            <td>${v.fahrer}</td>
            <td><span class="badge ges-${v.ges.toLowerCase()}">${v.ges}</span></td>
            <td class="mono small muted">${v.vin}</td>
            <td>${v.countries.map(c => `<span class="badge country" style="margin-right:2px;">${c}</span>`).join('')}</td>
            <td class="num">${v.n}</td>
            <td class="num">${num(v.kwh, 0)}</td>
            <td class="num">${v.n > 0 ? num(v.kwh/v.n, 1) : '—'}</td>
            <td class="num"><b>${eu(v.eur)}</b></td>
            <td class="num">${v.kwh > 0 ? kwhp(v.avg_eur_kwh, 3) : '—'}</td>
            <td class="num">${v.zeit_eur > 0 ? `<b style="color:var(--warn);">${pct(v.zeit_eur/v.eur)}</b>` : `<span class="muted">0 %</span>`}</td>
            <td>${vehSpark(v)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    host.innerHTML = html;
  }

  // ============================================================================
  // FAHRER
  // ============================================================================
  function renderFahrer(host) {
    const drivers = byField('f').filter(d => d.key && d.key !== '(?)');
    const vehMeta = getVehicleMeta();
    const driverVehMap = {};
    for (const v of vehMeta) {
      driverVehMap[v.fahrer] ??= [];
      driverVehMap[v.fahrer].push(v.kfz);
    }

    function driverSpark(d) {
      const monthly = MONTHS.map(m => sumBy(d.rows.filter(s=>s.m===m), s=>s.eu));
      return svgSpark(monthly, { color:'#0d0d0d', width:90, height:24 });
    }

    // Hinweis: die drei Kopf-Kacheln (Effizientester Fahrer / Hoechste vermeidbare
    // Kosten / Top-Verbraucher) wurden am 04.11.2026 auf Wunsch des Users entfernt.
    // Die Aussagen stehen jetzt belastbar im Reiter Effizienz; die alte
    // "Effizientester Fahrer"-Kachel war ausserdem falsch, weil sie die
    // 0,00-EUR-Positionen mitgewertet hat.

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Fahrer-Analyse</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;"><b>${drivers.length}</b> aktive Fahrer · Kennzahlen + Effizienz-Ranking</p>

      <div class="card">
        <div class="card-h"><h3>Vollständige Fahrer-Tabelle</h3><span class="h-sub">${drivers.length} Fahrer · sortiert nach Gesamtkosten</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Fahrer</th><th>Fahrzeuge</th>
            <th class="num">Sess.</th><th class="num">kWh</th>
            <th class="num">Gesamt</th><th class="num">Ø €/kWh</th>
            <th class="num">Zeit-Sess</th><th class="num">Vermeidbar</th>
            <th>${MONTHS_N}-Mon-Verlauf</th>
          </tr></thead>
          <tbody>
          ${drivers.map((d,i) => {
            const veh = driverVehMap[d.key] || [];
            const isWarn = d.vermeidbar / d.eur > 0.15;
            return `<tr>
              <td class="rank rank-${i<3?i+1:'x'}">${i+1}</td>
              <td><b>${d.key}</b><br/><small class="muted">${[...new Set(d.rows.map(s=>s.g))].join(' / ')}</small></td>
              <td>${veh.map(k=>`<span class="badge">${k}</span>`).join(' ')}</td>
              <td class="num">${d.n}</td>
              <td class="num">${num(d.kwh, 0)}</td>
              <td class="num"><b>${eu(d.eur)}</b></td>
              <td class="num">${d.kwh > 0 ? kwhp(d.avg_eur_kwh, 3) : '—'}</td>
              <td class="num">${d.zeit_n || '—'}</td>
              <td class="num">${d.vermeidbar > 0 ? `<b style="color:${isWarn?'var(--warn)':'var(--ink)'};">${eu(d.vermeidbar)}</b><br/><small class="muted">${pct(d.vermeidbar/d.eur)}</small>` : '<span class="muted">0</span>'}</td>
              <td>${driverSpark(d)}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    `;
    host.innerHTML = html;
  }

  // ============================================================================
  // STANDORTE
  // ============================================================================
  function renderStandorte(host) {
    const stations = byField('st').filter(s => s.key);
    const stationsByCountry = {};
    for (const s of stations) {
      const country = s.rows[0].c;
      stationsByCountry[country] ??= [];
      stationsByCountry[country].push({ ...s, country });
    }
    // Find expensive stations
    const expensive = [...stations.filter(s=>s.kwh > 0)].sort((a,b) => b.avg_eur_kwh - a.avg_eur_kwh).slice(0, 10);
    // Find zeit-tariff stations
    const zeitStations = stations.filter(s => s.zeit_n > 0).sort((a,b) => b.zeit_eur - a.zeit_eur);

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Standorte</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;"><b>${stations.length}</b> unterschiedliche Tesla-Supercharger-Stationen über ${Object.keys(stationsByCountry).length} Länder</p>

      <div class="kpis">
        <div class="kpi hi">
          <div class="label">Stationen gesamt</div>
          <div class="val">${stations.length}</div>
          <div class="extra">unique über ${MONATE_TXT}</div>
        </div>
        <div class="kpi">
          <div class="label">Meistbesucht</div>
          <div class="val" style="font-size:20px;">${stations[0].key.split(',')[0]}</div>
          <div class="extra">${stations[0].n} Sessions · ${eu(stations[0].eur)}</div>
        </div>
        <div class="kpi">
          <div class="label">Teuerstes pro kWh</div>
          <div class="val" style="font-size:20px;">${expensive[0].key.split(',')[0]}</div>
          <div class="extra">${kwhp(expensive[0].avg_eur_kwh)} €/kWh</div>
        </div>
        <div class="kpi warn">
          <div class="label">Zeit-Tarif-Standorte</div>
          <div class="val">${zeitStations.length}</div>
          <div class="extra">${eu(sumBy(zeitStations, s=>s.zeit_eur))} an vermeidbaren Kosten</div>
        </div>
        <div class="kpi">
          <div class="label">Top-3 Anteil</div>
          <div class="val">${pct((stations[0].eur+stations[1].eur+stations[2].eur)/STATS.eur)}</div>
          <div class="extra">vom Lade-Volumen</div>
        </div>
        <div class="kpi">
          <div class="label">Einmalig</div>
          <div class="val">${stations.filter(s=>s.n===1).length}</div>
          <div class="extra">nur 1× besucht (Reise-Strecken)</div>
        </div>
      </div>

      <div class="grid-12">
        <div class="card">
          <div class="card-h"><h3>Top-20 nach Häufigkeit</h3><span class="h-sub">Stamm-Stationen der Flotte</span></div>
          <table class="dt">
            <thead><tr><th>#</th><th>Standort</th><th>L</th><th class="num">Sess.</th><th class="num">kWh</th><th class="num">€</th><th class="num">Ø €/kWh</th><th class="num">Anteil</th></tr></thead>
            <tbody>
            ${stations.slice(0,20).sort((a,b)=>b.n-a.n).map((s,i) => `<tr>
              <td class="rank rank-${i<3?i+1:'x'}">${i+1}</td>
              <td>${s.key.replace(/,\\s*(Austria|Germany|Czech Republic|Slovenia|Italy|Hungary|Croatia)/, '')}</td>
              <td><span class="badge country">${s.rows[0].c}</span></td>
              <td class="num"><b>${s.n}</b></td>
              <td class="num">${num(s.kwh, 0)}</td>
              <td class="num">${eu(s.eur)}</td>
              <td class="num">${s.avg_eur_kwh > 0 ? kwhp(s.avg_eur_kwh) : '—'}</td>
              <td><div class="bar yellow" style="width:60px;"><i style="width:${(s.n/stations[0].n*100).toFixed(0)}%"></i></div></td>
            </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="card warn">
          <div class="card-h"><h3>Zeit-Tarif-Stationen</h3><span class="h-sub">vermeidbar wenn möglich</span></div>
          ${zeitStations.length ? `
          <table class="dt">
            <thead><tr><th>Standort</th><th class="num">Sess.</th><th class="num">€ verloren</th></tr></thead>
            <tbody>
            ${zeitStations.slice(0,10).map(s => `<tr>
              <td>${s.key.replace(/,\\s*(Austria|Germany|Czech Republic|Slovenia|Italy|Hungary|Croatia)/, '')}<br/><span class="badge country">${s.rows[0].c}</span></td>
              <td class="num"><b>${s.zeit_n}</b></td>
              <td class="num"><b style="color:var(--warn);">${eu(s.zeit_eur)}</b></td>
            </tr>`).join('')}
            </tbody>
          </table>
          ` : '<div class="empty">Keine Zeit-Tarif-Sessions im Datenraum</div>'}
        </div>
      </div>

      <!-- By country -->
      <div class="card">
        <div class="card-h"><h3>Stationen nach Land</h3><span class="h-sub">Verteilung &amp; durchschnittliche Tarife</span></div>
        <table class="dt">
          <thead><tr><th>Land</th><th class="num">Stationen</th><th class="num">Sessions</th><th class="num">kWh</th><th class="num">Gesamt €</th><th class="num">Ø €/kWh</th><th>Top-Standort</th></tr></thead>
          <tbody>
          ${Object.entries(stationsByCountry).sort((a,b)=>b[1].reduce((x,s)=>x+s.eur,0)-a[1].reduce((x,s)=>x+s.eur,0)).map(([c, list]) => {
            const top = [...list].sort((a,b)=>b.n-a.n)[0];
            const totalEur = sumBy(list, s=>s.eur);
            const totalSess = sumBy(list, s=>s.n);
            const totalKwh = sumBy(list, s=>s.kwh);
            return `<tr>
              <td><span class="badge country">${c}</span> <b>${COUNTRY_NAMES[c]}</b></td>
              <td class="num"><b>${list.length}</b></td>
              <td class="num">${totalSess}</td>
              <td class="num">${num(totalKwh, 0)}</td>
              <td class="num"><b>${eu(totalEur)}</b></td>
              <td class="num">${totalKwh > 0 ? (totalEur/totalKwh).toFixed(3) : '—'}</td>
              <td>${top.key.replace(/,\\s*(Austria|Germany|Czech Republic|Slovenia|Italy|Hungary|Croatia)/, '')} <span class="muted small">(${top.n}×)</span></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    `;
    host.innerHTML = html;
  }

  // ============================================================================
  // BLOCKIER-KOSTEN
  // ============================================================================
  function renderBlockier(host) {
    const zeitSess = SESSIONS.filter(s => s.kd === 'zeit');
    const idleRows = IDLE_PENALTIES;
    const totalZeit = sumBy(zeitSess, s=>s.eu);            // brutto
    const totalLade = sumBy(zeitSess, s=>s.lv||0);         // echte Ladezeit, Tarif
    const totalStand = sumBy(zeitSess, s=>s.sv||0);        // Standzeit, vermeidbar
    const totalIdle = sumBy(idleRows, r=>r.eu);
    const totalVermeidbar = totalZeit + totalIdle;

    // By driver: collect zeit + idle
    const driverData = {};
    for (const s of zeitSess) {
      const f = s.f;
      driverData[f] ??= { name:f, kfz:new Set(), zeit_n:0, zeit_eur:0, zeit_min:0, idle_n:0, idle_eur:0, idle_min:0, stations:{} };
      driverData[f].kfz.add(s.k);
      driverData[f].zeit_n++;
      driverData[f].zeit_eur += s.eu;
      driverData[f].zeit_min += (s.dm || s.im || 0);
      driverData[f].stations[s.st] = (driverData[f].stations[s.st] || 0) + 1;
    }
    for (const r of idleRows) {
      const f = r.f;
      driverData[f] ??= { name:f, kfz:new Set(), zeit_n:0, zeit_eur:0, zeit_min:0, idle_n:0, idle_eur:0, idle_min:0, stations:{} };
      driverData[f].kfz.add(r.k);
      driverData[f].idle_n++;
      driverData[f].idle_eur += r.eu;
      driverData[f].idle_min += r.mn;
      driverData[f].stations[r.st] = (driverData[f].stations[r.st] || 0) + 1;
    }
    const driverList = Object.values(driverData).map(d => ({
      ...d,
      kfz: [...d.kfz],
      total_eur: d.zeit_eur + d.idle_eur,
      topStation: Object.entries(d.stations).sort((a,b)=>b[1]-a[1])[0]
    })).sort((a,b) => b.total_eur - a.total_eur);

    // Monthly trend of zeit costs
    const monthlyZeit = MONTHS.map(m => ({
      key:m, label:MONTH_SHORT[m],
      eur: sumBy(zeitSess.filter(s=>s.m===m), s=>s.eu) + sumBy(idleRows.filter(r=>r.m===m), r=>r.eu),
      n: zeitSess.filter(s=>s.m===m).length + idleRows.filter(r=>r.m===m).length
    }));

    // Stations with zeit
    const zeitStations = {};
    for (const s of zeitSess) {
      zeitStations[s.st] ??= { name:s.st, country:s.c, n:0, eur:0, drivers:new Set() };
      zeitStations[s.st].n++;
      zeitStations[s.st].eur += s.eu;
      zeitStations[s.st].drivers.add(s.f);
    }
    const zeitStationList = Object.values(zeitStations).map(s => ({...s, drivers:[...s.drivers]})).sort((a,b)=>b.eur-a.eur);

    // When do zeit sessions happen? Heatmap
    const heatGrid = Array(7).fill(0).map(()=>Array(24).fill(0).map(()=>({n:0,eur:0})));
    for (const s of zeitSess) {
      if (s.h == null || s.wd == null) continue;
      const wd = s.wd === 0 ? 6 : s.wd - 1;
      heatGrid[wd][s.h].n++;
      heatGrid[wd][s.h].eur += s.eu;
    }

    let html = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Standzeiten &amp; Minutenpositionen</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">nach Ladezeit abgerechnete Positionen · wie viel davon wirklich vermeidbar ist</p>

      <div class="alert-box info">
        <div class="icon">i</div>
        <div class="body">
          <h4 style="font-size:19px;">Von ${eu(totalZeit + totalIdle)} Minutenkosten sind <b>${eu(totalStand + totalIdle)}</b> vermeidbar</h4>
          <p>
            Die ${zeitSess.length} Minutenpositionen (DKV-Codes 0965/0966, 0 kWh) sahen zunächst nach
            Blockiergebühren aus. Geprüft an den Rechnungen am 04.11.2026 sind sie es überwiegend nicht:
            sie kosten durchgehend rund <b>0,09 €/Minute</b> und liegen bei 475 von 486 Positionen neben
            einer Energiezeile derselben Ladung. Rechnet man die geladene Energie auf die Minuten um,
            ergibt sich eine Ladeleistung mit dem <b>Median von 58 kW</b> — die Minuten sind also
            überwiegend die <b>echte Ladedauer</b> und Bestandteil des DKV-Tarifs.<br>
            Aufgeteilt: <b>${eu(totalLade)}</b> Ladezeit (nicht vermeidbar, zählt im Reiter Effizienz
            beim effektiven Preis je kWh mit) und <b>${eu(totalStand)}</b> Standzeit über der benötigten
            Ladedauer. Dazu ${idleRows.length} Tesla-Überlastungsgebühren à ${eu(totalIdle)} — die sind
            echte Strafen und voll vermeidbar.
          </p>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi warn">
          <div class="label">Standzeit (vermeidbar)</div>
          <div class="val">${eu(totalStand)}</div>
          <div class="extra">${pct(totalStand/STATS.eur)} der Ladekosten</div>
        </div>
        <div class="kpi">
          <div class="label">Ladezeit (Tarif)</div>
          <div class="val">${eu(totalLade)}</div>
          <div class="extra">nicht vermeidbar · ${zeitSess.length} Positionen</div>
        </div>
        <div class="kpi warn">
          <div class="label">Blockier-Gebühren</div>
          <div class="val">${eu(totalIdle)}</div>
          <div class="extra">${idleRows.length} Vorfälle · Idle &gt; 5 min</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Zeit-Sess</div>
          <div class="val">${(totalZeit/zeitSess.length).toFixed(2)}<span class="u">€/Sess</span></div>
          <div class="extra">~ ${(totalZeit/zeitSess.length/0.40).toFixed(1)}× teurer als kWh-Tarif</div>
        </div>
        <div class="kpi">
          <div class="label">Betroffene Fahrer</div>
          <div class="val">${driverList.length}</div>
          <div class="extra">von ${STATS.drivers} aktiven</div>
        </div>
        <div class="kpi">
          <div class="label">Top-Standort</div>
          <div class="val" style="font-size:18px;">${zeitStationList[0]?.name?.split(',')[0] || '—'}</div>
          <div class="extra">${zeitStationList[0] ? eu(zeitStationList[0].eur)+' verloren' : '—'}</div>
        </div>
        <div class="kpi good">
          <div class="label">Trend</div>
          <div class="val">↘ ${pct((monthlyZeit[0].eur - monthlyZeit[monthlyZeit.length-1].eur)/monthlyZeit[0].eur)}</div>
          <div class="extra">Dez ${eu(monthlyZeit[0].eur)} → Mai ${eu(monthlyZeit[monthlyZeit.length-1].eur)}</div>
        </div>
      </div>

      <!-- Monthly trend -->
      <div class="card accent">
        <div class="card-h"><h3>Monatsverlauf der Blockier-/Zeit-Kosten</h3><span class="h-sub">Tendenz fallend — Fahrer optimieren ihr Verhalten</span></div>
        <div class="chart-wrap">
          ${svgBars(monthlyZeit.map(m => ({ label:m.label, value:m.eur, sublabel: m.n+' sess' })), {
            width:1200, height:220, barColor:'#c0392b', format:v=>'€'+Math.round(v)
          })}
        </div>
      </div>

      <!-- Driver ranking -->
      <div class="card">
        <div class="card-h"><h3>Verursacher-Ranking</h3><span class="h-sub">welche Fahrer Blockier-/Zeit-Kosten verursachen</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Fahrer</th><th>Fahrzeug</th>
            <th class="num">Zeit-Sess</th><th class="num">Zeit-€</th>
            <th class="num">Idle-Sess</th><th class="num">Idle-€</th>
            <th class="num">Verloren ges.</th><th>Top-Verursacher-Station</th>
          </tr></thead>
          <tbody>
          ${driverList.map((d,i) => `<tr>
            <td class="rank rank-${i<3?i+1:'x'}">${i+1}</td>
            <td><b>${d.name}</b></td>
            <td>${d.kfz.map(k=>`<span class="badge">${k}</span>`).join(' ')}</td>
            <td class="num">${d.zeit_n || '—'}</td>
            <td class="num">${d.zeit_eur > 0 ? '<b>'+eu(d.zeit_eur)+'</b>' : '—'}</td>
            <td class="num">${d.idle_n || '—'}</td>
            <td class="num">${d.idle_eur > 0 ? '<b>'+eu(d.idle_eur)+'</b>' : '—'}</td>
            <td class="num"><b style="color:var(--warn);font-size:15px;">${eu(d.total_eur)}</b></td>
            <td>${d.topStation ? `${d.topStation[0].replace(/,\\s*(Austria|Germany|.*?)$/, '')} <span class="muted">(${d.topStation[1]}×)</span>` : '—'}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Station ranking -->
      <div class="grid-12">
        <div class="card">
          <div class="card-h"><h3>Stationen mit Zeit-Tarif</h3><span class="h-sub">Wo entstehen die Verluste?</span></div>
          <table class="dt">
            <thead><tr><th>Standort</th><th>L</th><th class="num">Sess.</th><th class="num">€</th><th>Fahrer</th></tr></thead>
            <tbody>
            ${zeitStationList.map(s => `<tr>
              <td><b>${s.name.replace(/,\\s*(Austria|Germany|.*?)$/, '')}</b></td>
              <td><span class="badge country">${s.country}</span></td>
              <td class="num"><b>${s.n}</b></td>
              <td class="num"><b style="color:var(--warn);">${eu(s.eur)}</b></td>
              <td class="small">${s.drivers.join(', ')}</td>
            </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-h"><h3>Zeit-Sessions · Heatmap</h3><span class="h-sub">Wann passieren sie?</span></div>
          <div style="overflow-x:auto;">${svgHeatmap(heatGrid, { cellSize: 26 })}</div>
          <div class="small muted" style="margin-top:6px;">Zahlen = Anzahl Zeit-Sessions in der Stunde / am Tag</div>
        </div>
      </div>

      <!-- All zeit sessions list -->
      <div class="card">
        <div class="card-h"><h3>Alle Zeit-Tarif-Sessions im Detail</h3><span class="h-sub">${zeitSess.length} Einträge · chronologisch</span></div>
        <table class="dt">
          <thead><tr><th>Datum</th><th>Standort</th><th>L</th><th>Fzg</th><th>Fahrer</th><th class="num">Dauer</th><th class="num">€</th></tr></thead>
          <tbody>
          ${zeitSess.sort((a,b)=>(b.s||'').localeCompare(a.s||'')).slice(0, 50).map(s => `<tr>
            <td><b>${s.s ? s.s.slice(8,10)+'.'+s.s.slice(5,7)+'.'+s.s.slice(2,4) : '—'}</b></td>
            <td>${s.st || '—'}</td>
            <td><span class="badge country">${s.c}</span></td>
            <td><b>${s.k}</b></td>
            <td>${s.f}</td>
            <td class="num">${s.dm ? s.dm+' min' : (s.im ? s.im+' min' : '—')}</td>
            <td class="num"><b>${eu(s.eu)}</b></td>
          </tr>`).join('')}
          </tbody>
        </table>
        ${zeitSess.length > 50 ? `<div class="small muted" style="margin-top:8px;">Zeigt die 50 neuesten von ${zeitSess.length}</div>` : ''}
      </div>
    `;
    host.innerHTML = html;
  }

  // ============================================================================
  // INIT & TAB SWITCHING
  // ============================================================================
  function init() {
    // Update masthead stats
    document.getElementById('ms-sessions').textContent = STATS.n;
    document.getElementById('ms-eur').textContent = eu(STATS.eur);
    document.getElementById('ms-kwh').textContent = num(STATS.kwh, 0);
    document.getElementById('ms-period').textContent = PERIOD_SHORT;

    // Badge fuer Standzeiten. Zeigt NUR die Standzeit (Feld sv), nicht die
    // Bruttosumme der Minutenpositionen - der groessere Teil davon ist echte
    // Ladezeit und damit Tarifbestandteil (Korrektur 04.11.2026).
    const standEur = sumBy(SESSIONS, s=>s.sv||0) + sumBy(IDLE_PENALTIES, r=>r.eu);
    document.getElementById('badge-blockier').textContent =
      (standEur / STATS.eur * 100).toFixed(0) + ' %';

    // Badge fuer Effizienz - Anteil der vermeidbaren Kosten
    const eBadge = document.getElementById('badge-effizienz');
    if (eBadge && window.LC_ANALYSE) {
      eBadge.textContent = (window.LC_ANALYSE.gesamt.vermeidbar_quote * 100).toFixed(0) + ' %';
      eBadge.classList.remove('live');
    }

    // Badge fuer Ausland - Anteil der Auslandskosten an den Gesamtkosten
    const aBadge = document.getElementById('badge-ausland');
    if (aBadge) {
      const ausEur = sumBy(SESSIONS.filter(s => s.c && s.c !== 'AT'), s => s.eu);
      aBadge.textContent = STATS.eur ? (ausEur / STATS.eur * 100).toFixed(0) + ' %' : '—';
    }


    // Tab switching
    const tabs = document.querySelectorAll('.tab-nav button');
    const sections = document.querySelectorAll('.tab-section');
    let renderedTabs = new Set();

    function renderTab(tab) {
      if (renderedTabs.has(tab)) return;
      const host = document.getElementById('tab-' + tab);
      switch(tab) {
        case 'uebersicht': window.LCApp.renderUebersicht(host); break;
        case 'detail':     window.LCApp.renderDetail(host); break;
        case 'monat':      window.LCApp.renderMonat(host); break;
        case 'quartal':    window.LCApp.renderQuartal(host); break;
        case 'fahrzeuge':  renderFahrzeuge(host); break;
        case 'fahrer':     renderFahrer(host); break;
        case 'standorte':  window.LCApp.renderStandorte(host); break;
        case 'ausland':    window.LCApp.renderAusland(host); break;
        case 'blockier':   renderBlockier(host); break;
        case 'effizienz':  window.LCApp.renderEffizienz(host); break;
        case 'tipps':      window.LCApp.renderTipps(host); break;
      }
      renderedTabs.add(tab);
      // Universelle Tab-Suche an alle Tabs außer dem Detail-Tab (hat eigene Filter) anhängen
      if (tab !== 'detail' && window.LCApp.attachTabSearch) {
        window.LCApp.attachTabSearch(host);
      }
    }

    function activateTab(tab) {
      tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      sections.forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
      renderTab(tab);
      window.scrollTo({top:0, behavior:'instant'});
    }

    tabs.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));

    // Initial render
    renderTab('uebersicht');
  }

  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, {
    init, renderFahrzeuge, renderFahrer, renderStandorte, renderBlockier
  });
})();
