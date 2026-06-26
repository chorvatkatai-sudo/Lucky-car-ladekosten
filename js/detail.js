// Lucky Car Ladestatistik · Detail-Ladungen Tab + universelle Tab-Suche
(function(){
  const D = window.LCData;
  const {
    SESSIONS, IDLE_PENALTIES, MONTHS, MONTH_LABELS,
    COUNTRY_NAMES, eu, num, pct, sumBy, aggregate, withAvg
  } = D;

  // — Helpers
  const COUNTRY_RX = /,\s*(Austria|Germany|Czech Republic|Slovenia|Italy|Hungary|Croatia)\s*$/;
  const cleanSite = st => (st || '').replace(COUNTRY_RX, '').trim() || '—';

  function durMin(s) {
    if (s.s && s.e) {
      const d = (new Date(s.e) - new Date(s.s)) / 60000;
      if (isFinite(d) && d > 0) return Math.round(d);
    }
    return s.dm || s.im || null;
  }
  const BELEGE = window.BELEGE_DATA || {};
  const fmtDate = iso => iso ? iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(2,4) : '—';
  const fmtTime = iso => iso ? iso.slice(11,16) : '—';
  const fmtDur  = m => m == null ? '—' : (m >= 60 ? Math.floor(m/60)+'h '+(m%60)+'m' : m+' min');

  // ============================================================================
  // DETAIL-LADUNGEN
  // ============================================================================
  const COUNTRIES = [...new Set(SESSIONS.map(s=>s.c))].filter(Boolean).sort();
  const GES = [...new Set(SESSIONS.map(s=>s.g))].filter(Boolean).sort();

  const state = { q:'', month:'all', country:'all', ges:'all', kind:'all', sortKey:'date', sortDir:'desc' };

  const SORTERS = {
    date:    s => s.s || '',
    dur:     s => durMin(s) || 0,
    site:    s => cleanSite(s.st).toLowerCase(),
    country: s => s.c || '',
    kind:    s => s.kd || '',
    kfz:     s => s.k || '',
    fahrer:  s => (s.f || '').toLowerCase(),
    ges:     s => s.g || '',
    kwh:     s => s.kw || 0,
    eur:     s => s.eu || 0,
    rate:    s => s.kw > 0 ? s.eu / s.kw : 0,
    idle:    s => s.im || 0
  };

  function getFiltered() {
    const q = state.q.trim().toLowerCase();
    let list = SESSIONS.filter(s => {
      if (state.month   !== 'all' && s.m  !== state.month)   return false;
      if (state.country !== 'all' && s.c  !== state.country) return false;
      if (state.ges     !== 'all' && s.g  !== state.ges)     return false;
      if (state.kind    !== 'all' && s.kd !== state.kind)    return false;
      if (q) {
        const hay = (s.st+' '+s.f+' '+s.k+' '+s.v+' '+s.c+' '+s.g).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const fn = SORTERS[state.sortKey] || SORTERS.date;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    list.sort((a,b) => {
      const va = fn(a), vb = fn(b);
      if (va < vb) return -1*dir;
      if (va > vb) return  1*dir;
      return 0;
    });
    return list;
  }

  function renderDetail(host) {
    const opt = (v,l,cur) => `<option value="${v}" ${v===cur?'selected':''}>${l}</option>`;
    host.innerHTML = `
      <h1 style="font-weight:900;font-size:32px;letter-spacing:-0.5px;margin:0 0 4px;">Detail-Ladungen</h1>
      <p style="margin:0 0 16px;color:var(--ink-3);font-size:14px;">Jede einzelne Lade-Session — von wann bis wann, wo, welche Ladeart, Fahrzeug &amp; Fahrer. Suchbar, filterbar &amp; sortierbar.</p>

      <div id="detail-kpis" class="kpis" style="grid-template-columns:repeat(5,1fr);"></div>

      <div class="filter-bar" style="flex-wrap:wrap;gap:14px 18px;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FFE500" stroke-width="2.2" style="flex-shrink:0;"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input type="search" id="dt-q" placeholder="Standort, Fahrer, Kennzeichen oder FIN suchen …" value="${state.q}" style="flex:1;min-width:0;" autocomplete="off" />
        </div>
        <div style="display:flex;align-items:center;gap:8px;"><label>Monat</label>
          <select id="dt-month">${opt('all','Alle Monate',state.month)}${MONTHS.map(m=>opt(m,MONTH_LABELS[m]||m,state.month)).join('')}</select></div>
        <div style="display:flex;align-items:center;gap:8px;"><label>Land</label>
          <select id="dt-country">${opt('all','Alle',state.country)}${COUNTRIES.map(c=>opt(c,c+' · '+(COUNTRY_NAMES[c]||c),state.country)).join('')}</select></div>
        <div style="display:flex;align-items:center;gap:8px;"><label>Ges.</label>
          <select id="dt-ges">${opt('all','Alle',state.ges)}${GES.map(g=>opt(g,g,state.ges)).join('')}</select></div>
        <div style="display:flex;align-items:center;gap:8px;"><label>Ladeart</label>
          <select id="dt-kind">${opt('all','Alle',state.kind)}${opt('kwh','kWh-Tarif',state.kind)}${opt('zeit','Zeit-Tarif',state.kind)}</select></div>
        <button id="dt-reset" style="background:transparent;color:var(--yellow);border:1px solid var(--yellow);padding:5px 12px;font-family:inherit;font-weight:600;font-size:11px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">Zurücksetzen</button>
        <button id="dt-csv" style="background:var(--yellow);color:var(--ink);border:0;padding:6px 13px;font-family:inherit;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>Export (Excel/CSV)</button>
        <div class="filter-info" id="dt-info"></div>
      </div>

      <div class="card" style="padding:0;border-top:0;">
        <div id="detail-table"></div>
      </div>
    `;

    const q = host.querySelector('#dt-q');
    q.addEventListener('input', e => { state.q = e.target.value; update(host); });
    host.querySelector('#dt-month').addEventListener('change',  e => { state.month   = e.target.value; update(host); });
    host.querySelector('#dt-country').addEventListener('change',e => { state.country = e.target.value; update(host); });
    host.querySelector('#dt-ges').addEventListener('change',    e => { state.ges     = e.target.value; update(host); });
    host.querySelector('#dt-kind').addEventListener('change',   e => { state.kind    = e.target.value; update(host); });
    host.querySelector('#dt-reset').addEventListener('click', () => {
      Object.assign(state, { q:'', month:'all', country:'all', ges:'all', kind:'all' });
      renderDetail(host);
    });
    host.querySelector('#dt-csv').addEventListener('click', exportCSV);

    update(host);
  }

  function update(host) {
    const list = getFiltered();
    const agg = withAvg(aggregate(list));
    const zeitN = list.filter(s=>s.kd==='zeit').length;
    const zeitEur = sumBy(list.filter(s=>s.kd==='zeit'), s=>s.eu);

    // KPIs
    host.querySelector('#detail-kpis').innerHTML = `
      <div class="kpi hi"><div class="label">Treffer</div><div class="val">${list.length}</div><div class="extra">von ${SESSIONS.length} Sessions</div></div>
      <div class="kpi"><div class="label">Energie</div><div class="val">${num(agg.kwh,0)}<span class="u">kWh</span></div><div class="extra">${agg.n? num(agg.kwh/agg.n,1):'0'} kWh Ø</div></div>
      <div class="kpi"><div class="label">Kosten</div><div class="val" style="font-size:26px;">${eu(agg.eur)}</div><div class="extra">gefilterte Summe</div></div>
      <div class="kpi"><div class="label">Ø Preis</div><div class="val">${agg.avg_eur_kwh.toFixed(2)}<span class="u">€/kWh</span></div><div class="extra">der Auswahl</div></div>
      <div class="kpi ${zeitN?'warn':'good'}"><div class="label">Zeit-Tarif</div><div class="val">${zeitN}</div><div class="extra">${eu(zeitEur)} vermeidbar</div></div>
    `;

    host.querySelector('#dt-info').innerHTML = `<b>${list.length}</b> Sessions · <b>${num(agg.kwh,0)}</b> kWh · <b>${eu(agg.eur)}</b>`;

    // Sortable header
    const caret = key => state.sortKey===key ? `<span style="color:var(--ink);font-size:9px;margin-left:2px;">${state.sortDir==='asc'?'▲':'▼'}</span>` : '';
    const th = (key, label, cls='') => `<th class="${cls} sortable" data-sort="${key}" style="cursor:pointer;user-select:none;${state.sortKey===key?'color:var(--ink);background:var(--yellow-3);':''}">${label}${caret(key)}</th>`;

    const rows = list.map(s => {
      const m = durMin(s);
      const rate = s.kw > 0 ? (s.eu/s.kw) : null;
      const kindBadge = s.kd==='zeit'
        ? '<span class="badge kind-zeit">Zeit</span>'
        : '<span class="badge kind-kwh">kWh</span>';
      const beleg = BELEGE[s.i]
        ? `<a href="${BELEGE[s.i]}" target="_blank" rel="noopener" title="Rechnungsbeleg öffnen" style="display:inline-flex;align-items:center;gap:3px;color:var(--info);font-weight:700;text-decoration:none;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>PDF</a>`
        : '<span class="muted">—</span>';
      return `<tr>
        <td class="nowrap"><b>${fmtDate(s.s)}</b></td>
        <td class="num mono" style="white-space:nowrap;">${fmtTime(s.s)}<span class="muted"> – </span>${fmtTime(s.e)}</td>
        <td class="num">${fmtDur(m)}</td>
        <td>${cleanSite(s.st)}</td>
        <td class="center"><span class="badge country">${s.c||'—'}</span></td>
        <td class="center">${kindBadge}</td>
        <td><b>${s.k||'—'}</b></td>
        <td>${s.f||'—'}</td>
        <td class="center"><span class="badge ges-${(s.g||'').toLowerCase()}">${s.g||'—'}</span></td>
        <td class="num">${s.kw ? num(s.kw,1) : '—'}</td>
        <td class="num"><b>${eu(s.eu)}</b></td>
        <td class="num">${rate!=null ? rate.toFixed(2) : '—'}</td>
        <td class="num">${s.im ? '<b style="color:var(--warn);">'+s.im+'</b>' : '<span class="muted">0</span>'}</td>
        <td class="center">${beleg}</td>
      </tr>`;
    }).join('');

    host.querySelector('#detail-table').innerHTML = `
      <table class="dt" style="font-size:13px;">
        <thead><tr>
          ${th('date','Datum')}
          ${th('date','Von – Bis','num')}
          ${th('dur','Dauer','num')}
          ${th('site','Standort')}
          ${th('country','Land','center')}
          ${th('kind','Art','center')}
          ${th('kfz','Fahrzeug')}
          ${th('fahrer','Fahrer')}
          ${th('ges','Ges.','center')}
          ${th('kwh','kWh','num')}
          ${th('eur','€','num')}
          ${th('rate','€/kWh','num')}
          ${th('idle','Idle min','num')}
          <th class="center">Beleg</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="14" class="empty">Keine Sessions für diese Filter — Auswahl anpassen oder zurücksetzen.</td></tr>'}</tbody>
      </table>
    `;

    // Bind sort
    host.querySelectorAll('#detail-table th[data-sort]').forEach(h => {
      h.addEventListener('click', () => {
        const key = h.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = (key==='date') ? 'desc' : (key==='site'||key==='fahrer'||key==='kfz'||key==='country'||key==='ges'||key==='kind') ? 'asc' : 'desc';
        }
        update(host);
      });
    });
  }

  // — CSV / Excel Export (gefilterte Auswahl, DE-Excel-freundlich)
  function exportCSV() {
    const list = getFiltered();
    const head = ['Datum','Start','Stop','Dauer (min)','Standort','Land','Ladeart','Fahrzeug','Fahrer','Gesellschaft','kWh','EUR','EUR/kWh','Idle (min)','Beleg'];
    const dec = v => (v==null||v==='') ? '' : String(v).replace('.', ',');
    const q = v => { v = (v==null?'':String(v)); return '"'+v.replace(/"/g,'""')+'"'; };
    const lines = [head.map(q).join(';')];
    for (const s of list) {
      const m = durMin(s);
      const rate = s.kw > 0 ? (s.eu/s.kw) : '';
      lines.push([
        q(fmtDate(s.s)), q(fmtTime(s.s)), q(fmtTime(s.e)), q(m==null?'':m),
        q(cleanSite(s.st)), q(s.c||''), q(s.kd==='zeit'?'Zeit-Tarif':'kWh-Tarif'),
        q(s.k||''), q(s.f||''), q(s.g||''),
        q(s.kw ? dec(s.kw.toFixed(2)) : ''), q(dec(s.eu.toFixed(2))),
        q(rate!=='' ? dec(rate.toFixed(3)) : ''), q(s.im||0),
        q(BELEGE[s.i] || '')
      ].join(';'));
    }
    const csv = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Lucky_Car_Ladungen_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ============================================================================
  // UNIVERSELLE TAB-SUCHE  (Text-Filter über alle Tabellen/Ranglisten im Tab)
  // ============================================================================
  function attachTabSearch(section) {
    if (section.querySelector(':scope > .tab-search')) return; // already attached

    const bar = document.createElement('div');
    bar.className = 'tab-search empty';
    bar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
      <input type="search" placeholder="In diesem Tab suchen … (Standort, Fahrer, Kennzeichen, Land …)" autocomplete="off" />
      <span class="ts-count"></span>
      <button class="ts-clear">Zurücksetzen</button>
    `;
    section.insertBefore(bar, section.firstChild);

    const input = bar.querySelector('input');
    const countEl = bar.querySelector('.ts-count');
    const clearBtn = bar.querySelector('.ts-clear');

    const obs = new MutationObserver(() => apply());

    function rowsOf(table) {
      const tb = table.querySelectorAll('tbody tr');
      if (tb.length) return [...tb];
      return [...table.querySelectorAll('tr')].filter(r => !r.querySelector('th'));
    }

    function apply() {
      obs.disconnect();
      const q = input.value.trim().toLowerCase();
      let total = 0, shown = 0;
      section.querySelectorAll('table.dt').forEach(t => {
        rowsOf(t).forEach(r => {
          // skip "empty/colspan" rows
          if (r.children.length === 1 && r.querySelector('.empty')) return;
          total++;
          const match = !q || r.textContent.toLowerCase().includes(q);
          r.style.display = match ? '' : 'none';
          if (match) shown++;
        });
      });
      section.querySelectorAll('.leader').forEach(l => {
        total++;
        const match = !q || l.textContent.toLowerCase().includes(q);
        l.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      bar.classList.toggle('empty', !q);
      countEl.textContent = q ? `${shown} / ${total} Treffer` : `${total} Zeilen`;
      obs.observe(section, { childList:true, subtree:true });
    }

    input.addEventListener('input', apply);
    clearBtn.addEventListener('click', () => { input.value = ''; apply(); input.focus(); });

    apply();
  }

  // — Export
  window.LCApp = window.LCApp || {};
  Object.assign(window.LCApp, { renderDetail, attachTabSearch });
})();
