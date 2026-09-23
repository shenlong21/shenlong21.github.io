const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Dateline & year
const today = new Date();
const dateline = document.getElementById("dateline");
dateline.textContent = today.toLocaleDateString("en-GB", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});
dateline.dateTime = today.toISOString().slice(0, 10);
document.getElementById("year").textContent = today.getFullYear();

// Editions: same paper, different lead story and page order
const standardOrder = ["front", "career", "engineering", "security", "ai", "workshop", "opinion", "classifieds", "letters"];
const editions = {
  morning: standardOrder,
  security: ["front", "security", "career", "engineering", "ai", "workshop", "opinion", "classifieds", "letters"],
  night: standardOrder,
};

const edition = document.querySelector(".edition");
const nav = document.querySelector(".sections");
const editionButtons = [...document.querySelectorAll(".editions button")];
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyEdition(name) {
  root.dataset.edition = name;
  editions[name].forEach((id, index) => {
    const section = document.getElementById(id);
    edition.append(section);
    nav.append(nav.querySelector(`a[href="#${id}"]`));
    const page = section.querySelector(".section-head__page");
    if (page) page.textContent = `Page ${index + 1}`;
  });
  document.querySelectorAll(".js-page-of").forEach((span) => {
    span.textContent = `page ${editions[name].indexOf(span.dataset.target) + 1}`;
  });
  editionButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.edition === name)));
  themeColor.content = getComputedStyle(root).getPropertyValue("--paper").trim();
  document.dispatchEvent(new CustomEvent("editionchange", { detail: name }));
}

async function switchEdition(name) {
  if (name === root.dataset.edition) return;
  try { localStorage.setItem("edition", name); } catch {}
  const url = new URL(location.href);
  url.searchParams.set("edition", name);
  history.replaceState(null, "", url);

  const roll = document.querySelector(".press-roll");
  if (reducedMotion || !roll.animate) return applyEdition(name);
  // Reprint: ink rolls down over the page, the new edition is set, and the ink lifts
  roll.style.animation = "none";
  roll.getAnimations().forEach((a) => a.cancel());
  const easing = "cubic-bezier(.7, 0, .3, 1)";
  await roll.animate([{ transform: "scaleY(0)", transformOrigin: "top" }, { transform: "scaleY(1)", transformOrigin: "top" }],
    { duration: 380, easing, fill: "forwards" }).finished;
  applyEdition(name);
  await roll.animate([{ transform: "scaleY(1)", transformOrigin: "bottom" }, { transform: "scaleY(0)", transformOrigin: "bottom" }],
    { duration: 480, easing, fill: "forwards" }).finished;
}

editionButtons.forEach((b) => b.addEventListener("click", () => switchEdition(b.dataset.edition)));
applyEdition(root.dataset.edition);

// Highlight the current section in the nav
const navLinks = [...nav.querySelectorAll("a")];
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    navLinks.forEach((a) => {
      const active = a.hash === `#${entry.target.id}`;
      a.classList.toggle("is-active", active);
      // On narrow screens the nav scrolls sideways; keep the active link in view
      if (active && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: reducedMotion ? "auto" : "smooth" });
      }
    });
  }
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("section[id]").forEach((s) => spy.observe(s));

// Draw the career line as the reader scrolls through it
const timeline = document.querySelector(".timeline");
function drawTimeline() {
  const rect = timeline.getBoundingClientRect();
  const progress = (window.innerHeight * 0.6 - rect.top) / rect.height;
  timeline.style.setProperty("--progress", Math.min(Math.max(progress, 0), 1));
}
window.addEventListener("scroll", () => requestAnimationFrame(drawTimeline), { passive: true });
drawTimeline();

// The 3D portrait is an enhancement: skip it for reduced motion, data saver, or no WebGL
const saveData = navigator.connection?.saveData;
const hasWebGL = !!document.createElement("canvas").getContext("webgl2");
if (!reducedMotion && !saveData && hasWebGL) {
  import("./avatar.js").catch(() => { /* the printed portrait stays in place */ });
}
