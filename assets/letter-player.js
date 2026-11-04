// Founder's letter player: shown once assets/letter-audio.js names a recording.
// Highlights each paragraph while it is read (marks come from the ElevenLabs timings).
(function () {
  var rec = window.COMBINE_LETTER_AUDIO;
  if (!rec || !rec.src) return;
  var box = document.getElementById('listen');
  var audio = document.getElementById('listen-audio');
  var play = document.getElementById('listen-play');
  var track = document.getElementById('listen-track');
  var fill = document.getElementById('listen-fill');
  var time = document.getElementById('listen-time');
  if (!box || !audio) return;
  audio.src = rec.src;
  box.hidden = false;
  var marks = (rec.marks || []).slice().sort(function (a, b) { return a.start - b.start; });
  var total = rec.duration || 0;
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function idle() { time.textContent = Math.max(1, Math.round(total / 60)) + ' min'; }
  idle();
  var current = null;
  function highlight(t) {
    var id = null;
    for (var i = 0; i < marks.length; i++) { if (marks[i].start <= t + 0.05) id = marks[i].id; else break; }
    if (id === current) return;
    if (current) { var old = document.querySelector('[data-seg="' + current + '"]'); if (old) old.classList.remove('reading'); }
    current = id;
    if (id && !audio.paused) { var el = document.querySelector('[data-seg="' + id + '"]'); if (el) el.classList.add('reading'); }
  }
  function clear() { if (current) { var el = document.querySelector('[data-seg="' + current + '"]'); if (el) el.classList.remove('reading'); } current = null; }
  play.addEventListener('click', function () {
    if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } else { audio.pause(); }
  });
  audio.addEventListener('play', function () { box.classList.add('playing'); play.setAttribute('aria-label', 'Pause the letter'); highlight(audio.currentTime); });
  audio.addEventListener('pause', function () { box.classList.remove('playing'); play.setAttribute('aria-label', 'Play the letter'); clear(); });
  audio.addEventListener('ended', function () { clear(); fill.style.width = '0'; idle(); });
  audio.addEventListener('loadedmetadata', function () { if (isFinite(audio.duration)) total = audio.duration; });
  audio.addEventListener('timeupdate', function () {
    var d = total || audio.duration || 1, pct = Math.min(100, audio.currentTime / d * 100);
    fill.style.width = pct + '%';
    track.setAttribute('aria-valuenow', String(Math.round(pct)));
    time.textContent = mmss(audio.currentTime) + ' / ' + mmss(d);
    highlight(audio.currentTime);
  });
  function seek(frac) { var d = total || audio.duration; if (!d) return; audio.currentTime = Math.max(0, Math.min(1, frac)) * d; }
  track.addEventListener('click', function (e) { var r = track.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); });
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min((total || audio.duration || 0), audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
  });
})();
