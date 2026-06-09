const https = require('https');

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'PawcraftLauncher/1.0', ...headers },
      family: 4
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function checkForUpdate(currentVersion, githubRepo) {
  try {
    const data = await httpsGetJson(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
      { Accept: 'application/vnd.github+json' }
    );
    const latest = data.tag_name.replace(/^v/, '');
    const assets = (data.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size }));
    return { upToDate: latest === currentVersion, latestVersion: latest, currentVersion, assets };
  } catch {
    return { upToDate: true };
  }
}

module.exports = { checkForUpdate };
