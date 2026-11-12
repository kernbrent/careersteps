(() => {
  const selector = document.querySelector('[data-concept-select]');
  selector?.addEventListener('change', () => {
    if (selector.value) window.location.assign(selector.value);
  });
  const palette = document.querySelector('[data-palette-select]');
  if (palette) {
    const allowed = ['ocean', 'pine', 'ink'];
    const applyPalette = (value) => {
      const selected = allowed.includes(value) ? value : 'ocean';
      document.body.dataset.palette = selected;
      palette.value = selected;
    };
    try { applyPalette(sessionStorage.getItem('benzi-story-palette')); }
    catch { applyPalette('ocean'); }
    palette.addEventListener('change', () => {
      applyPalette(palette.value);
      try { sessionStorage.setItem('benzi-story-palette', palette.value); }
      catch { /* Color switching also works when browser storage is unavailable. */ }
    });
  }
})();
