const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════════════════
// HTTPS HELPER AVEC IPv4
// ═══════════════════════════════════════════════════════════

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: { 'User-Agent': 'PawcraftLauncher/1.0' },
      family: 4,
      ...options
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(httpsGet(res.headers.location, options));
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ═══════════════════════════════════════════════════════════
// TÉLÉCHARGEMENT MISE À JOUR
// ═══════════════════════════════════════════════════════════

async function downloadUpdate(url, destPath, onProgress) {
  const res = await httpsGet(url);
  if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);

  const total = parseInt(res.headers['content-length'] || '0', 10);
  let downloaded = 0;

  await fs.ensureDir(path.dirname(destPath));
  const out = fs.createWriteStream(destPath);

  return new Promise((resolve, reject) => {
    res.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total && onProgress) {
        onProgress('download', {
          label: 'Téléchargement nouvelle version...',
          percent: Math.round((downloaded / total) * 100),
        });
      }
    });
    res.pipe(out);
    res.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
  });
}

// ═══════════════════════════════════════════════════════════
// EXTENSION SELON PLATEFORME
// ═══════════════════════════════════════════════════════════

function getUpdateAssetSuffix() {
  switch (process.platform) {
    case 'win32': return '.exe';
    case 'darwin': return process.arch === 'arm64' ? '-arm64.dmg' : '.dmg';
    case 'linux': return '.AppImage';
    default: return null;
  }
}

function getTempExtension() {
  switch (process.platform) {
    case 'win32': return '.exe';
    case 'darwin': return '.dmg';
    case 'linux': return '.AppImage';
    default: return '';
  }
}

// ═══════════════════════════════════════════════════════════
// APPLICATION MISE À JOUR - WINDOWS
// ═══════════════════════════════════════════════════════════

function applyUpdateWindows(tempPath, currentExePath, scriptDir) {
  const ps1Path = path.join(scriptDir, 'launcher-updater.ps1');
  const script = `
Start-Sleep -Seconds 2
try {
  Copy-Item -Path "${tempPath.replace(/\\/g, '\\\\')}" -Destination "${currentExePath.replace(/\\/g, '\\\\')}" -Force
  Start-Process -FilePath "${currentExePath.replace(/\\/g, '\\\\')}"
} catch {
  Write-Host "Update failed: $_"
}
Remove-Item -Path $MyInvocation.MyCommand.Path -Force
`;
  fs.writeFileSync(ps1Path, script, 'utf8');

  spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-NoProfile',
    '-WindowStyle', 'Hidden',
    '-File', ps1Path
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();
}

// ═══════════════════════════════════════════════════════════
// APPLICATION MISE À JOUR - macOS
// ═══════════════════════════════════════════════════════════

function applyUpdateMacOS(tempPath, currentExePath, scriptDir) {
  const shPath = path.join(scriptDir, 'launcher-updater.sh');

  // Trouver le .app bundle
  const appBundleMatch = currentExePath.match(/^(.+\.app)/);
  const appPath = appBundleMatch ? appBundleMatch[1] : null;

  const script = `#!/bin/bash
sleep 2

# Fermer les processus
pkill -f "Pawcraft Launcher" 2>/dev/null || true

if [[ "${tempPath}" == *.dmg ]]; then
  # Monter le DMG
  MOUNT_POINT=$(hdiutil attach "${tempPath}" -nobrowse -noautoopen | grep "/Volumes" | awk '{print $NF}')
  if [[ -n "$MOUNT_POINT" ]]; then
    APP_IN_DMG=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)
    if [[ -n "$APP_IN_DMG" && -n "${appPath}" ]]; then
      rm -rf "${appPath}"
      cp -R "$APP_IN_DMG" "${appPath}"
      xattr -cr "${appPath}"
    fi
    hdiutil detach "$MOUNT_POINT" -quiet
  fi
  rm -f "${tempPath}"
  open "${appPath}"
else
  # Fichier direct
  cp -f "${tempPath}" "${currentExePath}"
  chmod +x "${currentExePath}"
  rm -f "${tempPath}"
  "${currentExePath}" &
fi

rm -f "$0"
`;

  fs.writeFileSync(shPath, script, { mode: 0o755 });
  spawn('/bin/bash', [shPath], { detached: true, stdio: 'ignore' }).unref();
}

// ═══════════════════════════════════════════════════════════
// APPLICATION MISE À JOUR - LINUX
// ═══════════════════════════════════════════════════════════

function applyUpdateLinux(tempPath, currentExePath, scriptDir) {
  const shPath = path.join(scriptDir, 'launcher-updater.sh');
  const script = `#!/bin/bash
sleep 2

# Fermer les processus
pkill -f "pawcraft" 2>/dev/null || true

# Copier la nouvelle version
cp -f "${tempPath}" "${currentExePath}"
chmod +x "${currentExePath}"
rm -f "${tempPath}"

# Relancer
"${currentExePath}" &

rm -f "$0"
`;

  fs.writeFileSync(shPath, script, { mode: 0o755 });
  spawn('/bin/bash', [shPath], { detached: true, stdio: 'ignore' }).unref();
}

// ═══════════════════════════════════════════════════════════
// DISPATCHER PRINCIPAL
// ═══════════════════════════════════════════════════════════

function applyLauncherUpdate(tempPath, currentExePath, scriptDir) {
  switch (process.platform) {
    case 'win32':
      return applyUpdateWindows(tempPath, currentExePath, scriptDir);
    case 'darwin':
      return applyUpdateMacOS(tempPath, currentExePath, scriptDir);
    case 'linux':
      return applyUpdateLinux(tempPath, currentExePath, scriptDir);
    default:
      throw new Error(`Plateforme non supportée: ${process.platform}`);
  }
}

module.exports = {
  downloadUpdate,
  applyLauncherUpdate,
  getUpdateAssetSuffix,
  getTempExtension
};
