/* ============================================================
   bitan-pond · 美术资源绘制器  (v3)
   几何取自用户 2026-09-28 认可的第一版（逐字保留，未做改动）
   仅新增：物种配色表 + 荷叶/荷花/水草/黄石 + seed 参数化
   ---- v1 关键参数（请勿擅改）----
     体宽 W = len * 0.34
     体型 taper = sin(PI * t^0.72)        // 对称水滴：头圆、尾尖
     花纹半径 r = W * (0.16 + rnd*0.30)
     胸鳍 alpha 0.42 / 尾鳍 alpha 0.62，均取体色中段
   ============================================================ */
(function (root) {
  var A = {};

  A.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  };

  /* ---------- 画一条鱼（第一版几何，逐字保留） ----------
     o = { x, y, len, rot, base:[c0,c1,c2], pat:{n,c}, seed }            */
  A.koi = function (g, o) {
    var rnd = A.rng(o.seed || 1);
    var base = o.base, pat = o.pat, L = o.len, W = o.len * 0.34;
    /* ---- 游动摆动（amp=0 时退化为原静态几何，逐像素一致）----
       amp   : 摆动幅度（相对体长），0.05~0.12 比较自然
       phase : 相位，驱动时间演化；不同鱼用不同 phase 就不同姿势
       wave  : 沿体轴的行波系数，越大尾部摆得越厉害            */
    var amp = o.amp || 0, ph = o.phase || 0, wv = o.wave == null ? 0.85 : o.wave;
    var psc = o.patScale == null ? 1 : o.patScale;      // 花纹缩放：小鱼用更小的斑块
    var pal = o.patAlpha == null ? 1 : o.patAlpha;      // 花纹透明度倍数
    function off(t) {
      if (!amp) return 0;
      var tt = t > 1 ? 1 : t;
      return amp * L * Math.sin(6.2832 * (ph - tt * wv)) * Math.pow(tt, 1.35);
    }
    function slope(t) {
      if (!amp) return 0;
      var d = 0.03, a = off(Math.max(0, t - d)), b = off(Math.min(1, t + d));
      return (b - a) / (2 * d * L);
    }
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0);

    // body: teardrop (fat head -> narrow tail)
    function bodyPath(sc) {
      g.beginPath();
      var n = 64, i, t, x, taper, w;
      for (i = 0; i <= n; i++) {
        t = i / n;                       // 0=head 1=tail
        x = (t - 0.5) * L;
        taper = Math.sin(Math.PI * Math.pow(t, 0.72));   // asymmetric taper
        w = W * 0.5 * taper * sc;
        var oy = off(t);
        if (i === 0) g.moveTo(x, -w + oy); else g.lineTo(x, -w + oy);
      }
      for (i = n; i >= 0; i--) {
        t = i / n; x = (t - 0.5) * L;
        taper = Math.sin(Math.PI * Math.pow(t, 0.72));
        w = W * 0.5 * taper * sc;
        g.lineTo(x, w + off(t));
      }
      g.closePath();
    }

    // soft ink halo
    g.save(); bodyPath(1.16);
    var halo = g.createRadialGradient(0, 0, 0, 0, 0, L * 0.6);
    halo.addColorStop(0, 'rgba(30,60,72,0.30)'); halo.addColorStop(1, 'rgba(30,60,72,0)');
    g.fillStyle = halo; g.filter = 'blur(9px)'; g.fill(); g.restore();

    // body base colour with wash gradient
    bodyPath(1.0);
    var bg = g.createLinearGradient(-L / 2, 0, L / 2, 0);
    bg.addColorStop(0, base[0]); bg.addColorStop(0.45, base[1]); bg.addColorStop(1, base[2]);
    g.fillStyle = bg;
    g.save(); g.shadowColor = 'rgba(20,50,60,0.35)'; g.shadowBlur = 10; g.fill(); g.restore();

    // pattern patches (clipped to body)
    g.save(); bodyPath(0.98); g.clip();
    var i2, px, py, r;
    for (i2 = 0; i2 < pat.n; i2++) {
      px = (rnd() - 0.15) * L * 0.82; py = (rnd() - 0.5) * W * 1.05;
      r = W * (0.16 + rnd() * 0.30) * psc;
      var tp = px / L + 0.5;
      g.beginPath();
      g.ellipse(px, py + off(tp), r * (0.85 + rnd() * 0.75), r * (0.6 + rnd() * 0.5), rnd() * 3 + slope(tp), 0, 6.2832);
      g.fillStyle = pat.c; g.globalAlpha = (0.55 + rnd() * 0.4) * pal; g.fill(); g.globalAlpha = 1;
    }
    g.restore();

    // pectoral fins
    g.save(); g.globalAlpha = 0.42 * pal; g.fillStyle = base[1];   // 小鱼淡化鳍，避免读成"四肢"
    var sides = [-1, 1], si, s;
    for (si = 0; si < sides.length; si++) {
      s = sides[si];
      g.beginPath();
      var oA = off(0.52), oB = off(0.80);
      g.moveTo(L * 0.02, s * W * 0.34 + oA);
      g.quadraticCurveTo(L * 0.14, s * W * 0.92 + oA, L * 0.30, s * W * 0.44 + oB);
      g.quadraticCurveTo(L * 0.16, s * W * 0.30 + oA, L * 0.02, s * W * 0.34 + oA);
      g.fill();
    }
    g.restore();

    // tail
    g.save(); g.globalAlpha = 0.62 * (0.55 + pal * 0.45); g.fillStyle = base[1];
    g.translate(L * 0.46, off(0.96));
    g.rotate(slope(0.96) * 0.9);
    g.translate(-L * 0.46, 0);
    g.beginPath(); g.moveTo(L * 0.46, 0);
    g.quadraticCurveTo(L * 0.68, -W * 0.46, L * 0.60, -W * 0.10);
    g.quadraticCurveTo(L * 0.72, 0, L * 0.60, W * 0.10);
    g.quadraticCurveTo(L * 0.68, W * 0.46, L * 0.46, 0);
    g.fill(); g.restore();

    // dorsal ridge ink line
    g.save(); g.strokeStyle = 'rgba(25,55,66,0.30)'; g.lineWidth = Math.max(1, L * 0.012);
    g.beginPath(); g.moveTo(-L * 0.30, off(0.20));
    g.quadraticCurveTo(0, -W * 0.05 + off(0.50), L * 0.34, off(0.84));
    g.stroke(); g.restore();

    g.restore();
  };

  /* ---------- 拆分绘制：身体（不含尾鳍） ---------- */
  A.koiBody = function (g, o) {
    var rnd = A.rng(o.seed || 1);
    var base = o.base, pat = o.pat, L = o.len, W = o.len * 0.34;
    var psc = o.patScale == null ? 1 : o.patScale;
    var pal = o.patAlpha == null ? 1 : o.patAlpha;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0);

    function bodyPath(sc) {
      g.beginPath();
      var n = 64, i, t, x, taper, w;
      for (i = 0; i <= n; i++) {
        t = i / n; x = (t - 0.5) * L;
        taper = Math.sin(Math.PI * Math.pow(t, 0.72));
        w = W * 0.5 * taper * sc;
        if (i === 0) g.moveTo(x, -w); else g.lineTo(x, -w);
      }
      for (i = n; i >= 0; i--) {
        t = i / n; x = (t - 0.5) * L;
        taper = Math.sin(Math.PI * Math.pow(t, 0.72));
        w = W * 0.5 * taper * sc;
        g.lineTo(x, w);
      }
      g.closePath();
    }

    // 柔光晕
    g.save(); bodyPath(1.16);
    var halo = g.createRadialGradient(0, 0, 0, 0, 0, L * 0.6);
    halo.addColorStop(0, 'rgba(30,60,72,0.30)'); halo.addColorStop(1, 'rgba(30,60,72,0)');
    g.fillStyle = halo; g.filter = 'blur(9px)'; g.fill(); g.restore();

    // 体色
    bodyPath(1.0);
    var bg = g.createLinearGradient(-L / 2, 0, L / 2, 0);
    bg.addColorStop(0, base[0]); bg.addColorStop(0.45, base[1]); bg.addColorStop(1, base[2]);
    g.fillStyle = bg;
    g.save(); g.shadowColor = 'rgba(20,50,60,0.35)'; g.shadowBlur = 10; g.fill(); g.restore();

    // 花纹
    g.save(); bodyPath(0.98); g.clip();
    for (var i2 = 0; i2 < pat.n; i2++) {
      var px = (rnd() - 0.15) * L * 0.82, py = (rnd() - 0.5) * W * 1.05;
      var r = W * (0.16 + rnd() * 0.30) * psc;
      g.beginPath();
      g.ellipse(px, py, r * (0.85 + rnd() * 0.75), r * (0.6 + rnd() * 0.5), rnd() * 3, 0, 6.2832);
      g.fillStyle = pat.c; g.globalAlpha = (0.55 + rnd() * 0.4) * pal; g.fill(); g.globalAlpha = 1;
    }
    g.restore();

    // 胸鳍
    g.save(); g.globalAlpha = 0.42 * pal; g.fillStyle = base[1];
    for (var si = 0; si < 2; si++) {
      var sd = si ? 1 : -1;
      g.beginPath();
      g.moveTo(L * 0.02, sd * W * 0.34);
      g.quadraticCurveTo(L * 0.14, sd * W * 0.92, L * 0.30, sd * W * 0.44);
      g.quadraticCurveTo(L * 0.16, sd * W * 0.30, L * 0.02, sd * W * 0.34);
      g.fill();
    }
    g.restore();

    // 背脊墨线
    g.save(); g.strokeStyle = 'rgba(25,55,66,0.30)'; g.lineWidth = Math.max(1, L * 0.012);
    g.beginPath(); g.moveTo(-L * 0.30, 0); g.quadraticCurveTo(0, -W * 0.05, L * 0.34, 0); g.stroke(); g.restore();

    g.restore();
  };

  /* ---------- 拆分绘制：尾鳍（原点=尾柄，向右伸展） ---------- */
  A.koiTail = function (g, o) {
    var base = o.base, L = o.len, W = L * 0.34;
    // 原点 = 尾柄 (0,0)，尾鳍向右伸展（相对坐标，便于绕尾柄旋转）
    g.save();
    g.globalAlpha = 0.62; g.fillStyle = base[1];
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(L * 0.22, -W * 0.46, L * 0.14, -W * 0.10);
    g.quadraticCurveTo(L * 0.26, 0, L * 0.14, W * 0.10);
    g.quadraticCurveTo(L * 0.22, W * 0.46, 0, 0);
    g.fill();
    g.restore();
  };

  /* ---------- 色板：第一版原色（逐字取自 koi.html） ---------- */
  A.PALETTE = {
    teal:  ['#1d6a72', '#2b8f92', '#17535c'],
    white: ['#dfe9e6', '#f2f7f5', '#c8d8d4'],
    coral: ['#c8553a', '#e0704c', '#a8412c'],
    gold:  ['#b98a3c', '#d8a94e', '#966c2c'],
    dark:  ['#25383f', '#3a5560', '#1b2a30'],
    brown: ['#6b5a3c', '#8c7a56', '#54462e'],
    blue:  ['#4b7d8c', '#6ea3b0', '#3a616e']
  };

  /* ---------- 12 个品种（base 三色 + pat 斑块色，全部出自第一版色板） ---------- */
  /* 品种配色：以「白底 + 彩斑」为主，暗色只占少数。
     参照图鱼群实测：白/灰 45%、黑 20%、红橙 15%、黄 9%、其他 11%。
     2026-09-28 修正：原表暗色品种过半，沉进深青水里整体读成"青色鱼"。 */
  A.SPECIES = [
    // —— 白底彩斑（主体，占比最大）——
    { id: 'kohaku',   zh: '红白锦鲤', base: ['#f0f6f4', '#fdfefd', '#dce6e3'], pat: { n: 3, c: '#e04a2c' }, len: 1.00 },
    { id: 'taisho',   zh: '大正三色', base: ['#f0f6f4', '#fdfefd', '#dce6e3'], pat: { n: 3, c: '#2b3a42' }, len: 0.96 },
    { id: 'shiro',    zh: '白写锦鲤', base: ['#f2f7f5', '#ffffff', '#e0e9e6'], pat: { n: 3, c: '#31424a' }, len: 0.92 },
    { id: 'hariwake', zh: '贴分锦鲤', base: ['#f6d97a', '#ffe9a0', '#e0bc4e'], pat: { n: 3, c: '#fdfefd' }, len: 0.95 },
    // —— 纯色亮彩 ——
    { id: 'benigoi',  zh: '绯红锦鲤', base: ['#e05540', '#f2705a', '#c33d2a'], pat: { n: 2, c: '#fdf3ea' }, len: 1.02 },
    { id: 'ogon',     zh: '黄金锦鲤', base: ['#e0a83c', '#f5c85e', '#b8862c'], pat: { n: 3, c: '#fff3d0' }, len: 0.94 },
    { id: 'orange',   zh: '橙金锦鲤', base: ['#e8863c', '#f7a35a', '#c4692a'], pat: { n: 2, c: '#fdf0e0' }, len: 0.97 },
    // —— 蓝紫（点缀，提亮）——
    { id: 'asagi',    zh: '浅黄锦鲤', base: ['#6ba8c4', '#8cc4da', '#4f88a4'], pat: { n: 3, c: '#f2f8fa' }, len: 1.00 },
    { id: 'purple',   zh: '紫鳞锦鲤', base: ['#9a7ab8', '#b79ad0', '#7a5c96'], pat: { n: 2, c: '#f6f0fa' }, len: 0.93 },
    // —— 暗色（少数，作对比）——
    { id: 'showa',    zh: '昭和三色', base: ['#3a4a52', '#4e626b', '#2a373d'], pat: { n: 4, c: '#f5f8f7' }, len: 0.98 },
    { id: 'kumonryu', zh: '黑纹龙',   base: ['#3d525a', '#52696f', '#2c3c42'], pat: { n: 3, c: '#eef4f2' }, len: 1.04 },
    { id: 'chagoi',   zh: '茶鲤',     base: ['#8a7550', '#a8936a', '#6d5b3c'], pat: { n: 2, c: '#e8dcc4' }, len: 1.06 }
  ];
  /* 场景里的品种权重：亮彩优先（白底 45%、彩 40%、暗 15%） */
  A.WEIGHTS = [7, 4, 4, 3, 4, 4, 3, 3, 3, 2, 1, 1];
  A.pickSpecies = function (r) {
    var tot = 0, i;
    for (i = 0; i < A.WEIGHTS.length; i++) tot += A.WEIGHTS[i];
    var x = r() * tot, acc = 0;
    for (i = 0; i < A.WEIGHTS.length; i++) { acc += A.WEIGHTS[i]; if (x <= acc) return i; }
    return 0;
  };

  /* ---------- 荷叶 ---------- */
  /* ---------- 荷叶（多形态）
     o.form : 'round' | 'notch' | 'torn' | 'curl' | 'young'
     o.tone : 'fresh' | 'deep' | 'olive' | 'yellow'
     o.seed 决定波瓣数、缺口位置、叶脉走向 -> 每片都不一样      */
  A.LOTUS_TONE = {
    fresh:  ['#3f9e6b', '#358a5c', '#2a724c'],
    deep:   ['#2f7d57', '#276a49', '#1e553a'],
    olive:  ['#4e8f55', '#417a48', '#33613a'],
    yellow: ['#8fa653', '#7b8f46', '#65763a']
  };

  A.lotusLeaf = function (g, o) {
    var r = o.r, rot = o.rot || 0, a = o.alpha == null ? 1 : o.alpha;
    var rnd = A.rng(o.seed || 7);
    var form = o.form || 'round';
    var P = A.LOTUS_TONE[o.tone] || A.LOTUS_TONE.fresh;
    var lit = o.lit || P[0], mid = o.mid || P[1], dark = o.dark || P[2];
    var i, b;

    g.save(); g.translate(o.x, o.y); g.rotate(rot); g.globalAlpha = a;

    var young = form === 'young';
    var lobes = o.lobes == null ? (young ? 4 : 5 + (rnd() * 4 | 0)) : o.lobes;
    var rim   = o.rim == null ? (young ? 0.065 : 0.030 + rnd() * 0.045) : o.rim;
    var sq    = o.squash == null ? (0.90 + rnd() * 0.14) : o.squash;
    var h1 = rnd() * 6.28, h2 = rnd() * 6.28, h3 = rnd() * 6.28;
    var a1 = rim, a2 = rim * 0.55, a3 = rim * 0.30;

    var bites = [];
    if (form === 'notch') {
      bites.push({ at: rnd() * 6.2832, deep: 0.30 + rnd() * 0.18, wide: 0.30 });
    } else if (form === 'torn') {
      var nb = 2 + (rnd() * 3 | 0);
      for (i = 0; i < nb; i++) bites.push({ at: rnd() * 6.2832, deep: 0.10 + rnd() * 0.16, wide: 0.16 + rnd() * 0.16 });
    } else if (rnd() < 0.5) {
      bites.push({ at: rnd() * 6.2832, deep: 0.15 + rnd() * 0.12, wide: 0.26 });
    }

    function radiusAt(ang) {
      var rr = 1 + a1 * Math.sin(ang * lobes + h1)
                 + a2 * Math.sin(ang * lobes * 2.7 + h2)
                 + a3 * Math.sin(ang * lobes * 5.1 + h3);
      for (var k = 0; k < bites.length; k++) {
        var d = Math.abs(((ang - bites[k].at + Math.PI * 3) % 6.2832) - Math.PI);
        rr *= 1 - bites[k].deep * Math.exp(-Math.pow(d / bites[k].wide, 2));
      }
      return rr;
    }

    var N = 180, pts = [];
    for (i = 0; i <= N; i++) {
      var ang = i / N * 6.2832, rr = radiusAt(ang);
      pts.push([Math.cos(ang) * r * rr, Math.sin(ang) * r * rr * sq]);
    }
    function outline() {
      g.beginPath();
      for (i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
      g.closePath();
    }

    outline();
    // 平涂底色（参照图是平涂绿，不是渐变）
    g.fillStyle = mid; g.fill();

    g.save(); g.clip();
    // 水彩斑块：不规则深浅色块，替代叶脉
    var nb = 5 + (rnd() * 5 | 0);
    for (i = 0; i < nb; i++) {
      var bx = (rnd() - 0.5) * r * 1.15, by = (rnd() - 0.5) * r * 1.15 * sq;
      var br = r * (0.20 + rnd() * 0.34);
      var bgr = g.createRadialGradient(bx, by, 0, bx, by, br);
      var dark = rnd() < 0.55;
      bgr.addColorStop(0, dark ? 'rgba(18,62,44,0.30)' : 'rgba(150,220,175,0.22)');
      bgr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bgr;
      g.beginPath(); g.ellipse(bx, by, br, br * (0.6 + rnd() * 0.5), rnd() * 3, 0, 6.2832); g.fill();
    }
    // 极淡的少数叶脉（不构成辐条感）
    var nv = 4 + (rnd() * 3 | 0);
    g.lineWidth = Math.max(1, r * 0.009);
    for (i = 0; i < nv; i++) {
      var va = rnd() * 6.2832, rr2 = radiusAt(va);
      g.strokeStyle = 'rgba(190,240,210,0.10)';
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(va + 0.16) * r * rr2 * 0.55, Math.sin(va + 0.16) * r * rr2 * 0.55 * sq,
                         Math.cos(va) * r * rr2 * 0.96, Math.sin(va) * r * rr2 * 0.96 * sq);
      g.stroke();
    }
    // 叶心亮斑
    var cg = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.20);
    cg.addColorStop(0, 'rgba(180,235,200,0.26)'); cg.addColorStop(1, 'rgba(180,235,200,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * 0.20, 0, 6.2832); g.fill();
    // 边缘暗环：叶缘微卷的阴影
    var eg = g.createRadialGradient(0, 0, r * 0.74, 0, 0, r * 1.04);
    eg.addColorStop(0, 'rgba(8,34,24,0)'); eg.addColorStop(1, 'rgba(8,34,24,0.34)');
    g.fillStyle = eg; g.beginPath(); g.arc(0, 0, r * 1.04, 0, 6.2832); g.fill();
    // 左上受光
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.07;
    var hg = g.createRadialGradient(-r * 0.26, -r * 0.30, 0, -r * 0.26, -r * 0.30, r * 0.72);
    hg.addColorStop(0, 'rgba(225,255,240,1)'); hg.addColorStop(1, 'rgba(225,255,240,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();

    if (form === 'curl' || young) {
      var ca = rnd() * 6.2832;
      g.save(); g.globalAlpha = young ? 0.22 : 0.16;
      g.strokeStyle = 'rgba(215,250,232,0.9)';
      g.lineWidth = Math.max(2, r * (young ? 0.075 : 0.045)); g.lineCap = 'round';
      g.beginPath();
      for (i = 0; i <= 40; i++) {
        var aa = ca - 0.9 + i / 40 * 1.8, rrr = radiusAt(aa) * 0.96;
        var px = Math.cos(aa) * r * rrr, py = Math.sin(aa) * r * rrr * sq;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke(); g.restore();
    }
    g.restore();

    outline();
    g.strokeStyle = o.stroke || 'rgba(8,34,26,0.62)';
    g.lineWidth = Math.max(1.6, r * 0.016);
    g.stroke();
    g.restore();
  };

  A.lotusBloom = function (g, o) {
    var r = o.r, ring, i;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0); g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    for (ring = 0; ring < 3; ring++) {
      var n = 7 - ring * 2, rr = r * (1 - ring * 0.26);
      for (i = 0; i < n; i++) {
        var a = i / n * 6.2832 + ring * 0.5;
        g.save(); g.translate(Math.cos(a) * rr * 0.42, Math.sin(a) * rr * 0.42); g.rotate(a);
        g.beginPath(); g.ellipse(0, 0, rr * 0.42, rr * 0.20, 0, 0, 6.2832);
        g.fillStyle = ring === 2 ? '#fbeaf0' : (o.petal || '#f3c3d2'); g.fill();
        g.restore();
      }
    }
    g.beginPath(); g.arc(0, 0, r * 0.16, 0, 6.2832); g.fillStyle = '#f6e8b8'; g.fill();
    g.restore();
  };

  /* ---------- 沉水植物（叶束） ---------- */
  A.waterPlant = function (g, o) {
    var r = A.rng(o.seed || 7), n = o.blades || 14, L = o.len, i;
    g.save(); g.translate(o.x, o.y); g.globalAlpha = o.alpha == null ? 0.55 : o.alpha;
    g.strokeStyle = o.color || '#2a7a68'; g.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var a = r() * 6.2832, ll = L * (0.45 + r() * 0.85);
      g.lineWidth = Math.max(1, L * (0.010 + r() * 0.016)) * (o.wscale || 1);
      g.beginPath(); g.moveTo(0, 0);
      var cx = Math.cos(a + (r() - 0.5) * 0.6) * ll * 0.55;
      var cy = Math.sin(a + (r() - 0.5) * 0.6) * ll * 0.55;
      g.quadraticCurveTo(cx, cy, cx * 1.7, cy * 1.7); g.stroke();
    }
    g.restore();
  };

  /* ---------- 驳岸黄石 ---------- */
  A.stone = function (g, o) {
    var r = A.rng(o.seed || 3), n = o.rocks || 5, i, j;
    g.save(); g.translate(o.x, o.y); g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    for (i = 0; i < n; i++) {
      var px = (r() - 0.5) * o.r * 1.5, py = (r() - 0.5) * o.r * 0.85;
      var rr = o.r * (0.22 + r() * 0.34);
      g.beginPath();
      var pts = 9;
      for (j = 0; j <= pts; j++) {
        var a = j / pts * 6.2832, rad = rr * (0.78 + r() * 0.34);
        var x = px + Math.cos(a) * rad, y = py + Math.sin(a) * rad * 0.82;
        j ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      var gg = g.createLinearGradient(px - rr, py - rr, px + rr, py + rr);
      gg.addColorStop(0, o.lit || '#a9b4b0'); gg.addColorStop(1, o.dark || '#6c7a78');
      g.fillStyle = gg; g.fill();
      g.strokeStyle = 'rgba(52,66,66,0.42)'; g.lineWidth = Math.max(1, rr * 0.07); g.stroke();
    }
    g.restore();
  };

  /* ---------- 水面焦散光斑 ---------- */
  A.caustic = function (g, o) {
    var r = A.rng(o.seed || 5), n = o.count || 110, i;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = o.alpha == null ? 0.075 : o.alpha;
    for (i = 0; i < n; i++) {
      var x = r() * o.w, y = r() * o.h, rad = (o.rmin || 26) + r() * ((o.rmax || 110) - (o.rmin || 26));
      var c = g.createRadialGradient(x, y, 0, x, y, rad);
      c.addColorStop(0, o.color || 'rgba(205,248,232,1)'); c.addColorStop(1, 'rgba(205,248,232,0)');
      g.fillStyle = c; g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill();
    }
    g.restore();
  };

﻿
  /* ============================================================
     场景补充元素 (v3.1, 2026-09-28)
     风格与 koi 一致：淡彩 + 柔光晕 + 细墨线
     ============================================================ */

  /* ---------- 涟漪环（投食/雨滴反馈） ---------- */
  /* ---------- 水面涟漪：一圈圈向外扩散的细环 ---------- */
  /* ---------- 水面涟漪：规则正圆，一圈圈向外扩散 ---------- */
  A.ripple = function (g, o) {
    var n = o.rings || 1, i, k;
    var baseA = o.alpha == null ? 0.5 : o.alpha;
    var line = o.lineWidth || 0;
    g.save(); g.translate(o.x, o.y);
    for (i = 0; i < n; i++) {
      var t = ((o.t || 0) + i / n) % 1;
      var rr = o.r * (0.12 + 0.88 * t);
      var fade = Math.sin(Math.PI * t);          // 淡入淡出
      if (rr < 1) continue;
      // 规则正圆（不再扰动、不再压扁）
      g.beginPath();
      g.arc(0, 0, rr, 0, 6.2832);
      g.strokeStyle = o.color || ('rgba(214,246,236,' + (baseA * fade).toFixed(3) + ')');
      g.lineWidth = line || Math.max(1.2, rr * 0.020);
      g.stroke();
      // 内圈细高光，让环有立体感
      if (rr > 4) {
        g.beginPath();
        g.arc(0, 0, rr * 0.985, 0, 6.2832);
        g.strokeStyle = 'rgba(240,255,250,' + (baseA * fade * 0.5).toFixed(3) + ')';
        g.lineWidth = Math.max(0.7, rr * 0.007);
        g.stroke();
      }
    }
    g.restore();
  };

  /* ---------- 浮萍 ---------- */
  A.duckweed = function (g, o) {
    var r = A.rng(o.seed || 9), n = o.count || 40, i;
    var baseA = o.alpha == null ? 0.85 : o.alpha;
    g.save(); g.translate(o.x, o.y);
    for (i = 0; i < n; i++) {
      var a = r() * 6.2832, d = Math.sqrt(r()) * o.r;
      var px = Math.cos(a) * d, py = Math.sin(a) * d * 0.92;
      var s = o.size * (0.55 + r() * 0.75);
      g.beginPath(); g.arc(px, py, s, 0, 6.2832);
      g.fillStyle = r() < 0.5 ? '#2f7d63' : '#3f9375';
      g.globalAlpha = baseA * (0.6 + r() * 0.4);
      g.fill();
    }
    g.restore();
  };

  /* ---------- 睡莲小叶（带缺口） ---------- */
  A.lilyPad = function (g, o) {
    var r = o.r, i;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0); g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    g.beginPath();
    var a0 = 0.36, a1 = 6.2832 - 0.36, N = 90;
    for (i = 0; i <= N; i++) {
      var a = a0 + (a1 - a0) * i / N;
      var w = r * (1 + 0.05 * Math.sin(a * 6));
      var px = Math.cos(a) * w, py = Math.sin(a) * w * 0.95;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    var lg = g.createRadialGradient(0, 0, 0, 0, 0, r);
    lg.addColorStop(0, o.lit || '#2a7259'); lg.addColorStop(0.65, o.mid || '#1f5f4b'); lg.addColorStop(1, o.dark || '#164436');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = 'rgba(12,44,36,0.40)'; g.lineWidth = Math.max(1, r * 0.03); g.stroke();
    g.restore();
  };
﻿
  /* ---------- 九曲桥（俯视折线桥面） ---------- */
  A.bridge = function (g, o) {
    var segs = o.turns || 5, segLen = o.len / segs, wid = o.wid, ang = 0, i;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0);
    var cx = -o.len / 2, cy = 0;
    var pts = [{ x: cx, y: cy }];
    for (i = 0; i < segs; i++) {
      var aTurn = (i % 2 === 0 ? 1 : -1) * (o.zig || 0.5);
      cx += Math.cos(aTurn) * segLen; cy += Math.sin(aTurn) * segLen;
      pts.push({ x: cx, y: cy });
    }
    function stroke(yOff, color, w) {
      g.strokeStyle = color; g.lineWidth = w;
      g.beginPath();
      pts.forEach(function (p, k) { k ? g.lineTo(p.x, p.y + yOff) : g.moveTo(p.x, p.y + yOff); });
      g.stroke();
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    stroke(0, 'rgba(20,50,44,0.28)', wid * 1.32);
    stroke(0, o.deck || '#9aa08f', wid);
    stroke(-wid * 0.52, 'rgba(96,100,88,0.90)', Math.max(1, wid * 0.10));
    stroke(wid * 0.52, 'rgba(96,100,88,0.90)', Math.max(1, wid * 0.10));
    g.fillStyle = 'rgba(92,88,76,0.72)';
    for (i = 1; i < pts.length - 1; i++) {
      g.beginPath(); g.arc(pts[i].x, pts[i].y, wid * 0.22, 0, 6.2832); g.fill();
    }
    g.restore();
  };

  /* ---------- 绿瓦凉亭（俯视八角攒尖顶） ---------- */
  /* ---------- 绿瓦凉亭（俯视）：层层出檐的八角攒尖顶 ----------
     关键：不要把 8 条垂脊画成等分放射线（会读成"八角星"）。
     真实俯视是「一圈圈同心八角瓦垄」，中心宝顶最小、最亮。 */
  /* ---------- 绿瓦凉亭（俯视）：同心层叠的八角攒尖顶 ----------
     教训：俯视图里「放射状垂脊」会读成八角星。
     真实观感是【一圈圈同心缩小的八角瓦垄】+ 层间阴影。 */
  A.pavilion = function (g, o) {
    var r = o.r, i, k;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0);
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;

    function octPath(rad, rot) {
      g.beginPath();
      for (k = 0; k <= 8; k++) {
        var a = k / 8 * 6.2832 + (rot || 0);
        var px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
    }

    // ---- 台基 ----
    octPath(r * 1.12, -0.39);
    g.fillStyle = '#a29d8e'; g.fill();
    g.strokeStyle = 'rgba(58,54,46,0.60)'; g.lineWidth = Math.max(1, r * 0.030); g.stroke();

    // ---- 同心层叠瓦垄：从外到内 9 圈，颜色渐亮、无放射线 ----
    var RINGS = 9;
    for (i = RINGS; i >= 1; i--) {
      var rad = r * (1.02 - (i - 1) * 0.098);
      var t = (RINGS - i) / (RINGS - 1);            // 0=外 1=内
      // 外深内亮（受光）
      var cr = Math.round(28 + t * 46);
      var cg = Math.round(86 + t * 74);
      var cb = Math.round(66 + t * 56);
      octPath(rad, -0.39 + t * 0.42);               // 逐层轻微旋转，形成瓦垄错位
      g.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
      g.fill();
      // 层间阴影线（这是"层层出檐"的关键）
      g.strokeStyle = 'rgba(12,40,32,' + (0.30 + t * 0.22).toFixed(2) + ')';
      g.lineWidth = Math.max(1, r * (0.026 - t * 0.012));
      g.stroke();
    }

    // ---- 宝顶 ----
    g.beginPath(); g.arc(0, 0, r * 0.16, 0, 6.2832);
    var cg2 = g.createRadialGradient(-r * 0.03, -r * 0.04, 0, 0, 0, r * 0.16);
    cg2.addColorStop(0, '#f6e09a'); cg2.addColorStop(0.68, '#cfa84e'); cg2.addColorStop(1, '#8d6d20');
    g.fillStyle = cg2; g.fill();
    g.strokeStyle = 'rgba(76,58,14,0.65)'; g.lineWidth = Math.max(1, r * 0.022); g.stroke();

    // ---- 左上受光（整体柔和高光）----
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.12;
    var hg = g.createRadialGradient(-r * 0.32, -r * 0.36, 0, -r * 0.32, -r * 0.36, r * 0.80);
    hg.addColorStop(0, 'rgba(226,255,238,1)'); hg.addColorStop(1, 'rgba(226,255,238,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(0, 0, r * 1.05, 0, 6.2832); g.fill(); g.restore();

    g.restore();
  };

  /* ---------- 岸边植物（芦苇/水葱丛） ---------- */
  A.shorePlant = function (g, o) {
    var r = A.rng(o.seed || 21), n = o.blades || 26, L = o.len, i;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0); g.globalAlpha = o.alpha == null ? 0.9 : o.alpha;
    g.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var base = (r() - 0.5) * o.spread;
      var ll = L * (0.5 + r() * 0.8);
      var bend = (r() - 0.5) * 0.5;
      var pick = r();
      g.strokeStyle = pick < 0.35 ? '#4a7a4e' : (pick < 0.6 ? '#356b45' : '#5c8a52');
      g.lineWidth = Math.max(1, L * (0.010 + r() * 0.014));
      g.beginPath(); g.moveTo(base, 0);
      g.quadraticCurveTo(base + bend * ll * 0.5, -ll * 0.55, base + bend * ll, -ll);
      g.stroke();
    }
    g.restore();
  };

  /* ---------- 落花瓣 ---------- */
  A.petal = function (g, o) {
    var r = A.rng(o.seed || 31), n = o.count || 10, i;
    var baseA = o.alpha == null ? 0.9 : o.alpha;
    g.save(); g.translate(o.x, o.y);
    for (i = 0; i < n; i++) {
      var a = r() * 6.2832, d = Math.sqrt(r()) * o.r;
      var px = Math.cos(a) * d, py = Math.sin(a) * d * 0.9;
      g.save(); g.translate(px, py); g.rotate(r() * 6.2832);
      var s = o.size * (0.7 + r() * 0.6);
      g.beginPath(); g.ellipse(0, 0, s, s * 0.46, 0, 0, 6.2832);
      g.fillStyle = r() < 0.5 ? '#f4cdd9' : '#f8e3e9';
      g.globalAlpha = baseA * (0.65 + r() * 0.35);
      g.fill(); g.restore();
    }
    g.restore();
  };

  /* ---------- 蜻蜓 ---------- */
  A.dragonfly = function (g, o) {
    var s = o.size, i;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0); g.globalAlpha = o.alpha == null ? 0.85 : o.alpha;
    for (i = 0; i < 2; i++) {
      var sy = i ? 1 : -1;
      g.fillStyle = 'rgba(200,235,240,0.45)';
      g.beginPath(); g.ellipse(-s * 0.18, sy * s * 0.42, s * 0.72, s * 0.16, sy * 0.35, 0, 6.2832); g.fill();
      g.beginPath(); g.ellipse(-s * 0.30, sy * s * 0.62, s * 0.60, s * 0.14, sy * 0.55, 0, 6.2832); g.fill();
      g.strokeStyle = 'rgba(120,170,180,0.35)'; g.lineWidth = Math.max(0.6, s * 0.02);
      g.beginPath(); g.ellipse(-s * 0.18, sy * s * 0.42, s * 0.72, s * 0.16, sy * 0.35, 0, 6.2832); g.stroke();
    }
    g.beginPath();
    g.moveTo(s * 0.55, 0);
    g.quadraticCurveTo(0, s * 0.10, -s * 0.75, 0);
    g.quadraticCurveTo(0, -s * 0.10, s * 0.55, 0);
    g.closePath();
    var bg = g.createLinearGradient(-s * 0.75, 0, s * 0.55, 0);
    bg.addColorStop(0, '#2b7f86'); bg.addColorStop(1, '#59b3a8');
    g.fillStyle = bg; g.fill();
    g.fillStyle = '#1d4a52';
    g.beginPath(); g.arc(s * 0.50, -s * 0.09, s * 0.09, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(s * 0.50, s * 0.09, s * 0.09, 0, 6.2832); g.fill();
    g.restore();
  };
