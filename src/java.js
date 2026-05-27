const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const { execSync } = require('child_process');
const extractZip = require('extract-zip');

const ADOPTIUM_URL =
  'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';

function checkJavaVersion(javaExe) {
  try {
    const out = execSync(`"${javaExe}" -version 2>&1`, { encoding: 'utf8' });
    const m = out.match(/version "(\d+)/);
    if (m) {
      const v = parseInt(m[1]);
      if (v >= 17 && v <= 21) return v;
    }
  } catch {}
  return null;
}

function findInstalledJava() {
  if (checkJavaVersion('java')) return 'java';

  const searchRoots = [
    'C:/Program Files/Java',
    'C:/Program Files/Eclipse Adoptium',
    'C:/Program Files/Microsoft',
    'C:/Program Files/BellSoft',
    'C:/Program Files/Zulu',
  ];

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      const javaExe = path.join(root, entry, 'bin', 'java.exe');
      if (fs.existsSync(javaExe) && checkJavaVersion(javaExe)) return javaExe;
    }
  }
  return null;
}

async function findOrDownloadJava(javaDir, onProgress) {
  // Check previously downloaded portable JRE
  if (fs.existsSync(javaDir)) {
    for (const entry of fs.readdirSync(javaDir)) {
      const javaExe = path.join(javaDir, entry, 'bin', 'java.exe');
      if (fs.existsSync(javaExe) && checkJavaVersion(javaExe)) return javaExe;
    }
  }

  // Check system-installed Java 17-21
  const systemJava = findInstalledJava();
  if (systemJava) return systemJava;

  // Download portable Java 21 JRE from Adoptium
  if (onProgress) onProgress('step', { label: 'Téléchargement de Java 21 (requis par Forge)…' });
  await fs.ensureDir(javaDir);
  const zipPath = path.join(javaDir, '_java21.zip');

  const res = await fetch(ADOPTIUM_URL, {
    headers: { 'User-Agent': 'PawcraftLauncher/1.0' },
    follow: 10,
  });
  if (!res.ok) throw new Error(`Impossible de télécharger Java 21 (HTTP ${res.status})`);

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  let downloaded = 0;
  const out = fs.createWriteStream(zipPath);

  await new Promise((resolve, reject) => {
    res.body.on('data', (chunk) => {
      downloaded += chunk.length;
      out.write(chunk);
      if (total && onProgress) {
        onProgress('download', { label: 'Java 21', percent: Math.round((downloaded / total) * 100) });
      }
    });
    res.body.on('end',   () => { out.end(); resolve(); });
    res.body.on('error', reject);
    out.on('error', reject);
  });

  if (onProgress) onProgress('step', { label: 'Extraction de Java 21…' });
  await extractZip(zipPath, { dir: path.resolve(javaDir) });
  fs.removeSync(zipPath);

  for (const entry of fs.readdirSync(javaDir)) {
    const javaExe = path.join(javaDir, entry, 'bin', 'java.exe');
    if (fs.existsSync(javaExe)) return javaExe;
  }

  throw new Error("Java 21 téléchargé mais java.exe introuvable dans l'archive");
}

module.exports = { findOrDownloadJava };
