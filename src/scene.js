/* ============================================================
   bitan-pond · 场景（分层）
   图层自下而上：
     L0 池底   沙底 + 沉水植物
     L1 水下   鱼影
     L2 鱼     鱼群（小的先画，大的后画）
     L3 水面   焦散 + 气泡 + 浮萍 + 荷叶 + 荷花 + 花瓣 + 涟漪
     L4 岸上   岸边植物 + 九曲桥 + 凉亭      <- 必须盖住水面
     L5 氛围   月光 / 萤火虫 / 暗角
   比例参照抖音图实测：鱼长 ≈ 屏宽 2~3%
   ============================================================ */
(function (root) {
  var S = {};
  var W = 1440, H = 900;
  S.W = W; S.H = H;

  S.SIZE = [
    { w: 0.55, min: 0.018, max: 0.026 },   // 主体（整鱼 ≈ 参照的 2~3%W）
    { w: 0.28, min: 0.027, max: 0.038 },   // 中等
    { w: 0.12, min: 0.040, max: 0.055 },   // 偏大
    { w: 0.05, min: 0.060, max: 0.080 }    // 近水面最大
  ];

  function rng(seed) { var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------------- 鱼群 ---------------- */
  S.build = function (seed, count) {
    var r = rng(seed), i, fish = [];
    for (i = 0; i < count; i++) {
      var pick = r(), acc = 0, band = S.SIZE[0];
      for (var k = 0; k < S.SIZE.length; k++) { acc += S.SIZE[k].w; if (pick <= acc) { band = S.SIZE[k]; break; } }
      fish.push({
        x: r() * W, y: r() * H, dir: r() * 6.2832,
        // 速度差异化：小鱼快、大鱼慢；同尺寸也各有个体差异
        spd: (1.30 - Math.min(1, (band.min + band.max) / 2 / 0.07) * 0.55) * (0.55 + r() * 0.95),
        baseSpd: 0,          // 巡航速度（下面赋值）
        burst: 0,            // 冲刺剩余时间
        L: (band.min + r() * (band.max - band.min)) * W,
        sp: Art.pickSpecies(r),
        seed: 1000 + i * 37, phase: r(),
        freq: 1.50 + r() * 0.90,      // 尾摆频率（周期/秒）：配 16 帧 -> 每秒换帧 24~38 次
        amp: 0,                        // 摆幅改由尺寸档决定（见 Art.CLASS_AMP）
        turn: (r() - 0.5) * 0.012,
        depth: r()                     // 0=浅(近水面) 1=深
      });
    }
    // 成群：参照图是「一大群 + 若干三三两两 + 少数独行」
    // 先挑 3 个群心，把 ~65% 的鱼塞进群心附近
    var cores = [];
    for (i = 0; i < 3; i++) cores.push({ x: W * (0.20 + r() * 0.55), y: H * (0.28 + r() * 0.45), dir: r() * 6.2832 });
    for (i = 0; i < fish.length; i++) {
      if (r() < 0.65) {
        var c = cores[(r() * cores.length) | 0];
        var rad = 0.8 + r() * 2.6;
        fish[i].x = c.x + (r() - 0.5) * fish[i].L * rad * 3.0;
        fish[i].y = c.y + (r() - 0.5) * fish[i].L * rad * 2.0;
        fish[i].dir = c.dir + (r() - 0.5) * 0.5;
      }
    }
    for (i = 0; i < fish.length; i++) { fish[i].baseSpd = fish[i].spd; }
    if (root.Pond && root.Pond.initFish) root.Pond.initFish(fish);
    return fish;
  };

  S.step = function (fish, t) {
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i];
      f.dir += f.turn + Math.sin(t * 0.7 + i * 1.3) * 0.004;
      f.x += Math.cos(f.dir) * f.spd;
      f.y += Math.sin(f.dir) * f.spd;
      var m = f.L;
      if (f.x < m) { f.x = m; f.dir = Math.PI - f.dir + (Math.random() - 0.5) * 0.3; }
      if (f.x > W - m) { f.x = W - m; f.dir = Math.PI - f.dir + (Math.random() - 0.5) * 0.3; }
      if (f.y < m) { f.y = m; f.dir = -f.dir + (Math.random() - 0.5) * 0.3; }
      if (f.y > H - m) { f.y = H - m; f.dir = -f.dir + (Math.random() - 0.5) * 0.3; }
      // ---- 分离：避免鱼叠在一起 ----
      // 对附近同层的鱼施加排斥，并轻微转向离开
      for (var j2 = 0; j2 < fish.length; j2++) {
        if (j2 === i) continue;
        var o2 = fish[j2];
        var ddx = f.x - o2.x, ddy = f.y - o2.y;
        var dist2 = ddx * ddx + ddy * ddy;
        // 期望最小间距 = 两条鱼体长的平均 * 0.85
        var minD = (f.L + o2.L) * 0.42;
        if (dist2 > minD * minD || dist2 < 0.0001) continue;
        var dist = Math.sqrt(dist2);
        var push = (minD - dist) / minD;          // 0..1，越挤推得越猛
        // 位置推开
        var ux = ddx / dist, uy = ddy / dist;
        var k = push * 0.85;
        f.x += ux * k; f.y += uy * k;
        // 转向避开（只影响朝向，避免抖动）
        if (f.burst <= 0) {
          var away = Math.atan2(uy, ux);
          var diff2 = away - f.dir;
          while (diff2 > Math.PI) diff2 -= 6.2832;
          while (diff2 < -Math.PI) diff2 += 6.2832;
          f.dir += Math.max(-0.05, Math.min(0.05, diff2 * push * 1.6));
        }
      }
      // 冲刺：双击喂食后冲向目标，之后平滑回落
      if (f.burst > 0) {
        f.burst -= 0.016;
        if (f.burst <= 0) { f.spd = f.baseSpd; f.burst = 0; }
      } else if (f.spd !== f.baseSpd) {
        f.spd += (f.baseSpd - f.spd) * 0.05;
        if (Math.abs(f.spd - f.baseSpd) < 0.01) f.spd = f.baseSpd;
      }
    }
    // 食物与进食
    if (root.Pond && root.Pond.stepFood) root.Pond.stepFood(1 / 60, fish, W, H);
  };

  /* ---------------- L0 池底 ---------------- */
  S.layerBottom = function (g, r) {
    // ---- 1) 深度渐变：中心浅亮、四周深暗 ----
    Art.depthGradient(g, W, H, {
      center: '#0a2833', mid: '#071f29', outer: '#041219', deep: '#02080d'
    });

    // ---- 2) 大面积水色斑（低频，不是噪点）----
    for (var i = 0; i < 14; i++) {
      var x = r() * W, y = r() * H, rr = 260 + r() * 460;
      var cc = r() < 0.5 ? '96,196,184' : '18,64,88';
      var w = g.createRadialGradient(x, y, 0, x, y, rr);
      w.addColorStop(0, 'rgba(' + cc + ',0.030)');
      w.addColorStop(1, 'rgba(' + cc + ',0)');
      g.fillStyle = w; g.beginPath(); g.arc(x, y, rr, 0, 6.2832); g.fill();
    }

    // ---- 3) 阳光光柱（水感核心）----
    Art.lightShafts(g, W, H, { count: 6, seed: 21, angle: -0.62, alpha: 0.022 });
    Art.lightShafts(g, W, H, { count: 3, seed: 77, angle: 0.52, alpha: 0.014 });

    // ---- 4) 池底：沉水植物（模糊、低对比，体现"透过水看"）----
    g.save(); g.filter = 'blur(7px)';
    for (i = 0; i < 20; i++) {
      Art.waterPlant(g, { x: r() * W, y: r() * H, len: 60 + r() * 70, blades: 8, alpha: 0.26, seed: i * 13 + 3 });
    }
    g.restore();

    // ---- 5) 焦散（水面聚光投在池底，要柔）----
    Art.caustic(g, { w: W, h: H, count: 55, alpha: 0.016, rmin: 60, rmax: 190, seed: 9 });

    // ---- 6) 表面波纹（极淡横向水纹）----
    Art.surfaceRipples(g, W, H, { rows: 30, seed: 33, alpha: 0.045, amp: 5, width: 1.5 });
    Art.surfaceRipples(g, W, H, { rows: 16, seed: 88, alpha: 0.028, amp: 9, width: 2.4 });

    // ---- 7) 浑浊感：远处发白，有"水体"的感觉 ----
    Art.murk(g, W, H, { alpha: 0.045, edge: 0.13 });
  };

  /* ---------------- L3 水面（盖住鱼） ---------------- */
  /* 荷叶布置：形态/色调/大小/朝向全部不同，且都不出画布 */
  S.LEAVES = [
    { x: 185, y: 745, r: 170, rot: 0.90, form: 'round', tone: 'fresh',  seed: 11 },
    { x: 330, y: 780, r: 112, rot: -0.55, form: 'notch', tone: 'deep',   seed: 22 },
    { x: 105, y: 625, r: 92,  rot: 1.70, form: 'torn',  tone: 'olive',  seed: 33 },
    { x: 355, y: 665, r: 66,  rot: 0.30, form: 'young', tone: 'fresh',  seed: 44 },
    { x: 1262, y: 168, r: 148, rot: -0.30, form: 'round', tone: 'deep', seed: 55 },
    { x: 1338, y: 292, r: 88,  rot: 0.70, form: 'curl',  tone: 'fresh', seed: 66 },
    { x: 1112, y: 108, r: 76,  rot: 1.20, form: 'notch', tone: 'olive', seed: 77 },
    { x: 1218, y: 742, r: 138, rot: 0.40, form: 'torn',  tone: 'fresh', seed: 88 },
    { x: 1318, y: 610, r: 82,  rot: -1.10, form: 'young', tone: 'deep', seed: 99 },
    { x: 622,  y: 176, r: 70,  rot: 2.10, form: 'curl',  tone: 'olive', seed: 111 },
    { x: 982,  y: 528, r: 60,  rot: 0.90, form: 'young', tone: 'fresh', seed: 122 },
    { x: 452,  y: 432, r: 56,  rot: 1.40, form: 'notch', tone: 'deep',  seed: 133 }
  ];

  S.layerSurface = function (g, r) {
    Art.caustic(g, { w: W, h: H, count: 110, alpha: 0.045, seed: 9 });
    Art.bubble(g, { x: 520, y: 640, w: 340, h: 220, size: 11, count: 14, seed: 3, alpha: 0.42 });
    Art.duckweed(g, { x: 210, y: 250, r: 130, size: 9, count: 36, alpha: 0.48, seed: 4 });
    Art.duckweed(g, { x: 1180, y: 820, r: 150, size: 10, count: 40, alpha: 0.44, seed: 6 });
    // 荷叶（多形态）
    for (var i = 0; i < S.LEAVES.length; i++) {
      var L = S.LEAVES[i];
      Art.lotusLeaf(g, { x: L.x, y: L.y, r: L.r, rot: L.rot, form: L.form, tone: L.tone, seed: L.seed });
    }
    // 荷花（贴在叶边）
    // 荷花：小而少，只作点缀（参照图里花只是小粉点）
    Art.lotusBloom(g, { x: 236, y: 686, r: 19 });
    Art.lotusBloom(g, { x: 318, y: 742, r: 14 });
    Art.lotusBloom(g, { x: 1300, y: 212, r: 17 });
    Art.lotusBloom(g, { x: 1236, y: 690, r: 13 });
    Art.petal(g, { x: 322, y: 726, r: 42, size: 8, count: 3, seed: 5 });   // 只留两三片，贴在花边
  };

  /* ---------------- L4 岸上结构（盖住水面） ---------------- */
  S.layerAbove = function (g, r) {
    Art.shorePlant(g, { x: -14, y: 560, len: 135, blades: 38, spread: 230, rot: -1.57, seed: 23, alpha: 0.86 });
    Art.shorePlant(g, { x: -10, y: 820, len: 110, blades: 30, spread: 170, rot: -1.62, seed: 24, alpha: 0.78 });
    Art.shorePlant(g, { x: 1454, y: 390, len: 125, blades: 34, spread: 210, rot: 1.57, seed: 27, alpha: 0.86 });
    Art.shorePlant(g, { x: 700, y: -6, len: 100, blades: 24, spread: 190, rot: 3.14, seed: 31, alpha: 0.62 });
    Art.pavilion(g, { x: 150, y: 120, r: 78, rot: 0.2 });
  };

  function makeLayer(fn, seed) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    fn(c.getContext('2d'), rng(seed));
    return c;
  }

  /* ---------------- 逐帧渲染 ---------------- */
  S.render = function (g, fish, t, night) {
    if (!g._L0) {
      g._L0 = makeLayer(S.layerBottom, 20260928);
      g._L3 = makeLayer(S.layerSurface, 20260928);
      g._L4 = makeLayer(S.layerAbove, 20260928);
    }
    g.clearRect(0, 0, W, H);
    g.drawImage(g._L0, 0, 0);                                   // L0 池底

    if (!g._shadowSpr) {
      g._shadowSpr = {};
    }
    // L1 鱼影（烘焙精灵，避免每帧 blur）
    for (i = 0; i < fish.length; i++) {
      var f = fish[i], d = f.depth;
      var skey = (f.cls == null ? (f.cls = Art.classOf(f.L / W)) : f.cls);
      var ss = g._shadowSpr[skey];
      if (!ss) {
        var sc = document.createElement('canvas');
        var sw = Math.ceil(f.L * 1.7), sh = Math.ceil(f.L * 1.0);
        sc.width = sw; sc.height = sh;
        var sg = sc.getContext('2d');
        sg.translate(sw / 2, sh / 2);
        Art.fishShadow(sg, { x: 0, y: 0, len: f.L, rot: 0, alpha: 0.30 });
        ss = g._shadowSpr[skey] = { canvas: sc, w: sw, h: sh };
      }
      g.save();
      g.globalAlpha = 0.85 * (1 - d * 0.45);
      g.translate(f.x + f.L * (0.06 + d * 0.10), f.y + f.L * (0.08 + d * 0.12));
      g.rotate(f.dir + Math.PI);
      g.drawImage(ss.canvas, -ss.w / 2, -ss.h / 2, ss.w, ss.h);
      g.restore();
    }
    // L2 鱼（小→大，形成层次）
    // 成组共享：组 = 品种 × 体长档，每组一套 24 帧摆动资源。
    // 组内不同鱼只靠 phase 偏移错开 -> 观感各自独立，但摆动只算一次。
    var order = fish.slice().sort(function (a, b) { return a.L - b.L; });
    for (i = 0; i < order.length; i++) {
      var k = order[i];
      if (k.parts == null) k.parts = Art.getKoiParts(k.sp, k.L, k.L / W);
      Art.drawKoiParts(g, k.parts, k.x, k.y, k.dir + Math.PI, k.phase + t * k.freq);
    }

    g.drawImage(g._L3, 0, 0);                                   // L3 水面
    // 动态涟漪（投食/雨滴反馈用）
    if (S.ripples) for (i = 0; i < S.ripples.length; i++) {
      var rp = S.ripples[i];
      Art.ripple(g, { x: rp.x, y: rp.y, r: rp.r * (1 + rp.age * 3), t: rp.age * 2, rings: 2, alpha: 0.5 * (1 - rp.age) });
    }
    g.drawImage(g._L4, 0, 0);                                   // L4 岸上

    // 食物 + 涟漪（浮在水面之上）
    if (root.Pond) {
      root.Pond.drawFood(g, W);
    }
    // L5 氛围
    if (night) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.05;
      var mg = g.createRadialGradient(W * 0.62, H * 0.18, 10, W * 0.62, H * 0.18, 620);
      mg.addColorStop(0, 'rgba(190,230,255,1)'); mg.addColorStop(1, 'rgba(190,230,255,0)');
      g.fillStyle = mg; g.fillRect(0, 0, W, H); g.restore();
      Art.firefly(g, { x: W * 0.24, y: H * 0.30, w: W * 0.34, h: H * 0.34, count: 6, glow: 130, t: t * 0.06, seed: 13 });
      Art.firefly(g, { x: W * 0.72, y: H * 0.68, w: W * 0.30, h: H * 0.30, count: 5, glow: 120, t: t * 0.05, seed: 17 });
      Art.firefly(g, { x: W * 0.55, y: H * 0.22, w: W * 0.22, h: H * 0.20, count: 3, glow: 100, t: t * 0.07, seed: 19 });
    }
    var vg = g.createRadialGradient(W * 0.5, H * 0.5, H * 0.34, W * 0.5, H * 0.5, H * 0.88);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,8,12,' + (night ? 0.74 : 0.50) + ')');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);

    // HUD 浮窗（最上层）
    if (root.Pond) root.Pond.drawHUD(g, fish, W, H);
  };

  root.Scene = S;
})(window);
