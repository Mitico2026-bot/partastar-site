var T = function (x) { var d = window.I18N; return (d && d[x]) || x; };
(function () {
  "use strict";

  /* Runtime figures are the catalog's own appliance table (hours of use, rounded as printed). */
  var LOADS = [
    { name: T("Зурагт"), w: T("150 Вт") },
    { name: T("Усны халаагуур"), w: T("2200 Вт") },
    { name: T("Агааржуулагч"), w: T("1500 Вт") },
    { name: T("Хөргөгч"), w: T("140 Вт") }
  ];
  var RT = [
    { k: 2.56, h: [16, 1.1, 1.5, 17], m: [[T("Хананд өлгөх"), "home-storage.html#wall-mounted"]] },
    { k: 3.17, h: [19, 1.3, 1.9, 20.1], m: [[T("Хананд өлгөх"), "home-storage.html#wall-mounted"]] },
    { k: 5.12, h: [31, 2.1, 3.1, 33], m: [[T("Давхарладаг"), "home-storage.html#stack-512"], [T("Тавиурт"), "home-storage.html#rack"], [T("Нэгдсэн систем"), "home-storage.html#all-in-one"], [T("Хананд өлгөх"), "home-storage.html#wall-mounted"]] },
    { k: 7.68, h: [46, 3.2, 4.6, 50], m: [[T("Давхарладаг"), "home-storage.html#stack-768"], [T("Тавиурт"), "home-storage.html#rack"], [T("Нэгдсэн систем"), "home-storage.html#all-in-one"]] },
    { k: 10, h: [60, 4.1, 6, 64], m: [[T("Дугуйтай"), "home-storage.html#leaning"], [T("Нэгдсэн систем"), "home-storage.html#all-in-one"], [T("Хананд өлгөх"), "home-storage.html#wall-mounted"]] },
    { k: 14.34, h: [86, 6, 9, 92], m: [[T("Дугуйтай"), "home-storage.html#leaning"], [T("Нэгдсэн систем"), "home-storage.html#all-in-one"]] },
    { k: 16, h: [96, 7, 10, 103], m: [[T("Дугуйтай"), "home-storage.html#leaning"]] },
    { k: 20, h: [120, 8.2, 12, 129], m: [[T("Нэгдсэн систем"), "home-storage.html#all-in-one"], [T("Давхарладаг IP65"), "home-storage.html#stack-ip65"]] },
    { k: 32, h: [192, 14, 20, 206], m: [[T("Дугуйтай"), "home-storage.html#leaning"], [T("Нэгдсэн систем"), "home-storage.html#all-in-one"]] }
  ];
  var MAX_K = 32;

  function fmt(n) {
    return (Math.round(n * 10) / 10).toString();
  }

  var root = document.getElementById("runtime");
  if (root) {
    var group = root.querySelector(".sizes");
    var level = root.querySelector(".level");
    var kwhText = root.querySelector(".kwh");
    var list = root.querySelector(".loads");
    var models = root.querySelector(".models");
    var DEFAULT_K = 10;

    RT.forEach(function (r, i) {
      var id = "rt-" + i;
      var label = document.createElement("label");
      label.setAttribute("for", id);
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "rt-size";
      input.id = id;
      input.value = String(i);
      if (r.k === DEFAULT_K) input.checked = true;
      var span = document.createElement("span");
      span.innerHTML = String(r.k) + T("<small> кВт·ц</small>");
      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
    });

    function render(i) {
      var r = RT[i];
      var frac = Math.max(0.1, r.k / MAX_K);
      var inner = 112; /* inner height of the cell drawing */
      var h = Math.round(inner * frac);
      level.setAttribute("height", String(h));
      level.setAttribute("y", String(136 - h));
      kwhText.textContent = String(r.k);
      list.innerHTML = "";
      LOADS.forEach(function (l, j) {
        var li = document.createElement("li");
        li.innerHTML =
          '<span class="hours">' + fmt(r.h[j]) + T("<small>цаг</small></span>") +
          '<span class="what">' + l.name + "</span>" +
          '<span class="watt">' + l.w + "</span>";
        list.appendChild(li);
      });
      models.innerHTML = "";
      r.m.forEach(function (m) {
        var a = document.createElement("a");
        a.href = m[1];
        a.textContent = m[0];
        models.appendChild(a);
      });
    }

    group.addEventListener("change", function (e) {
      if (e.target && e.target.name === "rt-size") render(Number(e.target.value));
    });
    render(RT.findIndex(function (r) { return r.k === DEFAULT_K; }));
  }

  /* Order buttons: copy the question text so it can be pasted into Messenger, then let the link open. */
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  var timer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove("show"); }, 4200);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[data-copy]") : null;
    if (!a) return;
    var text = a.getAttribute("data-copy");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { say(T("Асуултын текст хуулагдлаа. Messenger дээр буулгаж илгээнэ үү.")); },
          function () { say(T("Messenger дээр бүтээгдэхүүний нэрийг бичнэ үү: ") + text); }
        );
      } else {
        say(T("Messenger дээр бүтээгдэхүүний нэрийг бичнэ үү: ") + text);
      }
    } catch (err) {
      say(T("Messenger дээр бүтээгдэхүүний нэрийг бичнэ үү: ") + text);
    }
  });
})();

