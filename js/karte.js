// Lucky Car Ladestatistik · Reiter Standorte — Karte Österreich
// Ersetzt renderStandorte aus tabs2.js (wird nach tabs2.js geladen).
(function(){
  const D = window.LCData;
  const { SESSIONS, eu, num, pct, sumBy, byField } = D;
  const GEO   = window.GEO_AT || {};
  const UMRISS = window.GEO_AT_UMRISS || [];
  const BL_NAME = window.GEO_AT_BL || {};

  const AT = SESSIONS.filter(s => s.c === 'AT');

  // ---- Projektion: Breiten-/Längengrad -> SVG ----
  function projektor(w, h, rand) {
    const lons = UMRISS.map(p => p[0]), lats = UMRISS.map(p => p[1]);
    const lo0 = Math.min(...lons), lo1 = Math.max(...lons);
    const la0 = Math.min(...lats), la1 = Math.max(...lats);
    // Längengrade schrumpfen mit der Breite — sonst wird Österreich zu breit
    const kx = Math.cos((la0 + la1) / 2 * Math.PI / 180);
    const bw = (lo1 - lo0) * kx, bh = (la1 - la0);
    const k = Math.min((w - 2*rand) / bw, (h - 2*rand) / bh);
    const ox = (w - bw * k) / 2, oy = (h - bh * k) / 2;
    return (lon, lat) => [ox + (lon - lo0) * kx * k, oy + (la1 - lat) * k];
  }

  function karte(orte, w, h) {
    const p = projektor(w, h, 14);
    const pfad = UMRISS.map((pt, i) => (i ? 'L' : 'M') + p(pt[0], pt[1]).map(v => v.toFixed(1)).join(' ')).join(' ') + ' Z';
    const max = Math.max(...orte.map(o => o.eur), 1);
    // Flächentreue Skalierung: Radius ~ Wurzel des Betrags
    const r = v => 3 + 26 * Math.sqrt(v / max);
    const farbe = v => {
      const t = Math.pow(v / max, 0.45);
      return `rgba(255, ${Math.round(229 - 150*t)}, 0, ${(0.35 + 0.55*t).toFixed(2)})`;
    };
    let svg = `<svg viewBox="0 0 ${w} ${h}" class="chart" style="width:100%;height:auto;">`;
    svg += `<path d="${pfad}" fill="var(--surface-2,#17181d)" stroke="var(--rule,#2a2c33)" stroke-width="1.4"/>`;
    // größte zuletzt zeichnen wäre falsch — große zuerst, damit kleine obenauf sichtbar bleiben
    const sortiert = [...orte].sort((a, b) => b.eur - a.eur);
    for (const o of sortiert) {
      const [x, y] = p(o.lon, o.lat);
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r(o.eur).toFixed(1)}"`
           + ` fill="${farbe(o.eur)}" stroke="#0d0d0d" stroke-width="0.9">`
           + `<title>${o.ort} · ${o.n} Ladungen · ${eu(o.eur)} · ${num(o.kwh,0)} kWh</title></circle>`;
    }
    // Beschriftung der teuersten Orte, aber nur wenn sie sich nicht ueberlappen
    // (im Wiener Becken liegen die Orte sonst uebereinander).
    const gesetzt = [];
    for (const o of sortiert.slice(0, 18)) {
      const [x, y] = p(o.lon, o.lat);
      const ty = y - (r(o.eur) + 5);
      const breite = o.ort.length * 6.2;
      const kollision = gesetzt.some(g =>
        Math.abs(g.x - x) < (g.breite + breite) / 2 && Math.abs(g.y - ty) < 13);
      if (kollision) continue;
      gesetzt.push({ x, y: ty, breite });
      svg += `<text x="${x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle"`
           + ` font-family="Roboto Condensed" font-size="12" font-weight="700"`
           + ` fill="var(--ink,#f0f0f2)" style="paint-order:stroke;stroke:#0d0d0d;stroke-width:3px;">`
           + `${o.ort}</text>`;
    }
    svg += `</svg>`;
    return svg;
  }

  function renderStandorte(host) {
    // ---- nach Ort verdichten ----
    const proOrt = {};
    let ohneOrt = { n: 0, eur: 0 };
    for (const s of AT) {
      if (!s.o || !GEO[s.o]) { ohneOrt.n++; ohneOrt.eur += s.eu; continue; }
      (proOrt[s.o] ??= { ort: s.o, lat: GEO[s.o][0], lon: GEO[s.o][1], bl: GEO[s.o][2],
                         n: 0, eur: 0, kwh: 0, punkte: new Set(), fzg: new Set() });
      const o = proOrt[s.o];
      o.n++; o.eur += s.eu; o.kwh += s.kw;
      o.punkte.add(s.st); if (s.k) o.fzg.add(s.k);
    }
    const orte = Object.values(proOrt).sort((a, b) => b.eur - a.eur);
    const atEur = sumBy(AT, s => s.eu);

    // ---- nach Bundesland ----
    const proBL = {};
    for (const o of orte) {
      (proBL[o.bl] ??= { bl: o.bl, n: 0, eur: 0, kwh: 0, orte: 0 });
      proBL[o.bl].n += o.n; proBL[o.bl].eur += o.eur; proBL[o.bl].kwh += o.kwh; proBL[o.bl].orte++;
    }
    const laender = Object.values(proBL).sort((a, b) => b.eur - a.eur);

    // ---- Ladepunkte (einzelne Station) ----
    const punkte = byField('st', AT).filter(x => x.key && x.key !== '(?)');

    let html = `
      <div style="margin-bottom:18px;">
        <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Standorte Österreich</h1>
        <p style="margin:0;color:var(--ink-3);font-size:14px;">
          Wo wird geladen · ${orte.length} Orte · ${punkte.length} Ladepunkte · ${eu(atEur)}
        </p>
      </div>

      <div class="kpis">
        <div class="kpi hi">
          <div class="label">Ladekosten Österreich</div>
          <div class="val">${eu(atEur)}</div>
          <div class="extra">${AT.length} Positionen</div>
        </div>
        <div class="kpi">
          <div class="label">Orte</div>
          <div class="val">${orte.length}</div>
          <div class="extra">in ${laender.length} Bundesländern</div>
        </div>
        <div class="kpi">
          <div class="label">Ladepunkte</div>
          <div class="val">${punkte.length}</div>
          <div class="extra">einzelne Stationen</div>
        </div>
        <div class="kpi">
          <div class="label">Spitzenreiter</div>
          <div class="val" style="font-size:24px;">${orte[0] ? orte[0].ort : '—'}</div>
          <div class="extra">${orte[0] ? eu(orte[0].eur) + ' · ' + pct(orte[0].eur / atEur) : ''}</div>
        </div>
        <div class="kpi">
          <div class="label">Stärkstes Bundesland</div>
          <div class="val" style="font-size:24px;">${laender[0] ? (BL_NAME[laender[0].bl] || laender[0].bl) : '—'}</div>
          <div class="extra">${laender[0] ? eu(laender[0].eur) : ''}</div>
        </div>
        <div class="kpi">
          <div class="label">Ø Preis Österreich</div>
          <div class="val">${sumBy(AT,s=>s.kw) > 0 ? (atEur / sumBy(AT,s=>s.kw)).toFixed(2) : '—'}<span class="u">€/kWh</span></div>
          <div class="extra">inkl. Ladezeit-Tarife</div>
        </div>
      </div>

      <!-- KARTE -->
      <div class="card accent">
        <div class="card-h">
          <h3>Ladekosten nach Ort</h3>
          <span class="h-sub">Kreisfläche = Kosten · Maus über einen Kreis zeigt die Details</span>
          <span class="h-meta">MAX € ${orte[0] ? orte[0].eur.toFixed(0) : 0}</span>
        </div>
        <div class="chart-wrap">${karte(orte, 1000, 620)}</div>
      </div>

      <!-- BUNDESLÄNDER -->
      <div class="card">
        <div class="card-h"><h3>Nach Bundesland</h3><span class="h-sub">${laender.length} von 9</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Bundesland</th><th class="num">Orte</th><th class="num">Ladungen</th>
            <th class="num">kWh</th><th class="num">Kosten €</th><th class="num">Ø €/kWh</th><th class="num">Anteil</th>
          </tr></thead>
          <tbody>
          ${laender.map((l, i) => `<tr>
            <td class="rank rank-${i < 3 ? i + 1 : 'x'}">${i + 1}</td>
            <td><b>${BL_NAME[l.bl] || l.bl}</b></td>
            <td class="num">${l.orte}</td>
            <td class="num">${l.n}</td>
            <td class="num">${num(l.kwh, 0)}</td>
            <td class="num"><b>${eu(l.eur)}</b></td>
            <td class="num">${l.kwh > 0 ? (l.eur / l.kwh).toFixed(3) : '—'}</td>
            <td class="num">${pct(l.eur / atEur)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- ORTE -->
      <div class="card">
        <div class="card-h"><h3>Orte im Detail</h3><span class="h-sub">nach Kosten</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Ort</th><th>Bundesland</th><th class="num">Ladungen</th><th class="num">kWh</th>
            <th class="num">Kosten €</th><th class="num">Ø €/kWh</th><th class="num">Anteil</th>
            <th class="num">Ladepunkte</th><th class="num">Fahrzeuge</th>
          </tr></thead>
          <tbody>
          ${orte.map((o, i) => `<tr>
            <td class="rank rank-${i < 3 ? i + 1 : 'x'}">${i + 1}</td>
            <td><b>${o.ort}</b></td>
            <td class="small">${BL_NAME[o.bl] || o.bl}</td>
            <td class="num">${o.n}</td>
            <td class="num">${num(o.kwh, 0)}</td>
            <td class="num"><b>${eu(o.eur)}</b></td>
            <td class="num">${o.kwh > 0 ? (o.eur / o.kwh).toFixed(3) : '—'}</td>
            <td class="num">${pct(o.eur / atEur)}</td>
            <td class="num">${o.punkte.size}</td>
            <td class="num">${o.fzg.size}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- LADEPUNKTE -->
      <div class="card">
        <div class="card-h"><h3>Einzelne Ladepunkte</h3><span class="h-sub">${punkte.length} Stationen</span></div>
        <table class="dt">
          <thead><tr>
            <th>#</th><th>Ladepunkt</th><th class="num">Ladungen</th><th class="num">kWh</th>
            <th class="num">Kosten €</th><th class="num">Ø €/kWh</th>
          </tr></thead>
          <tbody>
          ${punkte.map((x, i) => `<tr>
            <td class="rank rank-${i < 3 ? i + 1 : 'x'}">${i + 1}</td>
            <td class="small">${x.key}</td>
            <td class="num">${x.n}</td>
            <td class="num">${num(x.kwh, 0)}</td>
            <td class="num"><b>${eu(x.eur)}</b></td>
            <td class="num">${x.kwh > 0 ? x.avg_eur_kwh.toFixed(3) : '—'}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card info">
        <div class="card-h"><h3>Zur Lesart</h3></div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--ink-3);line-height:1.7;">
          <li>Die Karte zeigt nur <b>Österreich</b>. Auslandsladungen stehen im Reiter <b>Ausland</b>.</li>
          <li><b>Kreisfläche</b> entspricht den Kosten (Radius = Wurzel des Betrags), damit große Orte kleine nicht optisch erschlagen.</li>
          <li>DKV druckt den Ladeort nur rund 10 Zeichen breit. Die Fragmente werden über ein Ortsverzeichnis
              zurückgeführt (<code>js/geo_at.js</code>).
              ${ohneOrt.n ? `Nicht zuordenbar bleiben <b>${ohneOrt.n} Positionen</b> über ${eu(ohneOrt.eur)}
              (${pct(ohneOrt.eur / atEur)}); sie fehlen in Karte und Tabellen.` : 'Aktuell ist alles zugeordnet.'}</li>
          <li>Staatsgrenze: Natural Earth (<i>ne_50m_admin_0_countries</i>, Public Domain), auf ${UMRISS.length} Punkte vereinfacht.</li>
        </ul>
      </div>
    `;
    host.innerHTML = html;
  }

  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, { renderStandorte });
})();
