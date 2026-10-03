/* Homepage: the dark/light split follows the cursor (or finger) */
(function () {
  'use strict';
  var SHIFT = 15;
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('ge-split');
    var L = document.getElementById('ge-left'), R = document.getElementById('ge-right');
    var opL = document.querySelectorAll('.ge-op-l'), opR = document.querySelectorAll('.ge-op-r');
    if (!root || !L || !R) return;
    function apply(split) {
      var t = (split - (50 - SHIFT)) / (2 * SHIFT);
      L.style.flexGrow = split.toFixed(2);
      R.style.flexGrow = (100 - split).toFixed(2);
      opL.forEach(function (el) { el.style.opacity = (0.45 + 0.55 * t).toFixed(2); });
      opR.forEach(function (el) { el.style.opacity = (0.45 + 0.55 * (1 - t)).toFixed(2); });
    }
    function move(e) {
      var r = root.getBoundingClientRect();
      var pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
      var narrow = r.width < 720;
      var f = narrow ? (pt.clientY - r.top) / r.height : (pt.clientX - r.left) / r.width;
      var split = 50 + (0.5 - f) * 2 * SHIFT;
      apply(Math.max(50 - SHIFT, Math.min(50 + SHIFT, split)));
    }
    root.addEventListener('mousemove', move);
    root.addEventListener('touchstart', move, { passive: true });
    root.addEventListener('touchmove', move, { passive: true });
    root.addEventListener('mouseleave', function () { apply(50); });
  });
})();
