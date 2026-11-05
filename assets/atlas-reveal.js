// Solar Atlas reveal. A horizon seam over desert sand hides a 3D globe of the nine regions.
// Desktop: grab the seam and pull it down. Phone: swipe up anywhere to raise the sun.
(function () {
  'use strict';
  var stage = document.getElementById('rv-stage');
  if (!stage || !window.d3) return;
  // content mode (/deck, /video): the same horizon, with a deck or a film behind it instead of the globe
  var content = stage.hasAttribute('data-content');
  if (!content && !window.topojson) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phoneMQ = window.matchMedia('(max-width: 760px)');
  var world = content ? null : topojson.feature(COMBINE_WORLD, COMBINE_WORLD.objects.countries);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dotColor(s) { var m = Math.min.apply(null, s.months); return m >= 5 ? '#e3a24c' : m >= 4 ? '#93b866' : '#9aa8ab'; }
  var $ = function (id) { return document.getElementById(id); };
  var W = 0, H = 0;
  var phone = function () { return phoneMQ.matches; };
  var g = { proj: null }, sites = content ? [] : COMBINE_SITES.slice().sort(function (a, b) { return b.annual - a.annual; }), api = { build: function () {}, select: function () {}, spin: function () {} };
  if (!content) {

  /* ------------------------------------------------------------- globe */
  g = { proj: null, path: null, rot: [-20, -8], target: [-20, -8], active: sites[0], dragging: false };
  var gsvg = d3.select('#rv-globe');
  function globeSize() {
    var r = Math.min(W, H);
    if (phone()) return { r: Math.min(W * 0.4, H * 0.21), cx: W / 2, cy: H * 0.44 };
    return { r: Math.min(H * 0.37, W * 0.24), cx: Math.max(W * 0.33, W / 2 - 300), cy: H * 0.5 };
  }
  function buildGlobe() {
    gsvg.attr('viewBox', '0 0 ' + W + ' ' + H); gsvg.selectAll('*').remove();
    var s = globeSize();
    g.proj = d3.geoOrthographic().scale(s.r).translate([s.cx, s.cy]).rotate(g.rot).clipAngle(90);
    g.path = d3.geoPath(g.proj);
    var defs = gsvg.append('defs');
    var sh = defs.append('radialGradient').attr('id', 'rv-gshade').attr('cx', .38).attr('cy', .32).attr('r', .75);
    sh.append('stop').attr('offset', 0).attr('stop-color', '#1a4a57'); sh.append('stop').attr('offset', 1).attr('stop-color', '#0a2129');
    var halo = defs.append('radialGradient').attr('id', 'rv-halo');
    halo.append('stop').attr('offset', .7).attr('stop-color', '#ffcf7a').attr('stop-opacity', .18); halo.append('stop').attr('offset', 1).attr('stop-color', '#ffcf7a').attr('stop-opacity', 0);
    gsvg.append('rect').attr('width', W).attr('height', H).attr('fill', '#071a20');
    gsvg.append('circle').attr('cx', s.cx).attr('cy', s.cy).attr('r', s.r * 1.18).attr('fill', 'url(#rv-halo)');
    gsvg.append('path').attr('class', 'sphere').attr('fill', 'url(#rv-gshade)').attr('stroke', 'rgba(255,207,122,.35)');
    gsvg.append('path').attr('class', 'grat').attr('fill', 'none').attr('stroke', 'rgba(244,236,220,.08)');
    gsvg.append('path').attr('class', 'land').attr('fill', '#c9b48a').attr('fill-opacity', .5).attr('stroke', '#0a2129').attr('stroke-width', .4);
    gsvg.append('g').attr('class', 'pts');
    drawGlobe();
  }
  function drawGlobe() {
    if (!g.proj) return;
    g.proj.rotate(g.rot);
    gsvg.select('.sphere').attr('d', g.path({ type: 'Sphere' }));
    gsvg.select('.grat').attr('d', g.path(d3.geoGraticule10()));
    gsvg.select('.land').attr('d', g.path(world));
    var c = g.proj.rotate();
    gsvg.select('.pts').selectAll('circle').data(sites, function (s) { return s.id; })
      .join(function (en) { return en.append('circle').attr('stroke', '#071a20').attr('stroke-width', 2).style('cursor', 'pointer').on('click', function (e, s) { select(s); }).call(function (sel) { sel.append('title').text(function (s) { return s.name + ', ' + s.country + ': ' + s.annual.toFixed(2) + ' kWh/m² a day'; }); }); })
      .attr('fill', dotColor)
      .attr('r', function (s) { return (s === g.active ? 9 : 5.5) * (stage.classList.contains('lit') ? 1 : 0); })
      .attr('cx', function (s) { return g.proj([s.lon, s.lat])[0]; }).attr('cy', function (s) { return g.proj([s.lon, s.lat])[1]; })
      .attr('opacity', function (s) { return d3.geoDistance([s.lon, s.lat], [-c[0], -c[1]]) < Math.PI / 2 ? 1 : 0; });
  }
  function spin() {
    // the globe is hidden behind the horizon until it opens: keep turning, but only draw when it can be seen
    var visible = st.opening > 0.001 || st.pull > 1;
    if (!g.dragging) {
      g.rot[0] += (g.target[0] - g.rot[0]) * 0.07; g.rot[1] += (g.target[1] - g.rot[1]) * 0.07;
      if (!stage.classList.contains('open') && !reduce) { g.target[0] += 0.06; }
    }
    if (visible && g.proj) drawGlobe(); requestAnimationFrame(spin);
  }
  gsvg.call(d3.drag()
    .filter(function () { return stage.classList.contains('open'); })
    .on('start', function () { g.dragging = true; })
    .on('drag', function (e) { var k = 75 / g.proj.scale(); g.rot[0] += e.dx * k; g.rot[1] = Math.max(-60, Math.min(60, g.rot[1] - e.dy * k)); g.target = g.rot.slice(); })
    .on('end', function () { g.dragging = false; }));

  /* ------------------------------------------------------------- region detail */
  function monthsChart(s) {
    var svg = d3.select('#rv-months'), w = 340, h = 64, x = d3.scaleBand().domain(d3.range(12)).range([0, w]).padding(.22), y = d3.scaleLinear().domain([0, 10]).range([h - 14, 2]);
    svg.attr('viewBox', '0 0 ' + w + ' ' + h); svg.selectAll('*').remove();
    var min = Math.min.apply(null, s.months);
    svg.selectAll('rect').data(s.months).join('rect').attr('x', function (d, i) { return x(i); }).attr('width', x.bandwidth()).attr('y', function (d) { return y(d); }).attr('height', function (d) { return y(0) - y(d); }).attr('rx', 2)
      .attr('fill', function (d) { return d === min ? '#d9714a' : '#e3a24c'; }).append('title').text(function (d, i) { return months[i] + ': ' + d.toFixed(2) + ' kWh/m² a day'; });
    svg.selectAll('text').data(months).join('text').attr('x', function (d, i) { return x(i) + x.bandwidth() / 2; }).attr('y', h - 2).attr('text-anchor', 'middle').attr('fill', '#a9bab5').attr('font-size', 9).attr('font-family', 'Geist Mono, monospace').text(function (d) { return d.charAt(0); });
  }
  function select(s) {
    g.active = s; g.target = [-s.lon, -s.lat * 0.6];
    document.querySelectorAll('#rv-list button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === s.id)); });
    var min = Math.min.apply(null, s.months);
    $('rv-name').textContent = s.name + ', ' + s.country;
    $('rv-annual').textContent = s.annual.toFixed(2);
    $('rv-min').textContent = min.toFixed(2);
    $('rv-min-k').textContent = 'Darkest month · ' + months[s.months.indexOf(min)];
    $('rv-check').textContent = s.checks;
    $('rv-source').href = s.source;
    monthsChart(s);
  }
  $('rv-list').innerHTML = sites.map(function (s) { return '<button type="button" data-id="' + s.id + '" aria-pressed="false"><span>' + s.name + '</span><span>' + s.annual.toFixed(1) + '</span></button>'; }).join('');
  document.querySelectorAll('#rv-list button').forEach(function (b) { b.addEventListener('click', function () { select(sites.filter(function (s) { return s.id === b.dataset.id; })[0]); }); });
  var track = $('rv-track');
  track.innerHTML = sites.map(function (s) {
    var low = Math.min.apply(null, s.months);
    return '<div class="c"><span class="n">' + s.name + ', ' + s.country + '</span><b>' + s.annual.toFixed(2) + ' kWh/m²</b><span class="k">Annual mean · darkest month ' + low.toFixed(2) + '</span><p>' + s.checks + '</p></div>';
  }).join('');
  track.addEventListener('scroll', function () {
    var w = track.firstElementChild.getBoundingClientRect().width + 10;
    select(sites[Math.max(0, Math.min(sites.length - 1, Math.round(track.scrollLeft / w)))]);
  }, { passive: true });
  api.build = buildGlobe; api.select = select; api.spin = spin;
  }

  /* ------------------------------------------------------------- the cover */
  var svg = d3.select('#rv-cover'), defs = svg.append('defs');
  var wallG = defs.append('linearGradient').attr('id', 'rv-wall').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  wallG.append('stop').attr('offset', 0).attr('stop-color', '#e9e1cf'); wallG.append('stop').attr('offset', .55).attr('stop-color', '#f7f1e3'); wallG.append('stop').attr('offset', 1).attr('stop-color', '#d4c8ae');
  var spotG = defs.append('radialGradient').attr('id', 'rv-spot');
  spotG.append('stop').attr('offset', 0).attr('stop-color', '#fff').attr('stop-opacity', .9); spotG.append('stop').attr('offset', 1).attr('stop-color', '#fff').attr('stop-opacity', 0);
  var sandF = defs.append('filter').attr('id', 'rv-sand').attr('x', 0).attr('y', 0).attr('width', 1).attr('height', 1).attr('color-interpolation-filters', 'sRGB');
  var turb = sandF.append('feTurbulence').attr('type', 'fractalNoise').attr('numOctaves', 2).attr('seed', 4).attr('result', 'ripples');
  var lit = sandF.append('feDiffuseLighting').attr('in', 'ripples').attr('diffuseConstant', 1.25).attr('lighting-color', '#fff4e2').attr('result', 'lit');
  lit.append('feDistantLight').attr('azimuth', 240).attr('elevation', 48);
  sandF.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'lit').attr('operator', 'arithmetic').attr('k1', .82).attr('k2', .3).attr('k3', 0).attr('k4', 0).attr('result', 'shaded');
  sandF.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', .9).attr('numOctaves', 1).attr('seed', 9).attr('result', 'fine');
  sandF.append('feColorMatrix').attr('in', 'fine').attr('type', 'matrix').attr('values', '0 0 0 0 0.55  0 0 0 0 0.36  0 0 0 0 0.18  0 0 0 0.35 -0.1').attr('result', 'specks');
  sandF.append('feComposite').attr('in', 'specks').attr('in2', 'shaded').attr('operator', 'over').attr('result', 'sand');
  sandF.append('feComposite').attr('in', 'sand').attr('in2', 'SourceAlpha').attr('operator', 'in');
  var sandG = defs.append('linearGradient').attr('id', 'rv-sandfill').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  sandG.append('stop').attr('offset', 0).attr('stop-color', '#f6dcb0'); sandG.append('stop').attr('offset', .5).attr('stop-color', '#ebc08a'); sandG.append('stop').attr('offset', 1).attr('stop-color', '#d6a064');
  var shadeG = defs.append('linearGradient').attr('id', 'rv-shade').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  shadeG.append('stop').attr('offset', 0).attr('stop-color', '#000').attr('stop-opacity', .22); shadeG.append('stop').attr('offset', .25).attr('stop-color', '#000').attr('stop-opacity', 0);
  var glowG = defs.append('radialGradient').attr('id', 'rv-glow');
  glowG.append('stop').attr('offset', 0).attr('stop-color', '#fff4d6'); glowG.append('stop').attr('offset', .35).attr('stop-color', '#ffd58a').attr('stop-opacity', .55); glowG.append('stop').attr('offset', 1).attr('stop-color', '#ffb84d').attr('stop-opacity', 0);

  var wall = svg.append('path').attr('fill', 'url(#rv-wall)');
  var spot = svg.append('ellipse').attr('fill', 'url(#rv-spot)');
  var sand = svg.append('path').attr('fill', 'url(#rv-sandfill)').attr('filter', 'url(#rv-sand)');
  var sandShade = svg.append('path').attr('fill', 'url(#rv-shade)');
  // mirage: a shimmering strip of pale sky along the far edge of the sand
  var mirF = defs.append('filter').attr('id', 'rv-mirage').attr('x', 0).attr('y', -0.5).attr('width', 1).attr('height', 2);
  var mirT = mirF.append('feTurbulence').attr('type', 'turbulence').attr('baseFrequency', '0.006 0.22').attr('numOctaves', 1).attr('seed', 3).attr('result', 'heat');
  if (!reduce) mirT.append('animate').attr('attributeName', 'baseFrequency').attr('values', '0.006 0.22;0.008 0.27;0.006 0.22').attr('dur', '7s').attr('repeatCount', 'indefinite');
  mirF.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'heat').attr('scale', 7).attr('xChannelSelector', 'R').attr('yChannelSelector', 'G');
  var mirG = defs.append('linearGradient').attr('id', 'rv-mirageG').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  mirG.append('stop').attr('offset', 0).attr('stop-color', '#eef3f2').attr('stop-opacity', .92);
  mirG.append('stop').attr('offset', .35).attr('stop-color', '#dfe9ea').attr('stop-opacity', .6);
  mirG.append('stop').attr('offset', .7).attr('stop-color', '#f3e3c4').attr('stop-opacity', .25);
  mirG.append('stop').attr('offset', 1).attr('stop-color', '#f3e3c4').attr('stop-opacity', 0);
  var mirage = svg.append('path').attr('fill', 'url(#rv-mirageG)').attr('filter', 'url(#rv-mirage)');
  var mirageGlint = svg.append('path').attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.55)').attr('stroke-width', 1).attr('filter', 'url(#rv-mirage)');
  var rim = svg.append('path').attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.85)').attr('stroke-width', 1.4);
  var glow = svg.append('ellipse').attr('fill', 'url(#rv-glow)').style('mix-blend-mode', 'screen');
  var spark = svg.append('g');
  spark.append('path').attr('d', 'M49.7 14.3a25 25 0 1 0 0 35.4l-8.5-8.5a13 13 0 1 1 0-18.4l8.5-8.5Z').attr('fill', 'rgba(60,40,20,.55)');
  var diamond = spark.append('path').attr('d', 'm52 23 9 9-9 9-9-9 9-9Z');

  var desert = (window.CombineDesert && !/desert=svg/.test(location.search)) ? window.CombineDesert(stage, document.getElementById('rv-cover')) : null;
  if (desert) { sand.attr('fill', 'transparent').attr('filter', null); mirage.style('display', 'none'); mirageGlint.style('display', 'none'); }
  var st = { pull: 0, vel: 0, x0: 0.5, dragging: false, open: false, opening: 0, openVel: 0 };
  function dirNow() { return st.dragDir || cfg().dir; }
  function cfg() { return phone() ? { seam: 0.7, dir: -1, threshold: 0.14, labelGap: 40, hintGap: 54 } : { seam: 0.6, dir: 1, threshold: 0.2, labelGap: 46, hintGap: 104 }; }
  function bump(x, amp) { var w = W * (0.09 + Math.min(0.12, amp / H * 0.5)); var d = (x - st.x0 * W) / w; return amp * Math.exp(-d * d); }
  function edge(y0, sign, lift, amp) { var pts = []; for (var i = 0; i <= 90; i++) { var x = i / 90 * W; pts.push(x.toFixed(1) + ',' + (y0 + sign * (lift + bump(x, amp))).toFixed(1)); } return pts; }
  function render() {
    var c = cfg(), y0 = H * c.seam, prog = st.opening, amp = st.pull * (1 - prog);
    var liftUp = prog * H * (c.seam + 0.08), liftDown = prog * H * (1 - c.seam + 0.08);
    var dd = dirNow(), gapTop = dd > 0 ? 0.18 : 0.82, gapBot = 1 - gapTop;
    var top = edge(y0, -1, liftUp, amp * gapTop), bot = edge(y0, 1, liftDown, amp * gapBot);
    wall.attr('d', 'M0,0L' + W + ',0L' + top.slice().reverse().join('L') + 'Z');
    var sandD = 'M' + bot.join('L') + 'L' + W + ',' + H + 'L0,' + H + 'Z';
    sand.attr('d', sandD);
    var mh = H * (phone() ? 0.03 : 0.045), lower = bot.map(function (p) { var q = p.split(','); return q[0] + ',' + (Number(q[1]) + mh).toFixed(1); });
    mirage.attr('d', 'M' + bot.join('L') + 'L' + lower.reverse().join('L') + 'Z').attr('opacity', 1 - prog);
    mirageGlint.attr('d', 'M' + bot.map(function (p) { var q = p.split(','); return q[0] + ',' + (Number(q[1]) + mh * 0.28).toFixed(1); }).join('L')).attr('opacity', (1 - prog) * 0.8);
    sandShade.attr('d', 'M' + bot.join('L') + 'L' + W + ',' + (y0 + liftDown + H * 0.2) + 'L0,' + (y0 + liftDown + H * 0.2) + 'Z');
    rim.attr('d', 'M' + top.join('L'));
    spot.attr('cx', W * 0.5).attr('cy', y0 * 0.55 - liftUp).attr('rx', W * 0.22).attr('ry', y0 * 0.5);
    var cx = st.x0 * W, cy = y0 - liftUp + (dd > 0 ? amp * 0.15 : -amp * 0.55), gl = Math.min(1, st.pull / (H * 0.12)) * (1 - prog * 0.6);
    glow.attr('cx', cx).attr('cy', cy).attr('rx', W * 0.16 + st.pull * 0.6).attr('ry', H * 0.08 + st.pull * 0.5).attr('opacity', 0.25 + gl * 0.75);
    var sz = Math.max(14, Math.min(26, W / 52));
    var sy = dd > 0 ? y0 + liftDown + amp * gapBot + sz * 1.8 : y0 - liftUp - amp * gapTop - sz * 1.2 - st.pull * 0.35;
    spark.attr('transform', 'translate(' + (cx - sz / 2) + ',' + sy + ') scale(' + (sz / 64) + ')').attr('opacity', 1 - prog);
    diamond.attr('fill', d3.interpolateRgb('#7da85a', '#d6ff9a')(gl)).style('filter', 'drop-shadow(0 0 ' + (2 + gl * 10) + 'px rgba(190,255,120,' + (0.4 + gl * 0.6) + '))');
    $('rv-label').style.transform = 'translateY(' + (y0 - liftUp - c.labelGap) + 'px)'; $('rv-label').style.opacity = String(1 - prog);
    $('rv-hint').style.transform = 'translateY(' + (y0 + liftDown + c.hintGap) + 'px)'; $('rv-hint').style.opacity = String(Math.max(0, 1 - st.pull / (H * 0.08)) * (1 - prog));
    if (desert) desert.draw({ clip: sandD, horizon: y0 + liftDown, glowX: cx, glowY: y0 + liftDown, glow: gl, opacity: 1, still: reduce });
    if (!phone()) $('rv-grab').style.top = (y0 - 36 + (dd > 0 ? amp * 0.3 : -amp * 0.3)) + 'px';
    $('rv-grab').style.display = prog > 0.5 ? 'none' : '';
  }
  function size() {
    var r = stage.getBoundingClientRect(); W = r.width; H = r.height;
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    turb.attr('baseFrequency', phone() ? '0.012 0.09' : '0.007 0.075');
    lit.attr('surfaceScale', phone() ? 2.2 : 2.4);
    if (desert) desert.resize(W, H);
    if (g.proj) api.build();
    render();
  }
  function tick() {
    if (!st.dragging) { st.vel = (st.vel - st.pull * 0.14) * 0.72; st.pull += st.vel; if (Math.abs(st.pull) < 0.05 && Math.abs(st.vel) < 0.01) st.pull = 0; }
    var to = st.open ? 1 : 0;
    if (reduce) st.opening = to; else { st.openVel = (st.openVel + (to - st.opening) * 0.06) * 0.8; st.opening += st.openVel; if (Math.abs(to - st.opening) < 0.001 && Math.abs(st.openVel) < 0.001) st.opening = to; }
    st.opening = Math.max(0, Math.min(1, st.opening));
    var wasOpen = stage.classList.contains('open');
    stage.classList.toggle('open', st.open && st.opening > 0.85);
    if (!st.dragging && st.pull < 0.5 && !st.open) st.dragDir = 0;
    if (!wasOpen && stage.classList.contains('open')) stage.classList.add('lit');
    render(); requestAnimationFrame(tick);
  }
  function open() { st.open = true; st.pull = 0; if (!content) api.select(g.active || sites[0]); stage.dispatchEvent(new Event('rv-open')); if (navigator.vibrate) navigator.vibrate(12); }
  var grab = $('rv-grab'), startY = 0, startPull = 0;
  grab.addEventListener('pointerdown', function (e) {
    if (st.open) return;
    grab.setPointerCapture(e.pointerId);
    var r = stage.getBoundingClientRect(); st.dragging = true; st.x0 = (e.clientX - r.left) / W; startY = e.clientY; startPull = st.pull; if (st.pull < 1) st.dragDir = 0;
  });
  grab.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    if (!st.dragging) { if (!st.open && !phone()) st.x0 += ((e.clientX - r.left) / W - st.x0) * 0.25; return; }
    st.x0 += ((e.clientX - r.left) / W - st.x0) * 0.35;
    var dy = e.clientY - startY; if (!st.dragDir && Math.abs(dy) > 4) st.dragDir = dy > 0 ? 1 : -1;
    var raw = Math.max(0, startPull + dy * (st.dragDir || cfg().dir)), max = H * 0.55;
    st.pull = max * (1 - Math.exp(-raw / max));
  });
  function release() { if (!st.dragging) return; st.dragging = false; st.vel = 0; if (st.pull > H * cfg().threshold) open(); }
  grab.addEventListener('pointerup', release); grab.addEventListener('pointercancel', release);
  grab.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { st.open = false; stage.classList.remove('open'); stage.classList.remove('lit'); stage.dispatchEvent(new Event('rv-close')); }); });

  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(size, 120); });
  stage.classList.add('live');
  size();
  if (!content) { g.rot = [-sites[0].lon + 60, -8]; g.target = g.rot.slice(); }
  // the cover is on screen now; build the globe and the region panel just after
  setTimeout(function () { if (!content) { api.build(); api.select(g.active || sites[0]); } stage.classList.add('globe-ready'); }, 0);
  requestAnimationFrame(tick); if (!content) requestAnimationFrame(api.spin);
})();