﻿
  /* ---------- 萤火虫（夜晚暖黄光点） ---------- */
  A.firefly = function (g, o) {
    var r = A.rng(o.seed || 41), n = o.count || 16, i;
    g.save(); g.translate(o.x, o.y);
    for (i = 0; i < n; i++) {
      var px = (r() - 0.5) * o.w, py = (r() - 0.5) * o.h;
      var pulse = 0.35 + 0.65 * Math.abs(Math.sin((o.t || 0) * 1.6 + i * 1.7));
      var rad = o.glow * (0.7 + r() * 0.6);
      var gl = g.createRadialGradient(px, py, 0, px, py, rad);
      gl.addColorStop(0, 'rgba(255,240,170,' + (0.85 * pulse).toFixed(3) + ')');
      gl.addColorStop(0.35, 'rgba(220,220,120,' + (0.35 * pulse).toFixed(3) + ')');
      gl.addColorStop(1, 'rgba(200,200,100,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(px, py, rad, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,252,220,' + (0.9 * pulse).toFixed(3) + ')';
      g.beginPath(); g.arc(px, py, rad * 0.16, 0, 6.2832); g.fill();
    }
    g.restore();
  };

  /* ---------- 鱼影（池底柔影，表现水深） ---------- */
  A.fishShadow = function (g, o) {
    var L = o.len, W = L * 0.34, i, t, x, w;
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0);
    g.globalAlpha = o.alpha == null ? 0.28 : o.alpha;
    g.beginPath();
    var n = 48;
    for (i = 0; i <= n; i++) { t = i / n; x = (t - 0.5) * L; w = W * 0.5 * Math.sin(Math.PI * Math.pow(t, 0.72));
      i ? g.lineTo(x, -w) : g.moveTo(x, -w); }
    for (i = n; i >= 0; i--) { t = i / n; x = (t - 0.5) * L; w = W * 0.5 * Math.sin(Math.PI * Math.pow(t, 0.72));
      g.lineTo(x, w); }
    g.closePath();
    g.fillStyle = o.color || 'rgba(6,26,34,0.85)';
    g.filter = 'blur(' + (L * 0.05).toFixed(1) + 'px)';
    g.fill();
    g.restore();
  };

  /* ---------- 气泡 ---------- */
  A.bubble = function (g, o) {
    var r = A.rng(o.seed || 51), n = o.count || 14, i;
    g.save(); g.translate(o.x, o.y); g.globalAlpha = o.alpha == null ? 0.5 : o.alpha;
    for (i = 0; i < n; i++) {
      var px = (r() - 0.5) * o.w, py = (r() - 0.5) * o.h;
      var rad = o.size * (0.35 + r() * 0.8);
      g.beginPath(); g.arc(px, py, rad, 0, 6.2832);
      g.fillStyle = 'rgba(200,240,235,0.18)'; g.fill();
      g.strokeStyle = 'rgba(225,250,245,0.55)'; g.lineWidth = Math.max(0.7, rad * 0.16); g.stroke();
      g.beginPath(); g.arc(px - rad * 0.32, py - rad * 0.34, rad * 0.24, 0, 6.2832);
      g.fillStyle = 'rgba(255,255,255,0.65)'; g.fill();
    }
    g.restore();
  };


  /* ============================================================
     精灵缓存：把鱼预渲染成位图，每帧只 drawImage。
     软件合成下 canvas 路径填充极慢（实测 1.4fps -> 目标 60fps）。
     ============================================================ */
  A._spriteCache = {};

  /* 把单条鱼烘成一张带透明通道的位图。
     scale 用于超采样（建议 2），绘制时缩回即得抗锯齿。 */
  A.bakeKoi = function (o, scale) {
    scale = scale || 2;
    var L = o.len, W = o.len * 0.34;
    var amp = o.amp || 0;
    // 摆动最大偏移 + 余量
    var padY = L * (0.34 + amp * 1.35) + 8;
    var padX = L * 0.16 + 8;
    var w = Math.ceil(L + padX * 2), h = Math.ceil(padY * 2);
    var c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w * scale));
    c.height = Math.max(2, Math.round(h * scale));
    var g2 = c.getContext('2d');
    g2.scale(scale, scale);
    A.koi(g2, {
      x: w / 2, y: h / 2, len: L, rot: 0,
      base: o.base, pat: o.pat, seed: o.seed,
      amp: o.amp, phase: o.phase, wave: o.wave,
      patScale: o.patScale, patAlpha: o.patAlpha
    });
    return { canvas: c, w: w, h: h };
  };

  /* 取（或生成）精灵。key 里带 phase 量化值，实现逐帧摆动。 */
  A.getKoiSprite = function (o, scale, steps) {
    scale = scale || 2; steps = steps || 16;
    var ph = Math.round(((o.phase % 1) + 1) % 1 * steps) / steps;
    var key = o.sp + '|' + Math.round(o.len) + '|' + (o.amp || 0).toFixed(3) + '|' + ph + '|' + (o.patScale || 1).toFixed(2) + '|' + (o.patAlpha || 1).toFixed(2);
    var hit = A._spriteCache[key];
    if (hit) return hit;
    var sp = A.SPECIES[o.sp];
    var s = A.bakeKoi({
      len: o.len, base: sp.base, pat: sp.pat, seed: o.seed,
      amp: o.amp, phase: ph, wave: o.wave || 0.9,
      patScale: o.patScale, patAlpha: o.patAlpha
    }, scale);
    s.key = key;
    // 缓存上限，防止爆内存
    var ks = Object.keys(A._spriteCache);
    if (ks.length > 420) { for (var i = 0; i < 120; i++) delete A._spriteCache[ks[i]]; }
    A._spriteCache[key] = s;
    return s;
  };

  A.drawKoiSprite = function (g, spr, x, y, rot) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    g.restore();
  };


  /* ============================================================
     共享动画图集（2026-09-28）
     目标：把「每条鱼独立算摆动」改成「按 (品种 × 尺寸档) 共享一套帧」，
           不同鱼只靠相位偏移错开 —— 看起来各自独立，但只算一次。

     摆动是正弦行波：phase 加 0.5 等于把身体沿体轴镜像。
     所以只烘前半周期（half 帧），后半周期用镜像复用 → 烘焙量减半。
     ============================================================ */
  A.ATLAS = {};
  A.ATLAS_N     = 24;                              // 每摆动周期的帧数
  A.ATLAS_SCALE = 2;                               // 烘焙超采样（缩放后仍清晰）
  A.SIZE_CLASSES = [0.020, 0.031, 0.046, 0.068];   // 体长 / 屏宽 的四个档
  A.CLASS_AMP    = [0.078, 0.076, 0.070, 0.060];   // 大鱼摆幅略小，更沉稳

  A.classOf = function (relLen) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < A.SIZE_CLASSES.length; i++) {
      var d = Math.abs(A.SIZE_CLASSES[i] - relLen);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  A.buildAtlas = function (sp, cls, designW) {
    var key = sp + '|' + cls;
    var hit = A.ATLAS[key];
    if (hit) return hit;
    var N = A.ATLAS_N, half = N >> 1;
    var rel = A.SIZE_CLASSES[cls];
    var refL = rel * (designW || 1440);
    var amp = A.CLASS_AMP[cls];
    var spc = A.SPECIES[sp];
    var seed = 5000 + sp * 137 + cls * 29;
    var psc = 0.34 + Math.min(1, rel / 0.055) * 0.50;
    var pal = 0.50 + Math.min(1, rel / 0.055) * 0.50;
    var frames = [];
    for (var i = 0; i < half; i++) {
      frames.push(A.bakeKoi({
        len: refL, base: spc.base, pat: spc.pat, seed: seed,
        amp: amp, phase: i / N, wave: 0.9,
        patScale: psc, patAlpha: pal
      }, A.ATLAS_SCALE));
    }
    var a = { frames: frames, half: half, N: N, refL: refL, amp: amp, key: key };
    A.ATLAS[key] = a;
    return a;
  };

  A.clearAtlas = function () { A.ATLAS = {}; A._spriteCache = {}; };

  A.atlasStats = function () {
    var n = 0, px = 0;
    for (var k in A.ATLAS) {
      var a = A.ATLAS[k];
      for (var i = 0; i < a.frames.length; i++) { n++; px += a.frames[i].canvas.width * a.frames[i].canvas.height; }
    }
    return { atlases: Object.keys(A.ATLAS).length, sprites: n, mb: +(px * 4 / 1048576).toFixed(1) };
  };

  /* 按相位取帧绘制（相位自动回绕；后半周期用镜像） */
  A.drawAtlas = function (g, a, x, y, rot, phase, drawLen) {
    var N = a.N, half = a.half;
    var p = phase - Math.floor(phase);
    var f = (Math.floor(p * N) % N + N) % N;
    var mirror = f >= half;
    var spr = a.frames[mirror ? f - half : f];
    var k = drawLen / a.refL;
    var w = spr.w * k, h = spr.h * k;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    if (mirror) g.scale(1, -1);
    g.drawImage(spr.canvas, -w / 2, -h / 2, w, h);
    g.restore();
  };


  /* ============================================================
     成组共享的摆动帧集（2026-09-28）
     思路（用户提出）：
       把鱼按「品种 × 体长档」分组，每组共享一套 24 帧摆动资源；
       组内不同鱼只靠 phase 偏移错开 -> 看起来各自独立，
       但每组的摆动只算一次，资源被复用。

     关键性能点：帧按该组的「实际绘制长度」烘焙，绘制时 1:1
       （不缩放）—— 软件合成下缩放重采样是主要开销。
     ============================================================ */
  A.SET_STEPS = 16;      // 每周期 24 帧（顺滑；12 帧会看出抽帧）
  A.SET_SCALE = 2;       // 烘焙超采样，缩放回逻辑尺寸绘制（抗锯齿）
  A.SET_LQ    = 10;      // 体长量化步长（px）：相近体长的鱼共用一组（视觉上 10px 无差别）
  A.SETS = {};

  A.setKey = function (sp, lenQ) { return sp + '|' + lenQ; };

  /* 取（或生成）一组摆动帧。组 = 品种 × 体长档 */
  A.getKoiSet = function (sp, len, relLen) {
    var lenQ = Math.max(8, Math.round(len / A.SET_LQ) * A.SET_LQ);
    var key = A.setKey(sp, lenQ);
    var hit = A.SETS[key];
    if (hit) return hit;

    var spc = A.SPECIES[sp];
    var amp = A.CLASS_AMP[A.classOf(relLen)];
    var psc = 0.34 + Math.min(1, relLen / 0.055) * 0.50;
    var pal = 0.50 + Math.min(1, relLen / 0.055) * 0.50;
    var seed = 5000 + sp * 137 + lenQ;
    var frames = [];
    for (var i = 0; i < A.SET_STEPS; i++) {
      frames.push(A.bakeKoi({
        len: lenQ, base: spc.base, pat: spc.pat, seed: seed,
        amp: amp, phase: i / A.SET_STEPS, wave: 0.9,
        patScale: psc, patAlpha: pal
      }, A.SET_SCALE));
    }
    var set = { frames: frames, n: A.SET_STEPS, lenQ: lenQ, key: key };
    A.SETS[key] = set;

    // 组数上限：超出时清掉最早的一批（组会按需重建）
    var ks = Object.keys(A.SETS);
    if (ks.length > 140) { for (var j = 0; j < 60; j++) delete A.SETS[ks[j]]; }
    return set;
  };

  /* 按相位绘制（1:1，无缩放） */
  A.drawKoiSet = function (g, set, x, y, rot, phase) {
    var n = set.n;
    var p = phase - Math.floor(phase);
    var idx = Math.floor(p * n) % n;
    var spr = set.frames[idx];
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    g.restore();
  };

  A.setStats = function () {
    var groups = 0, sprites = 0, px = 0;
    for (var k in A.SETS) {
      groups++;
      var f = A.SETS[k].frames;
      for (var i = 0; i < f.length; i++) { sprites++; px += f[i].canvas.width * f[i].canvas.height; }
    }
    return { groups: groups, sprites: sprites, mb: +(px * 4 / 1048576).toFixed(1) };
  };
  A.clearSets = function () { A.SETS = {}; };


  /* ============================================================
     身体/尾鳍拆分方案（2026-09-28，最终）
     问题：预烘 N 帧离散姿势 -> 精灵数太多（368 张），
           软件合成下纹理切换开销大，且仍有轻微抽帧。
     方案：把鱼拆成「身体」和「尾鳍」两张精灵；
           尾鳍绕尾柄【连续旋转】-> 真正 60fps 顺滑，无抽帧；
           每组只需 2 张精灵，资源大幅减少。
     ============================================================ */
  A.PARTS = {};

  A.partKey = function (sp, lenQ) { return sp + '|' + lenQ; };

  /* 取（或生成）一组的「身体 + 尾鳍」两张精灵 */
  A.getKoiParts = function (sp, len, relLen) {
    var lenQ = Math.max(10, Math.round(len / A.SET_LQ) * A.SET_LQ);
    var key = A.partKey(sp, lenQ);
    var hit = A.PARTS[key];
    if (hit) return hit;

    var spc = A.SPECIES[sp];
    var amp = A.CLASS_AMP[A.classOf(relLen)];
    var psc = 0.34 + Math.min(1, relLen / 0.055) * 0.50;
    var pal = 0.50 + Math.min(1, relLen / 0.055) * 0.50;
    var seed = 5000 + sp * 137 + lenQ;
    var L = lenQ, Wd = L * 0.34;
    var padX = L * 0.14 + 6;
    var padY = Wd * 0.95 + 6;

    // ---- 身体（含头/身/胸鳍，不含尾鳍；静态姿态）----
    var bw = Math.ceil(L + padX * 2), bh = Math.ceil(padY * 2);
    var bc = document.createElement('canvas');
    bc.width = Math.round(bw * A.SET_SCALE); bc.height = Math.round(bh * A.SET_SCALE);
    var bg2 = bc.getContext('2d');
    bg2.scale(A.SET_SCALE, A.SET_SCALE);
    A.koiBody(bg2, {
      x: bw / 2, y: bh / 2, len: L,
      base: spc.base, pat: spc.pat, seed: seed,
      patScale: psc, patAlpha: pal
    });

    // ---- 尾鳍（以尾柄为原点，便于旋转）----
    var tw = Math.ceil(L * 0.32) + 4, th = Math.ceil(Wd * 1.30) + 4;
    var tc = document.createElement('canvas');
    tc.width = Math.round(tw * A.SET_SCALE); tc.height = Math.round(th * A.SET_SCALE);
    var tg = tc.getContext('2d');
    tg.scale(A.SET_SCALE, A.SET_SCALE);
    tg.translate(0, th / 2);              // 尾柄在左边缘中点
    A.koiTail(tg, { len: L, base: spc.base });

    var parts = {
      body: { canvas: bc, w: bw, h: bh, ox: bw / 2, oy: bh / 2 },
      tail: { canvas: tc, w: tw, h: th, ox: 0, oy: th / 2 },
      L: L, amp: amp, key: key
    };
    A.PARTS[key] = parts;
    var ks = Object.keys(A.PARTS);
    if (ks.length > 90) { for (var j = 0; j < 40; j++) delete A.PARTS[ks[j]]; }
    return parts;
  };

  /* 绘制：身体 + 尾鳍（尾鳍按相位连续旋转） */
  A.drawKoiParts = function (g, P, x, y, rot, phase) {
    var ang = P.amp * 2.6 * Math.sin(6.2832 * (phase - Math.floor(phase)));
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    // 身体
    g.drawImage(P.body.canvas, -P.body.ox, -P.body.oy, P.body.w, P.body.h);
    // 尾鳍：移到尾柄处，再旋转
    g.save();
    g.translate(P.L * 0.46, 0);
    g.rotate(ang);
    g.drawImage(P.tail.canvas, 0, -P.tail.oy, P.tail.w, P.tail.h);
    g.restore();
    g.restore();
  };

  A.partStats = function () {
    var n = 0, px = 0;
    for (var k in A.PARTS) {
      var p = A.PARTS[k];
      n += 2;
      px += p.body.canvas.width * p.body.canvas.height + p.tail.canvas.width * p.tail.canvas.height;
    }
    return { groups: Object.keys(A.PARTS).length, sprites: n, mb: +(px * 4 / 1048576).toFixed(1) };
  };


  /* ============================================================
     水体：让池塘「像水」而不是一块平色
     参照图实测特征：低频柔光柱 + 深度渐变 + 浑浊感 + 微弱表面波
     （我的旧版问题是高频噪点太多、亮度均匀、太亮）
     ============================================================ */

  /* 深度渐变：中心亮、边缘暗（水越深越暗越浑） */
  A.depthGradient = function (g, W, H, o) {
    o = o || {};
    var cx = o.cx == null ? 0.5 : o.cx, cy = o.cy == null ? 0.44 : o.cy;
    var g1 = g.createRadialGradient(W * cx, H * cy, Math.min(W, H) * 0.04,
                                    W * cx, H * cy, Math.max(W, H) * (o.reach || 0.78));
    g1.addColorStop(0, o.center || '#1d5560');
    g1.addColorStop(0.42, o.mid || '#123c48');
    g1.addColorStop(0.78, o.outer || '#0a2530');
    g1.addColorStop(1, o.deep || '#05161e');
    g.fillStyle = g1; g.fillRect(0, 0, W, H);
  };

  /* 低频柔光柱：阳光穿过水面形成的大面积斜向亮带（水感的核心） */
  A.lightShafts = function (g, W, H, o) {
    o = o || {};
    var n = o.count || 7, r = A.rng(o.seed || 21), i, k;
    var ang = o.angle == null ? -0.62 : o.angle;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < n; i++) {
      // 光柱沿垂直方向铺开，宽度大、alpha 低 -> 低频柔和
      var t = (i + 0.5) / n + (r() - 0.5) * 0.12;
      var wdt = W * (0.10 + r() * 0.16);          // 柱宽（大）
      var op = (o.alpha == null ? 0.055 : o.alpha) * (0.45 + r() * 0.85);
      var cx = t * W, cy = H * (0.15 + r() * 0.7);
      var dx = Math.cos(ang), dy = Math.sin(ang);
      // 用线性渐变模拟一束斜光（沿光柱方向淡出）
      var len = Math.max(W, H) * 1.15;
      var x0 = cx - dx * len * 0.5, y0 = cy - dy * len * 0.5;
      var x1 = cx + dx * len * 0.5, y1 = cy + dy * len * 0.5;
      var lg = g.createLinearGradient(x0, y0, x1, y1);
      var c = o.color || '150,225,215';
      lg.addColorStop(0, 'rgba(' + c + ',0)');
      lg.addColorStop(0.35, 'rgba(' + c + ',' + (op).toFixed(4) + ')');
      lg.addColorStop(0.62, 'rgba(' + c + ',' + (op * 1.25).toFixed(4) + ')');
      lg.addColorStop(1, 'rgba(' + c + ',0)');
      g.save();
      g.translate(cx, cy);
      g.rotate(ang + Math.PI / 2);
      g.fillStyle = lg;
      // 竖向长条 + 横向柔边（用 scale 制造椭圆光斑）
      g.scale(1, 1);
      g.beginPath();
      g.ellipse(0, 0, wdt * 0.5, len * 0.5, 0, 0, 6.2832);
      g.fill();
      g.restore();
    }
    g.restore();
  };

  /* 表面波纹：极细、极淡的横向水纹（不是噪点） */
  A.surfaceRipples = function (g, W, H, o) {
    o = o || {};
    var rows = o.rows || 26, r = A.rng(o.seed || 33), i, k;
    g.save();
    g.lineCap = 'round';
    for (i = 0; i < rows; i++) {
      var y = (i + 0.5) / rows * H + (r() - 0.5) * 12;
      var x0 = -W * 0.05, len = W * (1.1 + r() * 0.4);
      var amp = (o.amp == null ? 4 : o.amp) * (0.5 + r());
      var op = (o.alpha == null ? 0.05 : o.alpha) * (0.4 + r() * 0.9);
      g.strokeStyle = 'rgba(178,232,222,' + op.toFixed(4) + ')';
      g.lineWidth = (o.width == null ? 1.4 : o.width) * (0.7 + r() * 0.8);
      g.beginPath();
      var segs = 5;
      for (k = 0; k <= segs; k++) {
        var px = x0 + len * k / segs;
        var py = y + Math.sin(k * 1.7 + i * 0.9) * amp;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
    g.restore();
  };

  /* 浑浊感：一层极淡的雾，让远处发白、有"透过水看"的感觉 */
  A.murk = function (g, W, H, o) {
    o = o || {};
    var m = g.createRadialGradient(W * 0.5, H * 0.42, Math.min(W, H) * 0.06,
                                   W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    m.addColorStop(0, 'rgba(120,190,190,0)');
    m.addColorStop(0.55, 'rgba(96,160,170,' + (o.alpha == null ? 0.05 : o.alpha) + ')');
    m.addColorStop(1, 'rgba(70,130,145,' + (o.edge == null ? 0.14 : o.edge) + ')');
    g.fillStyle = m; g.fillRect(0, 0, W, H);
  };

  root.Art = A;

  root.Art = A;
})(window);
