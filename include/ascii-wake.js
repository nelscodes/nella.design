/* ASCII wake, vanilla JS port.
   The shape comes from any image (your logo), and the resting marks are squares.

   Usage:
     AsciiWake(document.querySelector("#logo"), { src: "logo.svg" });

   The container needs a width and height (CSS). The canvas fills it.
   Ink colour = the container's CSS `color`. */

(function (global) {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* lightest to densest; the first is always a blank, the second is drawn as a square */
  const RAMPS = {
    Blocks: [" ", "▪", "░", "▒", "▓", "█"],
    Classic: [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"],
    Binary: [" ", ".", ":", "0", "1"],
    Squares: [" ", "▪", "■", "█"],
  };

  const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
  const COLD = 0.04; /* below this much heat a cell is just a resting square */
  const RING_S = 2.2; /* seconds for a click's ring to spread and fade */

  /* stable 0..1 per cell per deal, so the shimmer holds for a few frames */
  function hash(k, n) {
    let h = (k * 374761393 + n * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;
  function toRGB(c) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = c; /* ignored if invalid, so black */
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  function AsciiWake(el, opts) {
    const o = Object.assign(
      {
        src: null,        /* logo image URL (SVG or PNG recommended) */
        glyphs: "Blocks", /* ramp name, or pass your own array */
        size: 8,          /* glyph size, px: the characters drawn where the wake is hot */
        cell: 4.5,        /* grid cell size, px: smaller = more, finer squares */
        reach: 50,        /* wake width, 0..100 */
        trail: 1.2,       /* seconds for the wake to cool */
        pull: 40,         /* how far glyphs lean toward the pointer, 0..100 */
        padding: 0.1,     /* empty margin around the logo, fraction of the box */
        maskFrom: "auto", /* "auto" | "alpha" | "dark" | "light" */
        squareScale: 0.86, /* resting square size, fraction of a cell (1 = touching) */
        stagger: false,   /* offset every other row by half a cell (halftone look) */
        color: null,      /* ink colour; null = the container's CSS color */
        hoverColor: null, /* colour the cells blend to under the wake; null = same as ink */
      },
      opts || {}
    );

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    canvas.setAttribute("aria-hidden", "true");
    el.appendChild(canvas);
    el.style.touchAction = "pan-y";
    if (!el.hasAttribute("role")) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", o.ariaLabel || "Logo that reacts to the pointer");
    }

    const s = {
      W: 0, H: 0, ratio: 1, cols: 0, rows: 0, cw: 0, ch: 0, ox: 0, oy: 0,
      font: "", heat: new Float32Array(0), mask: new Float32Array(0),
      hx: -999, hy: -999, lx: NaN, ly: NaN, near: 0, inside: false,
      rings: [], deal: 0, tick: 0, raf: 0, img: null,
    };

    const ramp = () => (Array.isArray(o.glyphs) ? o.glyphs : RAMPS[o.glyphs] || RAMPS.Blocks);
    const radius = () => (12 + (clamp(o.reach, 0, 100) / 100) * 58) * (o.cell / 7.2);

    /* ── the shape: sample the logo's coverage into a mask, 0..1 per cell ── */
    function buildMask() {
      if (!s.img) return;
      const W = s.W, H = s.H;
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const g = off.getContext("2d", { willReadFrequently: true });
      const iw = s.img.naturalWidth || s.img.width, ih = s.img.naturalHeight || s.img.height;
      const box = 1 - o.padding * 2;
      const k = Math.min((W * box) / iw, (H * box) / ih);
      g.drawImage(s.img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
      const data = g.getImageData(0, 0, W, H).data;

      /* decide what counts as "the logo": transparency if the image has any, else dark pixels */
      let mode = o.maskFrom;
      if (mode === "auto") {
        let transparent = false;
        for (let p = 3; p < data.length; p += 4 * 17) if (data[p] < 250) { transparent = true; break; }
        mode = transparent ? "alpha" : "dark";
      }
      const val = (x, y) => {
        x = clamp(Math.round(x), 0, W - 1); y = clamp(Math.round(y), 0, H - 1);
        const p = (y * W + x) * 4;
        if (mode === "alpha") return data[p + 3] / 255;
        const lum = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
        return (mode === "dark" ? 1 - lum : lum) * (data[p + 3] / 255);
      };

      for (let j = 0; j < s.rows; j++) {
        for (let i = 0; i < s.cols; i++) {
          const cx = s.ox + (i + 0.5 + (o.stagger ? (j & 1) * 0.5 : 0)) * s.cw;
          const cy = s.oy + (j + 0.5) * s.ch;
          /* average a 3x3 of points across the cell so edges are soft, not jagged */
          let sum = 0;
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) sum += val(cx + (a * s.cw) / 3, cy + (b * s.ch) / 3);
          const m = sum / 9;
          s.mask[j * s.cols + i] = m < 0.12 ? 0 : clamp(m, 0, 1);
        }
      }
    }

    function build() {
      const r = el.getBoundingClientRect();
      s.W = Math.max(1, Math.round(r.width));
      s.H = Math.max(1, Math.round(r.height));
      s.ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(s.W * s.ratio);
      canvas.height = Math.round(s.H * s.ratio);
      s.ch = o.cell; /* square cells, so gaps match across and down */
      s.cw = o.cell;
      s.cols = Math.floor(s.W / s.cw - 0.5);
      s.rows = Math.floor(s.H / s.ch);
      s.font = `500 ${o.size}px ${MONO}`;
      s.heat = new Float32Array(s.cols * s.rows);
      s.mask = new Float32Array(s.cols * s.rows);
      s.ox = (s.W - s.cols * s.cw) / 2;
      s.oy = (s.H - s.rows * s.ch) / 2;
      buildMask();
      paint();
    }

    /* heat dropped on the grid in a soft round at a point */
    function stamp(x, y, rad, amt) {
      x -= s.ox; y -= s.oy;
      const c0 = Math.max(0, Math.floor((x - rad) / s.cw));
      const c1 = Math.min(s.cols - 1, Math.ceil((x + rad) / s.cw));
      const r0 = Math.max(0, Math.floor((y - rad) / s.ch));
      const r1 = Math.min(s.rows - 1, Math.ceil((y + rad) / s.ch));
      const R2 = rad * rad;
      for (let j = r0; j <= r1; j++) {
        const dy = (j + 0.5) * s.ch - y;
        for (let i = c0; i <= c1; i++) {
          const dx = (i + 0.5) * s.cw - x;
          const q = (dx * dx + dy * dy) / R2;
          if (q >= 1) continue;
          const t = 1 - q;
          const k = j * s.cols + i;
          s.heat[k] = Math.min(1, s.heat[k] + amt * t * t);
        }
      }
    }

    function paint() {
      if (!s.cols) return;
      const g = canvas.getContext("2d");
      g.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
      g.clearRect(0, 0, s.W, s.H);
      const baseCss = o.color || getComputedStyle(el).color;
      const baseRGB = toRGB(baseCss);
      const hoverRGB = o.hoverColor ? toRGB(o.hoverColor) : null;
      g.fillStyle = baseCss;
      let cur = baseCss;
      const paintWith = (css) => { if (css !== cur) { g.fillStyle = css; cur = css; } };
      g.font = s.font;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const rp = ramp();
      const top = rp.length - 1;
      const cell = Math.min(s.cw, s.ch);
      const lean = (clamp(o.pull, 0, 100) / 100) * s.near;
      const rad = radius();
      const far = rad * 2, far2 = far * far, R2 = rad * rad;
      const rings = s.rings.map((r) => {
        const p = r.t / RING_S;
        const e = 1 - Math.pow(1 - p, 3);
        return { x: r.x, y: r.y, R: 8 + e * 260 * (o.cell / 7.2), amp: 0.6 * (1 - p) * (1 - p) * Math.min(1, p * 6) };
      });

      for (let j = 0; j < s.rows; j++) {
        const y = s.oy + (j + 0.5) * s.ch;
        for (let i = 0; i < s.cols; i++) {
          const k = j * s.cols + i;
          const m = s.mask[k];
          if (m <= 0) continue;
          const cx = s.ox + (i + 0.5 + (o.stagger ? (j & 1) * 0.5 : 0)) * s.cw;
          let h = s.heat[k];
          if (s.near > 0.002) {
            const q = ((cx - s.hx) ** 2 + (y - s.hy) ** 2) / R2;
            if (q < 1) h = Math.max(h, 0.95 * s.near * (1 - q) * (1 - q));
          }
          for (const r of rings) {
            const d = (Math.hypot(cx - r.x, y - r.y) - r.R) / (24 * (o.cell / 7.2));
            if (d > -2.5 && d < 2.5) h += r.amp * Math.exp(-d * d);
          }
          h *= 0.55 + 0.45 * m;
          const v = Math.min(1, h);
          let u = v * top + 0.5;
          if (h > COLD) u += (hash(k, s.deal) - 0.5) * 1.6 * Math.min(1, h * 2);
          const idx = clamp(Math.floor(u), 1, top);
          /* blend ink toward the hover colour by how warm the cell is */
          if (hoverRGB && h > COLD) {
            const t = clamp(h * 1.6, 0, 1);
            paintWith(`rgb(${Math.round(baseRGB[0] + (hoverRGB[0] - baseRGB[0]) * t)},${Math.round(baseRGB[1] + (hoverRGB[1] - baseRGB[1]) * t)},${Math.round(baseRGB[2] + (hoverRGB[2] - baseRGB[2]) * t)})`);
          } else paintWith(baseCss);

          let x = cx, yy = y;
          if (lean > 0.002) {
            const dx = s.hx - x, dy = s.hy - yy;
            const d2 = dx * dx + dy * dy;
            if (d2 < far2) {
              const f = 1 - d2 / far2;
              const d = Math.sqrt(d2) || 1;
              const mv = Math.min(d * 0.6, 14 * (o.cell / 7.2) * lean * f * f);
              x += (dx / d) * mv;
              yy += (dy / d) * mv;
            }
          }

          /* resting state: a SQUARE whose side follows the coverage */
          if (h <= COLD || idx === 1) {
            const side = Math.max(1, cell * o.squareScale * Math.sqrt(m));
            /* snap to whole device pixels so touching squares leave no seams */
            const R = s.ratio, sd = Math.max(1, Math.round(side * R));
            g.fillRect(Math.round((x - side / 2) * R) / R, Math.round((yy - side / 2) * R) / R, sd / R, sd / R);
            continue;
          }
          g.fillText(rp[idx], x, yy);
        }
      }
    }

    /* the loop runs only while the wake is warm or the hand is moving */
    function run() {
      if (s.raf) return;
      let prev = performance.now();
      const step = (t) => {
        const dt = Math.min(0.05, (t - prev) / 1000);
        prev = t;
        const keep = Math.exp((-dt * 3) / Math.max(0.1, o.trail));
        let warm = 0;
        for (let k = 0; k < s.heat.length; k++) {
          const h = s.heat[k] * keep;
          s.heat[k] = h < 0.003 ? 0 : h;
          if (h > warm) warm = h;
        }
        s.rings = s.rings.filter((r) => (r.t += dt) < RING_S);
        s.near += ((s.inside ? 1 : 0) - s.near) * (1 - Math.pow(0.004, dt));
        s.tick += dt;
        if (s.tick > 0.07) { s.tick = 0; s.deal++; }
        paint();
        const still = warm === 0 && !s.rings.length && Math.abs((s.inside ? 1 : 0) - s.near) < 0.004;
        s.raf = still ? 0 : requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    }

    const where = (e) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    function move(e) {
      const { x, y } = where(e);
      const rad = radius();
      if (Number.isNaN(s.lx)) { s.lx = x; s.ly = y; }
      const d = Math.hypot(x - s.lx, y - s.ly);
      const n = Math.max(1, Math.ceil(d / (rad / 3)));
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        stamp(s.lx + (x - s.lx) * f, s.ly + (y - s.ly) * f, rad, 0.5);
      }
      s.lx = x; s.ly = y; s.hx = x; s.hy = y;
      s.inside = true;
      run();
    }

    el.addEventListener("pointerenter", (e) => { s.lx = NaN; move(e); });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", () => { s.inside = false; s.lx = NaN; run(); });
    el.addEventListener("pointerdown", (e) => {
      const { x, y } = where(e);
      s.rings.push({ x, y, t: 0 });
      run();
    });

    /* rebuild when the box resizes */
    let rt = 0;
    const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 60); });
    ro.observe(el);

    /* load the logo, then build */
    if (o.src) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { s.img = img; build(); };
      img.onerror = () => console.warn("AsciiWake: could not load", o.src);
      img.src = o.src;
    }

    return {
      /* change settings live: wake.update({ reach: 70, color: "#0a0" }) */
      update(patch) {
        const rebuild = "size" in patch || "cell" in patch || "padding" in patch || "maskFrom" in patch;
        Object.assign(o, patch);
        if (rebuild) build(); else { paint(); }
      },
      options: () => Object.assign({}, o),
      /* swap the logo later: wake.setSrc("other.svg") */
      setSrc(src) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { s.img = img; build(); };
        img.src = src;
      },
      destroy() { cancelAnimationFrame(s.raf); ro.disconnect(); canvas.remove(); },
    };
  }

  global.AsciiWake = AsciiWake;
  global.AsciiWake.RAMPS = RAMPS;
})(window);
