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

//footer year//
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