/* 3D environment scenes (pure CSS 3D, no libraries) */
(function () {
  var mounts = document.querySelectorAll(".s3d");
  if (!mounts.length) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function E(c, p, st) { var d = document.createElement("div"); if (c) d.className = c; if (st) d.style.cssText = st; if (p) p.appendChild(d); return d; }
  var GLASS = "background-color:#8fb8ea;background-image:linear-gradient(#e6ecf5 0 3px,transparent 3px),linear-gradient(90deg,#e6ecf5 0 3px,transparent 3px);background-size:14px 17px;";
  function box(p, x, y, w, d, h, o) {
    o = o || {}; var z = o.z || 0, wall = o.wall || "#e6ebf3", top = o.top || "#f6f8fb", fac = o.fac ? o.fac : "background:" + wall + ";";
    var b = E("cb", p, "transform:translate3d(" + x + "px," + y + "px," + z + "px)");
    E("f t", b, "width:" + w + "px;height:" + d + "px;background:" + top + ";transform:translateZ(" + h + "px)");
    var fr = E("f sf", b, "width:" + w + "px;height:" + h + "px;" + fac + "transform:translate3d(0," + d + "px," + h + "px) rotateX(-90deg)");
    E("f sb", b, "width:" + w + "px;height:" + h + "px;" + fac + "transform:translate3d(" + w + "px,0," + h + "px) rotateZ(180deg) rotateX(-90deg)");
    E("f sr", b, "width:" + d + "px;height:" + h + "px;" + fac + "transform:translate3d(" + w + "px,0," + h + "px) rotateZ(90deg) rotateX(-90deg)");
    E("f sl", b, "width:" + d + "px;height:" + h + "px;" + fac + "transform:translate3d(0," + d + "px," + h + "px) rotateZ(-90deg) rotateX(-90deg)");
    b.front = fr; return b;
  }
  var PV = "background-color:#10306a;background-image:linear-gradient(rgba(150,190,255,.55) 0 1px,transparent 1px),linear-gradient(90deg,rgba(150,190,255,.55) 0 1px,transparent 1px);background-size:10px 10px;";
  function roof(p, x, y, w, d, z, rh, col) {
    var half = d / 2, L = Math.sqrt(half * half + rh * rh), a = Math.atan2(rh, half) * 180 / Math.PI;
    var b = E("cb", p, "transform:translate3d(" + x + "px," + y + "px,0)");
    E("f sb", b, "width:" + w + "px;height:" + L + "px;background:" + col + ";transform:translate3d(0,0," + z + "px) rotateX(" + a + "deg)");
    var f = E("f sf", b, "width:" + w + "px;height:" + L + "px;background:" + col + ";transform:translate3d(0," + d + "px," + z + "px) rotateX(" + (180 - a) + "deg)");
    E("", f, "position:absolute;left:12%;top:14%;width:76%;height:70%;" + PV + "outline:2px solid #c9d3e3");
    E("f sr", b, "width:" + d + "px;height:" + rh + "px;background:#efe7da;clip-path:polygon(0 100%,50% 0,100% 100%);transform:translate3d(" + w + "px,0," + (z + rh) + "px) rotateZ(90deg) rotateX(-90deg)");
    E("f sl", b, "width:" + d + "px;height:" + rh + "px;background:#efe7da;clip-path:polygon(0 100%,50% 0,100% 100%);transform:translate3d(0," + d + "px," + (z + rh) + "px) rotateZ(-90deg) rotateX(-90deg)");
  }
  function flatPV(p, x, y, w, d, z) { E("f", p, "width:" + w + "px;height:" + d + "px;" + PV + "transform:translate3d(" + x + "px," + y + "px," + z + "px)"); }
  function pvRows(p, x, y, w, rows, z) { for (var i = 0; i < rows; i++) E("f", p, "width:" + w + "px;height:20px;" + PV + "outline:1px solid #c9d3e3;transform-origin:0 0;transform:translate3d(" + x + "px," + (y + i * 30) + "px," + z + "px) rotateX(-24deg)"); }
  function cab(p, x, y, s, z) {
    var b = box(p, x, y, 16 * s, 12 * s, 36 * s, { z: z || 0, wall: "#f4f6fa", top: "#fff" });
    E("", b.front, "position:absolute;left:18%;right:18%;top:12%;height:5px;background:#27d89a;box-shadow:0 0 8px #27d89a;animation:s3dled 1.6s ease-in-out infinite");
    return b;
  }
  function house(p, x, y, s) {
    var w = 120 * s, d = 96 * s, h = 58 * s;
    var b = box(p, x, y, w, d, h, { wall: "#f3ede3" });
    E("", b.front, "position:absolute;left:12%;top:30%;width:22%;height:36%;background:#9ec4f2;border:2px solid #fff");
    E("", b.front, "position:absolute;left:44%;top:34%;width:16%;height:66%;background:#6b4a36");
    E("", b.front, "position:absolute;left:68%;top:30%;width:22%;height:36%;background:#9ec4f2;border:2px solid #fff");
    roof(p, x, y, w, d, h, 44 * s, "#a8442f");
    cab(p, x + w + 6 * s, y + d - 20 * s, s);
  }
  function office(p, x, y, s, flr) {
    var w = 96 * s, d = 84 * s, h = (flr || 12) * 17 * s;
    box(p, x, y, w, d, h, { fac: GLASS, top: "#dfe6f0" });
    flatPV(p, x + 8 * s, y + 8 * s, w - 16 * s, d - 30 * s, h + 1);
    box(p, x + w - 26 * s, y + d - 20 * s, 18 * s, 14 * s, 12 * s, { z: h, wall: "#c7d0de" });
    cab(p, x + w + 6 * s, y + d - 18 * s, s);
  }
  function factory(p, x, y, s) {
    var w = 220 * s, d = 130 * s, h = 62 * s;
    var b = box(p, x, y, w, d, h, { wall: "#d3dbe8", top: "#c5cedc" });
    E("", b.front, "position:absolute;left:8%;right:8%;top:22%;height:18%;background:repeating-linear-gradient(90deg,#9ec4f2 0 22px,#d3dbe8 22px 28px)");
    E("", b.front, "position:absolute;left:42%;width:16%;top:50%;bottom:0;background:#52627d");
    pvRows(p, x + 10 * s, y + 10 * s, w - 20 * s, 4, h + 1);
    for (var i = 0; i < 3; i++) cab(p, x + w + 8 * s, y + 10 * s + i * 22 * s, s * 1.15);
  }
  function tree(p, x, y, s) { box(p, x + 3 * s, y + 3 * s, 4 * s, 4 * s, 10 * s, { wall: "#6b4a36", top: "#6b4a36" }); box(p, x, y, 10 * s, 10 * s, 14 * s, { z: 10 * s, wall: "#3f9a5b", top: "#58b873" }); }
  function car(p, x, y, s) { box(p, x, y, 56 * s, 26 * s, 12 * s, { z: 4 * s, wall: "#1f4fb4", top: "#2a63d8" }); box(p, x + 12 * s, y + 3 * s, 30 * s, 20 * s, 12 * s, { z: 16 * s, wall: "#9ec4f2", top: "#cfe3fb" }); [[4, 0], [42, 0], [4, 20], [42, 20]].forEach(function (c) { box(p, x + c[0] * s, y + c[1] * s, 10 * s, 6 * s, 8 * s, { wall: "#222", top: "#333" }); }); }
  function flow(p, x, y, w, h) { E("f flow", p, "width:" + w + "px;height:" + h + "px;transform:translate3d(" + x + "px," + y + "px,1px)"); }
  var SC = {
    city: function (p) { house(p, -270, -10, 1); office(p, -80, -190, 1, 13); factory(p, -20, 20, 1); tree(p, -280, 120, 1); tree(p, -250, 130, .8); tree(p, 250, -150, 1);
      flow(p, -140, 70, 120, 4); flow(p, -40, -110, 4, 190); flow(p, -40, 70, 20, 4); },
    house: function (p) { house(p, -150, -80, 1.6); tree(p, 120, 60, 1.6); tree(p, -230, 70, 1.3); tree(p, -200, -110, 1.1); flow(p, 60, 60, 120, 5); },
    office: function (p) { office(p, -150, -120, 1.5, 14); office(p, 60, -60, 1, 8); tree(p, 160, 90, 1.4); tree(p, -240, 70, 1.2); flow(p, 20, 90, 180, 5); },
    factory: function (p) { factory(p, -250, -90, 1.2); tree(p, 150, 100, 1.5); flow(p, 20, 90, 120, 5); },
    car: function (p) { house(p, -230, -90, 1.4); car(p, 20, 20, 1.6); tree(p, 170, -90, 1.5); flow(p, -60, 50, 100, 5); },
    cabin: function (p) { house(p, -150, -60, 1.3); tree(p, 80, 60, 1.6); tree(p, -240, 70, 1.4); tree(p, -220, -100, 1.2); tree(p, 150, -80, 1.8); flow(p, 20, 80, 100, 5); }
  };
  mounts.forEach(function (m) {
    var kind = m.getAttribute("data-scene") || "city", build = SC[kind] || SC.city;
    var stage = E("s3d-stage", m), sun = E("s3d-sun", m), world = E("s3d-world", stage);
    E("f ground", world, "width:640px;height:480px;transform:translate3d(-320px,-240px,0)");
    var inner = E("s3d-in", world, "transform:translate3d(0,0,0)"); build(inner);
    var sc = 1, rz = -34, tx = 0, ty = 0, vis = true, t0 = Date.now();
    function size() { var s = Math.min(m.clientWidth / 800, m.clientHeight / 520); sc = s; }
    size(); addEventListener("resize", size);
    function set() { var t = (Date.now() - t0) / 1000, sw = reduce ? 0 : Math.sin(t * .5) * 7; world.style.transform = "rotateX(" + (58 - ty * 8) + "deg) rotateZ(" + (rz + tx * 22 + sw) + "deg) scale(" + sc + ")"; }
    set();
    if (reduce) return;
    var host = m.closest(".hero, .page-head") || m;
    host.addEventListener("pointermove", function (e) { var b = host.getBoundingClientRect(); tx = (e.clientX - b.left) / b.width - .5; ty = (e.clientY - b.top) / b.height - .5; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }).observe(m);
    (function loop() { requestAnimationFrame(loop); if (vis) set(); })();
  });
})();

