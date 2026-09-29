/* ============================================================
   bitan-pond · 喂食系统 + 天气 + 右上角透明信息面板
   ============================================================ */
(function (root) {
  var P = {};

  /* ---------------- 品种基准体重（克） ---------------- */
  P.BASE_WEIGHT = [1200, 900, 850, 950, 1500, 700, 800, 1000, 600, 750, 1100, 1300];

  P.initFish = function (fish) {
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i];
      if (f.weight != null) continue;
      var base = P.BASE_WEIGHT[f.sp] || 900;
      f.weight = Math.round(base * (0.65 + (f.L / 200) * 0.7));
      f.eaten = 0;
      f.gain = 0;
    }
  };

  /* ---------------- 天气（离线季节模拟，无需网络） ---------------- */
  P.WEATHER_KINDS = {
    clear:    { zh: '晴',     rain: 0.00, sun: 1.00, wind: 2 },
    cloudy:   { zh: '多云',   rain: 0.00, sun: 0.66, wind: 2 },
    overcast: { zh: '阴',     rain: 0.00, sun: 0.44, wind: 3 },
    shower:   { zh: '阵雨',   rain: 0.55, sun: 0.36, wind: 4 },
    rain:     { zh: '小雨',   rain: 0.55, sun: 0.36, wind: 3 },
    fog:      { zh: '雾',     rain: 0.00, sun: 0.34, wind: 1 },
    snow:     { zh: '雪',     rain: 0.30, sun: 0.52, wind: 3 }
  };

  P.weather = {
    kind: 'cloudy', zh: '多云', temp: 18, wind: 2, rain: 0, sun: 0.66,
    source: '季节模拟', updated: 0
  };

  P.updateWeather = function () {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate(), h = d.getHours();
    // 用日期做确定性随机（同一天天气稳定）
    var s = (m * 100 + day) >>> 0;
    var r = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    var roll = r();
    var winter = (m <= 2 || m >= 12), summer = (m >= 5 && m <= 9);
    var kind;
    if (winter) kind = roll < .30 ? 'cloudy' : roll < .52 ? 'clear' : roll < .68 ? 'overcast' : roll < .82 ? 'fog' : roll < .95 ? 'rain' : 'snow';
    else if (summer) kind = roll < .34 ? 'clear' : roll < .55 ? 'cloudy' : roll < .72 ? 'shower' : roll < .86 ? 'rain' : 'overcast';
    else kind = roll < .38 ? 'clear' : roll < .60 ? 'cloudy' : roll < .74 ? 'overcast' : roll < .88 ? 'rain' : 'fog';
    var K = P.WEATHER_KINDS[kind];
    // 温度：季节基准 + 昼夜变化
    var baseT = summer ? 29 : winter ? 7 : 18;
    var dayT = baseT + (h >= 6 && h <= 18 ? 4 : -3);
    P.weather.kind = kind;
    P.weather.zh = K.zh;
    P.weather.temp = Math.round(dayT + (r() * 4 - 2));
    P.weather.wind = K.wind;
    P.weather.rain = K.rain;
    P.weather.sun = K.sun;
    P.weather.updated = Date.now();
    return P.weather;
  };

  /* ---------------- 食物 ---------------- */
  P.FOOD_LIFE = 16;
  P.FOOD_R = 0.0013;        // 颗粒半径（相对屏宽）：约 1.9px @1440（鱼长的 4~5%）
  P.SINK_TIME = 11.0;       // 下沉耗时（秒）：慢一点，看得清

  P.feed = function (x, y, strength) {
    strength = strength || 1;
    var dbl = strength >= 1.6;
    // 每次投喂就是「一小撮」：单击 3~5 粒，双击 8~13 粒
    var n = dbl ? (8 + (Math.random() * 6 | 0)) : (3 + (Math.random() * 3 | 0));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832;
      // 撒落范围小（一小撮落点），√ 使分布均匀
      var d = Math.sqrt(Math.random()) * 34;
      P.food.push({
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        // 落水时刻：错开一点，像一把撒下去
        delay: Math.random() * 0.18,
        sink: 0,                                  // 下沉进度 0->1
        life: P.FOOD_LIFE * (0.75 + Math.random() * 0.5),
        eaten: false,
        r: P.FOOD_R * (0.75 + Math.random() * 0.6)
      });
    }
    // 落点涟漪：一圈（双击两圈）
    P.ripples.push({ x: x, y: y, age: 0, r: 22 * strength, big: dbl, rings: dbl ? 2 : 1, life: 2.6 });
    P.lastFeed = Date.now();
    P.feedCount++;
    P.feedLog.unshift({ t: Date.now(), n: n, x: x, y: y, dbl: dbl });
    if (P.feedLog.length > 40) P.feedLog.pop();
    return n;
  };

  /* 双击喂食：附近的鱼加速冲过去 */
  P.burstTo = function (fish, x, y, radius) {
    var cnt = 0;
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i];
      var dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy);
      if (d > radius) continue;
      f.dir = Math.atan2(dy, dx);
      f.spd = f.baseSpd * 3.4;          // 冲刺
      f.burst = 2.4;                    // 持续 2.4 秒
      cnt++;
    }
    return cnt;
  };

  /* ---------------- 每帧：食物衰减 + 吸引 + 进食 ---------------- */
  P.stepFood = function (dt, fish, W, H) {
    var i, j;
    for (i = P.food.length - 1; i >= 0; i--) {
      var fo = P.food[i];
      fo.life -= dt;
      if (fo.delay > 0) { fo.delay -= dt; continue; }
      // 下沉：sink 0->1
      if (fo.sink < 1) fo.sink = Math.min(1, fo.sink + dt / P.SINK_TIME);
      if (fo.life <= 0) P.food.splice(i, 1);
    }
    for (i = P.ripples.length - 1; i >= 0; i--) {
      P.ripples[i].age += dt / (P.ripples[i].life || 2.6);
      if (P.ripples[i].age >= 1) P.ripples.splice(i, 1);
    }
    if (!P.food.length) return;

    for (i = 0; i < fish.length; i++) {
      var f = fish[i];
      var best = null, bd = 1e9;
      for (j = 0; j < P.food.length; j++) {
        var fo = P.food[j];
        if (fo.eaten || fo.delay > 0 || fo.sink > 0.85) continue;   // 未落水/已沉底的不吃
        var dx = fo.x - f.x, dy = fo.y - f.y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = fo; }
      }
      if (!best) continue;
      var reach = f.L * (f.burst > 0 ? 22 : 11);
      if (bd < reach * reach) {
        var ang = Math.atan2(best.y - f.y, best.x - f.x);
        var diff = ang - f.dir;
        while (diff > Math.PI) diff -= 6.2832;
        while (diff < -Math.PI) diff += 6.2832;
        f.dir += Math.max(-0.09, Math.min(0.09, diff));
        if (f.burst <= 0) f.spd = Math.max(f.spd, f.baseSpd * 1.5);   // 追食略加速
        // 吃食冷却：吃完一粒要等一会儿（像真实啄食，一粒一粒）
        if (f.eatCd == null) f.eatCd = 0;
        if (f.eatCd > 0) { f.eatCd -= dt; continue; }
        var eatR = f.L * 0.42;
        if (bd < eatR * eatR) {
          best.eaten = true; f.eaten++; f.gain += 1;
          f.eatCd = 0.5 + Math.random() * 1.2;     // 冷却 0.5~1.7 秒
        }
      }
    }
    for (i = P.food.length - 1; i >= 0; i--) if (P.food[i].eaten) P.food.splice(i, 1);
  };

  /* ---------------- 绘制食物 + 涟漪 ---------------- */
  P.drawFood = function (g, W) {
    var i;
    // ---- 涟漪：一圈圈扩散的细环 ----
    for (i = 0; i < P.ripples.length; i++) {
      var r = P.ripples[i];
      root.Art.ripple(g, {
        x: r.x, y: r.y,
        r: r.r * (1 + r.age * 2.6),          // 扩散放慢
        t: r.age,                             // 单圈向外推进
        rings: r.rings || 1,
        alpha: 0.85 * (1 - r.age) * (1 - r.age * 0.4)
      });
    }
    // ---- 鱼食颗粒：细小的暖黄点，随时间下沉变小变暗 ----
    for (i = 0; i < P.food.length; i++) {
      var o = P.food[i];
      if (o.delay > 0) continue;             // 还没落水
      var sink = o.sink || 0;
      var fade = Math.min(1, o.life / 2.2) * (1 - sink * 0.55);   // 下沉后变淡
      var rr = o.r * W * (1 - sink * 0.30);                        // 下沉后略小
      if (rr < 0.35) continue;
      g.save();
      // 轻微下移（视觉上像往下沉）
      var dy = sink * W * 0.006;
      g.globalAlpha = fade;
      // 外圈微光（很小）
      var gr = g.createRadialGradient(o.x, o.y + dy, 0, o.x, o.y + dy, rr * 1.7);
      gr.addColorStop(0, 'rgba(255,240,190,0.55)');
      gr.addColorStop(1, 'rgba(240,200,120,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(o.x, o.y + dy, rr * 1.7, 0, 6.2832); g.fill();
      // 颗粒本体
      g.fillStyle = sink > 0.5 ? 'rgba(226,190,120,0.92)' : 'rgba(255,246,206,0.96)';
      g.beginPath(); g.arc(o.x, o.y + dy, rr, 0, 6.2832); g.fill();
      g.restore();
    }
  };

  /* ============================================================
     右上角透明信息面板
       收起：标题 + 鱼数/总重 + 天气
       展开：+ 每个品种的数量/重量/吃食 + 投喂记录
     交互：左键点面板 = 展开/收起（由宿主转发坐标）
     ============================================================ */
  P.HUD = {
    show: true,
    expanded: false,
    margin: 16,
    w: 250,
    line: 22,
    pad: 13,
    rowH: 20,
    hit: null          // 上一帧的面板矩形（供点击命中判断）
  };

  P.hitHUD = function (x, y) {
    var h = P.HUD.hit;
    return h && x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
  };

  P.drawHUD = function (g, fish, W, H, opts) {
    if (!P.HUD.show) return;
    opts = opts || {};
    var HUD = P.HUD;
    var S = Math.max(W, H) / 900;
    var pad = HUD.pad * S, lh = HUD.line * S, rowH = HUD.rowH * S;
    var pw = HUD.w * S;
    var px = W - pw - HUD.margin * S, py = HUD.margin * S;

    // ---- 统计 ----
    var bySp = {}, totalW = 0, totalEaten = 0, totalGain = 0;
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i];
      var w = f.weight + f.gain * 12;
      bySp[f.sp] = bySp[f.sp] || { n: 0, w: 0, e: 0 };
      bySp[f.sp].n++; bySp[f.sp].w += w; bySp[f.sp].e += f.eaten;
      totalW += w; totalEaten += f.eaten; totalGain += f.gain;
    }
    var ids = Object.keys(bySp).map(Number).sort(function (a, b) {
      return bySp[b].w - bySp[a].w;
    });

    // ---- 面板高度 ----
    var rows = HUD.expanded ? ids.length : 0;
    var extra = HUD.expanded ? (lh * 0.9 + rows * rowH + lh * 2.2) : 0;
    var ph = pad * 2 + lh * 3.1 + extra;

    // ---- 背板（半透明） ----
    g.save();
    g.fillStyle = 'rgba(6,26,32,0.62)';
    g.strokeStyle = 'rgba(150,220,205,0.30)';
    g.lineWidth = Math.max(1, S);
    var r = 12 * S;
    g.beginPath();
    if (g.roundRect) g.roundRect(px, py, pw, ph, r);
    else g.rect(px, py, pw, ph);
    g.fill(); g.stroke();

    // 左侧高光条
    g.fillStyle = 'rgba(150,235,210,0.55)';
    g.fillRect(px, py + r, Math.max(1.5, 2.5 * S), ph - r * 2);

    var tx = px + pad, ty = py + pad;
    var fontS = Math.round(13 * S);
    var smallS = Math.round(11.5 * S);

    // ---- 标题行：碧潭观鱼 + 天气 ----
    g.font = '600 ' + fontS + 'px "Segoe UI","Microsoft YaHei",sans-serif';
    g.fillStyle = 'rgba(170,240,220,0.96)';
    g.fillText('碧潭观鱼', tx, ty + lh * 0.78);
    // 天气（右对齐）
    var wtxt = P.weather.zh + ' ' + P.weather.temp + '\u00B0C';
    g.font = smallS + 'px "Segoe UI","Microsoft YaHei",sans-serif';
    g.fillStyle = 'rgba(255,232,170,0.92)';
    g.fillText(wtxt, px + pw - pad - g.measureText(wtxt).width, ty + lh * 0.78);
    ty += lh * 1.05;

    // 风向/降雨
    g.fillStyle = 'rgba(160,215,205,0.72)';
    var sub2 = '风 ' + P.weather.wind + ' 级' + (P.weather.rain > 0 ? ' · 有雨' : '') + ' · ' + P.weather.source;
    g.fillText(sub2, tx, ty + lh * 0.7);
    ty += lh * 1.0;

    // 分隔线
    g.strokeStyle = 'rgba(150,220,205,0.18)';
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(px + pw - pad, ty); g.stroke();
    ty += lh * 0.35;

    // ---- 鱼数 / 总重 ----
    g.font = smallS + 'px "Segoe UI","Microsoft YaHei",sans-serif';
    g.fillStyle = 'rgba(226,245,238,0.94)';
    g.fillText('鱼群 ' + fish.length + ' 条', tx, ty + lh * 0.72);
    var wkg = (totalW / 1000).toFixed(2) + ' kg';
    g.fillStyle = 'rgba(255,225,160,0.95)';
    g.fillText(wkg, px + pw - pad - g.measureText(wkg).width, ty + lh * 0.72);
    ty += lh * 0.95;

    g.fillStyle = 'rgba(170,215,205,0.70)';
    g.fillText('\u25BE 展开投喂明细', tx, ty + lh * 0.62);
    var hint = HUD.expanded ? '\u25B4' : '\u25BE';
    g.fillText(hint, px + pw - pad - g.measureText(hint).width, ty + lh * 0.62);
    ty += lh * 0.95;

    // ---- 展开：品种明细 ----
    if (HUD.expanded) {
      g.strokeStyle = 'rgba(150,220,205,0.18)';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(px + pw - pad, ty); g.stroke();
      ty += rowH * 0.45;

      // 表头
      g.font = Math.round(10.5 * S) + 'px "Segoe UI","Microsoft YaHei",sans-serif';
      g.fillStyle = 'rgba(150,200,195,0.62)';
      g.fillText('品种', tx + 12 * S, ty + rowH * 0.7);
      var h1 = '条数', h2 = '重量';
      g.fillText(h1, px + pw - pad - 92 * S - g.measureText(h1).width, ty + rowH * 0.7);
      g.fillText(h2, px + pw - pad - g.measureText(h2).width, ty + rowH * 0.7);
      ty += rowH * 0.95;

      for (i = 0; i < ids.length; i++) {
        var sp = ids[i], d = bySp[sp];
        var spc = root.Art.SPECIES[sp];
        // 色点
        g.fillStyle = spc ? spc.base[1] : '#fff';
        g.beginPath(); g.arc(tx + 5 * S, ty + rowH * 0.42, 4 * S, 0, 6.2832); g.fill();
        // 名称
        g.fillStyle = 'rgba(224,244,238,0.90)';
        g.font = smallS + 'px "Segoe UI","Microsoft YaHei",sans-serif';
        g.fillText(spc ? spc.zh : ('#' + sp), tx + 14 * S, ty + rowH * 0.72);
        // 条数
        g.fillStyle = 'rgba(180,230,215,0.92)';
        var n1 = String(d.n);
        g.fillText(n1, px + pw - pad - 92 * S - g.measureText(n1).width, ty + rowH * 0.72);
        // 重量
        g.fillStyle = 'rgba(255,228,170,0.92)';
        var w1 = (d.w / 1000).toFixed(2) + 'kg';
        g.fillText(w1, px + pw - pad - g.measureText(w1).width, ty + rowH * 0.72);
        // 吃食进度条（底部细线）
        var barW = pw - pad * 2 - 16 * S;
        var frac = d.e > 0 ? Math.min(1, d.e / Math.max(1, totalEaten)) : 0;
        g.fillStyle = 'rgba(120,190,175,0.16)';
        g.fillRect(tx + 14 * S, ty + rowH * 0.86, barW - 14 * S, Math.max(1, 1.6 * S));
        if (frac > 0) {
          g.fillStyle = 'rgba(255,215,130,0.62)';
          g.fillRect(tx + 14 * S, ty + rowH * 0.86, (barW - 14 * S) * frac, Math.max(1, 1.6 * S));
        }
        ty += rowH;
      }

      // 投喂合计
      ty += rowH * 0.3;
      g.strokeStyle = 'rgba(150,220,205,0.18)';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(px + pw - pad, ty); g.stroke();
      ty += rowH * 0.75;
      g.font = smallS + 'px "Segoe UI","Microsoft YaHei",sans-serif';
      g.fillStyle = 'rgba(200,240,228,0.92)';
      g.fillText('今日投喂 ' + P.feedCount + ' 次', tx, ty);
      g.fillStyle = 'rgba(255,220,160,0.92)';
      var e2 = '吃掉 ' + totalEaten + ' 粒';
      g.fillText(e2, px + pw - pad - g.measureText(e2).width, ty);
    }

    g.restore();

    // 记录命中区域（逻辑坐标 -> 设备坐标已一致）
    HUD.hit = { x: px, y: py, w: pw, h: ph };
  };

  P.food = [];
  P.ripples = [];
  P.feedLog = [];
  P.feedCount = 0;
  P.lastFeed = 0;

  P.reset = function () { P.food = []; P.ripples = []; P.feedLog = []; P.feedCount = 0; };

  root.Pond = P;
})(window);
