const fetch = require('node-fetch');

async function checkForUpdate(currentVersion, githubRepo) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
      { headers: { 'User-Agent': 'PawcraftLauncher/1.0', Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return { upToDate: true };
    const data   = await res.json();
    const latest = data.tag_name.replace(/^v/, '');
    const assets = (data.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size }));
    return { upToDate: latest === currentVersion, latestVersion: latest, currentVersion, assets };
  } catch {
    return { upToDate: true };
  }
}

module.exports = { checkForUpdate };
