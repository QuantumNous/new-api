/* pixeltype — squares assemble into model names, hold, scatter, repeat */
(function () {
  var host = document.querySelector(".pxword");
  if (!host) return;
  var FONT = {
    A:["01110","10001","10001","11111","10001","10001","10001"],
    C:["01111","10000","10000","10000","10000","10000","01111"],
    D:["11110","10001","10001","10001","10001","10001","11110"],
    E:["11111","10000","10000","11110","10000","10000","11111"],
    F:["11111","10000","10000","11110","10000","10000","10000"],
    G:["01111","10000","10000","10111","10001","10001","01111"],
    I:["11111","00100","00100","00100","00100","00100","11111"],
    K:["10001","10010","10100","11000","10100","10010","10001"],
    L:["10000","10000","10000","10000","10000","10000","11111"],
    M:["10001","11011","10101","10101","10001","10001","10001"],
    N:["10001","11001","10101","10011","10001","10001","10001"],
    P:["11110","10001","10001","11110","10000","10000","10000"],
    Q:["01110","10001","10001","10001","10101","10010","01101"],
    S:["01111","10000","10000","01110","00001","00001","11110"],
    T:["11111","00100","00100","00100","00100","00100","00100"],
    U:["10001","10001","10001","10001","10001","10001","01110"],
    W:["10001","10001","10001","10101","10101","11011","10001"],
    Y:["10001","01010","00100","00100","00100","00100","00100"]
  };
  var WORDS = ["FLATKEY","GPT","CLAUDE","GEMINI","DEEPSEEK","SEEDANCE","GLM","QWEN"];
  var COLORS = ["#A78BFA","#C4B5FD","#8B5CF6","#DDD6FE"];
  var ACCENT = "#67E8F9";
  var pool = [];

  function layout(word) {
    var cols = word.length * 6 - 1;
    var W = host.clientWidth, H = host.clientHeight;
    var cell = Math.min(Math.floor(W * 0.86 / cols), Math.floor(H * 0.6 / 7), 22);
    var ox = Math.round((W - cols * cell) / 2), oy = Math.round((H - 7 * cell) / 2);
    var pts = [];
    for (var li = 0; li < word.length; li++) {
      var g = FONT[word[li]];
      if (!g) continue;
      for (var r = 0; r < 7; r++)
        for (var c = 0; c < 5; c++)
          if (g[r][c] === "1")
            pts.push([ox + (li * 6 + c) * cell, oy + r * cell, cell]);
    }
    return pts;
  }

  function show(word) {
    var pts = layout(word);
    while (pool.length < pts.length) {
      var d = document.createElement("i");
      d.style.cssText = "position:absolute;display:block;opacity:0;transition:transform .8s cubic-bezier(.22,.9,.3,1),opacity .6s ease;will-change:transform";
      host.appendChild(d);
      pool.push(d);
    }
    pool.forEach(function (d, i) {
      if (i < pts.length) {
        var p = pts[i];
        d.style.width = d.style.height = (p[2] - 2) + "px";
        d.style.background = Math.random() < 0.05 ? ACCENT : COLORS[Math.floor(Math.random() * COLORS.length)];
        d.style.transitionDelay = (Math.random() * 0.35) + "s";
        // scatter start (only when currently hidden)
        if (d.style.opacity === "0") {
          d.style.transitionDuration = "0s";
          d.style.transform = "translate(" + (p[0] + (Math.random() - 0.5) * 420) + "px," + (p[1] + (Math.random() - 0.5) * 420) + "px) rotate(" + ((Math.random() - 0.5) * 180) + "deg)";
          void d.offsetWidth;
          d.style.transitionDuration = "";
        }
        d.style.transform = "translate(" + p[0] + "px," + p[1] + "px) rotate(0deg)";
        d.style.opacity = "1";
      } else {
        d.style.transform += " scale(.2)";
        d.style.opacity = "0";
      }
    });
  }

  function hide() {
    pool.forEach(function (d) {
      if (d.style.opacity === "1") {
        d.style.transitionDelay = (Math.random() * 0.2) + "s";
        d.style.transform = d.style.transform.replace(/\) rotate.*/, ") rotate(" + ((Math.random() - 0.5) * 160) + "deg) scale(.3)");
        d.style.opacity = "0";
      }
    });
  }

  var idx = 0;
  function cycle() {
    show(WORDS[idx % WORDS.length]);
    idx++;
    setTimeout(function () {
      hide();
      setTimeout(cycle, 700);
    }, 2600);
  }
  cycle();
})();
