const STORAGE_KEY = 'pawcraft-theme';

export function initTheme() {
  const saved     = localStorage.getItem(STORAGE_KEY);
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || preferred);
}

export function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-theme-dark') ?.classList.toggle('active', theme === 'dark');
  document.getElementById('btn-theme-light')?.classList.toggle('active', theme === 'light');
}
