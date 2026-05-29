const { spawn } = require('child_process');
const path  = require('path');
const fs    = require('fs-extra');
const fetch = require('node-fetch');

async function downloadExe(url, destPath, onProgress) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PawcraftLauncher/1.0' },
    follow: 5,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const total      = parseInt(res.headers.get('content-length') || '0', 10);
  let   downloaded = 0;

  await fs.ensureDir(path.dirname(destPath));
  const out = fs.createWriteStream(destPath);

  return new Promise((resolve, reject) => {
    res.body.on('data', (chunk) => {
      downloaded += chunk.length;
      out.write(chunk);
      if (total && onProgress) {
        onProgress('download', {
          label:   'Téléchargement du nouveau launcher…',
          percent: Math.round((downloaded / total) * 100),
        });
      }
    });
    res.body.on('end', () => { out.end(); resolve(); });
    res.body.on('error', reject);
    out.on('error', reject);
  });
}

function applyLauncherUpdate(tempExePath, currentExePath) {
  const batPath = path.join(path.dirname(tempExePath), 'pawcraft-update.bat');
  const bat = [
    '@echo off',
    'ping -n 3 127.0.0.1 > nul',
    `copy /y "${tempExePath}" "${currentExePath}"`,
    `start "" "${currentExePath}"`,
    'del "%~f0"',
  ].join('\r\n');
  fs.writeFileSync(batPath, bat, 'latin1');
  spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore' }).unref();
}

module.exports = { downloadExe, applyLauncherUpdate };
