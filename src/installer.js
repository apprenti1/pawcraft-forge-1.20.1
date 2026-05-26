const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const { spawn, execSync } = require('child_process');
const { MODS, MC_VERSION, FORGE_VERSION } = require('./modlist');

const FORGE_INSTALLER_URL =
  `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_VERSION}/forge-${FORGE_VERSION}-installer.jar`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downloadFile(url, destPath, onProgress, label) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PawcraftLauncher/1.0' },
    follow: 5,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  let downloaded = 0;

  await fs.ensureDir(path.dirname(destPath));
  const out = fs.createWriteStream(destPath);

  return new Promise((resolve, reject) => {
    res.body.on('data', (chunk) => {
      downloaded += chunk.length;
      out.write(chunk);
      if (total && onProgress) {
        onProgress('download', { label, percent: Math.round((downloaded / total) * 100) });
      }
    });
    res.body.on('end', () => { out.end(); resolve(); });
    res.body.on('error', reject);
    out.on('error', reject);
  });
}

// ── Java ──────────────────────────────────────────────────────────────────────

function findJava() {
  // 1. Check system Java (PATH)
  try {
    const out = execSync('java -version 2>&1', { encoding: 'utf8' });
    const m = out.match(/version "(\d+)/);
    if (m && parseInt(m[1]) >= 17) return 'java';
  } catch {}

  // 2. Common Windows install paths (Java 17)
  const candidates = [
    'C:/Program Files/Java/jre-17/bin/java.exe',
    'C:/Program Files/Java/jdk-17/bin/java.exe',
    'C:/Program Files/Eclipse Adoptium/jre-17.0.9.9-hotspot/bin/java.exe',
    'C:/Program Files/Microsoft/jdk-17.0.9.8-hotspot/bin/java.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    'Java 17+ introuvable. Installez-le depuis https://adoptium.net/ puis relancez le launcher.'
  );
}

// ── Forge installation ────────────────────────────────────────────────────────

async function installForge(gameDir, onProgress) {
  onProgress('step', { label: 'Recherche de Java 17+...' });
  const javaPath = findJava();

  onProgress('step', { label: 'Téléchargement de Forge...' });
  const installerPath = path.join(gameDir, '_forge-installer.jar');
  await downloadFile(FORGE_INSTALLER_URL, installerPath, onProgress, 'Forge installer');

  onProgress('step', { label: 'Installation de Forge (peut prendre 1-2 min)...' });

  await new Promise((resolve, reject) => {
    const proc = spawn(
      javaPath,
      ['-jar', installerPath, '--installClient', gameDir],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    proc.stdout.on('data', (d) =>
      onProgress('log', { text: d.toString().trim() })
    );
    proc.stderr.on('data', (d) =>
      onProgress('log', { text: d.toString().trim() })
    );
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Forge installer a échoué (code ${code})`));
    });
    proc.on('error', reject);
  });

  try { fs.removeSync(installerPath); } catch {}
}

// ── Mod resolution ────────────────────────────────────────────────────────────

async function resolveCurseForge(projectId, apiKey) {
  if (!apiKey) throw new Error('Clé API CurseForge manquante (configurez-la dans les paramètres)');

  const url =
    `https://api.curseforge.com/v1/mods/${projectId}/files` +
    `?gameVersion=${MC_VERSION}&modLoaderType=1&pageSize=5&sortField=5&sortOrder=desc`;

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CurseForge API: HTTP ${res.status} (projet ${projectId})`);

  const { data } = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`Aucun fichier trouvé sur CurseForge pour le projet ${projectId} (MC ${MC_VERSION} / Forge)`);
  }

  const file = data[0];
  if (!file.downloadUrl) {
    // CurseForge redacts some URLs — build it from the numeric file ID
    const id = file.id;
    const name = file.fileName;
    const a = Math.floor(id / 1000);
    const b = id % 1000;
    return {
      url: `https://mediafilez.forgecdn.net/files/${a}/${b}/${name}`,
      filename: name,
    };
  }
  return { url: file.downloadUrl, filename: file.fileName };
}

async function resolveModrinth(projectId) {
  const url =
    `https://api.modrinth.com/v2/project/${projectId}/version` +
    `?game_versions=["${MC_VERSION}"]&loaders=["forge"]`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PawcraftLauncher/1.0 (contact@pawcraft.local)' },
  });
  if (!res.ok) throw new Error(`Modrinth API: HTTP ${res.status} (projet ${projectId})`);

  const versions = await res.json();
  if (!versions || versions.length === 0) {
    throw new Error(`Aucune version trouvée sur Modrinth pour ${projectId} (MC ${MC_VERSION} / Forge)`);
  }

  const version = versions[0];
  const primary = version.files.find((f) => f.primary) || version.files[0];
  return { url: primary.url, filename: primary.filename };
}

// ── Mod download ──────────────────────────────────────────────────────────────

async function downloadMods(gameDir, apiKey, onProgress) {
  const modsDir = path.join(gameDir, 'mods');
  await fs.ensureDir(modsDir);

  // Wipe existing mods before reinstall
  for (const f of fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'))) {
    fs.removeSync(path.join(modsDir, f));
  }

  const total = MODS.length;
  for (let i = 0; i < total; i++) {
    const mod = MODS[i];
    onProgress('mod', {
      label: `Téléchargement de ${mod.name}... (${i + 1}/${total})`,
      percent: Math.round(((i + 1) / total) * 100),
    });

    try {
      const dl =
        mod.source === 'curseforge'
          ? await resolveCurseForge(mod.projectId, apiKey)
          : await resolveModrinth(mod.projectId);

      await downloadFile(dl.url, path.join(modsDir, dl.filename), null, mod.name);
    } catch (err) {
      onProgress('warn', { label: `⚠ ${mod.name}: ${err.message}` });
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function checkInstallation(gameDir) {
  const forgeDir = path.join(gameDir, 'versions', FORGE_VERSION);
  const modsDir  = path.join(gameDir, 'mods');

  const hasForge = fs.existsSync(forgeDir);
  const modCount = fs.existsSync(modsDir)
    ? fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).length
    : 0;
  const hasMods = modCount > 0;

  return { hasForge, hasMods, modCount, ready: hasForge && hasMods };
}

async function installAll(gameDir, apiKey, onProgress) {
  await fs.ensureDir(gameDir);
  const state = await checkInstallation(gameDir);

  if (!state.hasForge) {
    await installForge(gameDir, onProgress);
  }

  if (!state.hasMods) {
    onProgress('step', { label: 'Téléchargement des mods...' });
    await downloadMods(gameDir, apiKey, onProgress);
  }

  onProgress('done', { label: '✓ Installation terminée !' });
}

module.exports = { checkInstallation, installAll };
