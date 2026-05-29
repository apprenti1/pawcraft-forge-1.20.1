const fetch = require('node-fetch');

async function checkForUpdate(currentVersion, githubRepo) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
      { headers: { 'User-Agent': 'PawcraftLauncher/1.0', Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return { upToDate: true };
    const { tag_name } = await res.json();
    const latest = tag_name.replace(/^v/, '');
    return { upToDate: latest === currentVersion, latestVersion: latest, currentVersion };
  } catch {
    return { upToDate: true };
  }
}

module.exports = { checkForUpdate };
