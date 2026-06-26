// Lucky Car Ladestatistik · Shared utilities & data helpers

(function(){
  const D = window.SESSIONS_DATA;
  const SESSIONS = D.s;  // array of sessions
  const IDLE_PENALTIES = D.ip;

  // — Formatting helpers
  const eu = v => '€ ' + v.toLocaleString('de-AT', {minimumFractionDigits:2, maximumFractionDigits:2});
  const num = (v, dec=0) => v.toLocaleString('de-AT', {minimumFractionDigits:dec, maximumFractionDigits:dec});
  const pct = v => (v*100).toFixed(0) + ' %';
  const pct1 = v => (v*100).toFixed(1) + ' %';

  const MONTHS = [...new Set(SESSIONS.map(s=>s.m))].sort();
  const MONTH_LABELS = {
    '2025-12':'Dezember 2025','2026-01':'Januar 2026','2026-02':'Februar 2026',
    '2026-03':'März 2026','2026-04':'April 2026','2026-05':'Mai 2026'
  };
  const MONTH_SHORT = {
    '2025-12':'DEZ','2026-01':'JAN','2026-02':'FEB',
    '2026-03':'MRZ','2026-04':'APR','2026-05':'MAI'
  };
  // Labels/Kürzel für neu hinzukommende Monate automatisch ergänzen (z. B. via Upload)
  const _M_DE = ['','Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const _M_SH = ['','JAN','FEB','MRZ','APR','MAI','JUN','JUL','AUG','SEP','OKT','NOV','DEZ'];
  MONTHS.forEach(m => {
    const mo = +(''+m).split('-')[1], y = (''+m).split('-')[0];
    if(!MONTH_LABELS[m] && mo>=1 && mo<=12) MONTH_LABELS[m] = _M_DE[mo]+' '+y;
    if(!MONTH_SHORT[m] && mo>=1 && mo<=12) MONTH_SHORT[m] = _M_SH[mo];
  });
  const COUNTRY_NAMES = {AT:'Österreich',DE:'Deutschland',CZ:'Tschechien',SI:'Slowenien',IT:'Italien',HU:'Ungarn',HR:'Kroatien'};
  const COUNTRY_FLAGS = {AT:'🇦🇹',DE:'🇩🇪',CZ:'🇨🇿',SI:'🇸🇮',IT:'🇮🇹',HU:'🇭🇺',HR:'🇭🇷'};
  // Use country code badges (no emoji to stay neutral)

  // — Aggregation utilities
  function sumBy(arr, fn) {
    return arr.reduce((a,r)=>a+fn(r), 0);
  }
  function groupBy(arr, keyFn) {
    const m = {};
    for (const r of arr) {
      const k = keyFn(r);
      (m[k] ??= []).push(r);
    }
    return m;
  }
  function aggregate(arr) {
    return {
      n: arr.length,
      eur: sumBy(arr, r=>r.eu),
      kwh: sumBy(arr, r=>r.kw),
      zeit_n: arr.filter(r=>r.kd==='zeit').length,
      zeit_eur: sumBy(arr.filter(r=>r.kd==='zeit'), r=>r.eu),
      kwh_n: arr.filter(r=>r.kd==='kwh').length,
      kwh_eur: sumBy(arr.filter(r=>r.kd==='kwh'), r=>r.eu),
      avg_eur_kwh: 0  // computed below
    };
  }
  function withAvg(agg) {
    agg.avg_eur_kwh = agg.kwh > 0 ? agg.eur / agg.kwh : 0;
    agg.vermeidbar = agg.zeit_eur + 0;  // zeit-tariff is the avoidable cost
    agg.vermeidbar_pct = agg.eur > 0 ? agg.zeit_eur / agg.eur : 0;
    return agg;
  }

  // — Filters
  function byMonth(month) { return SESSIONS.filter(s => s.m === month); }
  function byMonths(months) { return SESSIONS.filter(s => months.includes(s.m)); }
  function byVehicle(kfz) { return SESSIONS.filter(s => s.k === kfz); }
  function byDriver(fahrer) { return SESSIONS.filter(s => s.f === fahrer); }
  function byCountry(country) { return SESSIONS.filter(s => s.c === country); }

  // — Quarters
  const QUARTERS = {
    'Q4-2025': { label:'Q4 2025', months:['2025-12'] },
    'Q1-2026': { label:'Q1 2026', months:['2026-01','2026-02','2026-03'] },
    'Q2-2026': { label:'Q2 2026', months:['2026-04','2026-05','2026-06'] }
  };

  // — Vehicle/Driver/Station/Country aggregates
  function byField(field, sessions = SESSIONS) {
    const g = groupBy(sessions, r=>r[field] || '(?)');
    return Object.entries(g).map(([k, rs]) => withAvg({ key:k, ...aggregate(rs), rows:rs }))
      .sort((a,b)=>b.eur - a.eur);
  }

  // Compute Vehicle/Driver/Gesellschaft cross-reference
  function getVehicleMeta() {
    const map = {};
    for (const s of SESSIONS) {
      if (!s.k || s.k === '(?)') continue;
      if (!map[s.k]) {
        map[s.k] = { kfz:s.k, vin:s.v, fahrer:s.f, ges:s.g, source:s.src,
                     sessions:[], months:new Set(), countries:new Set() };
      }
      map[s.k].sessions.push(s);
      map[s.k].months.add(s.m);
      map[s.k].countries.add(s.c);
    }
    return Object.values(map).map(v => {
      const agg = withAvg(aggregate(v.sessions));
      return {
        ...v,
        ...agg,
        months: [...v.months].sort(),
        countries: [...v.countries].sort(),
        active_months: v.months.size,
        cost_per_session: agg.n > 0 ? agg.eur / agg.n : 0
      };
    }).sort((a,b) => b.eur - a.eur);
  }

  // — Day-of-week / hour-of-day analysis
  function byHour(sessions = SESSIONS) {
    const r = Array(24).fill(0).map(()=>({n:0, eur:0}));
    for (const s of sessions) {
      if (s.h != null) { r[s.h].n++; r[s.h].eur += s.eu; }
    }
    return r;
  }
  function byWeekday(sessions = SESSIONS) {
    const r = Array(7).fill(0).map(()=>({n:0, eur:0}));
    for (const s of sessions) {
      if (s.wd != null) { r[s.wd].n++; r[s.wd].eur += s.eu; }
    }
    return r;
  }

  // — SVG chart helpers
  function svgBars(data, opts = {}) {
    // data: [{label, value, sublabel?}]
    const {
      width = 800, height = 220, padL = 50, padR = 20, padT = 30, padB = 50,
      barColor = '#FFE500', barStroke = 'var(--chart-ink,#0d0d0d)', showLabels = true, format = v => v
    } = opts;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const max = Math.max(...data.map(d=>d.value), 0.1);
    const colW = innerW / data.length;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart">`;
    svg += `<line x1="${padL}" y1="${padT+innerH}" x2="${width-padR}" y2="${padT+innerH}" stroke="var(--chart-ink,#0d0d0d)" stroke-width="1.5"/>`;
    data.forEach((d, i) => {
      const barW = colW * 0.7;
      const x = padL + i*colW + (colW - barW)/2;
      const h = max > 0 ? (d.value / max) * innerH : 0;
      const y = padT + innerH - h;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${barColor}" stroke="${barStroke}" stroke-width="1"/>`;
      if (showLabels) {
        svg += `<text x="${(x+barW/2).toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-weight="700" font-size="13" fill="var(--chart-ink,#0d0d0d)">${format(d.value)}</text>`;
      }
      svg += `<text x="${(x+barW/2).toFixed(1)}" y="${(padT+innerH+15).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="12" fill="var(--chart-ink,#0d0d0d)" font-weight="600">${d.label}</text>`;
      if (d.sublabel) {
        svg += `<text x="${(x+barW/2).toFixed(1)}" y="${(padT+innerH+30).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="10" fill="var(--chart-mut,#6a6a6a)">${d.sublabel}</text>`;
      }
    });
    svg += `</svg>`;
    return svg;
  }

  // — Area / line chart (used for the monthly trend on the overview)
  function svgAreaLine(data, opts = {}) {
    // data: [{label, value, sublabel?}]
    const {
      width = 1200, height = 260, padL = 52, padR = 24, padT = 30, padB = 50,
      line = 'var(--yellow,#FFE500)', fill = 'var(--chart-area,rgba(255,229,0,0.10))',
      grid = 'var(--chart-track,#e5e3dc)', txt = 'var(--chart-mut,#6a6a6a)',
      ink = 'var(--chart-ink,#0d0d0d)', format = v => v
    } = opts;
    const n = data.length;
    const max = Math.max(...data.map(d => d.value), 0.1) * 1.18;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const x = i => padL + (n <= 1 ? innerW/2 : innerW * i / (n - 1));
    const y = v => padT + innerH - (v / max) * innerH;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart" style="width:100%;height:auto;display:block;">`;
    // gridlines + y labels
    for (let r = 0; r <= 4; r++) {
      const yy = padT + innerH * r / 4;
      svg += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${width-padR}" y2="${yy.toFixed(1)}" stroke="${grid}" stroke-width="1" ${r===4?'':'stroke-dasharray="2 5"'}/>`;
      svg += `<text x="${padL-10}" y="${(yy+4).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono" font-size="11" fill="${txt}">${format(max*(1-r/4))}</text>`;
    }
    const pts = data.map((d,i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
    // area fill
    svg += `<path d="M${padL},${padT+innerH} L${pts.join(' L')} L${(width-padR)},${padT+innerH} Z" fill="${fill}"/>`;
    // line
    svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${line}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    // dots + value labels + x labels
    data.forEach((d,i) => {
      const px = x(i), py = y(d.value);
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" fill="var(--paper,#0c0d10)" stroke="${line}" stroke-width="2.5"/>`;
      svg += `<text x="${px.toFixed(1)}" y="${(py-14).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="13" fill="${ink}">${format(d.value)}</text>`;
      svg += `<text x="${px.toFixed(1)}" y="${(padT+innerH+20).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-weight="600" font-size="13" fill="${ink}">${d.label}</text>`;
      if (d.sublabel) svg += `<text x="${px.toFixed(1)}" y="${(padT+innerH+36).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="11" fill="${txt}">${d.sublabel}</text>`;
    });
    svg += `</svg>`;
    return svg;
  }

  function svgStackedBars(rows, opts = {}) {
    // rows: [{label, segments: [{value, color, label?}]}]
    const {
      width = 800, height = 280, padL = 100, padR = 20, padT = 20, padB = 30,
      labelKey = 'label'
    } = opts;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const max = Math.max(...rows.map(r => r.segments.reduce((a,s)=>a+s.value, 0)), 0.1);
    const rowH = innerH / rows.length;
    const barH = Math.min(rowH * 0.7, 24);

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart">`;
    rows.forEach((r, i) => {
      const y = padT + i*rowH + (rowH - barH)/2;
      svg += `<text x="${padL-8}" y="${(y+barH/2+4).toFixed(1)}" text-anchor="end" font-family="Roboto Condensed" font-size="13" fill="var(--chart-ink,#0d0d0d)" font-weight="600">${r[labelKey]}</text>`;
      let cx = padL;
      r.segments.forEach(seg => {
        const w = (seg.value / max) * innerW;
        svg += `<rect x="${cx.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${barH}" fill="${seg.color}" stroke="var(--chart-ink,#0d0d0d)" stroke-width="0.8"/>`;
        if (w > 30 && seg.label) {
          svg += `<text x="${(cx+w/2).toFixed(1)}" y="${(y+barH/2+4).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="11" fill="var(--chart-ink,#0d0d0d)" font-weight="700">${seg.label}</text>`;
        }
        cx += w;
      });
      // Total label
      const total = r.segments.reduce((a,s)=>a+s.value, 0);
      svg += `<text x="${(cx+8).toFixed(1)}" y="${(y+barH/2+4).toFixed(1)}" font-family="Roboto Condensed" font-size="12" fill="var(--chart-ink,#0d0d0d)" font-weight="700">${total.toFixed(0).toLocaleString('de-AT')}</text>`;
    });
    svg += `</svg>`;
    return svg;
  }

  function svgDonut(segments, opts = {}) {
    // segments: [{value, color, label?}]
    const { size = 200, stroke = 30, total: tot = null } = opts;
    const r = (size/2) - stroke/2 - 2;
    const cx = size/2, cy = size/2;
    const total = tot ?? segments.reduce((a,s)=>a+s.value, 0);
    const circ = 2*Math.PI*r;
    let offset = 0;
    let svg = `<svg viewBox="0 0 ${size} ${size}" style="display:block;">`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--chart-track,#e5e3dc)" stroke-width="${stroke}"/>`;
    for (const seg of segments) {
      const len = (seg.value/total) * circ;
      if (len < 0.1) continue;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}" stroke-dasharray="${len.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="${-offset.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
    }
    svg += `</svg>`;
    return svg;
  }

  function svgSpark(values, opts = {}) {
    // small bar sparkline
    const { width = 80, height = 24, color = 'var(--chart-ink,#0d0d0d)' } = opts;
    const max = Math.max(...values, 0.1);
    const cw = width / values.length;
    let svg = `<svg viewBox="0 0 ${width} ${height}" style="display:inline-block;vertical-align:middle;">`;
    values.forEach((v, i) => {
      const h = Math.max(1, (v / max) * (height - 2));
      const y = height - h;
      svg += `<rect x="${(i*cw + 0.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(cw - 1).toFixed(1)}" height="${h.toFixed(1)}" fill="${v > 0 ? color : 'var(--chart-track,#e5e3dc)'}"/>`;
    });
    svg += `</svg>`;
    return svg;
  }

  function svgHeatmap(values24x7, opts = {}) {
    // values24x7: 7 weekday rows × 24 hour columns of {n, eur}
    const { cellSize = 22, padL = 60, padT = 20, padB = 24 } = opts;
    const w = padL + 24*cellSize + 20;
    const h = padT + 7*cellSize + padB;
    const maxN = Math.max(...values24x7.flat().map(c=>c.n), 1);
    const days = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    let svg = `<svg viewBox="0 0 ${w} ${h}">`;
    // X axis (hours)
    for (let i = 0; i < 24; i++) {
      if (i % 2 === 0) {
        svg += `<text x="${(padL + i*cellSize + cellSize/2).toFixed(1)}" y="${(padT-6).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="10" fill="var(--chart-mut,#6a6a6a)">${i.toString().padStart(2,'0')}</text>`;
      }
    }
    // Rows
    for (let d = 0; d < 7; d++) {
      const dayLabel = days[d];
      svg += `<text x="${padL-8}" y="${(padT + d*cellSize + cellSize/2 + 4).toFixed(1)}" text-anchor="end" font-family="Roboto Condensed" font-size="11" fill="var(--chart-ink,#0d0d0d)" font-weight="600">${dayLabel}</text>`;
      for (let i = 0; i < 24; i++) {
        const v = values24x7[d][i];
        const intensity = v.n / maxN;
        const fill = intensity === 0 ? 'var(--chart-empty,#f5f3eb)' : `rgba(255, 229, 0, ${0.2 + intensity*0.8})`;
        svg += `<rect class="heat-cell" x="${(padL + i*cellSize).toFixed(1)}" y="${(padT + d*cellSize).toFixed(1)}" width="${cellSize}" height="${cellSize}" fill="${fill}" stroke="var(--chart-ink,#0d0d0d)" stroke-width="0.3"/>`;
        if (v.n > 0) {
          svg += `<text x="${(padL + i*cellSize + cellSize/2).toFixed(1)}" y="${(padT + d*cellSize + cellSize/2 + 3.5).toFixed(1)}" text-anchor="middle" font-family="Roboto Condensed" font-size="9" fill="var(--chart-ink,#0d0d0d)" font-weight="600">${v.n}</text>`;
        }
      }
    }
    svg += `</svg>`;
    return svg;
  }

  // — Compute master stats (called once)
  function masterStats() {
    const agg = withAvg(aggregate(SESSIONS));
    const months_n = MONTHS.length;
    const drivers = new Set(SESSIONS.map(s=>s.f).filter(f=>f && f !== '(?)')).size;
    const vehicles = new Set(SESSIONS.map(s=>s.k).filter(k=>k && k !== '(?)')).size;
    const countries = new Set(SESSIONS.map(s=>s.c)).size;
    const stations = new Set(SESSIONS.map(s=>s.st)).size;
    return { ...agg, months_n, drivers, vehicles, countries, stations };
  }

  // — Helpers exposed
  window.LCData = {
    SESSIONS, IDLE_PENALTIES, MONTHS, MONTH_LABELS, MONTH_SHORT,
    COUNTRY_NAMES, COUNTRY_FLAGS, QUARTERS,
    eu, num, pct, pct1,
    sumBy, groupBy, aggregate, withAvg,
    byMonth, byMonths, byVehicle, byDriver, byCountry, byField,
    getVehicleMeta, byHour, byWeekday, masterStats,
    svgBars, svgStackedBars, svgDonut, svgSpark, svgHeatmap, svgAreaLine
  };
})();
