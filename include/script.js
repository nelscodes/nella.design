//copy to clipboard//
function copyEmail(element) {
  const email = "nellawongly@gmail.com";
  const tooltip = element.nextElementSibling;

  navigator.clipboard
    .writeText(email)
    .then(function () {
      // Show tooltip
      tooltip.classList.add("show");

      // Hide tooltip after 2 seconds
      setTimeout(function () {
        tooltip.classList.remove("show");
      }, 2000);
    })
    .catch(function (err) {
      console.error("Failed to copy: ", err);
      tooltip.textContent = "Copy failed";
      tooltip.classList.add("show");
      setTimeout(function () {
        tooltip.classList.remove("show");
        tooltip.textContent = "Copied!";
      }, 2000);
    });
}

//hover img//
function mediaQueryCheck(inputQuery) {
  var content = document.getElementById("navigation");
  if (inputQuery.matches) {
    for (let el of document.querySelectorAll(".hover")) {
      let image = new Image();
      image.src = el.dataset.src;
      image.className = "followMouse";
      image.style.width = "240px";
      image.style.position = "fixed";

      el.addEventListener("mouseover", (e) => {
        document.getElementById("container").append(image);
        image.style.left = `${e.clientX * 1.1}px`;
        image.style.top = `${e.clientY * 1.05}}px`;
      });

      el.addEventListener("mouseout", (e) => {
        image.remove();
      });
    }

    window.addEventListener("mousemove", (e) => {
      let image = document.querySelector(".followMouse");
      if (image) {
        image.style.left = `${e.clientX * 1.1}px`;
        image.style.top = `${e.clientY * 1.05}px`;
      }
    });
  } else {
  }
}
var mobileQuery = window.matchMedia("(min-width: 900px)");
mediaQueryCheck(mobileQuery);
mobileQuery.addListener(mediaQueryCheck);

//click audio//
document.addEventListener('DOMContentLoaded', () => {
  const navClickSound = new Audio('sounds/audio-click.wav');

  const navItems = document.querySelectorAll('.floating-nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const destination = item.getAttribute('href');

      navClickSound.currentTime = 0;
      navClickSound.play().catch(() => {});

      const delay = (navClickSound.duration || 0.3) * 1000; // convert to ms, fallback 300ms

      setTimeout(() => {
        if (destination && destination !== '#') {
          window.location.href = destination;
        }
      }, delay);
    });
  });
});

