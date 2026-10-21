// Runs before the stylesheet so the first paint uses the saved or system theme.
(() => {
  const key = "cometworks-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const valid = value => ["system", "light", "dark"].includes(value);
  let preference = "system";
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) preference = saved;
  } catch { /* Storage can be unavailable in private or restricted contexts. */ }

  const apply = () => {
    const theme = preference === "system" ? (media.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    for (const input of document.querySelectorAll('input[name="theme"]')) {
      input.checked = input.value === preference;
    }
  };
  apply();
  media.addEventListener("change", () => { if (preference === "system") apply(); });
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue) ? event.newValue : "system";
      apply();
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    const control = document.querySelector(".theme-switch");
    control.hidden = false;
    control.addEventListener("change", event => {
      if (!valid(event.target.value)) return;
      preference = event.target.value;
      try { localStorage.setItem(key, preference); } catch { /* Keep the in-page choice. */ }
      apply();
    });
  });
})();
