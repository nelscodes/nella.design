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
    { src: "./images/12apostles.webp", caption: "From my university days in Melbourne" },
    { src: "./images/kashihara-sakura.webp", caption: "Did a 3-month stint in countryside Japan" },
    { src: "./images/runningviews.webp", caption: "Love running during sunsets" },

  ];

  const CARD_W = 208;
  const N = PHOTOS.length;
  const ANGLE_STEP = 360 / N; // one "step" of the rotation state per card
  const SPACING = 90; // px each neighboring card sits from the front (front can overlap it)
  const TILT_DEG = 45; // tilt angle for side cards
  const Z_PUSH = 40; // how far back side cards sit
  const VISIBLE_WINDOW_STEPS = 1.2; // cards beyond this many steps away fade out entirely
  const DRAG_SENSITIVITY = 0.35; // degrees per pixel
  const IDLE_INTERVAL_MS = 3000; // how often it auto-advances
  const RESUME_DELAY_MS = 1500; // pause after interaction before auto-advance resumes

  function wrapOffset(raw, n) {
    let r = ((raw % n) + n) % n;
    if (r > n / 2) r -= n;
    return r;
  }

  const stage = document.getElementById("galleryStage");
  const ring = document.getElementById("galleryRing");
  const captionIndexEl = document.getElementById("galleryCaptionIndex");
  const captionTextEl = document.getElementById("galleryCaptionText");

  // Build the card elements once.
  const cardEls = PHOTOS.map((photo, i) => {
    const el = document.createElement("div");
    el.className = "gallery-card";
    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.caption;
    img.draggable = false;
    el.appendChild(img);
    el.addEventListener("click", () => goTo(i));
    ring.appendChild(el);
    return el;
  });

  let rotation = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let idleTimer = null;
  let resumeTimer = null;

  function render() {
    const currentPosition = rotation / ANGLE_STEP;
    let activeIndex = 0;
    let bestDiff = Infinity;

    cardEls.forEach((el, i) => {
      const offset = wrapOffset(i - currentPosition, N);
      const absOffset = Math.abs(offset);
      const x = offset * SPACING;
      const z = -absOffset * Z_PUSH;
      const tilt = offset * TILT_DEG;
      const scale = Math.max(0.6, 1 - Math.min(absOffset, 1) * 0.22);
      const frontness = Math.max(0, 1 - absOffset / VISIBLE_WINDOW_STEPS);
      const opacity = absOffset < 0.5 ? 1 : frontness > 0 ? 0.9 : 0;

      el.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${-tilt}deg) scale(${scale})`;
      el.style.opacity = opacity;
      el.style.pointerEvents = frontness > 0 ? "auto" : "none";
      el.style.zIndex = String(Math.round((1 - absOffset) * 100));

      if (absOffset < bestDiff) {
        bestDiff = absOffset;
        activeIndex = i;
      }
    });

    captionIndexEl.textContent = String(activeIndex + 1).padStart(2, "0");
    captionTextEl.textContent = PHOTOS[activeIndex].caption;
  }

  function setAnimated(animated) {
    cardEls.forEach((el) => el.classList.toggle("no-transition", !animated));
  }

  function startIdle() {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      setAnimated(true);
      rotation += ANGLE_STEP;
      render();
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

  function goTo(index) {
    pauseIdle();
    const targetBase = index * ANGLE_STEP;
    const currentMod = ((rotation % 360) + 360) % 360;
    const targetMod = ((targetBase % 360) + 360) % 360;
    let diff = targetMod - currentMod;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    rotation += diff;
    setAnimated(true);
    render();
    scheduleResume();
  }

  stage.addEventListener("pointerdown", (e) => {
    pauseIdle();
    setAnimated(false);
    dragging = true;
    dragStartX = e.clientX;
    dragStartRotation = rotation;
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const delta = e.clientX - dragStartX;
    rotation = dragStartRotation + delta * DRAG_SENSITIVITY;
    render();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("dragging");
    if (e.pointerId != null) stage.releasePointerCapture(e.pointerId);
    // snap to the nearest card
    rotation = Math.round(rotation / ANGLE_STEP) * ANGLE_STEP;
    setAnimated(true);
    render();
    scheduleResume();
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointerleave", endDrag);

  render();
  startIdle();
})();


//footer year//
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
