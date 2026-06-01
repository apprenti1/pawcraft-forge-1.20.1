export function loadPages() {
  const pages = ['home', 'settings', 'wiki', 'console'];
  for (const page of pages) {
    const html = window.launcher.readPageHTML(page);
    document.getElementById(`page-${page}`).innerHTML = html;
  }
}