//gallery//
(function () {
  const PHOTOS = [
    { src: "./images/mypic3.webp", caption: "That's me!" },
    { src: "./images/kashihara-sakura.webp", caption: "Did a 3-month stint in countryside Japan" },
    { src: "./images/12apostles.webp", caption: "From my university days in Melbourne" },
  ];

  const N = PHOTOS.length;

  // ── tuning ──
  const ORBIT = 140;           // how far out to the sides the ring reaches (their "Spread")
  const DEPTH = 50;           // 0..150, how much smaller the back of the ring is (100 = half size)
  const LEAN = 10;             // px the back cards ride up, so the ring reads as going "back"
  const PULL = 140;            // px of drag that turns the ring by one card
  const TOSS = 150;            // ms of release velocity to look ahead (makes flicks work)
  const MOST = 2;              // max cards a single flick may skip
  const SETTLE_MS = 700;       // how long the snap-to-card glide takes
  const IDLE_INTERVAL_MS = 6000;
  const RESUME_DELAY_MS = 6000;
  // every card gets its own slight tilt; deliberately not a pattern
  const ANGLE = [-4.2, 2.6, -1.4, 3.8, 1.7];

  const stage = document.getElementById("galleryStage");
  const ring = document.getElementById("galleryRing");
  const captionIndexEl = document.getElementById("galleryCaptionIndex");
  const captionTextEl = document.getElementById("galleryCaptionText");

  if (!stage || !ring || !N) return; // gallery not on this page, skip it

  const reduceMotion =
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 4); // quart-out
  const mod = (a, n) => ((a % n) + n) % n;

  // shortest signed distance on a ring of n positions
  function wrapOffset(raw, n) {
    let r = mod(raw, n);
    if (r > n / 2) r -= n;
    return r;
  }

  // ── build cards ──
  let suppressClick = false;

  const cardEls = PHOTOS.map((photo, i) => {
    const el = document.createElement("div");
    el.className = "gallery-card";
    el.style.transition = "none"; // JS drives every frame; a CSS transition would fight it
    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.caption;
    img.draggable = false;
    el.appendChild(img);
    el.addEventListener("click", () => {
      if (suppressClick) return;
      goTo(i);
    });
    ring.appendChild(el);
    return el;
  });

  // ── state ──
  // `turn` is a continuous position in card-steps: 0 = first card at the front,
  // 1.5 = halfway between the 2nd and 3rd. It is NOT wrapped or clamped; wrapping
  // it would send a card the long way round the moment it crossed the seam.
  let turn = 0;
  let raf = 0;
  let drag = null;
  let held = false;
  let idleTimer = null;
  let resumeTimer = null;

  // ── where each card sits, given where the ring is ──
  function paint() {
    cardEls.forEach((el, i) => {
      const th = (i - turn) * ((Math.PI * 2) / N);
      const f = (Math.cos(th) + 1) / 2; // 1 at the front, 0 at the back
      const x = Math.sin(th) * ORBIT;
      const y = -(1 - f) * LEAN;
      const s = mix(1 - clamp(DEPTH, 0, 150) / 200, 1, f);
      el.style.transform =
        `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) ` +
        `rotate(${ANGLE[i % ANGLE.length]}deg) scale(${s.toFixed(4)})`;
      el.style.zIndex = String(Math.round(f * 100));
    });

    const active = mod(Math.round(turn), N);
    if (captionIndexEl) captionIndexEl.textContent = String(active + 1).padStart(2, "0");
    if (captionTextEl) captionTextEl.textContent = PHOTOS[active].caption;
  }

  // ── glide to a whole position from wherever the ring currently is ──
  function glide(to) {
    cancelAnimationFrame(raf);
    const from = turn;
    if (reduceMotion || from === to) {
      turn = to;
      paint();
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / SETTLE_MS);
      turn = mix(from, to, easeOut(p));
      paint();
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function goTo(index) {
    pauseIdle();
    const base = Math.round(turn);
    glide(base + wrapOffset(index - base, N));
    scheduleResume();
  }

  // ── auto-advance ──
  function startIdle() {
    clearInterval(idleTimer);
    if (reduceMotion) return;
    idleTimer = setInterval(() => {
      if (document.hidden || held) return;
      glide(Math.round(turn) + 1);
    }, IDLE_INTERVAL_MS);
  }
  function pauseIdle() {
    clearInterval(idleTimer);
    clearTimeout(resumeTimer);
  }
  function scheduleResume() {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startIdle, RESUME_DELAY_MS);
  }

  // ── drag: dragging right moves the cards right ──
  stage.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(raf);
    pauseIdle();
    held = true;
    drag = { x0: e.clientX, t0: turn, last: e.clientX, t: e.timeStamp, vx: 0, moved: false };
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;

    if (!drag.moved && Math.abs(dx) > 3) {
      drag.moved = true;
      stage.classList.add("dragging");
      // capture only once it's really a drag, so plain clicks still reach the cards
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    }

    // px/ms, smoothed so one jittery frame can't fake a flick
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.vx = (drag.vx + (e.clientX - drag.last) / dt) / 2;
    drag.last = e.clientX;
    drag.t = e.timeStamp;


    turn = drag.t0 - dx / PULL;
    paint();
  });

  function endDrag(e) {
    if (!drag) return;
    const g = drag;
    drag = null;
    held = false;
    stage.classList.remove("dragging");
    if (e && e.pointerId != null) {
      try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (g.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      // where it would come to rest if it kept going, capped so a hard flick can't spin out
      const carry = clamp((-g.vx * TOSS) / PULL, -MOST, MOST);
      glide(Math.round(turn + carry));
    }
    scheduleResume();
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  // arrow keys, if the stage is focusable (tabindex="0" in the HTML)
  stage.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? -1 : e.key === "ArrowLeft" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    pauseIdle();
    glide(Math.round(turn) + d);
    scheduleResume();
  });

  paint();
  startIdle();
})();


