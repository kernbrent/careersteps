(() => {
  const selector = document.querySelector('[data-concept-select]');
  selector?.addEventListener('change', () => {
    if (selector.value) window.location.assign(selector.value);
  });
})();
