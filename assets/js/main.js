const yearElements = document.querySelectorAll("[data-current-year]");
const navToggle = document.querySelector("[data-nav-toggle]");
const siteNav = document.querySelector("[data-site-nav]");

yearElements.forEach((element) => {
  element.textContent = new Date().getFullYear();
});

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const footerBottom = document.querySelector(".site-footer .footer-bottom");
if (footerBottom && !footerBottom.querySelector(".developer-credit")) {
  const credit = document.createElement("div");
  credit.className = "developer-credit";
  credit.innerHTML = `
    <img src="/assets/images/career-steps-logo.png" alt="" width="28" height="28">
    <span>Designed, developed, and maintained by Career Steps Consulting LLC.</span>
  `;
  footerBottom.appendChild(credit);
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  document.documentElement.classList.add("motion-enabled");

  const pageHero = document.querySelector(".atlas-hero, .page-hero");
  pageHero?.classList.add("hero-animate");

  const revealSelector = [
    ".atlas-service",
    ".section-heading",
    ".card",
    ".service-group",
    ".feature-mark",
    ".feature > :not(.feature-mark)",
    ".work-feature",
    ".trip-panel > :first-child",
    ".trip-detail",
    ".process-step",
    ".service-layout > :first-child",
    ".service-content > *",
    ".case-header",
    ".case-block",
    ".about-grid > *",
    ".contact-grid > *",
    ".calendar-shell",
    ".calendar-fallback",
    ".cta-inner > *",
    ".footer-grid > *",
  ].join(", ");

  const staggerSelector = [
    ".atlas-service-route",
    ".card-grid",
    ".service-groups",
    ".trip-details",
    ".process",
    ".case-grid",
    ".service-content",
    ".footer-grid",
  ].join(", ");

  const liftSelector = [
    ".atlas-service",
    ".card",
    ".service-group",
    ".trip-detail",
    ".process-step",
    ".case-block",
    ".quote-card",
    ".contact-card",
    ".work-feature",
  ].join(", ");

  const flashSelector = [
    liftSelector,
    ".service-content > *",
  ].join(", ");

  document.querySelectorAll(staggerSelector).forEach((group) => {
    [...group.children].forEach((item, index) => {
      item.style.setProperty("--reveal-delay", `${Math.min(index * 90, 450)}ms`);
    });
  });

  document.querySelectorAll(liftSelector).forEach((item) => {
    item.classList.add("motion-lift");
  });

  document.querySelectorAll(flashSelector).forEach((item) => {
    item.classList.add("motion-flash");
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.1 });

    document.querySelectorAll(revealSelector).forEach((item) => {
      item.classList.add("reveal-item");
      revealObserver.observe(item);
    });
  } else {
    document.querySelectorAll(revealSelector).forEach((item) => {
      item.classList.add("reveal-item", "is-visible");
    });
  }
}
