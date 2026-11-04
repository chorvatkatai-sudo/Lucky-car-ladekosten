// Lucky Car Ladestatistik · Reiter "Effizienz" und "Tipps"
//
// Gerechnet wird in pipeline/baue_analyse.py, hier wird nur dargestellt.
// Datenquelle: window.LC_ANALYSE (js/analyse.js).
//
// Reiter Effizienz: was haette vermieden werden koennen, wer verursacht es.
// Reiter Tipps:     was jeder einzelne Fahrer konkret anders machen soll.

(function(){
  const D = window.LCData;
  const A = window.LC_ANALYSE;
  const { eu, num, pct, pct1 } = D;
  const MS = D.MONTH_SHORT, ML = D.MONTH_LABELS;

  if (!A) { console.error('analyse.js fehlt – Reiter Effizienz/Tipps bleiben leer'); return; }

  const K = A.konstanten;
  const ct = v => (v*100).toFixed(1).replace('.', ',') + ' ct';
  const ekwh = v => v.toFixed(4).replace('.', ',') + ' €/kWh';
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ==========================================================================
  // RECHERCHIERTE TARIFE
  // Zwei Quellen: (1) der Recherchebericht "E-Auto laden in Oesterreich",
  // Stand 04.11.2026, und (2) eigene Nachrecherche vom 04.11.2026.
  // Die Spalte "Beleg" sagt, woher der Wert kommt - das ist bewusst sichtbar,
  // damit niemand eine Zahl fuer gesichert haelt, die es nicht ist.
  // ==========================================================================
  const TARIFE = [
    {a:'Lidl Plus (App)',            ac:'0,19', dc:'0,29 / HPC 0,59', fix:'Preis je Ladepunkt in der App', q:'Bericht'},
    {a:'Lidl ad hoc',                ac:'0,45', dc:'0,60 / HPC 0,65', fix:'ohne App deutlich teurer',      q:'Bericht'},
    {a:'Tesla Supercharger Off-Peak',ac:'—',    dc:'0,37',            fix:'22–08 Uhr, Mitglieder-Kategorie', q:'Nachrecherche'},
    {a:'Tesla Supercharger Peak',    ac:'—',    dc:'0,43',            fix:'08–22 Uhr, Mitglieder-Kategorie', q:'Nachrecherche'},
    {a:'Wien Energie PRO',           ac:'0,36', dc:'0,36',            fix:'29,90 €/Monat, nur Eigennetz',  q:'Bericht'},
    {a:'Wien Energie SMART',         ac:'0,40', dc:'0,40',            fix:'5,90 €/Monat, nur Eigennetz',   q:'Bericht'},
    {a:'Wien Energie GO',            ac:'0,43', dc:'0,43',            fix:'0 €/Monat, nur Eigennetz',      q:'Bericht'},
    {a:'ÖAMTC eigenes Netz',         ac:'0,44', dc:'0,54 / ab 150 kW 0,64', fix:'Belegungsentgelt beachten', q:'Bericht'},
    {a:'IONITY Go (ohne Abo)',       ac:'—',    dc:'0,66',            fix:'Mindestpreis, Station kann teurer', q:'Bericht'},
    {a:'SMATRICS Charge Simple',     ac:'0,55', dc:'0,65',            fix:'19,90 € Aktivierung + Standgebühr', q:'Bericht'},
    {a:'Wien Energie im Roaming',    ac:'0,70', dc:'0,70',            fix:'dieselbe Karte, fremdes Netz',  q:'Bericht'},
    {a:'DKV AC Stufe 1 / 2',         ac:'0,34 / 0,44', dc:'—',        fix:'in unseren Rechnungen belegt',  q:'beide'},
    {a:'DKV DC Standard / High',     ac:'—',    dc:'0,65 / 0,78',     fix:'in unseren Rechnungen belegt',  q:'beide'},
  ];

  const EC = [
    {k:'Median Ad-hoc-Preis Österreich (Jänner 2026)', v:'0,64 €/kWh'},
    {k:'davon AC', v:'0,57 €/kWh'},
    {k:'davon DC', v:'0,70 €/kWh'},
    {k:'davon ab 150 kW', v:'0,75 €/kWh'},
    {k:'Kartentarife ohne Grundgebühr, AC (Stand August 2026)', v:'0,43 – 0,55 €/kWh'},
    {k:'Kartentarife ohne Grundgebühr, DC', v:'0,43 – 0,69 €/kWh'},
  ];

  // ==========================================================================
  // Hilfsdarstellungen
  // ==========================================================================
  // Gestapelter Monatsbalken: A1 / A2 / B / C
  // Ruhige Palette: Gelbtoene fuer die Netzwahl (der grosse, nicht
  // verhaltensbedingte Teil), Blau fuers Zeitfenster, Grau fuers
  // Stehenbleiben. Bewusst KEIN Rot - es geht um Potenzial, nicht um Schuld.
  const FARBE = {A1:'#FFE500', A2:'#C9B200', B:'#6FA8DC', C:'#9A9DA4'};
  const TOPF_NAME = {
    A1:'Netzwahl – Alternative belegt',
    A2:'Netzwahl – wahrscheinlich',
    B:'Zeitfenster Peak → Off-Peak',
    C:'Stehenbleiben nach Ladeende'
  };

  function monatsChart(){
    const rows = A.je_monat;
    const W = 1200, H = 300, padL = 56, padR = 20, padT = 24, padB = 56;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = Math.max(...rows.map(r => r.vermeidbar), 1) * 1.15;
    const cw = iw / rows.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" style="width:100%;height:auto;display:block;">`;
    for (let i = 0; i <= 4; i++) {
      const y = padT + ih * i / 4;
      s += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--chart-track)" stroke-width="1" ${i===4?'':'stroke-dasharray="2 5"'}/>`;
      s += `<text x="${padL-9}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--chart-mut)">${num(max*(1-i/4),0)}</text>`;
    }
    rows.forEach((r, i) => {
      const bw = cw * 0.62, x = padL + i*cw + (cw-bw)/2;
      let yy = padT + ih;
      ['C','B','A2','A1'].forEach(t => {
        const h = (r.topf[t] / max) * ih;
        if (h <= 0.3) return;
        yy -= h;
        s += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${FARBE[t]}" stroke="#0d0d0d" stroke-width="0.8"><title>${ML[r.m]} · ${TOPF_NAME[t]}: ${eu(r.topf[t])}</title></rect>`;
      });
      s += `<text x="${(x+bw/2).toFixed(1)}" y="${(yy-7).toFixed(1)}" text-anchor="middle" font-weight="700" font-size="12.5" fill="var(--chart-ink)">${num(r.vermeidbar,0)}</text>`;
      s += `<text x="${(x+bw/2).toFixed(1)}" y="${(padT+ih+18).toFixed(1)}" text-anchor="middle" font-weight="600" font-size="12" fill="var(--chart-ink)">${MS[r.m]}</text>`;
      s += `<text x="${(x+bw/2).toFixed(1)}" y="${(padT+ih+33).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="var(--chart-mut)">${pct1(r.quote)}</text>`;
      s += `<text x="${(x+bw/2).toFixed(1)}" y="${(padT+ih+47).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--ink-4)">${ekwh(r.preis)}</text>`;
    });
    s += `</svg>`;
    return s;
  }

  function legende(){
    return `<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin-top:10px;">` +
      ['A1','A2','B','C'].map(t =>
        `<span><i style="display:inline-block;width:11px;height:11px;background:${FARBE[t]};border:1px solid #0d0d0d;vertical-align:-1px;margin-right:5px;"></i>${TOPF_NAME[t]} · <b class="mono">${eu(A.gesamt.topf[t])}</b></span>`
      ).join('') + `</div>`;
  }

  function spark(reihe){
    const vals = reihe.map(r => r.v);
    return D.svgSpark(vals, {width:86, height:22, color:'var(--ink-3)'});
  }

  // ==========================================================================
  // REITER EFFIZIENZ
  // ==========================================================================
  function renderEffizienz(host){
    const g = A.gesamt;
    const moeglich = g.ist_eur - g.vermeidbar;
    const dkv = A.betreiber.filter(b => b.via === 'DKV');
    const dkvKwh = dkv.reduce((a,b)=>a+b.kwh,0);
    const dkvEur = dkv.reduce((a,b)=>a+(b.eur_eff!=null?b.eur_eff:b.eur),0);   // inkl. Ladezeit-Minuten
    const dkvZeit = dkv.reduce((a,b)=>a+(b.zeitanteil||0),0);
    const tsl = A.betreiber.find(b => b.via === 'Tesla') || {kwh:0,eur:0,preis:0};

    let h = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Lade-Effizienz · Einsparpotenzial</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">
        ${D.PERIOD_LONG} · ${A.monate.length} Monate · Oktober 2026 nicht in der Wertung ·
        Referenzpreis ${ekwh(K.referenz)} (Tesla-Supercharger Österreich Peak, deckungsgleich mit Wien Energie GO
        und dem unteren Ende der E-Control-Kartentarife)
      </p>

      <div class="kpis" style="grid-template-columns:repeat(6,1fr);">
        <div class="kpi hi">
          <div class="label">Einsparpotenzial</div>
          <div class="val">${eu(g.vermeidbar)}</div>
          <div class="extra">${pct1(g.vermeidbar_quote)} der Ladekosten</div>
        </div>
        <div class="kpi">
          <div class="label">pro Monat</div>
          <div class="val">${eu(g.pro_monat)}</div>
          <div class="extra">Durchschnitt über ${A.monate.length} Monate</div>
        </div>
        <div class="kpi hi">
          <div class="label">auf 12 Monate</div>
          <div class="val">${eu(g.jahr_hochgerechnet)}</div>
          <div class="extra">bei gleichem Verhalten</div>
        </div>
        <div class="kpi">
          <div class="label">Ladekosten IST</div>
          <div class="val">${eu(g.ist_eur)}</div>
          <div class="extra">${num(g.ist_kwh,0)} kWh · ${ekwh(g.preis_schnitt)}<br>
            <span style="color:var(--ink-4);">inkl. Idle-Gebühren, daher ${eu(A.idle_eur||0)} über dem Kopfbereich</span></div>
        </div>
        <div class="kpi good">
          <div class="label">wäre möglich gewesen</div>
          <div class="val">${eu(moeglich)}</div>
          <div class="extra">${ekwh(moeglich/g.ist_kwh)} im Schnitt</div>
        </div>
        <div class="kpi">
          <div class="label">Positionen bewertet</div>
          <div class="val">${num(g.n_energie,0)}<span class="u">Energie</span></div>
          <div class="extra">+ ${num(g.n_zeit,0)} Minutenpositionen</div>
        </div>
      </div>

      <div class="alert-box good">
        <div class="icon">€</div>
        <div class="body">
          <h4>${eu(g.vermeidbar)} Einsparpotenzial — und ${pct((g.topf.A1+g.topf.A2)/g.vermeidbar)} davon liegt nicht beim Fahrer</h4>
          <p>
            Das Geld geht nicht durch Unachtsamkeit verloren, sondern durch die <b>Wahl des Ladenetzes</b>:
            über die DKV-Karte wurden ${num(dkvKwh,0)} kWh zu durchschnittlich <b>${ekwh(dkvEur/dkvKwh)}</b>
            geladen, am Tesla-Supercharger ${num(tsl.kwh,0)} kWh zu <b>${ekwh(tsl.preis)}</b> — bei
            praktisch gleicher Energiemenge <b>${pct(dkvEur/dkvKwh/tsl.preis - 1)}</b> Aufschlag.
            Wer die DKV-Karte benutzt hat, hat nichts falsch gemacht; sie war da und sie funktioniert.
            Die Ersparnis liegt darin, <b>welche Karte vorne im Fahrzeug liegt</b> — eine Entscheidung
            der Fuhrparkverwaltung, keine Frage der Fahrdisziplin.
          </p>
        </div>
      </div>

      <!-- Woran es wirklich liegt -->
      <div class="card accent" style="margin-bottom:14px;">
        <div class="card-h"><h3>Woran es liegt</h3>
          <span class="h-sub">Beschaffung gegen Verhalten</span></div>
        <div style="display:flex;gap:0;height:30px;border:1px solid var(--rule);margin-bottom:12px;">
          <div style="flex:${(g.topf.A1+g.topf.A2).toFixed(0)};background:var(--yellow);display:grid;place-items:center;
                      font-weight:800;font-size:12.5px;color:#0d0d0d;letter-spacing:0.3px;">
            KARTENWAHL · ${pct((g.topf.A1+g.topf.A2)/g.vermeidbar)}</div>
          <div style="flex:${g.topf.C.toFixed(0)};background:var(--surface-2);display:grid;place-items:center;
                      font-weight:700;font-size:12px;color:var(--ink-2);">
            ${g.topf.C/g.vermeidbar > 0.10 ? 'STEHENBLEIBEN · '+pct(g.topf.C/g.vermeidbar) : ''}</div>
          <div style="flex:${g.topf.B.toFixed(0)};background:#6FA8DC;display:grid;place-items:center;
                      font-weight:700;font-size:12px;color:#0d0d0d;">
            ${g.topf.B/g.vermeidbar > 0.08 ? 'UHRZEIT' : ''}</div>
        </div>
        <div style="font-size:13.5px;line-height:1.65;color:var(--ink-2);">
          <b>${pct((g.topf.A1+g.topf.A2+g.topf.B)/g.vermeidbar)}</b> des Potenzials hängt an Tarif und Netz —
          daran ändert kein Fahrer etwas, solange er die Karte benutzt, die er bekommen hat.
          Nur <b>${pct(g.topf.C/g.vermeidbar)}</b> (${eu(g.topf.C)} auf ${A.monate.length} Monate und
          ${A.je_fahrer.length} Fahrer, also rund ${eu(g.topf.C/A.monate.length/A.je_fahrer.length)}
          pro Fahrer und Monat) entfallen auf Standzeit nach Ladeende.
          Die folgenden Auswertungen zeigen deshalb <b>Potenzial</b>, keine Verfehlungen.
        </div>
      </div>

      <!-- Die vier Töpfe -->
      <div class="grid-2">
        <div class="card accent">
          <div class="card-h"><h3>Woraus sich die ${eu(g.vermeidbar)} zusammensetzen</h3>
            <span class="h-sub">vier Töpfe, keine Überschneidung</span></div>
          <table class="dt">
            <thead><tr><th>Topf</th><th class="num">Positionen</th><th class="num">Betrag</th><th class="num">Anteil</th></tr></thead>
            <tbody>
              ${['A1','A2','B','C'].map(t => `
                <tr>
                  <td><i style="display:inline-block;width:10px;height:10px;background:${FARBE[t]};margin-right:7px;vertical-align:-1px;"></i><b>${TOPF_NAME[t]}</b></td>
                  <td class="num">${num(A.gesamt.topf_n[t],0)}</td>
                  <td class="num"><b>${eu(g.topf[t])}</b></td>
                  <td class="num">${pct(g.topf[t]/g.vermeidbar)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr><td><b>Summe</b></td><td class="num"></td><td class="num"><b>${eu(g.vermeidbar)}</b></td><td class="num">100 %</td></tr></tfoot>
          </table>
          <p class="small muted" style="margin:12px 0 0;line-height:1.55;">
            <b>Netzwahl</b> = alles, was über ${ekwh(K.referenz)} bezahlt wurde. „Alternative belegt“ heißt:
            an genau diesem Ort haben wir selbst schon an einem Tesla-Supercharger geladen, die günstigere
            Säule ist also nachweislich erreichbar. „Wahrscheinlich“ = Ort ohne eigenen Tesla-Nachweis.<br>
            <b>Zeitfenster</b> = Ladungen, die schon unter ${ekwh(K.referenz)} lagen, aber tagsüber statt
            nachts erfolgten (${K.offpeak_von}–0${K.offpeak_bis} Uhr sind ${ekwh(K.referenz_off)}).<br>
            <b>Stehenbleiben</b> = das Fahrzeug hing länger am Kabel, als zum Laden nötig war, und die
            Säule rechnet nach Minuten ab. <b>Vollständig vermeidbar.</b> Die echte Ladedauer
            (${eu(A.gesamt.zeit_lade_eur)}) ist hier bewusst <b>nicht</b> enthalten — sie fällt beim
            DKV-Tarif zwangsläufig an und steckt im effektiven Preis je kWh, also in der Netzwahl.
          </p>
        </div>

        <div class="card">
          <div class="card-h"><h3>Der Preisunterschied, den wir selbst bezahlt haben</h3>
            <span class="h-sub">eigene Rechnungen, keine Annahme</span></div>
          <table class="dt">
            <thead><tr><th>Kanal</th><th class="num">kWh</th><th class="num">€</th><th class="num">€/kWh</th></tr></thead>
            <tbody>
              <tr><td><b>Tesla-Supercharger</b></td><td class="num">${num(tsl.kwh,0)}</td><td class="num">${eu(tsl.eur)}</td><td class="num"><b style="color:var(--good);">${ekwh(tsl.preis)}</b></td></tr>
              <tr><td><b>DKV-Karte (Roaming)</b><br><span class="small muted">inkl. ${eu(dkvZeit)} Ladezeit-Minuten</span></td><td class="num">${num(dkvKwh,0)}</td><td class="num">${eu(dkvEur)}</td><td class="num"><b style="color:var(--yellow);">${ekwh(dkvEur/dkvKwh)}</b></td></tr>
            </tbody>
          </table>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--rule);">
            <div class="label" style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px;">Tesla-Supercharger Österreich · eigene Messung</div>
            <table class="dt">
              <thead><tr><th>Zeitfenster</th><th class="num">Ladungen</th><th class="num">kWh</th><th class="num">€/kWh</th></tr></thead>
              <tbody>
                <tr><td>Peak 08–22 Uhr</td><td class="num">${num(A.zeitfenster.tesla_at.peak.n,0)}</td><td class="num">${num(A.zeitfenster.tesla_at.peak.kwh,0)}</td><td class="num">${ekwh(A.zeitfenster.tesla_at.peak.preis)}</td></tr>
                <tr><td>Off-Peak 22–08 Uhr</td><td class="num">${num(A.zeitfenster.tesla_at.off.n,0)}</td><td class="num">${num(A.zeitfenster.tesla_at.off.kwh,0)}</td><td class="num"><b style="color:var(--good);">${ekwh(A.zeitfenster.tesla_at.off.preis)}</b></td></tr>
              </tbody>
            </table>
            <p class="small muted" style="margin:9px 0 0;">
              Gemessen ${ekwh(A.zeitfenster.tesla_at.peak.preis)} tags und ${ekwh(A.zeitfenster.tesla_at.off.preis)} nachts —
              das deckt sich mit den veröffentlichten ${ekwh(K.referenz)} / ${ekwh(K.referenz_off)}.
              Bei der DKV-Karte ist dieser Nachteffekt <b>nicht</b> vorhanden
              (${ekwh(A.zeitfenster.dkv_at.off.preis)} nachts gegen ${ekwh(A.zeitfenster.dkv_at.peak.preis)} tags) —
              nachts laden hilft also nur am Supercharger.
            </p>
          </div>
        </div>
      </div>

      <!-- Monatsverlauf -->
      <div class="card accent">
        <div class="card-h"><h3>Einsparpotenzial je Monat</h3>
          <span class="h-sub">Balken gestapelt nach Topf · unter dem Monat Anteil und Ø-Preis</span>
          <span class="h-meta">Ø ${eu(g.pro_monat)} / Monat</span></div>
        <div class="chart-wrap">${monatsChart()}</div>
        ${legende()}
      </div>

      <!-- Monatstabelle -->
      <div class="card">
        <div class="card-h"><h3>Monatsübersicht</h3><span class="h-sub">Zahlen zum Balkenbild</span></div>
        <table class="dt">
          <thead><tr>
            <th>Monat</th><th class="num">kWh</th><th class="num">Ø €/kWh</th>
            <th class="num">Ladekosten</th><th class="num">Potenzial</th><th class="num">Anteil</th>
            <th class="num">Netzwahl</th><th class="num">Zeitfenster</th><th class="num">Stehenbleiben</th>
          </tr></thead>
          <tbody>
            ${A.je_monat.map(r => `
              <tr>
                <td><b>${ML[r.m]}</b></td>
                <td class="num">${num(r.kwh,0)}</td>
                <td class="num">${ekwh(r.preis)}</td>
                <td class="num">${eu(r.ist_eur)}</td>
                <td class="num"><b>${eu(r.vermeidbar)}</b></td>
                <td class="num">${pct1(r.quote)}</td>
                <td class="num">${eu(r.topf.A1 + r.topf.A2)}</td>
                <td class="num">${eu(r.topf.B)}</td>
                <td class="num">${eu(r.topf.C)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td><b>Summe</b></td>
            <td class="num"><b>${num(g.ist_kwh,0)}</b></td>
            <td class="num"><b>${ekwh(g.preis_schnitt)}</b></td>
            <td class="num"><b>${eu(g.ist_eur)}</b></td>
            <td class="num"><b>${eu(g.vermeidbar)}</b></td>
            <td class="num"><b>${pct1(g.vermeidbar_quote)}</b></td>
            <td class="num"><b>${eu(g.topf.A1+g.topf.A2)}</b></td>
            <td class="num"><b>${eu(g.topf.B)}</b></td>
            <td class="num"><b>${eu(g.topf.C)}</b></td>
          </tr></tfoot>
        </table>
      </div>

      <!-- Einsparpotenzial je Fahrer -->
      <div class="card accent">
        <div class="card-h"><h3>Einsparpotenzial je Fahrer</h3>
          <span class="h-sub">überwiegend Kartenwahl, nicht Fahrverhalten</span>
          <span class="h-meta">${A.je_fahrer.length} Fahrer · sortiert nach Menge</span></div>
        <table class="dt">
          <thead><tr>
            <th class="rank">#</th><th>Fahrer</th><th>Fahrzeug</th><th>Ges.</th>
            <th class="num">kWh</th><th class="num">Ø €/kWh</th><th class="num">Ladekosten</th>
            <th class="num">Potenzial</th><th class="num">Anteil</th>
            <th class="num">DKV-Anteil</th><th>Verlauf</th>
          </tr></thead>
          <tbody>
            ${A.je_fahrer.map((f,i) => {
              const tot = f.dkv_kwh + f.tesla_kwh;
              const dq = tot ? f.dkv_kwh/tot : 0;
              return `
              <tr>
                <td class="rank">${i+1}</td>
                <td><b>${esc(f.name)}</b>${f.ist_tesla ? '' : ` <span class="badge" title="Fremdmarke – am Supercharger nur mit eigener Mitgliedschaft zum Vorzugspreis">${esc(f.marke)}</span>`}</td>
                <td class="mono small">${f.kfz.map(esc).join(' · ')}</td>
                <td>${f.ges.map(x=>`<span class="badge ges-${x.toLowerCase()}">${esc(x)}</span>`).join(' ')}</td>
                <td class="num">${num(f.kwh,0)}</td>
                <td class="num"><b>${ekwh(f.preis)}</b></td>
                <td class="num">${eu(f.ist_eur)}</td>
                <td class="num"><b>${eu(f.vermeidbar)}</b></td>
                <td class="num">${pct1(f.quote)}</td>
                <td class="num">${pct(dq)} <span class="bar yellow" style="width:52px;"><i style="width:${(dq*100).toFixed(0)}%"></i></span></td>
                <td>${spark(f.reihe)}</td>
              </tr>`;}).join('')}
          </tbody>
        </table>
        <p class="small muted" style="margin:12px 0 0;">
          Die Reihenfolge folgt weitgehend der gefahrenen Menge — wer viel unterwegs ist, steht
          oben. Das ist kein Leistungsurteil. Entscheidend ist die Spalte <b>DKV-Anteil</b>:
          die vier Fahrer mit 0 % DKV haben auch den niedrigsten Preis je kWh, ohne irgendetwas
          anders zu machen als mit einer anderen Karte zu laden.
        </p>
      </div>

      <!-- Effizienz-Ranking -->
      <div class="grid-12">
        <div class="card">
          <div class="card-h"><h3>Preis je kWh im Vergleich</h3>
            <span class="h-sub">mengenunabhängig · ab 100 kWh</span></div>
          <table class="dt">
            <thead><tr><th class="rank">#</th><th>Fahrer</th><th class="num">Ø €/kWh</th>
              <th class="num">gegen Referenz</th><th class="num">kWh</th></tr></thead>
            <tbody>
              ${A.je_fahrer.filter(f=>f.eff_rang).sort((a,b)=>a.eff_rang-b.eff_rang).map(f => `
                <tr>
                  <td class="rank">${f.eff_rang}</td>
                  <td><b>${esc(f.name)}</b> <span class="muted small">${esc(f.marke)}</span></td>
                  <td class="num"><b style="color:${f.preis>0.6?'var(--yellow)':f.preis>0.48?'var(--ink)':'var(--good)'};">${ekwh(f.preis)}</b></td>
                  <td class="num">${f.preis>K.referenz ? '+'+ct(f.preis-K.referenz) : '−'+ct(K.referenz-f.preis)}</td>
                  <td class="num">${num(f.kwh,0)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-h"><h3>Stehenbleiben nach Ladeende</h3>
            <span class="h-sub">Standzeit über der benötigten Ladedauer</span>
            <span class="h-meta">${eu(g.topf.C)}</span></div>
          <table class="dt">
            <thead><tr><th>Fahrer</th><th class="num">Fälle</th><th class="num">Standzeit</th>
              <th class="num">größter Fall</th><th class="num">davon Ladezeit (Tarif)</th></tr></thead>
            <tbody>
              ${A.je_fahrer.filter(f=>f.zeit_eur>0).sort((a,b)=>b.zeit_eur-a.zeit_eur).map(f=>`
                <tr><td><b>${esc(f.name)}</b></td><td class="num">${num(f.n_stand||0,0)}</td>
                <td class="num"><b>${eu(f.zeit_eur)}</b></td>
                <td class="num">${eu(f.zeit_max)}</td>
                <td class="num muted">${eu(f.zeit_lade_eur||0)}</td></tr>`).join('')}
            </tbody>
            <tfoot><tr><td><b>Summe</b></td><td class="num"></td>
              <td class="num"><b>${eu(g.topf.C)}</b></td><td class="num"></td>
              <td class="num"><b>${eu(A.gesamt.zeit_lade_eur)}</b></td></tr></tfoot>
          </table>
          <p class="small muted" style="margin:11px 0 0;">
            Die letzte Spalte ist <b>kein</b> Vorwurf: das ist der Minutenanteil, der auf die echte
            Ladedauer entfällt und beim DKV-Tarif zwangsläufig anfällt. Er zählt in der Netzwahl mit,
            nicht hier. Vermeidbar ist die Spalte „Standzeit“ — nach Ladeende abstecken und wegfahren.
            Tesla gewährt fünf Minuten Karenz und verlangt in Österreich danach bis zu 0,50 €/Minute
            ohne Obergrenze; Wien Energie 0,05 €/Minute ab drei Stunden an DC, gedeckelt bei 25 €.
          </p>
        </div>
      </div>

      <!-- Betreiber -->
      <div class="card">
        <div class="card-h"><h3>Wohin das Geld fließt · Betreiber</h3>
          <span class="h-sub">sortiert nach Preis · ab 50 kWh</span></div>
        <table class="dt">
          <thead><tr><th>Betreiber</th><th>Zugang</th><th class="num">Ladungen</th>
            <th class="num">kWh</th><th class="num">€ Energie</th><th class="num">+ Minuten</th>
            <th class="num">Ø €/kWh effektiv</th>
            <th class="num">Potenzial</th><th>gegen Referenz</th></tr></thead>
          <tbody>
            ${A.betreiber.map(b => {
              const ueber = Math.max(0, b.preis - K.referenz);
              const w = Math.min(100, (ueber / 0.36) * 100);
              return `
              <tr>
                <td><b>${esc(b.o)}</b></td>
                <td>${b.via === 'Tesla' ? '<span class="badge kind-kwh">Tesla</span>' : '<span class="badge">DKV</span>'}</td>
                <td class="num">${num(b.n,0)}</td>
                <td class="num">${num(b.kwh,0)}</td>
                <td class="num">${eu(b.eur)}</td>
                <td class="num" style="color:var(--ink-3);">${b.zeitanteil>0?eu(b.zeitanteil):'—'}</td>
                <td class="num"><b style="color:${b.preis>0.7?'var(--yellow)':b.preis>0.5?'var(--ink)':'var(--good)'};">${ekwh(b.preis)}</b></td>
                <td class="num">${b.vermeidbar > 0 ? eu(b.vermeidbar) : '—'}</td>
                <td><span class="bar yellow" style="width:120px;"><i style="width:${w.toFixed(0)}%"></i></span>
                    <span class="small mono muted">${ueber > 0 ? '+'+ct(ueber) : '—'}</span></td>
              </tr>`;}).join('')}
          </tbody>
        </table>
        <p class="small muted" style="margin:12px 0 0;">
          Die Spalte „vermeidbar“ umfasst hier Netzwahl und Zeitfenster zusammen, deshalb
          liegt ihre Summe über dem Topf Netzwahl allein. SMATRICS ist mit Abstand der größte
          Einzelposten — ein Betreiber, der über die DKV-Karte durchgehend in der teuersten
          DKV-Stufe abgerechnet wird.
        </p>
      </div>

      <!-- Methodik -->
      <div class="card">
        <div class="card-h"><h3>Wie gerechnet wurde</h3><span class="h-sub">damit die Zahl überprüfbar bleibt</span></div>
        <div style="font-size:13.5px;line-height:1.65;color:var(--ink-2);">
          <p style="margin:0 0 9px;"><b>Referenzpreis ${ekwh(K.referenz)}.</b> Dieser Wert ist nicht geschätzt, sondern
          dreifach abgestützt: er ist der Peak-Preis des Tesla-Superchargers in Österreich, gleichzeitig
          der Preis von Wien Energie GO im Eigennetz und gleichzeitig das untere Ende der von der
          E-Control ausgewiesenen Kartentarife. Gegenprobe an den eigenen Rechnungen: unsere
          Tesla-Ladungen liegen bei ${ekwh(A.zeitfenster.tesla_at.peak.preis)} im Peak und
          ${ekwh(A.zeitfenster.tesla_at.off.preis)} im Off-Peak.</p>
          <p style="margin:0 0 9px;"><b>Vier Töpfe ohne Überschneidung.</b> Jede Position fällt in genau einen Topf,
          deshalb lässt sich die Summe nicht doppelt zählen. Positionen über ${ekwh(K.referenz)} zählen nur
          die Differenz zur Referenz, nicht den ganzen Betrag.</p>
          <p style="margin:0 0 9px;"><b>Der Preis je kWh ist der effektive Preis.</b> Wo DKV zusätzlich Minuten
          abrechnet, ist der auf die echte Ladedauer entfallende Anteil in den kWh-Preis eingerechnet
          (${eu(A.gesamt.zeit_lade_eur)} insgesamt). Sonst erschiene DKV günstiger als es ist. Nur die
          Standzeit darüber hinaus (${eu(A.gesamt.zeit_stand_eur)}) steht als eigener Topf da.
          Die Aufteilung nutzt konservative 11 kW als Referenzleistung — dadurch gilt möglichst viel
          als unvermeidbare Ladezeit und möglichst wenig als Vorwurf an die Fahrer.</p>
          <p style="margin:0 0 9px;"><b>Nur Österreich wird bewertet.</b> Die Referenzpreise sind österreichische
          Preise. Die ${eu(g.ausland_eur)} Auslandsladungen werden deshalb <b>nicht</b> als vermeidbar gezählt —
          sie stehen im Reiter Ausland.</p>
          <p style="margin:0;"><b>Nicht eingerechnet</b> sind Umwege zu einer günstigeren Säule (die selbst Strom und
          Zeit kosten), die Tesla-Mitgliedschaft von ${num(K.tesla_abo,2)} €/Monat (steht als eigene Rechnung im
          Reiter Tipps) und Ladeverluste (die abgerechnete kWh-Menge ist bereits die an der Säule gemessene).
          Die Zahl ist damit eher zu niedrig als zu hoch angesetzt.</p>
        </div>
      </div>

    `;
    host.innerHTML = h;
  }

  // ==========================================================================
  // Tipps je Fahrer erzeugen
  // ==========================================================================
  function tippsFuer(f){
    const t = [];
    const tot = f.dkv_kwh + f.tesla_kwh;
    const dq = tot ? f.dkv_kwh/tot : 0;

    // 1) Netzwechsel - der mit Abstand groesste Hebel
    if (f.dkv_kwh > 50 && dq > 0.1) {
      const amOrt = (f.teure_orte||[]).filter(o => o.alt && o.alt.am_ort);
      const nah   = (f.teure_orte||[]).filter(o => o.alt && !o.alt.am_ort && o.alt.lohnt);
      const fern  = (f.teure_orte||[]).filter(o => o.alt && !o.alt.am_ort && !o.alt.lohnt);
      let txt = `Du hast <b>${num(f.dkv_kwh,0)} kWh</b> (${pct(dq)} deiner Energie) über die
        <b>DKV-Karte</b> geladen — im Schnitt deutlich teurer als am Tesla-Supercharger.`;
      if (amOrt.length) {
        txt += ` An <b>${amOrt.length} ${amOrt.length===1?'deinem Ladeort':'deiner Ladeorte'}</b>
          steht ein Supercharger, den wir selbst nutzen, <b>direkt am selben Ort</b>:
          ${amOrt.map(o=>`${esc(o.o)} (${ekwh(o.preis)} bezahlt statt ${ekwh(o.alt.preis)})`).join(', ')}.
          Das ist ohne jeden Umweg zu holen.`;
      }
      if (nah.length) {
        txt += ` Diese Umwege rechnen sich ebenfalls:
          ${nah.map(o=>`${esc(o.o)} → ${esc(o.alt.o)} (${o.alt.km} km, ${ekwh(o.alt.preis)},
            spart ${eu(o.alt.ersparnis_je_ladung)} je Ladung)`).join(', ')}.`;
      }
      if (fern.length && !amOrt.length && !nah.length) {
        txt += ` <b>Achtung:</b> an deinen Ladeorten haben wir selbst noch nie am Supercharger
          geladen, der nächste bekannte liegt zu weit weg
          (${esc(fern[0].alt.o)}, ${fern[0].alt.km} km) — dieser Umweg würde die Ersparnis
          auffressen. Sinnvoller ist, in der <b>Tesla-App</b> nachzusehen, ob an deinen
          Standorten ein freigegebener Supercharger steht; unsere Liste kennt nur die,
          die wir selbst schon angefahren haben.`;
      }
      t.push({p:1, kopf:'Lade am Tesla-Supercharger statt mit der DKV-Karte',
              spar:(f.topf.A1+f.topf.A2), body:txt});
    }

    // 2) Fremdmarke -> Mitgliedschaft rechnen
    if (!f.ist_tesla && f.marke !== 'unbekannt') {
      const kwhM = f.kwh / Math.max(1, f.monate_aktiv);
      const vorteil = 0.06;   // Peak->Off-Peak-Vorteil in der Mitglieder-Kategorie
      const schwelle = K.tesla_abo / vorteil;
      t.push({p:1, kopf:`Dein ${esc(f.marke)} darf an den Supercharger — das ist nicht auf Tesla beschränkt`,
        spar:null,
        body:`Freigegebene Tesla-Supercharger in Österreich sind für alle CCS-fähigen Fahrzeuge offen,
          eine Mitgliedschaft ist zum Laden <b>nicht</b> Voraussetzung. Du lädst derzeit
          ${num(kwhM,0)} kWh pro Monat zu <b>${ekwh(f.preis)}</b> — das ist der höchste Wert der Flotte.
          Schon der Supercharger-Preis ohne Mitgliedschaft liegt darunter. Für den Mitgliederpreis
          kostet die Supercharging-Mitgliedschaft ${num(K.tesla_abo,2)} €/Monat; sie rechnet sich ab
          rund ${num(schwelle,0)} kWh im Monat am Supercharger — bei deiner Menge also klar.
          <b>Vor dem ersten Mal:</b> in der Tesla-App unter „Ihr Elektrofahrzeug aufladen“ prüfen,
          ob der Standort für Fremdmarken freigegeben ist, und die Säulennummer in der App auswählen.`});
    }

    // 3) Zeitfenster
    if (f.peak_quote !== null && f.peak_quote > 0.6 && f.tesla_kwh > 100) {
      t.push({p:2, kopf:'Verschiebe Ladungen nach 22 Uhr',
        spar:f.topf.B,
        body:`<b>${pct(f.peak_quote)}</b> deiner Ladungen mit belegter Uhrzeit liegen im teuren
          Peak-Fenster 08–22 Uhr (${num(f.peak_kwh,0)} kWh). Am Supercharger kostet die Nacht
          ${ekwh(K.referenz_off)} statt ${ekwh(K.referenz)} — rund ${ct(0.06)} je kWh günstiger.
          Wichtig: Tesla legt den Tarif <b>beim Anstecken</b> fest und behält ihn für die ganze
          Sitzung. Kurz vor 22 Uhr lohnt es sich also zu warten, statt um 21:50 zu starten.
          Bei der DKV-Karte bringt die Nacht dagegen nichts — dort gibt es kein Nachtfenster.`});
    }

    // 4) Stehenbleiben nach Ladeende
    if (f.zeit_eur > 20) {
      t.push({p:f.zeit_eur > 150 ? 1 : 3, kopf:'Nach Ladeende abstecken und wegfahren',
        spar:f.zeit_eur,
        body:`Auf dich entfallen <b>${eu(f.zeit_eur)}</b> für Standzeit, die <b>über</b> der für deine
          geladene Energie nötigen Ladedauer lag — der größte Einzelfall mit
          ${eu(f.zeit_max)}. (Die reine Ladezeit von ${eu(f.zeit_lade_eur||0)} ist hier bewusst
          <b>nicht</b> enthalten, die fällt beim DKV-Tarif zwangsläufig an.) Das ist vollständig vermeidbar: Benachrichtigung „Ladung beendet“
          in der App aktivieren und den Platz räumen. Tesla gibt fünf Minuten Karenz und verlangt
          danach bis zu 0,50 €/Minute ohne Obergrenze; Wien Energie rechnet 0,05 €/Minute ab
          drei Stunden an DC und fünf Stunden an AC, gedeckelt mit 25 € je Vorgang.`});
    }

    // 5) Regionaler Tarifhinweis
    const bl = f.bl;
    if (bl === 'W' || f.haupt_ort === 'Wien') {
      t.push({p:3, kopf:'Du lädst überwiegend in Wien — nutze das Wien-Energie-Eigennetz',
        spar:null,
        body:`Im eigenen Netz von Wien Energie kostet die kWh ${ekwh(0.43)} im Tarif GO ohne
          Grundgebühr, ${ekwh(0.40)} bei SMART (5,90 €/Monat) und ${ekwh(0.36)} bei PRO
          (29,90 €/Monat). Achtung auf den Unterschied: <b>dieselbe Karte im fremden Netz
          kostet ${ekwh(0.70)}</b> — mehr als das Doppelte von PRO. Bei den Stationsgruppen
          City und Spot entfällt der Standzeitzuschlag nachts zwischen 22 und 8 Uhr.
          Der Supercharger Wien-Donaustadt ist rund um die Uhr offen und auch für
          Fremdmarken freigegeben.`});
    }

    // 6) Alltagsladung
    t.push({p:4, kopf:'Günstig ist, was du ohnehin ansteuerst',
      spar:null,
      body:`Der niedrigste kWh-Preis nützt nichts, wenn er einen Umweg kostet: 30 kWh zehn Cent
        billiger geladen spart 3 €, zehn Zusatzkilometer verbrauchen davon schon rund 1 € an Strom.
        Lade deshalb dort, wo du ohnehin stehst. Lidl-Standorte liegen mit der Lidl-Plus-App bei
        ${ekwh(0.19)} an AC und ${ekwh(0.29)} an normalem DC — ohne App dagegen bei
        ${ekwh(0.45)} bzw. ${ekwh(0.60)}. Der Zahlungsweg entscheidet hier mehr als die Säule.`});

    return t.sort((a,b)=>a.p-b.p);
  }

  // ==========================================================================
  // REITER TIPPS
  // ==========================================================================
  function renderTipps(host){
    const g = A.gesamt;
    const tsl = A.betreiber.find(b => b.via === 'Tesla') || {preis:0};

    let h = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Tipps · wo und wann günstig geladen wird</h1>
      <p style="margin:0 0 18px;color:var(--ink-3);font-size:14px;">
        Erst die allgemeinen Regeln, dann für jeden Fahrer ein eigenes Blatt — gedacht zum
        Ausdrucken und Durchgehen. Der Hauptladeort je Fahrer kommt aus den Rechnungen,
        die Empfehlung daraus und aus zwei Recherchen vom 4. November 2026.
      </p>

      <div class="alert-box good">
        <div class="icon">✓</div>
        <div class="body">
          <h4>Die eine Regel, die ${eu(g.topf.A1+g.topf.A2)} wert ist</h4>
          <p>
            Fast die gesamte Ersparnis hängt an einer einzigen Entscheidung: <b>Tesla-Supercharger
            statt DKV-Karte</b>. Am Supercharger haben wir ${ekwh(tsl.preis)} bezahlt, über die
            DKV-Karte im Schnitt deutlich mehr. Freigegebene Supercharger in Österreich sind
            <b>für alle CCS-fähigen Fahrzeuge</b> offen, nicht nur für Teslas — eine Mitgliedschaft
            ist zum Laden keine Voraussetzung. Zweitgrößter Hebel: nach Ladeende <b>abstecken</b>
            (${eu(g.topf.C)} Standzeit über der nötigen Ladedauer). Drittgrößter: <b>nach 22 Uhr</b> laden
            (${ekwh(K.referenz_off)} statt ${ekwh(K.referenz)}).
          </p>
        </div>
      </div>

      <!-- Resümee der beiden Recherchen -->
      <div class="card accent">
        <div class="card-h"><h3>Resümee · Recherchebericht gegen eigene Nachrecherche</h3>
          <span class="h-sub">beide Stand 04.11.2026</span></div>
        <div style="font-size:13.5px;line-height:1.65;color:var(--ink-2);">
          <p style="margin:0 0 10px;"><b>Wo beide übereinstimmen.</b> Der Tesla-Supercharger ist in Österreich
          für Fremdmarken mit CCS geöffnet und eine Mitgliedschaft ist dafür keine Voraussetzung.
          Es gibt keinen österreichweit günstigsten Anbieter — entscheidend sind Netz, Zahlungsweg
          und Standzeit, nicht der beworbene Centwert. Roaming ist die teuerste Variante:
          der Bericht belegt das mit Wien Energie (${ekwh(0.43)} im Eigennetz gegen ${ekwh(0.70)} im
          Roaming), unsere Nachrecherche mit den DKV-Preisstufen. Standzeit ist in jedem Netz
          eine eigene Kostenart. Tesla fixiert den Tarif beim Anstecken.</p>

          <p style="margin:0 0 10px;"><b>Was die Nachrecherche ergänzt.</b> Der Bericht nennt bewusst keine
          Tesla-Preise für Österreich, weil sie standort- und zeitabhängig sind — er sagt nur, dass
          Nebenzeiten günstiger sein <i>können</i>. Die Nachrecherche liefert die konkreten Werte:
          <b>${ekwh(0.43)} im Peak 08–22 Uhr, ${ekwh(0.37)} im Off-Peak 22–08 Uhr</b>, Mitgliedschaft
          ${num(K.tesla_abo,2)} €/Monat (von ursprünglich 12,99 € gesenkt) oder 100 €/Jahr.
          Dazu die <b>DKV-Preisstufen</b>, die der Bericht nicht behandelt, weil DKV ein reines
          B2B-Produkt ist: AC 0,34 / 0,44 / 0,69 und DC 0,53 / 0,65 / 0,78 €/kWh. Und die
          E-Control-Zahlen als Maßstab: Median der Ad-hoc-Preise 0,64 €/kWh, Kartentarife ohne
          Grundgebühr 0,43–0,69 €/kWh.</p>

          <p style="margin:0 0 10px;"><b>Wo sie sich widersprechen — und wer recht hat.</b> Der Bericht hält
          fest, nachts sei <i>nicht grundsätzlich</i> günstiger, und das ist richtig: für Haushaltsstrom
          mit Fixtarif stimmt es, und bei der DKV-Karte stimmt es auch — unsere Nachtladungen kosten
          dort ${ekwh(A.zeitfenster.dkv_at.off.preis)} gegen ${ekwh(A.zeitfenster.dkv_at.peak.preis)} am Tag,
          also nichts. Am Tesla-Supercharger gibt es den Nachtvorteil dagegen sehr wohl, und wir haben
          ihn selbst bezahlt: ${ekwh(A.zeitfenster.tesla_at.off.preis)} nachts gegen
          ${ekwh(A.zeitfenster.tesla_at.peak.preis)} tags. Die pauschale Aussage „nachts ist günstiger“
          ist also falsch, die netzspezifische richtig. Beim IONITY-Tarif weist der Bericht selbst auf
          widersprüchliche Angaben auf der Anbieterseite hin — diese Werte bleiben hier unter Vorbehalt.</p>

          <p style="margin:0;"><b>Was beide Recherchen nicht können.</b> Keine der beiden ist eine vollständige
          Erhebung aller österreichischen Anbieter, und Live-Preise in den Apps können abweichen.
          Für unsere Auswertung ist das unkritisch, weil der Referenzpreis nicht aus der Recherche
          allein stammt, sondern an den eigenen Rechnungen gegengeprüft ist: unsere DKV-Positionen
          bilden genau die vier recherchierten Preisstufen als scharfe Cluster ab
          (0,34 / 0,44 / 0,65 / 0,78 €/kWh), und unsere Tesla-Ladungen genau die recherchierten
          ${ekwh(0.43)} / ${ekwh(0.37)}. Beide Recherchen bestätigen sich damit gegenseitig an den Daten.</p>
        </div>
      </div>

      <!-- Tarifvergleich -->
      <div class="grid-21">
        <div class="card">
          <div class="card-h"><h3>Tarife im Vergleich</h3>
            <span class="h-sub">Euro pro kWh · nur im genannten Netz und Zahlungsweg</span></div>
          <table class="dt">
            <thead><tr><th>Angebot</th><th class="num">AC</th><th class="num">DC / HPC</th>
              <th>Bedingung</th><th>Beleg</th></tr></thead>
            <tbody>
              ${TARIFE.map(r => `
                <tr>
                  <td><b>${esc(r.a)}</b></td>
                  <td class="num">${esc(r.ac)}</td>
                  <td class="num">${esc(r.dc)}</td>
                  <td class="small muted">${esc(r.fix)}</td>
                  <td><span class="badge ${r.q==='beide'?'kind-kwh':r.q==='Nachrecherche'?'auto':''}">${esc(r.q)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <p class="small muted" style="margin:11px 0 0;">
            „beide“ heißt: der Wert steht in der Recherche <b>und</b> ist in unseren eigenen
            Rechnungen als Preiscluster nachweisbar. Preise gelten nur im jeweiligen Netz —
            dieselbe Karte im Fremdnetz kostet erheblich mehr.
          </p>
        </div>
        <div class="card">
          <div class="card-h"><h3>Maßstab E-Control</h3><span class="h-sub">Behördenzahlen</span></div>
          <table class="dt">
            <tbody>
              ${EC.map(r=>`<tr><td class="small">${esc(r.k)}</td><td class="num"><b>${esc(r.v)}</b></td></tr>`).join('')}
            </tbody>
          </table>
          <p class="small muted" style="margin:11px 0 0;">
            Unser DKV-Schnitt liegt auf dem Niveau des <b>Ad-hoc-Medians</b> — also dort, wo man
            ohne Vertrag landet. Für eine Flottenkarte ist das der falsche Platz. Unser
            Supercharger-Schnitt von ${ekwh(tsl.preis)} liegt dagegen <b>unter</b> dem unteren Ende
            aller ausgewiesenen Kartentarife.
          </p>
          <p class="small muted" style="margin:9px 0 0;">
            Nachprüfen lassen sich aktuelle Preise über <b>ladestellen.at</b> (Ladepunkt, Stecker,
            Leistung, Ad-hoc-Preis) und <b>ladetarif.at</b> (Vertragsvergleich), beide von der
            E-Control betrieben.
          </p>
        </div>
      </div>

      <!-- Wann laden -->
      <div class="card accent">
        <div class="card-h"><h3>Wann laden?</h3>
          <span class="h-sub">unsere eigenen Supercharger-Ladungen je Stunde</span>
          <span class="h-meta">Off-Peak ab ${K.offpeak_von} Uhr</span></div>
        ${stundenChart()}
        <p class="small muted" style="margin:12px 0 0;line-height:1.55;">
          Jede Säule ist eine Stunde des Tages, die Höhe die geladene Energie, die Zahl darunter
          der dort bezahlte Preis. Die drei Stunden ab 22 Uhr und die Stunden vor 8 Uhr liegen
          sichtbar niedriger. Zugleich zeigt das Bild das Problem: die Flotte lädt fast
          ausschließlich zwischen 8 und 20 Uhr. <b>Nur ${pct(A.zeitfenster.tesla_at.off.kwh/(A.zeitfenster.tesla_at.off.kwh+A.zeitfenster.tesla_at.peak.kwh))}
          der Supercharger-Energie fällt ins günstige Nachtfenster.</b>
          Hinweis: Für ${pct(1-A.zeitfenster.anteil_echtzeit)} der Positionen liefert der Beleg keine
          echte Uhrzeit (${A.zeitfenster.ohne_zeit_quellen.map(esc).join(', ')}) — diese sind hier nicht enthalten.
        </p>
      </div>

      <!-- Checkliste -->
      <div class="grid-3">
        <div class="card">
          <div class="card-h"><h3>Vor jeder Ladung</h3></div>
          <ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.7;color:var(--ink-2);">
            <li>Ist der Supercharger die erreichbare Option? Dann dorthin.</li>
            <li>Welcher Preis gilt mit <b>meinem</b> Zahlungsweg? App-Preis, Kartenpreis und
                Ad-hoc-Preis sind drei verschiedene Dinge.</li>
            <li>Eigennetz oder Fremdnetz? Roaming ist der teuerste Weg.</li>
            <li>Ab wann läuft eine Standgebühr?</li>
            <li>Passt die Leistung zur geplanten Standzeit?</li>
            <li>Benachrichtigung aktiv, damit das Ladeende nicht verpasst wird?</li>
          </ul>
        </div>
        <div class="card">
          <div class="card-h"><h3>Am Supercharger</h3></div>
          <ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.7;color:var(--ink-2);">
            <li>Bei Fremdmarken: Freigabe des Standorts in der Tesla-App prüfen.</li>
            <li>Säulennummer in der App exakt auswählen.</li>
            <li>Tarif gilt ab dem Anstecken — vor 22 Uhr lohnt Warten.</li>
            <li>Ab 80 % kann die Überlastungsgebühr greifen, bis 0,50 €/Minute
                <b>ohne Obergrenze</b>.</li>
            <li>Nach Ladeende innerhalb von fünf Minuten abstecken.</li>
            <li>Nie eine Zahlung über einen QR-Code-Aufkleber leisten.</li>
          </ul>
        </div>
        <div class="card">
          <div class="card-h"><h3>Diese Betreiber meiden</h3>
            <span class="h-sub">über die DKV-Karte</span></div>
          <table class="dt">
            <thead><tr><th>Betreiber</th><th class="num">€/kWh</th><th class="num">kostete uns</th></tr></thead>
            <tbody>
              ${A.betreiber.filter(b=>b.via==='DKV' && b.vermeidbar>50).slice(0,9).map(b=>`
                <tr><td><b>${esc(b.o)}</b></td><td class="num">${ekwh(b.preis)}</td>
                <td class="num"><b>${eu(b.vermeidbar)}</b></td></tr>`).join('')}
            </tbody>
          </table>
          <p class="small muted" style="margin:10px 0 0;">
            Diese Betreiber werden über die DKV-Karte in der teuersten Stufe abgerechnet.
            Bei allen gilt dieselbe Abhilfe: Supercharger in der Nähe suchen.
          </p>
        </div>
      </div>

      <!-- Fahrerblätter -->
      <h2 style="font-weight:900;font-size:24px;margin:26px 0 6px;letter-spacing:-0.3px;">Fahrerblätter</h2>
      <p style="margin:0 0 14px;color:var(--ink-3);font-size:13.5px;">
        Ein Blatt je Fahrer zum Ausdrucken. <b>Das ist keine Bewertung und kein Vorwurf</b> —
        der weitaus grösste Teil des Potenzials entsteht durch die Karte, die im Fahrzeug liegt,
        nicht durch das Verhalten am Ladepunkt. Die Blätter sagen jedem, <b>wo und wann</b> er
        am günstigsten lädt, mehr nicht.
      </p>
      ${A.je_fahrer.filter(f => f.kwh >= 50 || f.zeit_eur > 20).map(fahrerBlatt).join('')}

    `;
    host.innerHTML = h;
  }

  function stundenChart(){
    const rows = A.stunden;
    const W = 1200, H = 260, padL = 52, padR = 20, padT = 20, padB = 58;
    const iw = W-padL-padR, ih = H-padT-padB;
    const max = Math.max(...rows.map(r=>r.kwh), 1) * 1.12;
    const cw = iw/24;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" style="width:100%;height:auto;display:block;">`;
    // Off-Peak-Fenster hinterlegen
    const xOf = h => padL + h*cw;
    s += `<rect x="${xOf(0)}" y="${padT}" width="${cw*K.offpeak_bis}" height="${ih}" fill="rgba(39,208,122,0.09)"/>`;
    s += `<rect x="${xOf(K.offpeak_von)}" y="${padT}" width="${cw*(24-K.offpeak_von)}" height="${ih}" fill="rgba(39,208,122,0.09)"/>`;
    s += `<line x1="${padL}" y1="${padT+ih}" x2="${W-padR}" y2="${padT+ih}" stroke="var(--chart-track)" stroke-width="1.5"/>`;
    rows.forEach(r => {
      const bw = cw*0.66, x = padL + r.h*cw + (cw-bw)/2;
      const hh = (r.kwh/max)*ih, y = padT+ih-hh;
      const off = r.h >= K.offpeak_von || r.h < K.offpeak_bis;
      if (r.kwh > 0) {
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${off?'#27d07a':'#FFE500'}" stroke="#0d0d0d" stroke-width="0.8"><title>${r.h}:00 · ${num(r.kwh,0)} kWh · ${r.preis?ekwh(r.preis):'–'}</title></rect>`;
      }
      s += `<text x="${(x+bw/2).toFixed(1)}" y="${(padT+ih+15).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--chart-ink)">${String(r.h).padStart(2,'0')}</text>`;
      if (r.preis) {
        s += `<text x="${(x+bw/2).toFixed(1)}" y="${(padT+ih+29).toFixed(1)}" text-anchor="middle" font-size="9" fill="${off?'#27d07a':'var(--chart-mut)'}">${(r.preis*100).toFixed(0)}</text>`;
      }
    });
    s += `<text x="${padL}" y="${(padT+ih+48).toFixed(1)}" font-size="10.5" fill="var(--chart-mut)">Stunde · darunter bezahlter Preis in Cent/kWh · grün hinterlegt = Off-Peak ${K.offpeak_von}–0${K.offpeak_bis} Uhr</text>`;
    s += `</svg>`;
    return s;
  }

  // Alternative zu einem teuren Ladeort. Ein Umweg wird nur dann empfohlen, wenn
  // er sich rechnet — die Regel stammt aus dem Recherchebericht: der Mehrverbrauch
  // der Zusatzkilometer muss aus der Ersparnis gedeckt sein. Lohnt er nicht, wird
  // das gesagt, statt den Fahrer auf eine teure Extrafahrt zu schicken.
  function altZelle(o){
    const a = o.alt;
    if (!a) return '<span class="muted small">kein eigener Supercharger-Nachweis in der Nähe — in der Tesla-App prüfen</span>';
    const nachts = a.preis_off ? ` · nachts ${ekwh(a.preis_off)}` : '';
    if (a.am_ort) {
      return `<b style="color:var(--good);">direkt in ${esc(a.o)}</b>
        <span class="small muted">· ${esc(a.st)} · ${ekwh(a.preis)}${nachts}</span>`;
    }
    if (a.lohnt) {
      return `<b>${esc(a.o)}</b> <span class="small muted">· ${a.km} km · ${ekwh(a.preis)}${nachts}
        · spart ${eu(a.ersparnis_je_ladung)} je Ladung nach Abzug des Umwegs</span>`;
    }
    return `<span class="muted small">nächster eigener Supercharger ist <b>${esc(a.o)}</b> in ${a.km} km —
      <b style="color:var(--yellow);">dieser Umweg rechnet sich nicht</b>
      (${eu(a.ersparnis_je_ladung)} Ersparnis gegen ${eu(a.umweg_kosten)} Mehrverbrauch).
      In der Tesla-App prüfen, ob es vor Ort einen gibt.</span>`;
  }

  function fahrerBlatt(f){
    const tipps = tippsFuer(f);
    const tot = f.dkv_kwh + f.tesla_kwh;
    const dq = tot ? f.dkv_kwh/tot : 0;
    const proMonat = f.vermeidbar / Math.max(1, f.monate_aktiv);

    return `
      <div class="card accent fahrerblatt" style="margin-bottom:14px;">
        <div class="card-h">
          <h3>${esc(f.name)}
            ${f.ist_tesla ? '' : `<span class="badge" style="margin-left:7px;">${esc(f.marke)}</span>`}
          </h3>
          <span class="h-sub">${f.kfz.map(esc).join(' · ')} · ${f.ges.map(esc).join('/')} ·
            Hauptladeort ${esc(f.haupt_ort)} (${pct(f.haupt_ort_anteil)} der Ladungen)</span>
          <span class="h-meta">${num(f.monate_aktiv,0)} Monate · ${num(f.n,0)} Ladungen</span>
        </div>

        <div class="kpis" style="grid-template-columns:repeat(6,1fr);margin-bottom:14px;">
          <div class="kpi hi"><div class="label">Einsparpotenzial</div><div class="val">${eu(f.vermeidbar)}</div>
            <div class="extra">${eu(proMonat)} / Monat</div></div>
          <div class="kpi"><div class="label">Ladekosten</div><div class="val">${eu(f.ist_eur)}</div>
            <div class="extra">${pct1(f.quote)} davon vermeidbar</div></div>
          <div class="kpi"><div class="label">Ø Preis</div><div class="val">${(f.preis*100).toFixed(1).replace('.',',')}<span class="u">ct/kWh</span></div>
            <div class="extra">Referenz ${(K.referenz*100).toFixed(0)} ct</div></div>
          <div class="kpi"><div class="label">Energie</div><div class="val">${num(f.kwh,0)}<span class="u">kWh</span></div>
            <div class="extra">${num(f.monate_aktiv,0)} Monate aktiv</div></div>
          <div class="kpi"><div class="label">DKV-Anteil</div><div class="val">${pct(dq)}</div>
            <div class="extra">${num(f.dkv_kwh,0)} kWh DKV · ${num(f.tesla_kwh,0)} Tesla</div></div>
          <div class="kpi"><div class="label">im Peak geladen</div>
            <div class="val">${f.peak_quote===null?'—':pct(f.peak_quote)}</div>
            <div class="extra">${f.peak_quote===null?'keine Uhrzeit im Beleg':'08–22 Uhr'}</div></div>
        </div>

        ${(f.teure_orte && f.teure_orte.length) ? `
        <table class="dt" style="margin-bottom:12px;">
          <thead><tr><th>Ladeorte mit Potenzial</th><th class="num">Ladungen</th><th class="num">kWh</th>
            <th class="num">bezahlt</th><th class="num">Potenzial</th><th>Supercharger, den wir selbst nutzen</th></tr></thead>
          <tbody>
            ${f.teure_orte.map(o => `
              <tr>
                <td><b>${esc(o.o)}</b></td>
                <td class="num">${num(o.n,0)}</td>
                <td class="num">${num(o.kwh,0)}</td>
                <td class="num">${ekwh(o.preis)}</td>
                <td class="num"><b>${eu(o.verm)}</b></td>
                <td>${altZelle(o)}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : ''}

        ${tipps.map(t => `
          <div style="border-left:3px solid ${t.p===1?'var(--yellow)':t.p===2?'var(--info)':'var(--rule)'};padding:9px 0 9px 13px;margin-bottom:10px;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
              <b style="font-size:15px;color:#fff;">${t.kopf}</b>
              ${t.spar ? `<span class="pill yellow">${eu(t.spar)} Potenzial</span>` : ''}
            </div>
            <div style="font-size:13.5px;line-height:1.6;color:var(--ink-2);">${t.body}</div>
          </div>`).join('')}
      </div>`;
  }

  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, { renderEffizienz, renderTipps });
})();
