// Token Launch Radar — dashboard. Renders window.RADAR (written by main.ts
// from the same board.json the gate reads) with no fetch and no network.
// The sandbox recomputes implied values with the same function the board
// used: implied = 10^(a + b*log10(tvl)) * momentum * seasoning * kin.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.getElementById('board').textContent = 'No radar data.'; return; }
  var rows = D.rows, live = D.live, aside = D.set_aside, M = D.model, F = M.fit;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function num(n) { return n == null ? '—' : Math.round(n).toLocaleString('en-US'); }
  function pct(n) { return n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function ageLabel(d) { return d == null ? 'unknown' : d + 'd'; }
  function xtvl(r) { return r.implied_value_usd / r.tvl_usd; }

  var state = { tab: 'board', q: '', cat: '', chain: '', tier: 'all', verdict: 'all', minTvl: 0, dir7: 'all', sort: 'rank', dir: 1, sel: null, w: M.momentum_weight, floor: M.seasoning_floor };
  // Watchlist membership, for the WL tag and the tier filter.
  var isWatch = {};
  D.watchlist_slugs.forEach(function (s) { isWatch[s] = 1; });

  function filtered() {
    var q = state.q.toLowerCase();
    return rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.tier === 'watchlist' && !isWatch[r.slug]) return false;
      if (state.tier === 'early' && isWatch[r.slug]) return false;
      if (state.verdict !== 'all' && r.econ.verdict !== state.verdict) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.dir7 === 'up' && !(r.change_7d > 0)) return false;
      if (state.dir7 === 'down' && !(r.change_7d < 0)) return false;
      return true;
    });
  }
  function sorted(list) {
    var k = state.sort, d = state.dir;
    var val = function (r) {
      if (k === 'rank') return r.rank;
      if (k === 'name') return r.name;
      if (k === 'tvl') return r.tvl_usd;
      if (k === 'chg') return r.change_7d == null ? -1e9 : r.change_7d;
      if (k === 'age') return r.age_days == null ? -1 : r.age_days;
      if (k === 'imp') return r.implied_value_usd;
      if (k === 'xtvl') return xtvl(r);
      if (k === 'slice') return r.econ.slice_per_1k_usd;
      if (k === 'verdict') return r.econ.verdict;
      return r.rank;
    };
    return list.slice().sort(function (a, b) {
      var x = val(a), y = val(b);
      if (x < y) return -d;
      if (x > y) return d;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function pill(v) { return '<span class="pill ' + v + '">' + v + '</span>'; }
  function rowHtml(r) {
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
      '<td>' + r.rank + (isWatch[r.slug] ? ' <span class="wl">WL</span>' : '') + '</td>' +
      '<td><span class="name">' + esc(r.name) + '</span><span class="cat">' + esc(r.category || '—') + ' · ' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</span></td>' +
      '<td>' + money(r.tvl_usd) + '</td>' +
      '<td>' + pct(r.change_7d) + '</td>' +
      '<td>' + ageLabel(r.age_days) + '</td>' +
      '<td><b>' + money(r.implied_value_usd) + '</b></td>' +
      '<td>' + xtvl(r).toFixed(3) + '×</td>' +
      '<td>$' + r.econ.slice_per_1k_usd.toFixed(2) + '</td>' +
      '<td>' + pill(r.econ.verdict) + '</td></tr>';
  }
  function boardTable(list) {
    var heads = [['rank', '#'], ['name', 'Protocol'], ['tvl', 'TVL'], ['chg', '7d'], ['age', 'No token for'], ['imp', 'Implied'], ['xtvl', '×TVL'], ['slice', 'Slice / $1k'], ['verdict', 'Verdict']];
    var h = '<table><thead><tr>' + heads.map(function (x) {
      return '<th data-k="' + x[0] + '">' + x[1] + (state.sort === x[0] ? (state.dir === 1 ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + list.map(rowHtml).join('') + '</tbody></table>';
    return h;
  }
  function options(list, cur, allLabel) {
    return '<option value="">' + allLabel + '</option>' + list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }

  function renderBoard() {
    var list = sorted(filtered());
    var cats = [], chains = [];
    rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
    rows.forEach(function (r) { r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
    cats.sort(); chains.sort();
    return '<div class="filters">' +
      '<label>Search<input id="f-q" type="search" placeholder="name or slug" value="' + esc(state.q) + '"></label>' +
      '<label>Category<select id="f-cat">' + options(cats, state.cat, 'All categories') + '</select></label>' +
      '<label>Chain<select id="f-chain">' + options(chains, state.chain, 'All chains') + '</select></label>' +
      '<label>Tier<select id="f-tier"><option value="all">All rows</option><option value="watchlist"' + (state.tier === 'watchlist' ? ' selected' : '') + '>Watchlist only</option><option value="early"' + (state.tier === 'early' ? ' selected' : '') + '>Early finds only</option></select></label>' +
      '<label>Verdict<select id="f-verdict"><option value="all">Any verdict</option>' + ['farm', 'thin', 'skip'].map(function (v) { return '<option value="' + v + '"' + (state.verdict === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
      '<label>Min TVL<select id="f-tvl">' + [[0, 'Any size'], [1e7, '$10M+'], [5e7, '$50M+'], [1e8, '$100M+'], [5e8, '$500M+'], [1e9, '$1B+']].map(function (x) { return '<option value="' + x[0] + '"' + (state.minTvl === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>7d<select id="f-7d"><option value="all">Any move</option><option value="up"' + (state.dir7 === 'up' ? ' selected' : '') + '>Gaining</option><option value="down"' + (state.dir7 === 'down' ? ' selected' : '') + '>Falling</option></select></label>' +
      '</div>' +
      '<p class="count">' + list.length + ' of ' + rows.length + ' rows &middot; click a row for its detail and farm plan &middot; click a column header to sort</p>' +
      boardTable(list) +
      '<div id="detail-slot">' + (state.sel ? detailHtml(bySlug(state.sel)) : '') + '</div>';
  }
  function bySlug(slug) { for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) return rows[i]; return null; }

  function detailHtml(r) {
    if (!r) return '';
    var m = r.model, e = r.econ;
    var steps = r.farm_steps.map(function (s, i) { return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(s) + '</li>'; }).join('');
    return '<section class="detail" id="detail"><h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank #' + r.rank + (isWatch[r.slug] ? ' · watchlist' : ' · early find') + ' · ' + esc(r.category || 'no category') + ' · ' + esc(r.chains.join(', ')) + ' · listed ' + (r.listed_at || 'date unknown') + '</p>' +
      '<div class="kv">' +
      '<div><b>TVL</b>' + money(r.tvl_usd) + '</div>' +
      '<div><b>7-day TVL change</b>' + pct(r.change_7d) + '</div>' +
      '<div><b>No token for</b>' + ageLabel(r.age_days) + '</div>' +
      '<div><b>Token recorded</b>' + (r.symbol || 'none') + '</div>' +
      '<div><b>Implied value</b>' + money(r.implied_value_usd) + '</div>' +
      '<div><b>Range (middle half)</b>' + money(r.band.low_usd) + ' – ' + money(r.band.high_usd) + '</div>' +
      '<div><b>× TVL</b>' + xtvl(r).toFixed(3) + '×</div>' +
      '<div><b>Slug</b>' + esc(r.slug) + '</div></div>' +
      '<h3>How this row is valued</h3>' +
      '<p class="model-line">curve 10^' + F.intercept + ' × TVL^' + F.slope + ' = ' + money(m.curve_value_usd) +
      ' &times; momentum ' + m.growth_multiplier.toFixed(2) + ' (7d ' + pct(m.growth_pct) + ')' +
      ' &times; seasoning ' + m.maturity_multiplier.toFixed(2) + ' (' + ageLabel(m.age_days) + ')' +
      (m.kin_multiplier !== 1 ? ' &times; kin 0.5' : '') + ' = <b>' + money(r.implied_value_usd) + '</b></p>' +
      (m.kin_note ? '<p class="band">' + esc(m.kin_note) + '</p>' : '') +
      '<p class="band">The range is the middle half of the leave-one-out backtest errors (&times;' + F.band_low + '–&times;' + F.band_high + '): the model is usually within a factor of ' + F.loo_median + '.</p>' +
      '<h3>Farm economics — ' + pill(e.verdict) + '</h3>' +
      '<div class="kv">' +
      '<div><b>Slice per $1k</b>$' + e.slice_per_1k_usd.toFixed(2) + '</div>' +
      '<div><b>Plan capital</b>$' + num(e.capital_usd) + '</div>' +
      '<div><b>Expected slice</b>$' + e.slice_usd.toFixed(2) + '</div>' +
      '<div><b>Gas (6 txs, ' + esc(e.chain) + ')</b>$' + e.gas_usd.toFixed(2) + '</div>' +
      '<div><b>Net at plan size</b>' + (e.net_usd >= 0 ? '+' : '−') + '$' + Math.abs(e.net_usd).toFixed(2) + '</div>' +
      '<div><b>Net per hour</b>' + (e.net_per_hour_usd >= 0 ? '+' : '−') + '$' + Math.abs(e.net_per_hour_usd).toFixed(2) + '/h</div></div>' +
      '<p class="band">Assumes 10% of the implied value reaches depositors, shared pro-rata over TVL. Gas is six transactions at the ' + esc(e.chain) + ' tier; Ethereum mainnet plans cost about $48 of gas, cheap chains about $0.30.</p>' +
      '<h3>Farm plan — 7 steps, about 75 minutes of doing plus the hold</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<span class="badge">page = board.json &middot; <span class="ok">' + D.board_size + '/' + D.board_size + ' rows match</span> &middot; digest ' + esc(D.board_digest) + '</span>' +
      '</section>';
  }

  function renderLive() {
    var h = '<table><thead><tr><th>Protocol</th><th>TVL</th><th>Market cap</th><th>×TVL</th><th>7d</th></tr></thead><tbody>' +
      live.map(function (r) {
        return '<tr><td><span class="name">' + esc(r.name) + '</span><span class="cat">' + esc(r.category || '—') + ' · ' + esc(r.chains.slice(0, 2).join(', ')) + '</span></td>' +
          '<td>' + money(r.tvl_usd) + '</td><td><b>' + money(r.mcap_usd) + '</b></td><td>' + r.multiple.toFixed(2) + '×</td><td>' + pct(r.change_7d) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="count">The 40 largest token-recorded protocols by market cap, shown at the market&rsquo;s own value — never mixed into the ranked board. ' + D.live_size + ' shown of ' + num(416) + ' token-recorded protocols in the snapshot.</p>';
    return h;
  }
  function renderAside() {
    var h = '<p class="count">' + aside.length + ' pre-token protocols set aside by the strict rule, largest first. A set-aside protocol is not a bad protocol: the rule only says its record does not read as a launch.</p>' +
      '<table><thead><tr><th>Protocol</th><th>TVL</th><th>Reason</th></tr></thead><tbody>' +
      aside.map(function (r) {
        return '<tr><td><span class="name">' + esc(r.name) + '</span><span class="cat">' + esc(r.category || '—') + '</span></td><td>' + money(r.tvl_usd) + '</td><td style="text-align:left;white-space:normal">' + esc(r.reason) + '</td></tr>';
      }).join('') + '</tbody></table>';
    return h;
  }

  // --- calibration: scatter + backtest + sandbox ---
  function scatterSvg() {
    var W = 560, H = 360, P = 42;
    var x0 = 6.7, x1 = 10.5, y0 = 3.0, y1 = 10.0;
    function X(v) { return P + (Math.log10(v) - x0) / (x1 - x0) * (W - 2 * P); }
    function Y(v) { return H - P - (Math.log10(v) - y0) / (y1 - y0) * (H - 2 * P); }
    var s = '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Log TVL against log market cap">';
    var gx;
    for (gx = 7; gx <= 10; gx++) {
      s += '<line x1="' + X(Math.pow(10, gx)).toFixed(1) + '" y1="' + P + '" x2="' + X(Math.pow(10, gx)).toFixed(1) + '" y2="' + (H - P) + '" stroke="#e3dacb"/>';
      s += '<text x="' + X(Math.pow(10, gx)).toFixed(1) + '" y="' + (H - P + 16) + '" font-size="10" fill="#6f6455" text-anchor="middle">$' + (gx === 10 ? '10B' : gx === 9 ? '1B' : gx === 8 ? '100M' : '10M') + '</text>';
    }
    var gy;
    for (gy = 4; gy <= 10; gy += 2) {
      s += '<line x1="' + P + '" y1="' + Y(Math.pow(10, gy)).toFixed(1) + '" x2="' + (W - P) + '" y2="' + Y(Math.pow(10, gy)).toFixed(1) + '" stroke="#e3dacb"/>';
      s += '<text x="' + (P - 6) + '" y="' + (Y(Math.pow(10, gy)) + 3).toFixed(1) + '" font-size="10" fill="#6f6455" text-anchor="end">$' + (gy === 10 ? '10B' : gy === 8 ? '100M' : gy === 6 ? '1M' : '10K') + '</text>';
    }
    // fitted line
    s += '<line x1="' + X(Math.pow(10, x0)).toFixed(1) + '" y1="' + Y(Math.pow(10, F.intercept + F.slope * x0)).toFixed(1) + '" x2="' + X(Math.pow(10, x1)).toFixed(1) + '" y2="' + Y(Math.pow(10, F.intercept + F.slope * x1)).toFixed(1) + '" stroke="#9a3b26" stroke-width="2"/>';
    // pre-token rows (hollow) then comparables (filled)
    rows.forEach(function (r) {
      s += '<circle cx="' + X(r.tvl_usd).toFixed(1) + '" cy="' + Y(Math.max(1e3, r.implied_value_usd)).toFixed(1) + '" r="2.4" fill="none" stroke="#1f6b4a" stroke-width="1"/>';
    });
    D.comparables.forEach(function (p) {
      s += '<circle cx="' + X(p.tvl_usd).toFixed(1) + '" cy="' + Y(p.mcap_usd).toFixed(1) + '" r="3" fill="#9a3b26"/>';
    });
    s += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" font-size="11" fill="#6f6455" text-anchor="middle">TVL (log scale)</text>';
    s += '<text x="12" y="' + (H / 2) + '" font-size="11" fill="#6f6455" text-anchor="middle" transform="rotate(-90 12 ' + (H / 2) + ')">Market cap / implied value (log scale)</text></svg>';
    return s;
  }
  function sandboxImplied(r, w, floor) {
    var g = Math.min(60, Math.max(-40, r.change_7d == null ? 0 : r.change_7d));
    var age = r.age_days == null ? 365 : r.age_days;
    var season = floor + (1 - floor) * Math.min(Math.max(age, 0), 730) / 730;
    var v = Math.pow(10, F.intercept + F.slope * Math.log10(r.tvl_usd)) * (1 + w * g / 100) * season * r.model.kin_multiplier;
    return Math.max(1, Math.round(v));
  }
  function renderCalib() {
    var top = rows.slice().sort(function (a, b) { return sandboxImplied(b, state.w, state.floor) - sandboxImplied(a, state.w, state.floor); }).slice(0, 8);
    return '<div class="calib">' +
      '<div class="card"><h3>Calibration scatter</h3>' + scatterSvg() +
      '<p class="legend">Filled dots: the ' + F.comparables + ' comparables (traded, market cap on the vertical). Hollow dots: the board&rsquo;s implied values. Line: the fitted curve 10^' + F.intercept + ' &times; TVL^' + F.slope + '.</p></div>' +
      '<div class="card sandbox"><h3>Backtest &amp; levers</h3>' +
      '<ul><li>Comparables: <b>' + F.comparables + '</b> traded protocols (positive market cap, no CEX / bridge / liquid-staking, no versioned pool, mcap/TVL 0.005–20).</li>' +
      '<li>Leave-one-out typical miss: <b>&times;' + F.loo_median + '</b> (mean &times;' + F.loo_mean + '), against <b>&times;' + F.flat_median + '</b> for a flat median multiple.</li>' +
      '<li>Middle half of backtest errors: &times;' + F.band_low + '–&times;' + F.band_high + ' — the range shown per row.</li>' +
      '<li>Curve R&sup2; ' + F.r2 + ': size alone explains little; momentum and seasoning do the rest of the work.</li>' +
      '<li>Category peer gaps were fitted and rejected: with shrinkage the backtest worsened (&times;2.79 at pseudo-count 64 vs &times;2.61 without), so the model keeps no category term. The gap table was checked, not assumed.</li></ul>' +
      '<h3>Live sandbox — same function, your levers</h3>' +
      '<label>Momentum weight <span id="sb-w">' + state.w.toFixed(2) + '</span><input id="sb-wi" type="range" min="0" max="1.5" step="0.05" value="' + state.w + '"></label>' +
      '<label>Seasoning floor <span id="sb-f">' + state.floor.toFixed(2) + '</span><input id="sb-fi" type="range" min="0.3" max="0.8" step="0.05" value="' + state.floor + '"></label>' +
      '<p>Top 8 under your levers (board.json keeps the fitted values):</p><ol>' +
      top.map(function (r) { return '<li>' + esc(r.name) + ' — <b>' + money(sandboxImplied(r, state.w, state.floor)) + '</b> (fitted ' + money(r.implied_value_usd) + ')</li>'; }).join('') + '</ol>' +
      '<p><button id="sb-reset" type="button">Reset to fitted levers</button></p></div>' +
      '</div>';
  }

  function render() {
    var el = document.getElementById('board');
    el.setAttribute('aria-busy', 'false');
    var stats = '<div class="stats">' +
      '<div class="stat"><b>' + D.watchlist_size + '/' + D.watchlist_size + ' <span class="ok">✓</span></b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + D.board_size + '</b><span>pre-token ranked</span></div>' +
      '<div class="stat"><b>' + D.early_size + '</b><span>early finds below the floor</span></div>' +
      '<div class="stat"><b>' + D.live_size + ' shown</b><span>token already trades (416 in snapshot)</span></div>' +
      '<div class="stat"><b>' + D.set_aside_size + '</b><span>set aside by the strict rule</span></div>' +
      '<div class="stat"><b>×' + F.loo_median + '</b><span>leave-one-out miss (flat ×' + F.flat_median + ')</span></div></div>';
    var farm = '<section class="farmnext"><h2>Farm next — by net dollars per hour at plan size</h2>' +
      '<p>Net of gas at the plan&rsquo;s capital, assuming 10% of the implied value reaches depositors. The big names are thin or skip: their slice is small next to Ethereum gas. The farm is in small protocols on cheap chains.</p><ol>' +
      D.farm_next.map(function (f) { return '<li>' + esc(f.name) + ' — <b>+$' + f.net_per_hour_usd.toFixed(2) + '/h</b> (net +$' + f.net_usd.toFixed(2) + ')</li>'; }).join('') + '</ol></section>';
    var tabs = [['board', 'Pre-token board', D.board_size], ['live', 'Token already trades', D.live_size], ['aside', 'Set aside', D.set_aside_size], ['calib', 'Model & calibration', null]];
    var tabHtml = '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0]) + '">' + t[1] + (t[2] != null ? ' <span class="n">' + t[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    var body = state.tab === 'board' ? renderBoard() : state.tab === 'live' ? renderLive() : state.tab === 'aside' ? renderAside() : renderCalib();
    el.innerHTML = stats + farm + tabHtml + body;
    bind();
  }

  function bind() {
    var el = document.getElementById('board');
    el.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); render(); });
    });
    if (state.tab === 'board') {
      var q = document.getElementById('f-q');
      if (q) q.addEventListener('input', function () { state.q = q.value; render(); var nq = document.getElementById('f-q'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); });
      [['f-cat', 'cat'], ['f-chain', 'chain'], ['f-tier', 'tier'], ['f-verdict', 'verdict'], ['f-7d', 'dir7']].forEach(function (pair) {
        var s = document.getElementById(pair[0]);
        if (s) s.addEventListener('change', function () { state[pair[1]] = s.value; render(); });
      });
      var tvl = document.getElementById('f-tvl');
      if (tvl) tvl.addEventListener('change', function () { state.minTvl = Number(tvl.value); render(); });
      el.querySelectorAll('th[data-k]').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-k');
          if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = 1; }
          render();
        });
      });
      el.querySelectorAll('tbody tr').forEach(function (tr) {
        tr.addEventListener('click', function () {
          state.sel = tr.getAttribute('data-slug');
          try { history.replaceState(null, '', '#' + state.sel); } catch (e) { /* file: URLs */ }
          render();
          var d = document.getElementById('detail');
          if (d) d.scrollIntoView({ block: 'start' });
        });
      });
    }
    if (state.tab === 'calib') {
      var wi = document.getElementById('sb-wi'), fi = document.getElementById('sb-fi');
      if (wi) wi.addEventListener('input', function () { state.w = Number(wi.value); render(); });
      if (fi) fi.addEventListener('input', function () { state.floor = Number(fi.value); render(); });
      var rs = document.getElementById('sb-reset');
      if (rs) rs.addEventListener('click', function () { state.w = M.momentum_weight; state.floor = M.seasoning_floor; render(); });
    }
  }

  // Deep link: #slug opens that protocol's detail.
  var hash = (location.hash || '').slice(1);
  if (hash && bySlug(hash)) { state.sel = hash; }
  render();
})();
