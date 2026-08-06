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