// fade-up on scroll
const fadeUpObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    el.style.animationPlayState = 'running';
    fadeUpObserver.unobserve(el);
    el.addEventListener('animationend', () => {
      el.classList.remove('fade-up', 'delay-1', 'delay-2', 'delay-3', 'delay-4');
      el.style.animationPlayState = '';
      el.style.willChange = 'auto';
    }, { once: true });
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach((el) => {
  el.style.animationPlayState = 'paused';
  fadeUpObserver.observe(el);
});

//logo interaction//
const logoBox = document.getElementById("logo");
if (logoBox) {
  AsciiWake(logoBox, {
    src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA4MCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQxLjg5NjkgMTguMDY2NUM0MS45Mzc5IDE2LjM3OTkgNDEuNjY3NSAxNC43MDAyIDQxLjA5OTIgMTMuMTExN0M0MC42MzM3IDExLjgxOTYgMzkuODg5NSAxMC42NDU5IDM4LjkxOTUgOS42NzM2NkMzOC4wMTE0IDguNzg2MiAzNi45MjMyIDguMTA0MTggMzUuNzI4NyA3LjY3Mzc3QzM0LjUwMTYgNy4yNDIzIDMzLjIwOTMgNy4wMjU2NSAzMS45MDg2IDcuMDMzMzVDMjkuOTk0MyA2Ljk4NzU1IDI4LjEwNTcgNy40ODIwOCAyNi40NTk1IDguNDYwMjRDMjQuOTA4MSA5LjQyNjQzIDIzLjY1ODYgMTAuODA4MiAyMi44NTI5IDEyLjQ0ODhDMjEuOTY2NSAxNC4yOTQzIDIxLjUyNzYgMTYuMzIyOSAyMS41NzIxIDE4LjM2OThDMjEuNTIyNyAyMC40MjgxIDIxLjk2MTcgMjIuNDY4NyAyMi44NTI5IDI0LjMyNDZDMjMuNjU5MSAyNS45NTkzIDI0LjkzNDMgMjcuMzE2NyAyNi41MTU3IDI4LjIyMzNDMjguMjM2NiAyOS4xNjI1IDMwLjE3MzMgMjkuNjM1IDMyLjEzMzQgMjkuNTk0QzMzLjY2NjUgMjkuNjE2NiAzNS4xOTA1IDI5LjM1MzcgMzYuNjI3NSAyOC44MTg3QzM3Ljg2NzcgMjguMzU1MSAzOC45ODA0IDI3LjYwNDMgMzkuODc0NSAyNi42Mjc4QzQwLjczNDMgMjUuNjczNyA0MS4zMzA2IDI0LjUxMiA0MS42MDQ4IDIzLjI1NzJMMzYuNzk2IDIyLjcxNzlDMzYuNTg5MSAyMy4zMDg4IDM2LjI0MjIgMjMuODQwOCAzNS43ODQ4IDI0LjI2ODRDMzUuMzMzNCAyNC42OTEgMzQuNzk3MiAyNS4wMTI3IDM0LjIxMTkgMjUuMjEyMkMzMy41NTg2IDI1LjQ0MDEgMzIuODcwMSAyNS41NTA0IDMyLjE3ODMgMjUuNTM4QzMxLjE1NDEgMjUuNTY0OCAzMC4xNDE1IDI1LjMxNjUgMjkuMjQ1OSAyNC44MTg5QzI4LjQwMzcgMjQuMzMzOCAyNy43MjM1IDIzLjYxMDcgMjcuMjkwOSAyMi43NDA0QzI2LjgyMDUgMjEuNzYzNSAyNi41ODU3IDIwLjY4OTggMjYuNjA1NiAxOS42MDU3SDQxLjg5NjlWMTguMDY2NVpNMjYuNjk1NCAxNi4xNzg5QzI2LjczNzcgMTUuMzQ3MiAyNi45NiAxNC41MzQ1IDI3LjM0NzEgMTMuNzk3QzI3Ljc4NzQgMTIuOTg0OCAyOC40Mjk4IDEyLjI5OTggMjkuMjEyMiAxMS44MDg0QzMwLjA0MDkgMTEuMjg0MSAzMS4wMDY5IDExLjAxODEgMzEuOTg3MyAxMS4wNDQ0QzMyLjg5NjIgMTEuMDI4NSAzMy43OTI3IDExLjI1NzUgMzQuNTgyNyAxMS43MDczQzM1LjMxOTIgMTIuMTQ3NiAzNS45MjE0IDEyLjc4MDkgMzYuMzI0MSAxMy41Mzg2QzM2Ljc2MjEgMTQuMzUwMSAzNi45OTM3IDE1LjI1NjggMzYuOTk4MyAxNi4xNzg5SDI2LjY5NTRaIiBmaWxsPSIjMDAwMEZGIi8+CjxwYXRoIGQ9Ik00OS40ODA1IDBWMjkuMjEySDQ0LjMzNDdWMEg0OS40ODA1WiIgZmlsbD0iIzAwMDBGRiIvPgo8cGF0aCBkPSJNNTguNzk0NyAwVjI5LjIxMkg1My42NDg5VjBINTguNzk0N1oiIGZpbGw9IiMwMDAwRkYiLz4KPHBhdGggZD0iTTY4LjQ1NzQgMjkuNjA1MkM2Ny4xNzE5IDI5LjYyNDcgNjUuODk2OSAyOS4zNzIgNjQuNzE2IDI4Ljg2MzdDNjMuNjQyMiAyOC4zODcxIDYyLjczMiAyNy42MDU4IDYyLjA5ODIgMjYuNjE2NkM2MS40MjkzIDI1LjUzMTUgNjEuMDk3IDI0LjI3MjYgNjEuMTQzMiAyMi45OTg4QzYxLjEwMTMgMjEuOTM3OCA2MS4zMzc1IDIwLjg4NDMgNjEuODI4NSAxOS45NDI4QzYyLjI3MDggMTkuMTQ2OCA2Mi45MTM4IDE4LjQ4MDUgNjMuNjkzNiAxOC4wMTAzQzY0LjUxODIgMTcuNTAxMSA2NS40MTYzIDE3LjEyMjIgNjYuMzU2NCAxNi44ODY4QzY3LjM2NzQgMTYuNjI2OSA2OC4zOTY0IDE2LjQ0MjkgNjkuNDM0OSAxNi4zMzYyQzcwLjcxNTcgMTYuMjAxNCA3MS43NjA2IDE2LjA3NzggNzIuNTU4MyAxNS45NzY3QzczLjE2NzUgMTUuOTIyMyA3My43NTk2IDE1Ljc0NjYgNzQuMjk5OCAxNS40NTk5Qzc0LjQ4MjkgMTUuMzM4OSA3NC42Mjk3IDE1LjE3MDUgNzQuNzI0NyAxNC45NzI2Qzc0LjgxOTcgMTQuNzc0OCA3NC44NTkyIDE0LjU1NDkgNzQuODM5MSAxNC4zMzYzVjE0LjI0NjRDNzQuODY3MSAxMy43ODkzIDc0Ljc5NzUgMTMuMzMxNCA3NC42MzQ4IDEyLjkwMzJDNzQuNDcyIDEyLjQ3NTEgNzQuMjE5OSAxMi4wODY1IDczLjg5NTMgMTEuNzYzNEM3My4xMjM4IDExLjEyODYgNzIuMTM5NiAxMC44MTEzIDcxLjE0MjYgMTAuODc1OEM3MC4wODI0IDEwLjgxOTQgNjkuMDMyOCAxMS4xMTE0IDY4LjE1NCAxMS43MDcyQzY3LjQ2OTQgMTIuMTg3NiA2Ni45NDggMTIuODY1OCA2Ni42NTk3IDEzLjY1MUw2MS44NTEgMTIuOTY1NkM2Mi4xOTIxIDExLjcwNTggNjIuODM2MyAxMC41NDg3IDYzLjcyNzMgOS41OTVDNjQuNjI4IDguNjkwMDkgNjUuNzIzMSA4LjAwMjMxIDY2LjkyOTQgNy41ODM4N0M2OC4yNzc1IDcuMTIxMzQgNjkuNjk1IDYuODkzMzMgNzEuMTIwMiA2LjkwOTc1QzcyLjE3NiA2LjkxMDE3IDczLjIyODEgNy4wMzQ2MSA3NC4yNTQ4IDcuMjgwNTFDNzUuMjc0NCA3LjUxMTMyIDc2LjI0NDYgNy45MjIyNCA3Ny4xMTk5IDguNDkzOTNDNzcuOTkyNSA5LjA1NzU1IDc4LjcxMDcgOS44Mjk4OCA3OS4yMDk2IDEwLjc0MUM3OS43NjYzIDExLjg2NzYgODAuMDM2NCAxMy4xMTQxIDc5Ljk5NjEgMTQuMzdWMjkuMjEySDc1LjA0MTNWMjYuMTY3Mkg3NC44NzI4Qzc0LjUzNDEgMjYuODAzMiA3NC4wODk1IDI3LjM3NjkgNzMuNTU4MyAyNy44NjM3QzcyLjk0MzIgMjguNDI1NyA3Mi4yMjA5IDI4Ljg1NzYgNzEuNDM0OCAyOS4xMzMzQzcwLjQ3ODEgMjkuNDY1OSA2OS40NyAyOS42MjU3IDY4LjQ1NzQgMjkuNjA1MlpNNjkuNzk0NCAyNS44NDEzQzcwLjcyNzUgMjUuODY3MyA3MS42NTE4IDI1LjY1NDYgNzIuNDc5NyAyNS4yMjM0QzczLjIwNDUgMjQuODUwNCA3My44MTQzIDI0LjI4NzIgNzQuMjQzNiAyMy41OTQzQzc0LjY1MTMgMjIuOTE1OSA3NC44NjUgMjIuMTM4NiA3NC44NjE1IDIxLjM0NzJWMTguNzUxOEM3NC42MjIgMTguOTEzNCA3NC4zNTU3IDE5LjAzMTMgNzQuMDc1MSAxOS4xMDAxQzczLjY5MzEgMTkuMjEyNSA3My4yNTQ5IDE5LjMxMzYgNzIuNzgzIDE5LjQwMzVMNzEuMzc4NiAxOS42MjgyTDcwLjE2NTIgMTkuNzk2N0M2OS40NjE2IDE5Ljg4NjIgNjguNzcxMyAyMC4wNTk3IDY4LjEwOTEgMjAuMzEzNUM2Ny41NTEyIDIwLjUxMTEgNjcuMDU1MiAyMC44NTIxIDY2LjY3MSAyMS4zMDIzQzY2LjMwMSAyMS43NjIxIDY2LjExMyAyMi4zNDE5IDY2LjE0MjkgMjIuOTMxNEM2Ni4xMTk0IDIzLjM0NzMgNjYuMjAyIDIzLjc2MjQgNjYuMzgyOCAyNC4xMzc4QzY2LjU2MzUgMjQuNTEzMSA2Ni44MzY3IDI0LjgzNjQgNjcuMTc2NiAyNS4wNzczQzY3Ljk1MDUgMjUuNTkzNiA2OC44NjQyIDI1Ljg2MDMgNjkuNzk0NCAyNS44NDEzWiIgZmlsbD0iIzAwMDBGRiIvPgo8cGF0aCBkPSJNMTQuMDg5MiA3LjMxNDIzSDUuMDg5NjJIMFYxMi40MDM5VjI5LjE2N0g1LjA4OTYyVjEyLjQwMzlIMTQuMDg5MlY3LjMxNDIzWiIgZmlsbD0iIzAwMDBGRiIvPgo8cGF0aCBkPSJNMTkuMTc5IDEyLjQwMzlIMTQuMDg5NFYyOS4xNjdIMTkuMTc5VjEyLjQwMzlaIiBmaWxsPSIjMDAwMEZGIi8+Cjwvc3ZnPgo=", // logo embedded so it also works when index.html is opened by double-click
    glyphs: "Blocks",
    cell: 4,
    size: 4,
    reach: 60,
    trail: 1.5,
    pull: 40,
    squareScale: 0.4,
    padding: 0.04,
    color: "#707187",
    hoverColor: "#9696c1"
  });
}

//footer year//
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
