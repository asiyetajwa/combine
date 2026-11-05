// Demo video behind the horizon: pause when the horizon closes.
(function () {
  'use strict';
  var stage = document.getElementById('rv-stage'), v = document.getElementById('demo-video');
  if (!stage || !v) return;
  stage.addEventListener('rv-close', function () { v.pause(); });
})();
