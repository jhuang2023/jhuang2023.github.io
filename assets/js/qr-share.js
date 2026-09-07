(function () {
  var button = document.querySelector("[data-qr-action]");
  var dialog = document.getElementById("qr-dialog");
  if (!button || !dialog) {
    return;
  }

  var canvas = dialog.querySelector("[data-qr-canvas]");
  var urlLabel = dialog.querySelector("[data-qr-url]");
  var hintFlat = dialog.querySelectorAll("[data-qr-hint-flat]");
  var hint3d = dialog.querySelectorAll("[data-qr-hint-3d]");
  var ctx = canvas.getContext("2d");

  var SIZE = 300; /* css px — keep in sync with .qr-dialog-code */
  var QUIET = 4; /* quiet-zone modules scanners expect around the symbol */
  /* one continuous camera arc between the two viewpoints: elevation
     interpolates 90° → 32° on a smooth spherical path while the modules
     ride the same easing, so the eye can track every part of the scene
     turning from flat code into standing tree — and back along the exact
     same path. */
  var TRANS_MS = 750;
  var PHI_TOP = 1.5708; /* straight overhead */
  var PHI_SIDE = 0.5586; /* asin(0.53) ≈ 32° elevation */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ONE centred object: the tree's CANOPY is the QR code. The code lives
     on a vertical plane — every dark module is a dense little cluster of
     low-poly leaf blocks whose front projection exactly fills its cell;
     light modules are see-through gaps in the foliage. Scanning view =
     camera level, straight at the canopy (trunk peeking out below).
     Dragging rotates the very same canopy body, revealing its depth,
     branches and the full tree. No second model, no flat picture. */
  var SIDE_SIN = 0.53; /* showcase view: ~45° isometric */
  var SIDE_COS = 0.848;
  var THETA_HOME = Math.PI / 4;
  var SPIN_SPEED = 0.00009;

  var CREAM = [251, 246, 234];
  var CODE_TILE = [244, 238, 221]; /* light modules: pale floor tiles */
  var PLATE_A = [240, 231, 211];
  var PLATE_B = [233, 223, 202];
  var TRUNK_BROWNS = [[146, 106, 76], [128, 91, 64], [110, 77, 54]];
  var GRASS_GREENS = [[124, 179, 66], [139, 195, 74], [104, 159, 56]];
  var FLOWER_COLORS = [[244, 143, 177], [255, 224, 130], [248, 187, 208]];

  var month = new Date().getMonth() + 1;
  var SEASON =
    month >= 3 && month <= 5 ? "spring" :
    month >= 6 && month <= 8 ? "summer" :
    month >= 9 && month <= 11 ? "autumn" : "winter";
  var THEMES = {
    spring: {
      tree: [[205, 230, 173], [188, 221, 152], [174, 213, 129], [214, 235, 189], [244, 178, 199]],
      qr: [[35, 87, 44], [46, 100, 51], [27, 77, 42], [56, 106, 47]],
      finder: [24, 61, 33],
      petals: ["#f8bbd0", "#f48fb1", "#ffe082"],
      snow: false
    },
    summer: {
      tree: [[197, 225, 165], [209, 232, 176], [174, 213, 129], [188, 221, 152], [156, 204, 121]],
      qr: [[27, 77, 42], [40, 90, 45], [51, 105, 30], [33, 84, 36]],
      finder: [21, 61, 31],
      petals: ["#f8bbd0", "#ffe082", "#f48fb1"],
      snow: false
    },
    autumn: {
      tree: [[217, 164, 65], [199, 123, 59], [168, 91, 50], [138, 154, 91], [180, 130, 60]],
      qr: [[105, 60, 30], [88, 51, 27], [120, 68, 30], [96, 58, 32]],
      finder: [74, 42, 22],
      petals: ["#ffb74d", "#ff8a65", "#ffd54f"],
      snow: false
    },
    winter: {
      tree: [[156, 175, 136], [126, 147, 122], [181, 196, 168], [142, 158, 134], [206, 216, 199]],
      qr: [[54, 68, 55], [44, 58, 48], [63, 78, 62], [50, 66, 54]],
      finder: [38, 50, 41],
      petals: ["#f4f7f2", "#e3ebe0", "#dde7ea"],
      snow: true
    }
  };
  var theme = THEMES[SEASON];

  var modCount = 0;
  var g = 0;
  var cells = []; /* dark modules, for the scanning view */
  var nodes = []; /* everything with depth: lawn, veg, tree, grass, flowers */
  var order = [];
  var treePos = null; /* {discR} ground base */
  var treeFit = null;
  var flatFit = null;
  var currentUrl = null;

  var mode = 0;
  var t = 0; /* transition progress: camera arc + module lift share it */
  var fxAlpha = 0; /* gentle focus vignette, derived from t */
  var theta = 0;
  var spinSettled = false;
  var flattenTheta = 0;
  var flattenT0 = 1;
  var dragging = false;
  var dragMoved = false;
  var dragX0 = 0;
  var dragTheta0 = 0;
  var introAt = 0;
  var introDone = false;
  var rafId = null;
  var lastNow = 0;
  var petals = [];
  var petalSeed = 1;
  var sceneSeed = 7;

  function cellHash(r, c) {
    var h = ((r + 1) * 73856093) ^ ((c + 1) * 19349663);
    return (h >>> 0) % 1024;
  }

  function hashUnit(r, c, salt) {
    var h = ((r + 1) * 73856093) ^ ((c + 1) * 19349663) ^ ((salt + 1) * 83492791);
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return (h % 100000) / 100000;
  }

  function srand() {
    /* deterministic scene: identical layout every frame and every open */
    sceneSeed = (sceneSeed * 48271) % 2147483647;
    return sceneSeed / 2147483647;
  }

  function prand() {
    petalSeed = (petalSeed * 48271) % 2147483647;
    return petalSeed / 2147483647;
  }

  function lerp(a, b, x) {
    return a + (b - a) * x;
  }

  function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function normAngle(a) {
    a = a % 6.28318;
    if (a > 3.14159) {
      a -= 6.28318;
    }
    if (a < -3.14159) {
      a += 6.28318;
    }
    return a;
  }

  function rgb(col, mul) {
    return "rgb(" + Math.round(col[0] * mul) + "," + Math.round(col[1] * mul) + "," + Math.round(col[2] * mul) + ")";
  }

  function mix(a, b, x) {
    return [lerp(a[0], b[0], x), lerp(a[1], b[1], x), lerp(a[2], b[2], x)];
  }

  function inFinder(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }

  function buildMatrix(url) {
    var qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    modCount = qr.getModuleCount();
    g = modCount + QUIET * 2;
    cells = [];
    nodes = [];
    sceneSeed = 7;
    var half = g / 2;
    var mid = (modCount - 1) / 2;
    var GROUND_R = 0.72;
    var H = g * 0.8; /* total sculpture height */
    var r, c, i, j, k;

    /* ================= ONE static 3D pixel sculpture =================
       Every block's world position is decided here, once, and never
       touched again. Straight overhead the blocks project onto their QR
       cells (that IS the code); from the side the same blocks are a tree.
       The camera is the only thing that ever moves. */

    function asym(a) {
      return 1 + 0.2 * Math.sin(a * 3 + 1.7) + 0.13 * Math.sin(a * 5 + 0.6);
    }

    var darkMap = {}; /* "c,r" -> crown floor of that module (branch routing) */
    for (r = 0; r < modCount; r++) {
      for (c = 0; c < modCount; c++) {
        if (!qr.isDark(r, c)) {
          continue;
        }
        var finder = inFinder(r, c, modCount);
        var solid = r === 6 || c === 6 ||
          (r >= modCount - 9 && r <= modCount - 5 && c >= modCount - 9 && c <= modCount - 5);
        var cx = c + QUIET + 0.5 - half;
        var cy = r + QUIET + 0.5 - half;
        var u = (c - mid) / mid;
        var v = (r - mid) / mid;
        var rN = Math.max(Math.abs(u), Math.abs(v));
        var grounded = rN >= GROUND_R || finder || solid;
        var col0 = finder || solid ? theme.finder : theme.qr[cellHash(r, c) % theme.qr.length];
        var cell = {
          cx: cx,
          cy: cy,
          finder: finder,
          solid: solid,
          col: col0,
          delay: Math.min(430, Math.sqrt((r - mid) * (r - mid) + (c - mid) * (c - mid)) * 13)
        };
        cells.push(cell);

        if (grounded) {
          /* rim + all corner patterns: dense turf, fixed at the ground */
          var turfH = 0.3 + hashUnit(r, c, 15) * 0.15;
          nodes.push({
            kind: "leaf",
            wx: cx,
            wy: cy,
            z: 0,
            h: turfH,
            size: 1,
            col: col0,
            tcol: finder || solid ? mix(theme.finder, theme.tree[1], 0.45) : theme.tree[cellHash(r, c) % 3],
            light: 0.95,
            delay: cell.delay
          });
          if (!solid && hashUnit(r, c, 16) < 0.35) {
            nodes.push({
              kind: "blade",
              wx: cx,
              wy: cy,
              z: turfH,
              h: 0.9 + hashUnit(r, c, 17) * 0.8,
              col: theme.tree[cellHash(r, c) % 3],
              delay: cell.delay
            });
          }
          continue;
        }

        /* crown module: a small stack of blocks at different FIXED heights.
           Their overhead footprints stay inside this cell, so the code is
           intact from above; from the side they give the crown its body.
           Bottom quarter of the tree stays leaf-free. */
        var angC = Math.atan2(cy, cx);
        var zTopM = Math.min(H, H * (0.34 + 0.62 * Math.pow(1 - rN, 0.8) * asym(angC)) +
          (hashUnit(r, c, 7) - 0.5) * 1.6);
        var zBotM = H * (0.27 + 0.05 * hashUnit(r, c, 8));
        zTopM = Math.max(zTopM, zBotM + 1.2);
        darkMap[c + "," + r] = zBotM;
        var count = rN > 0.55 ? 2 : 3;
        for (j = 0; j < count; j++) {
          var frac = j === 0 ? 0.85 + hashUnit(r, c, 21) * 0.15
            : j === 1 ? 0.15 + hashUnit(r, c, 22) * 0.3
            : 0.45 + hashUnit(r, c, 23) * 0.3;
          var size = j === 0 ? 0.95 : 0.55 + hashUnit(r, c, 24 + j) * 0.3;
          var maxOff = (0.98 - size) / 2;
          var bz = lerp(zBotM, zTopM, frac);
          nodes.push({
            kind: "leaf",
            soft: true, /* rendered as a soft leaf blob, swaying in the wind */
            tilt: (hashUnit(r, c, 51 + j) - 0.5) * 0.6,
            phase: hashUnit(r, c, 52 + j) * 6.28,
            wx: cx + (hashUnit(r, c, 26 + j) * 2 - 1) * maxOff,
            wy: cy + (hashUnit(r, c, 27 + j) * 2 - 1) * maxOff,
            z: bz,
            h: size,
            size: size,
            col: theme.qr[(cellHash(r, c) + j) % theme.qr.length],
            tcol: theme.tree[(cellHash(r, c) + j) % theme.tree.length],
            light: 0.85 + 0.22 * (bz / H),
            delay: cell.delay
          });
        }
      }
    }

    /* ---- static crooked trunk + branches, tucked underneath dark cells:
       from overhead they are hidden by the foliage above them, from the
       side they are the visible wood of the bare lower quarter ---- */
    function crownFloor(cc, rr) {
      return darkMap[cc + "," + rr];
    }
    var tc = null, tr = null, best = 1e9;
    for (r = Math.floor(mid) - 3; r <= Math.floor(mid) + 3; r++) {
      for (c = Math.floor(mid) - 3; c <= Math.floor(mid) + 3; c++) {
        if (crownFloor(c, r) !== undefined) {
          var d0 = (c - mid) * (c - mid) + (r - mid) * (r - mid);
          if (d0 < best) {
            best = d0;
            tc = c;
            tr = r;
          }
        }
      }
    }
    if (tc !== null) {
      var topZ = crownFloor(tc, tr) + 1.5; /* reach just into the foliage */
      for (var lv = 0; lv < topZ; lv++) {
        nodes.push({
          kind: "wood",
          wx: tc + QUIET + 0.5 - half,
          wy: tr + QUIET + 0.5 - half,
          z: lv,
          h: 1,
          size: lv < topZ * 0.3 ? 0.95 : 0.82,
          col: TRUNK_BROWNS[lv % TRUNK_BROWNS.length]
        });
      }
    }
    for (i = 0; i < 5; i++) {
      var ang = (i / 5) * 6.28318 + 0.5;
      var ux = Math.cos(ang);
      var uy = Math.sin(ang);
      for (var rad = 2; rad < mid * GROUND_R; rad += 1.4) {
        var gc = Math.round(mid + ux * rad);
        var gr = Math.round(mid + uy * rad);
        var hit = null;
        for (var probe = 0; probe <= 1 && hit === null; probe++) {
          if (crownFloor(gc + probe, gr) !== undefined) {
            hit = [gc + probe, gr];
          } else if (crownFloor(gc, gr + probe) !== undefined) {
            hit = [gc, gr + probe];
          } else if (crownFloor(gc - probe, gr) !== undefined) {
            hit = [gc - probe, gr];
          }
        }
        if (hit === null) {
          continue;
        }
        nodes.push({
          kind: "wood",
          wx: hit[0] + QUIET + 0.5 - half,
          wy: hit[1] + QUIET + 0.5 - half,
          z: crownFloor(hit[0], hit[1]) - 0.85,
          h: 0.6,
          size: 0.6,
          col: TRUNK_BROWNS[(i + Math.round(rad)) % TRUNK_BROWNS.length]
        });
      }
    }

    /* sparse life just outside the code square */
    treePos = { baseHalf: half + 2 };
    for (i = 0; i < 8; i++) {
      var side = Math.floor(srand() * 4);
      var along = (srand() * 2 - 1) * (half + 0.8);
      var out = half + 0.7 + srand() * 1.0;
      nodes.push({
        kind: "grass",
        wx: side === 0 ? along : side === 1 ? along : out * (side === 2 ? 1 : -1),
        wy: side === 0 ? -out : side === 1 ? out : along,
        z: 0,
        h: 1 + srand() * 1.1,
        col: GRASS_GREENS[Math.floor(srand() * GRASS_GREENS.length)]
      });
    }
    for (i = 0; i < 5; i++) {
      var side2 = Math.floor(srand() * 4);
      var along2 = (srand() * 2 - 1) * (half + 0.6);
      var out2 = half + 0.7 + srand() * 1.0;
      nodes.push({
        kind: "flower",
        wx: side2 === 0 ? along2 : side2 === 1 ? along2 : out2 * (side2 === 2 ? 1 : -1),
        wy: side2 === 0 ? -out2 : side2 === 1 ? out2 : along2,
        z: 0.3,
        col: FLOWER_COLORS[Math.floor(srand() * FLOWER_COLORS.length)]
      });
    }

    flatFit = { minX: 0, maxX: 0, minY: 0, maxY: 0 }; /* framing is constant now */
    treeFit = flatFit;

    order = [];
    for (i = 0; i < nodes.length; i++) {
      order.push(i);
    }
  }

  function introAlpha(cell, now) {
    if (introDone || cell.delay === undefined) {
      return 1;
    }
    var x = (now - introAt - cell.delay) / 260;
    return x <= 0 ? 0 : x >= 1 ? 1 : x;
  }

  function updatePetals(dt, e) {
    if (mode === 1 && !reduceMotion && e > 0.6 && petals.length < 12 && prand() < 0.1) {
      petals.push({
        x: prand() * SIZE,
        y: -8,
        vy: (theme.snow ? 14 : 20) + prand() * (theme.snow ? 14 : 24),
        sway: (theme.snow ? 5 : 8) + prand() * (theme.snow ? 8 : 13),
        phase: prand() * 6.28,
        rot: prand() * 6.28,
        color: theme.petals[Math.floor(prand() * theme.petals.length)]
      });
    }
    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i];
      p.y += p.vy * dt / 1000;
      p.phase += dt / 700;
      p.rot += dt / 900;
      if (p.y > SIZE + 10 || e < 0.4) {
        petals.splice(i, 1);
      }
    }
  }

  function drawPetals(e) {
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      ctx.save();
      ctx.globalAlpha = 0.9 * e;
      ctx.translate(p.x + Math.sin(p.phase) * p.sway, p.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (theme.snow) {
        ctx.arc(0, 0, 2.4, 0, 6.29);
      } else {
        ctx.rotate(p.rot);
        ctx.roundRect(-3.2, -2.1, 6.4, 4.2, 2.1);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(now) {
    var dpr = window.devicePixelRatio || 1;
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = rgb(CREAM, 1);
    ctx.fillRect(0, 0, SIZE, SIZE);

    var e = easeInOut(t);
    var half = g / 2;

    var cosT = Math.cos(theta);
    var sinT = Math.sin(theta);
    /* spherical interpolation of the camera elevation — one smooth arc,
       one target anchor, zero cuts */
    var phi = lerp(PHI_TOP, PHI_SIDE, e);
    var sa = Math.sin(phi);
    var ca = Math.cos(phi);

    /* constant zoom (subject ≈ 66% of the frame in both states) and an
       anchor that pans smoothly up the trunk, so the subject never resizes
       or jumps on screen */
    var s = SIZE / (treePos.baseHalf * 2 * 1.38);
    var zA = g * 0.78 * 0.34 * e;
    var ox = SIZE / 2;
    var oy = SIZE * 0.52 + s * zA * ca;

    function drawFx() {
      /* a whisper of peripheral grey to guide the eye — the scene stays
         visible end to end, nothing is ever covered */
      if (fxAlpha <= 0.02) {
        return;
      }
      var gradFx = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.42, SIZE / 2, SIZE / 2, SIZE * 0.8);
      gradFx.addColorStop(0, "rgba(126, 120, 108, 0)");
      gradFx.addColorStop(1, "rgba(126, 120, 108, " + (0.28 * fxAlpha).toFixed(3) + ")");
      ctx.fillStyle = gradFx;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    function px_(wx, wy) {
      return ox + s * (wx * cosT - wy * sinT);
    }
    function py_(wx, wy, z) {
      return oy + s * ((wx * sinT + wy * cosT) * sa - z * ca);
    }

    var i, node;
    var bh = treePos.baseHalf;

    /* soil base */
    ctx.fillStyle = rgb(PLATE_A, 1);
    ctx.beginPath();
    ctx.moveTo(px_(-bh, -bh), py_(-bh, -bh, 0));
    ctx.lineTo(px_(bh, -bh), py_(bh, -bh, 0));
    ctx.lineTo(px_(bh, bh), py_(bh, bh, 0));
    ctx.lineTo(px_(-bh, bh), py_(-bh, bh, 0));
    ctx.closePath();
    ctx.fill();

    if (t <= 0.0001) {
      /* fully settled scan state: exact overhead grid, pixel-snapped */
      var fcorners = [[0, 0], [0, modCount - 7], [modCount - 7, 0]];
      var u = Math.round(s * dpr) / dpr;
      for (i = 0; i < fcorners.length; i++) {
        var fx = fcorners[i][1] + QUIET - half;
        var fy = fcorners[i][0] + QUIET - half;
        var fpx = Math.round(px_(fx, fy) * dpr) / dpr;
        var fpy = Math.round(py_(fx, fy, 0) * dpr) / dpr;
        ctx.fillStyle = rgb(theme.finder, 1);
        ctx.fillRect(fpx, fpy, 7 * u, 7 * u);
        ctx.fillStyle = rgb(PLATE_A, 1);
        ctx.fillRect(fpx + u, fpy + u, 5 * u, 5 * u);
        ctx.fillStyle = rgb(theme.finder, 1);
        ctx.fillRect(fpx + 2 * u, fpy + 2 * u, 3 * u, 3 * u);
      }
      for (i = 0; i < cells.length; i++) {
        node = cells[i];
        if (node.finder) {
          continue;
        }
        var a0 = introAlpha(node, now);
        if (a0 <= 0) {
          continue;
        }
        var w = node.solid ? 1 : 0.95;
        var x0 = px_(node.cx - w / 2, node.cy - w / 2);
        var y0 = py_(node.cx - w / 2, node.cy - w / 2, 0);
        var pw = w * s;
        if (introDone) {
          x0 = Math.round(x0 * dpr) / dpr;
          y0 = Math.round(y0 * dpr) / dpr;
          pw = Math.round(pw * dpr) / dpr;
        }
        ctx.globalAlpha = a0;
        ctx.fillStyle = rgb(node.col, 1);
        ctx.fillRect(x0, y0, pw, pw);
      }
      ctx.globalAlpha = 1;
      drawPetals(e);
      drawFx();
      return;
    }

    ctx.globalAlpha = e * 0.6;
    ctx.fillStyle = "rgba(94, 84, 60, 0.16)";
    ctx.beginPath();
    ctx.ellipse(px_(0, 0), py_(0, 0, 0) + 1, half * 0.55 * s, half * 0.55 * s * sa, 0, 0, 6.29);
    ctx.fill();
    ctx.globalAlpha = 1;

    /* ---- the sculpture is frozen: world positions were fixed at build
       time and never change. Only the painter's order follows the camera
       (that is ordering, not motion). Colour drifts deep→lush with the
       tilt, like light changing on a fixed object. ---- */
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      node._q = e;
      node._x = node.wx;
      node._y = node.wy;
      node._z = node.z;
      node._size = node.size || 1;
      node._h = node.h || 1;
      node.depth = node._x * sinT + node._y * cosT + node._z * 0.01;
    }
    order.sort(function (a, b) {
      return nodes[a].depth - nodes[b].depth;
    });

    /* gentle breeze: fades out entirely in the overhead scan view, so the
       code face never wavers; positions in the model stay fixed — the sway
       is a pure render-time offset */
    var windT = now * 0.0012;
    var windAmp = reduceMotion ? 0 : 0.17 * e;

    for (var oi = 0; oi < order.length; oi++) {
      node = nodes[order[oi]];
      var alpha = introAlpha(node, now);
      if (alpha <= 0.01) {
        continue;
      }
      ctx.globalAlpha = alpha;

      if (node.soft) {
        /* soft two-layer leaf blob */
        var swx = node._x + windAmp * Math.sin(windT + node.phase);
        var swy = node._y + windAmp * 0.7 * Math.cos(windT * 0.9 + node.phase * 1.3);
        var scol = node.tcol ? mix(node.col, node.tcol, node._q) : node.col;
        var bx = px_(swx, swy);
        var by = py_(swx, swy, node._z + node._h * 0.55);
        var rx = node._size * s * 0.68;
        var ry2 = rx * 0.82;
        ctx.fillStyle = rgb(scol, 0.78 * (node.light || 1));
        ctx.beginPath();
        ctx.ellipse(bx + rx * 0.12, by + ry2 * 0.3, rx, ry2, node.tilt, 0, 6.29);
        ctx.fill();
        ctx.fillStyle = rgb(scol, Math.min(1.12, (node.light || 1) * 1.05));
        ctx.beginPath();
        ctx.ellipse(bx - rx * 0.06, by - ry2 * 0.14, rx * 0.94, ry2 * 0.9, node.tilt, 0, 6.29);
        ctx.fill();
        continue;
      }

      if (node.kind === "grass" || node.kind === "blade") {
        ctx.globalAlpha = alpha * (node.kind === "blade" ? Math.max(0.25, e) : 1);
        ctx.fillStyle = rgb(node.col, 1);
        for (var b2 = -1; b2 <= 1; b2++) {
          var bx2 = node._x + b2 * (node.kind === "blade" ? 0.24 : 0.55);
          var bhh = node._h * (b2 === 0 ? 1 : 0.72);
          ctx.beginPath();
          ctx.moveTo(px_(bx2 - 0.22, node._y), py_(bx2 - 0.22, node._y, node._z));
          ctx.lineTo(px_(bx2 + 0.22, node._y), py_(bx2 + 0.22, node._y, node._z));
          ctx.lineTo(px_(bx2 + b2 * 0.14 + windAmp * 0.8 * Math.sin(windT + bx2), node._y), py_(bx2 + b2 * 0.14 + windAmp * 0.8 * Math.sin(windT + bx2), node._y, node._z + bhh));
          ctx.closePath();
          ctx.fill();
        }
        continue;
      }
      if (node.kind === "flower") {
        ctx.fillStyle = rgb(node.col, 1);
        ctx.beginPath();
        ctx.arc(px_(node._x, node._y), py_(node._x, node._y, node._z), Math.max(1.6, 0.2 * s), 0, 6.29);
        ctx.fill();
        continue;
      }

      var hf = node._size / 2;
      var z0 = node._z;
      var z1 = node._z + node._h;
      var light = node.light || 1;
      var bcol = node.tcol ? mix(node.col, node.tcol, node._q) : node.col;

      for (var side = 0; side < 4; side++) {
        var dxs = side === 0 ? 1 : side === 1 ? -1 : 0;
        var dys = side === 2 ? 1 : side === 3 ? -1 : 0;
        var ny = dxs * sinT + dys * cosT;
        if (ny <= 0.02) {
          continue;
        }
        var nx = dxs * cosT - dys * sinT;
        var mul = Math.min(1, 0.55 + 0.3 * ny + 0.15 * Math.max(nx, 0));
        var pax = node._x + (dxs !== 0 ? dxs * hf : -hf);
        var pay = node._y + (dys !== 0 ? dys * hf : -hf);
        var pbx = node._x + (dxs !== 0 ? dxs * hf : hf);
        var pby = node._y + (dys !== 0 ? dys * hf : hf);
        ctx.fillStyle = rgb(bcol, mul * light);
        ctx.beginPath();
        ctx.moveTo(px_(pax, pay), py_(pax, pay, z1));
        ctx.lineTo(px_(pbx, pby), py_(pbx, pby, z1));
        ctx.lineTo(px_(pbx, pby), py_(pbx, pby, z0));
        ctx.lineTo(px_(pax, pay), py_(pax, pay, z0));
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = rgb(bcol, Math.min(1.08, light * 1.05));
      ctx.beginPath();
      ctx.moveTo(px_(node._x - hf, node._y - hf), py_(node._x - hf, node._y - hf, z1));
      ctx.lineTo(px_(node._x + hf, node._y - hf), py_(node._x + hf, node._y - hf, z1));
      ctx.lineTo(px_(node._x + hf, node._y + hf), py_(node._x + hf, node._y + hf, z1));
      ctx.lineTo(px_(node._x - hf, node._y + hf), py_(node._x - hf, node._y + hf, z1));
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawPetals(e);
    drawFx();
  }

  function setHints() {
    var i;
    for (i = 0; i < hintFlat.length; i++) {
      hintFlat[i].hidden = mode === 1;
    }
    for (i = 0; i < hint3d.length; i++) {
      hint3d[i].hidden = mode !== 1;
    }
  }

  function needsFrames() {
    return !introDone || t !== mode || mode === 1;
  }

  function tick(now) {
    var dt = lastNow ? Math.min(64, now - lastNow) : 16;
    lastNow = now;
    if (!introDone && now - introAt > 430 + 300) {
      introDone = true;
    }
    if (t !== mode) {
      var step = dt / TRANS_MS;
      t = mode === 1 ? Math.min(1, t + step) : Math.max(0, t - step);
    }
    /* the focus vignette breathes with the transition and is gone at rest */
    fxAlpha = t > 0 && t < 1 ? Math.sin(3.14159 * t) : 0;
    canvas.style.filter = fxAlpha > 0.02
      ? "saturate(" + (1 - 0.14 * fxAlpha).toFixed(3) + ") blur(" + (0.6 * fxAlpha).toFixed(2) + "px)"
      : "";

    if (mode === 1) {
      if (!dragging) {
        if (!spinSettled) {
          if (t < 1) {
            theta = easeInOut(t) * THETA_HOME; /* azimuth rides the same arc */
          } else {
            theta += (THETA_HOME - theta) * Math.min(1, dt / 220);
            if (Math.abs(THETA_HOME - theta) < 0.01) {
              theta = THETA_HOME;
              spinSettled = true;
            }
          }
        } else if (!reduceMotion) {
          theta += dt * SPIN_SPEED;
        }
      }
    } else {
      /* reverse strictly retraces the same path down to θ = 0 */
      theta = t > 0 ? flattenTheta * (t / flattenT0) : 0;
    }

    updatePetals(dt, easeInOut(t));
    draw(now);
    if (needsFrames()) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  function kick() {
    if (!rafId) {
      lastNow = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function pageUrl() {
    /* Drop the hash: section-nav rewrites it while scrolling, the phone should
       land on the page top anyway, and fewer bytes keep the code coarse enough
       to scan off a laptop screen. */
    return window.location.href.split("#")[0];
  }

  function open() {
    var url = pageUrl();
    if (url !== currentUrl) {
      buildMatrix(url);
      currentUrl = url;
      urlLabel.textContent = url;
    }
    mode = 0;
    t = 0;
    fxAlpha = 0;
    canvas.style.filter = "";
    theta = 0;
    petals.length = 0;
    introAt = performance.now();
    introDone = reduceMotion;
    setHints();
    dialog.showModal();
    kick();
  }

  button.addEventListener("click", open);

  canvas.addEventListener("pointerdown", function (ev) {
    if (mode !== 1) {
      return;
    }
    dragging = true;
    dragMoved = false;
    dragX0 = ev.clientX;
    dragTheta0 = theta;
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", function (ev) {
    if (!dragging) {
      return;
    }
    var dx = ev.clientX - dragX0;
    if (Math.abs(dx) > 4) {
      dragMoved = true;
    }
    theta = dragTheta0 + dx * 0.012;
    spinSettled = true;
    kick();
  });

  function endDrag() {
    dragging = false;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("click", function () {
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    mode = mode === 1 ? 0 : 1;
    if (mode === 0) {
      flattenTheta = normAngle(theta);
      flattenT0 = Math.max(t, 0.001);
    } else {
      spinSettled = false;
    }
    if (reduceMotion) {
      t = mode;
      theta = mode === 1 ? THETA_HOME : 0;
      spinSettled = true;
    }
    setHints();
    kick();
  });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog || event.target.closest("[data-qr-close]")) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", function () {
    stop();
    petals.length = 0;
    button.blur();
  });
})();