(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 3D tilt on catalog cards
  if (!reduce && matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".cat-card").forEach(function (c) {
      c.addEventListener("pointermove", function (e) { var b = c.getBoundingClientRect(); var x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5; c.style.transform = "perspective(900px) rotateY(" + (x * 8) + "deg) rotateX(" + (-y * 8) + "deg) translateZ(4px)"; });
      c.addEventListener("pointerleave", function () { c.style.transform = ""; });
    });
  }
})();

/* ---- 3D product photos: layered extrusion + tilt ---- */
(function () {
  var reduce = false; /* owner request: always spin */
  var imgs = document.querySelectorAll(".pic > img, .pic img");
  if (!imgs.length || !("IntersectionObserver" in window)) return;
  var LAYERS = 22, STEP = 1.3;
  function build(img) {
    if (img.dataset.p3d) return;
    img.dataset.p3d = "1";
    var cut = img.currentSrc || img.src;
    var wrap = document.createElement("span");
    wrap.className = "p3d";
    var obj = document.createElement("span");
    obj.className = "p3d-obj";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(obj);
    for (var i = LAYERS; i >= 1; i--) {
      var l = document.createElement("img");
      l.src = cut; l.alt = ""; l.setAttribute("aria-hidden", "true");
      l.className = "p3d-l";
      l.style.transform = "translateZ(" + (-i * STEP) + "px)";
      l.style.filter = "brightness(" + (0.8 - i * 0.025).toFixed(2) + ") saturate(.9)";
      obj.appendChild(l);
    }
    img.classList.add("p3d-front");
    obj.appendChild(img);
    var sh = document.createElement("span"); sh.className = "p3d-sh"; wrap.appendChild(sh);
    var st = { a: Math.random() * 40 - 20, drag: false, x: 0, vis: true, obj: obj };
    objs.push(st);
    if (!reduce) {
      wrap.style.cursor = "grab"; wrap.style.touchAction = "pan-y";
      wrap.addEventListener("pointerdown", function (e) { st.drag = true; st.x = e.clientX; wrap.style.cursor = "grabbing"; try { wrap.setPointerCapture(e.pointerId); } catch (_) {} });
      wrap.addEventListener("pointermove", function (e) { if (st.drag) { st.a += (e.clientX - st.x) * 0.8; st.x = e.clientX; } });
      var up = function () { st.drag = false; wrap.style.cursor = "grab"; };
      wrap.addEventListener("pointerup", up); wrap.addEventListener("pointercancel", up);
      wrap.addEventListener("pointerenter", function () { st.hover = true; });
      wrap.addEventListener("pointerleave", function () { st.hover = false; up(); });
      new IntersectionObserver(function (en) { st.vis = en[0].isIntersecting; }).observe(wrap);
    }
  }
  var objs = [];
  if (!reduce) (function () {
    var last = 0;
    function loop(t) {
      var dt = last ? Math.min(t - last, 100) : 16; last = t;
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i]; if (!o.vis) continue;
        if (!o.drag) o.a += dt * (o.hover ? 0.01 : 0.032);
        o.obj.style.transform = "rotateX(8deg) rotateY(" + (o.a % 360).toFixed(1) + "deg)";
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) {
      if (e.isIntersecting) { build(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: "120px" });
  imgs.forEach(function (i) {
    if (i.classList.contains("cover") || /aio-room|hero-house/.test(i.src)) return;
    io.observe(i);
  });
})();

/* language dropdown */
(function(){
  var ds=document.querySelectorAll("details.lang");
  if(!ds.length)return;
  document.addEventListener("click",function(e){ds.forEach(function(d){if(!d.contains(e.target))d.removeAttribute("open");});});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")ds.forEach(function(d){d.removeAttribute("open");});});
})();
