(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var sites = COMBINE_SITES;
  var world = topojson.feature(COMBINE_WORLD, COMBINE_WORLD.objects.countries);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var css = getComputedStyle(document.documentElement);
  var tok = function (n) { return css.getPropertyValue(n).trim(); };
  function dot(s) { var m = Math.min.apply(null, s.months); return m >= 5 ? '#e3a24c' : m >= 4 ? '#93b866' : '#9aa8ab'; }
  var selected = sites.filter(function (s) { return s.id === 'kenya'; })[0] || sites[0];

  var markers = sites.map(function (s) {
    var o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' · ' + s.country; $('site-select').append(o);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'site-dot'; b.dataset.site = s.id;
    b.style.setProperty('--dot', dot(s)); b.title = s.name + ', ' + s.country; b.setAttribute('aria-label', 'Explore ' + s.name + ', ' + s.country);
    b.addEventListener('click', function () { select(s.id); }); $('site-markers').append(b); return b;
  });
  $('site-select').addEventListener('change', function (e) { select(e.target.value); });
  function select(id) { selected = sites.filter(function (s) { return s.id === id; })[0] || sites[0]; render(); }

  function render() {
    var s = selected, min = Math.min.apply(null, s.months), month = months[s.months.indexOf(min)];
    $('site-select').value = s.id;
    $('site-location').textContent = Math.abs(s.lat).toFixed(2) + '°' + (s.lat < 0 ? 'S' : 'N') + ' · ' + Math.abs(s.lon).toFixed(2) + '°' + (s.lon < 0 ? 'W' : 'E') + ' · kWh/m²/day';
    $('site-annual').textContent = s.annual.toFixed(2);
    $('site-min').textContent = min.toFixed(2);
    $('site-min-label').textContent = 'Darkest month · ' + month;
    $('site-check').textContent = s.checks;
    $('site-source').href = s.source;
    markers.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.site === s.id)); });
    chart();
  }

  function map() {
    var host = $('world-map'), w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    var proj = d3.geoEqualEarth().fitExtent([[8, 8], [w - 8, h - 8]], { type: 'Sphere' }), path = d3.geoPath(proj);
    var svg = d3.select('#world-svg').attr('viewBox', '0 0 ' + w + ' ' + h);
    svg.selectAll('path').remove();
    svg.append('path').attr('d', path({ type: 'Sphere' })).attr('fill', tok('--panel')).attr('stroke', tok('--rule'));
    svg.append('path').attr('d', path(d3.geoGraticule10())).attr('fill', 'none').attr('stroke', tok('--rule')).attr('stroke-width', 0.5);
    svg.selectAll('.land').data(world.features).join('path').attr('class', 'land').attr('d', path).attr('fill', '#c9b48a').attr('fill-opacity', 0.55).attr('stroke', tok('--ground')).attr('stroke-width', 0.5);
    markers.forEach(function (b, i) { var p = proj([sites[i].lon, sites[i].lat]); b.style.left = p[0] + 'px'; b.style.top = p[1] + 'px'; });
  }

  function chart() {
    var host = $('solar-chart'), w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    var s = selected, m = { left: 26, right: 4, top: 10, bottom: 22 };
    var x = d3.scaleBand().domain(d3.range(12)).range([m.left, w - m.right]).padding(0.24);
    var y = d3.scaleLinear().domain([0, 10]).range([h - m.bottom, m.top]);
    var svg = d3.select('#chart-svg').attr('viewBox', '0 0 ' + w + ' ' + h); svg.selectAll('*').remove();
    svg.append('g').selectAll('line').data([0, 5, 10]).join('line').attr('x1', m.left).attr('x2', w - m.right).attr('y1', y).attr('y2', y).attr('stroke', tok('--rule'));
    svg.append('g').selectAll('text').data([0, 5, 10]).join('text').attr('x', m.left - 6).attr('y', function (d) { return y(d) + 4; }).attr('text-anchor', 'end').attr('fill', tok('--dim')).attr('font-size', 10).attr('font-family', tok('--mono')).text(function (d) { return d; });
    var min = Math.min.apply(null, s.months);
    svg.append('g').selectAll('rect').data(s.months).join('rect')
      .attr('x', function (d, i) { return x(i); }).attr('width', x.bandwidth())
      .attr('y', function (d) { return y(d); }).attr('height', function (d) { return y(0) - y(d); })
      .attr('fill', function (d) { return d === min ? '#c75b2e' : '#e3a24c'; })
      .append('title').text(function (d, i) { return months[i] + ': ' + d.toFixed(2) + ' kWh/m²/day'; });
    svg.append('g').selectAll('text').data(months).join('text').attr('x', function (d, i) { return x(i) + x.bandwidth() / 2; }).attr('y', h - 6).attr('text-anchor', 'middle').attr('fill', tok('--dim')).attr('font-size', 10).attr('font-family', tok('--mono')).text(function (d) { return d.charAt(0); });
  }

  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { map(); chart(); }, 120); });
  map(); render();
})();
