/* fal-style animated pixel clusters — deterministic per data-seed */
(function () {
  function cluster(el) {
    var cell = +el.dataset.cell || 26;
    var cols = +el.dataset.cols || 12;
    var rows = +el.dataset.rows || 8;
    var n = +el.dataset.n || Math.round(cols * rows * 0.28);
    var colors = (el.dataset.colors || "#DDD1F6,#C4B5FD,#A78BFA").split(",");
    var accent = el.dataset.accent || "#15803D";
    var seed = +el.dataset.seed || 7;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    el.style.width = cols * cell + "px";
    el.style.height = rows * cell + "px";
    var used = {};
    for (var i = 0; i < n; i++) {
      var x, y, k, tries = 0;
      do { x = Math.floor(rnd() * cols); y = Math.floor(rnd() * rows); k = x + "_" + y; }
      while (used[k] && ++tries < 40);
      used[k] = 1;
      var s = document.createElement("i");
      s.style.left = x * cell + "px";
      s.style.top = y * cell + "px";
      s.style.width = s.style.height = cell + "px";
      s.style.background = rnd() < 0.07 ? accent : colors[Math.floor(rnd() * colors.length)];
      s.style.animationDelay = (rnd() * 7).toFixed(2) + "s";
      s.style.animationDuration = (5 + rnd() * 7).toFixed(2) + "s";
      el.appendChild(s);
    }
  }
  document.querySelectorAll(".pxgrid").forEach(cluster);
})();
