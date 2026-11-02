// Lucky Car Ladestatistik · Auslands-Ladekosten
// Alle Ladevorgaenge ausserhalb Oesterreichs: welches Fahrzeug, welcher
// Mitarbeiter, wo, in welchem Monat, wie viel.
(function(){
  const D = window.LCData;
  const {
    SESSIONS, MONTHS, MONTH_LABELS, MONTH_SHORT, COUNTRY_NAMES,
    eu, num, pct, sumBy, groupBy, aggregate, withAvg, byField,
    svgStackedBars
  } = D;

  const HEIMAT = 'AT';
  const LAND_FARBE = {
    DE:'#1e5a9e', IT:'#c0392b', CZ:'#8a4a8a', SI:'#1f7a3c',
    HU:'#e87a30', HR:'#2b9ea8', SK:'#b8860b', CH:'#d14d4d',
    PL:'#6a7fb5', FR:'#4a6fa5', NL:'#e0892a', BE:'#7a5c9e', LU:'#5c8a5c'
  };
  const farbe = c => LAND_FARBE[c] || '#888';
  const landName = c => COUNTRY_NAMES[c] || c || '—';

  const AUS = SESSIONS.filter(s => s.c && s.c !== HEIMAT);
  const GESAMT_EUR = sumBy(SESSIONS, s => s.eu);

  // Monate, in denen es ueberhaupt Auslandsladungen gab
  const AUS_MONATE = MONTHS.filter(m => AUS.some(s => s.m === m));

  function eurOderStrich(v) {
    return v ? eu(v) : '<span class="muted">–</span>';
  }

  function renderAusland(host) {
    if (!AUS.length) {
      host.innerHTML = `
        <div style="margin-bottom:18px;">
          <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Auslands-Ladekosten</h1>
          <p style="margin:0;color:var(--ink-3);font-size:14px;">Alle Ladevorgaenge ausserhalb Österreichs</p>
        </div>
        <div class="card"><p style="margin:0;color:var(--ink-3);">Im erfassten Zeitraum gibt es keine Ladungen ausserhalb Österreichs.</p></div>`;
      return;
    }

    const aus_eur = sumBy(AUS, s => s.eu);
    const aus_kwh = sumBy(AUS, s => s.kw);
    const laender = byField('c', AUS);
    const fahrzeuge = byField('k', AUS);
    const fahrerListe = byField('f', AUS);

    // ---- Monatsverlauf, gestapelt nach Land ----
    const trend = AUS_MONATE.map(m => {
      const rows = AUS.filter(s => s.m === m);
      const segs = laender
        .map(l => ({ land: l.key, value: sumBy(rows.filter(s => s.c === l.key), s => s.eu) }))
        .filter(s => s.value > 0)
        .map(s => ({ value: s.value, color: farbe(s.land), label: s.land }));
      return { label: MONTH_SHORT[m] || m, segments: segs,
               summe: sumBy(rows, s => s.eu), n: rows.length };
    });

    // ---- Fahrzeug x Monat ----
    const fzMatrix = fahrzeuge.map(f => {
      const rows = f.rows;
      const proMonat = {};
      AUS_MONATE.forEach(m => { proMonat[m] = sumBy(rows.filter(s => s.m === m), s => s.eu); });
      const fahrerIn = [...new Set(rows.map(s => s.f).filter(Boolean))];
      const laenderIn = [...new Set(rows.map(s => s.c))].sort();
      return {
        kfz: f.key, ges: (rows[0] || {}).g || '', n: f.n, kwh: f.kwh, eur: f.eur,
        fahrer: fahrerIn, laender: laenderIn, proMonat
      };
    });

    // ---- Mitarbeiter ----
    const maListe = fahrerListe.map(f => {
      const rows = f.rows;
      return {
        name: f.key, n: f.n, kwh: f.kwh, eur: f.eur,
        kfz: [...new Set(rows.map(s => s.k).filter(Boolean))].sort(),
        laender: [...new Set(rows.map(s => s.c))].sort(),
        monate: [...new Set(rows.map(s => s.m))].sort()
      };
    });

    // ---- Einzelnachweis ----
    const einzel = [...AUS].sort((a, b) => (a.s < b.s ? 1 : a.s > b.s ? -1 : 0));
    const datum = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(2, 4) : '—';
    const uhr = iso => (iso && iso.length >= 16 && iso.slice(11, 16) !== '12:00') ? iso.slice(11, 16) : '';

    let html = `
      <div style="margin-bottom:18px;">
        <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Auslands-Ladekosten</h1>
        <p style="margin:0;color:var(--ink-3);font-size:14px;">
          Alle Ladevorgänge ausserhalb Österreichs · ${AUS_MONATE.length === 1 ? MONTH_LABELS[AUS_MONATE[0]] : (MONTH_LABELS[AUS_MONATE[0]] + ' — ' + MONTH_LABELS[AUS_MONATE[AUS_MONATE.length-1]])}
        </p>
      </div>

      <div class="kpis">
        <div class="kpi hi">
          <div class="label">Auslandskosten</div>
          <div class="val">${eu(aus_eur)}</div>
          <div class="extra">${pct(aus_eur / GESAMT_EUR)} der gesamten Ladekosten</div>
        </div>
        <div class="kpi">
          <div class="label">Energie</div>
          <div class="val">${num(aus_kwh, 0)}<span class="u">kWh</span></div>
          <div class="extra">${AUS.length} Positionen</div>
        </div>
        <div class="kpi">
          <div class="label">Länder</div>
          <div class="val">${laender.length}</div>
          <div class="extra">${laender.map(l => l.key).join(' · ')}</div>
        </div>
        <div class="kpi">
          <div class="label">Fahrzeuge</div>
          <div class="val">${fahrzeuge.length}</div>
          <div class="extra">${maListe.length} Mitarbeiter betroffen</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Preis</div>
          <div class="val">${aus_kwh > 0 ? (aus_eur / aus_kwh).toFixed(2) : '—'}<span class="u">€/kWh</span></div>
          <div class="extra">im Ausland</div>
        </div>
        <div class="kpi">
          <div class="label">Teuerstes Land</div>
          <div class="val" style="font-size:22px;">${landName(laender[0].key)}</div>
          <div class="extra">${eu(laender[0].eur)} · ${laender[0].n} Positionen</div>
        </div>
      </div>

      <!-- Monatsverlauf -->
      <div class="card accent">
        <div class="card-h">
          <h3>Monatsverlauf · nach Land</h3>
          <span class="h-sub">Kosten in € pro Lade-Monat</span>
          <span class="h-meta">MAX € ${Math.max(...trend.map(t => t.summe)).toFixed(0)}</span>
        </div>
        <div class="chart-wrap">
          ${svgStackedBars(trend, { width: 1200, height: Math.max(220, 42 * trend.length + 50), padL: 70 })}
        </div>
        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
          ${laender.map(l => `<span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:11px;height:11px;background:${farbe(l.key)};border:1px solid var(--ink);"></span>
            <b>${l.key}</b> <span class="muted">${landName(l.key)}</span></span>`).join('')}
        </div>
      </div>

      <!-- Nach Land -->
      <div class="card">
        <div class="card-h"><h3>Nach Land</h3><span class="h-sub">${laender.length} Länder</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Land</th><th class="num">Positionen</th><th class="num">kWh</th>
            <th class="num">Kosten €</th><th class="num">Ø €/kWh</th><th class="num">Anteil Ausland</th>
            <th>Fahrzeuge</th>
          </tr></thead>
          <tbody>
          ${laender.map((l, i) => {
            const kfz = [...new Set(l.rows.map(s => s.k).filter(Boolean))].sort();
            return `<tr>
              <td class="rank rank-${i < 3 ? i + 1 : 'x'}">${i + 1}</td>
              <td><span style="display:inline-flex;align-items:center;gap:7px;">
                <span style="width:11px;height:11px;background:${farbe(l.key)};border:1px solid var(--ink);"></span>
                <b>${l.key}</b> <span class="muted">${landName(l.key)}</span></span></td>
              <td class="num">${l.n}</td>
              <td class="num">${num(l.kwh, 0)}</td>
              <td class="num"><b>${eu(l.eur)}</b></td>
              <td class="num">${l.kwh > 0 ? (l.eur / l.kwh).toFixed(3) : '—'}</td>
              <td class="num">${pct(l.eur / aus_eur)}</td>
              <td class="small">${kfz.join(' · ')}</td>
            </tr>`;
          }).join('')}
          </tbody>
          <tfoot><tr style="border-top:2px solid var(--ink);font-weight:700;">
            <td></td><td><b>Summe</b></td>
            <td class="num"><b>${AUS.length}</b></td>
            <td class="num"><b>${num(aus_kwh, 0)}</b></td>
            <td class="num"><b>${eu(aus_eur)}</b></td>
            <td class="num"></td><td class="num"><b>100 %</b></td><td></td>
          </tr></tfoot>
        </table>
      </div>

      <!-- Fahrzeug x Monat -->
      <div class="card">
        <div class="card-h">
          <h3>Fahrzeug · Monat · Kosten</h3>
          <span class="h-sub">welches Fahrzeug hat wann im Ausland geladen</span>
        </div>
        <table class="dt">
          <thead><tr>
            <th>Kennzeichen</th><th>Mitarbeiter</th><th>Ges.</th><th>Länder</th>
            ${AUS_MONATE.map(m => `<th class="num">${MONTH_SHORT[m] || m}</th>`).join('')}
            <th class="num">Gesamt</th><th class="num">kWh</th>
          </tr></thead>
          <tbody>
          ${fzMatrix.map(f => `<tr>
            <td><b>${f.kfz}</b></td>
            <td class="small">${f.fahrer.join(', ') || '<span class="muted">—</span>'}</td>
            <td><span class="badge ges-${(f.ges || '').toLowerCase()}">${f.ges}</span></td>
            <td class="small">${f.laender.map(c => `<span style="color:${farbe(c)};font-weight:700;">${c}</span>`).join(' ')}</td>
            ${AUS_MONATE.map(m => `<td class="num">${eurOderStrich(f.proMonat[m])}</td>`).join('')}
            <td class="num"><b>${eu(f.eur)}</b></td>
            <td class="num">${num(f.kwh, 0)}</td>
          </tr>`).join('')}
          </tbody>
          <tfoot><tr style="border-top:2px solid var(--ink);font-weight:700;">
            <td colspan="4"><b>Summe</b></td>
            ${AUS_MONATE.map(m => `<td class="num"><b>${eurOderStrich(sumBy(AUS.filter(s => s.m === m), s => s.eu))}</b></td>`).join('')}
            <td class="num"><b>${eu(aus_eur)}</b></td>
            <td class="num"><b>${num(aus_kwh, 0)}</b></td>
          </tr></tfoot>
        </table>
      </div>

      <!-- Mitarbeiter -->
      <div class="card">
        <div class="card-h">
          <h3>Nach Mitarbeiter</h3>
          <span class="h-sub">${maListe.length} Mitarbeiter mit Auslandsladungen</span>
        </div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Mitarbeiter</th><th>Fahrzeug(e)</th><th>Länder</th>
            <th class="num">Positionen</th><th class="num">kWh</th><th class="num">Kosten €</th>
            <th class="num">Anteil</th><th>Monate</th>
          </tr></thead>
          <tbody>
          ${maListe.map((f, i) => `<tr>
            <td class="rank rank-${i < 3 ? i + 1 : 'x'}">${i + 1}</td>
            <td><b>${f.name || '(kein Fahrer hinterlegt)'}</b></td>
            <td class="small">${f.kfz.join(' · ')}</td>
            <td class="small">${f.laender.map(c => `<span style="color:${farbe(c)};font-weight:700;">${c}</span>`).join(' ')}</td>
            <td class="num">${f.n}</td>
            <td class="num">${num(f.kwh, 0)}</td>
            <td class="num"><b>${eu(f.eur)}</b></td>
            <td class="num">${pct(f.eur / aus_eur)}</td>
            <td class="small">${f.monate.map(m => MONTH_SHORT[m] || m).join(' ')}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Einzelnachweis -->
      <div class="card">
        <div class="card-h">
          <h3>Einzelnachweis</h3>
          <span class="h-sub">${einzel.length} Positionen, neueste zuerst</span>
          <span class="h-meta">Suche oben filtert diese Liste</span>
        </div>
        <table class="dt">
          <thead><tr>
            <th>Datum</th><th>Land</th><th>Ladeort</th><th>Kennzeichen</th><th>Mitarbeiter</th>
            <th>Ges.</th><th>Quelle</th><th class="num">kWh</th><th class="num">Kosten €</th><th>Art</th>
          </tr></thead>
          <tbody>
          ${einzel.map(s => `<tr>
            <td class="nowrap">${datum(s.s)}${uhr(s.s) ? ` <span class="muted">${uhr(s.s)}</span>` : ''}</td>
            <td><span style="color:${farbe(s.c)};font-weight:700;">${s.c}</span></td>
            <td class="small">${s.st || '<span class="muted">—</span>'}</td>
            <td><b>${s.k}</b></td>
            <td class="small">${s.f || '<span class="muted">—</span>'}</td>
            <td><span class="badge ges-${(s.g || '').toLowerCase()}">${s.g}</span></td>
            <td class="small">${s.src}</td>
            <td class="num">${s.kw ? num(s.kw, 1) : '<span class="muted">–</span>'}</td>
            <td class="num"><b>${eu(s.eu)}</b></td>
            <td class="small">${s.kd === 'zeit' ? 'Ladezeit' : 'Energie'}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card info">
        <div class="card-h"><h3>Zur Lesart</h3></div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--ink-3);line-height:1.7;">
          <li><b>Land</b> kommt bei Tesla aus der Spalte <i>Country</i> der Abrechnungs-CSV, bei DKV aus dem Kopf der jeweiligen Länder-Teilrechnung.</li>
          <li><b>Ladeort</b> steht bei DKV auf dem Beleg nur gekürzt (Betreibername 15, Ort 10 Zeichen) — deshalb wirken manche Ortsnamen abgeschnitten.</li>
          <li><b>Art "Ladezeit"</b> sind Positionen, die nach Standzeit statt nach Energie abgerechnet werden (DKV-Produktcodes 0965/0966). Sie haben 0 kWh und gehen in den Ø-Preis je kWh nicht ein.</li>
          <li>Eine Ladung kann als <b>zwei Positionen</b> erscheinen (Energie + Ladezeit) — so rechnet DKV ab.</li>
          <li>Beträge in Euro inkl. USt. Tschechische Rechnungen sind mit 24,70 CZK/€, ungarische mit 400 HUF/€ umgerechnet.</li>
        </ul>
      </div>
    `;
    host.innerHTML = html;
  }

  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, { renderAusland });
})();
