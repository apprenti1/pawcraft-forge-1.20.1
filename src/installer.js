const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const { spawn, execSync } = require('child_process');
const { MODS, SHADERS, RESOURCEPACKS, MC_VERSION, FORGE_VERSION, MODPACK_VERSION } = require('./modlist');
const { findOrDownloadJava } = require('./java');

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

// ── Forge installation ────────────────────────────────────────────────────────

async function installForge(gameDir, onProgress) {
  onProgress('step', { label: 'Recherche de Java 17–21…' });
  const javaDir = path.join(gameDir, '..', 'java');
  const javaPath = await findOrDownloadJava(javaDir, onProgress);

  onProgress('step', { label: 'Téléchargement de Forge...' });
  const installerPath = path.join(gameDir, '_forge-installer.jar');
  await downloadFile(FORGE_INSTALLER_URL, installerPath, onProgress, 'Forge installer');

  onProgress('step', { label: 'Installation de Forge (peut prendre 1-2 min)...' });

  // Forge installer requires launcher_profiles.json to exist
  const profilesPath = path.join(gameDir, 'launcher_profiles.json');
  if (!fs.existsSync(profilesPath)) {
    await fs.writeJson(profilesPath, { profiles: {}, selectedProfile: '(Default)', authenticationDatabase: {} });
  }

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

async function resolveCurseForge(projectId, apiKey, fileId) {
  if (!apiKey) throw new Error('Clé API CurseForge manquante (configurez-la dans les paramètres)');

  const url = fileId
    ? `https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}`
    : `https://api.curseforge.com/v1/mods/${projectId}/files` +
      `?gameVersion=${MC_VERSION}&modLoaderType=1&pageSize=5&sortField=5&sortOrder=desc`;

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CurseForge API: HTTP ${res.status} (projet ${projectId})`);

  const json = await res.json();
  const file = fileId ? json.data : (json.data?.[0]);
  if (!file) {
    throw new Error(`Aucun fichier trouvé sur CurseForge pour le projet ${projectId} (MC ${MC_VERSION} / Forge)`);
  }

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
    `?game_versions=${encodeURIComponent(JSON.stringify([MC_VERSION]))}` +
    `&loaders=${encodeURIComponent(JSON.stringify(['forge']))}` ;

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
          ? await resolveCurseForge(mod.projectId, apiKey, mod.fileId)
          : await resolveModrinth(mod.projectId);

      await downloadFile(dl.url, path.join(modsDir, dl.filename), null, mod.name);
    } catch (err) {
      onProgress('warn', { label: `⚠ ${mod.name}: ${err.message}` });
    }
  }
}

// ── Shaders & resource packs ──────────────────────────────────────────────────

async function resolveModrinthAsset(projectId, gameVersion = null, fileMatch = null) {
  let url = `https://api.modrinth.com/v2/project/${projectId}/version`;
  if (gameVersion) url += `?game_versions=${encodeURIComponent(JSON.stringify([gameVersion]))}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PawcraftLauncher/1.0' } });
  if (!res.ok) throw new Error(`Modrinth: HTTP ${res.status} (${projectId})`);
  const versions = await res.json();
  if (!versions || versions.length === 0) throw new Error(`Aucune version trouvée pour ${projectId} (MC ${gameVersion || 'any'})`);
  const files = versions[0].files;
  const picked = fileMatch
    ? (files.find((f) => f.filename.toLowerCase().includes(fileMatch)) || files[0])
    : (files.find((f) => f.primary) || files[0]);
  return { url: picked.url, filename: picked.filename };
}

async function downloadShaders(gameDir, onProgress, force = false) {
  const dir = path.join(gameDir, 'shaderpacks');
  await fs.ensureDir(dir);
  for (const shader of SHADERS) {
    const existing = fs.readdirSync(dir).find((f) => f.includes('Complementary'));
    if (existing && !force) {
      configureShader(gameDir, existing);
      continue;
    }
    if (existing && force) fs.removeSync(path.join(dir, existing));
    onProgress('step', { label: `Téléchargement du shader ${shader.name}…` });
    try {
      const dl = await resolveModrinthAsset(shader.projectId);
      await downloadFile(dl.url, path.join(dir, dl.filename), onProgress, shader.name);
      configureShader(gameDir, dl.filename);
    } catch (err) {
      onProgress('warn', { label: `⚠ Shader ${shader.name}: ${err.message}` });
    }
  }
}

async function downloadResourcePacks(gameDir, onProgress, force = false) {
  const dir = path.join(gameDir, 'resourcepacks');
  await fs.ensureDir(dir);
  const active = [];
  for (const pack of RESOURCEPACKS) {
    // Local pack bundled in assets/
    if (pack.source === 'local') {
      const destPath = path.join(dir, pack.keyword);
      const srcPath  = path.join(__dirname, '..', 'assets', pack.keyword);
      if (fs.existsSync(srcPath)) {
        if (!fs.existsSync(destPath) || force) {
          if (fs.existsSync(destPath)) fs.removeSync(destPath);
          await fs.copy(srcPath, destPath);
        }
        active.push(pack.keyword);
      }
      continue;
    }

    const keyword  = (pack.fileMatch || pack.projectId.split('-')[0]).toLowerCase();
    const existing = fs.readdirSync(dir).find((f) => f.toLowerCase().includes(keyword));
    if (existing && !force) {
      active.push(existing);
      continue;
    }
    if (existing && force) fs.removeSync(path.join(dir, existing));
    onProgress('step', { label: `Téléchargement du resource pack ${pack.name}…` });
    try {
      const dl = await resolveModrinthAsset(pack.projectId, MC_VERSION, pack.fileMatch || null);
      await downloadFile(dl.url, path.join(dir, dl.filename), onProgress, pack.name);
      active.push(dl.filename);
    } catch (err) {
      onProgress('warn', { label: `⚠ Resource pack ${pack.name}: ${err.message}` });
    }
  }
  if (active.length) configureResourcePacks(gameDir, active);
}

function configureShader(gameDir, filename) {
  const configDir  = path.join(gameDir, 'config');
  const oculusProps = path.join(configDir, 'oculus.properties');
  fs.ensureDirSync(configDir);
  let content = '';
  if (fs.existsSync(oculusProps)) {
    content = fs.readFileSync(oculusProps, 'utf8');
    content = content.replace(/^shaderPack=.*/m, `shaderPack=${filename}`);
    if (!/^shaderPack=/m.test(content)) content += `\nshaderPack=${filename}`;
    content = content.replace(/^enableShaders=.*/m, 'enableShaders=true');
    if (!/^enableShaders=/m.test(content)) content += '\nenableShaders=true';
  } else {
    content = `shaderPack=${filename}\nenableShaders=true\n`;
  }
  fs.writeFileSync(oculusProps, content, 'utf8');
}

function configureResourcePacks(gameDir, filenames) {
  const optionsPath = path.join(gameDir, 'options.txt');
  const packEntries = filenames.map((f) => `file/${f}`);
  const base = ['vanilla', 'mod_resources'];
  // Virtual/built-in packs registered at runtime — always enable them
  const virtual = [
    'fabric', 'continuity:default', 'continuity:glass_pane_culling_fix',
    'high_contrast', 'mod/subtle_effects:resourcepacks/biome_color_water_particles',
  ];
  const fixed = new Set([...base, ...packEntries, ...virtual]);

  if (!fs.existsSync(optionsPath)) {
    const line = `resourcePacks:[${[...base, ...packEntries, ...virtual].map((p) => `"${p}"`).join(',')}]`;
    fs.writeFileSync(optionsPath, line + '\n', 'utf8');
    return;
  }

  let content = fs.readFileSync(optionsPath, 'utf8');
  const match = content.match(/^resourcePacks:\[(.*)\]/m);

  // Preserve any other mod-injected entries not already in our fixed list
  const preserved = match
    ? match[1].split(',')
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter((s) => s && !fixed.has(s))
    : [];

  const line = `resourcePacks:[${[...base, ...packEntries, ...virtual, ...preserved].map((p) => `"${p}"`).join(',')}]`;

  if (match) {
    content = content.replace(/^resourcePacks:.*/m, line);
  } else {
    content += '\n' + line;
  }
  fs.writeFileSync(optionsPath, content, 'utf8');
}

// ── Public API ────────────────────────────────────────────────────────────────

async function checkInstallation(gameDir) {
  const forgeProfileName = FORGE_VERSION.replace(`${MC_VERSION}-`, `${MC_VERSION}-forge-`);
  const forgeDir    = path.join(gameDir, 'versions', forgeProfileName);
  const modsDir     = path.join(gameDir, 'mods');
  const shadersDir  = path.join(gameDir, 'shaderpacks');
  const resourceDir = path.join(gameDir, 'resourcepacks');

  const hasForge = fs.existsSync(forgeDir);
  const modCount = fs.existsSync(modsDir)
    ? fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).length
    : 0;
  const hasMods    = modCount >= MODS.length;
  const hasShaders = fs.existsSync(shadersDir) &&
    fs.readdirSync(shadersDir).some((f) => f.includes('Complementary'));
  const packKeywords = RESOURCEPACKS.map((p) => (p.fileMatch || p.keyword || p.projectId.split('-')[0]).toLowerCase());
  const resourceFiles = fs.existsSync(resourceDir) ? fs.readdirSync(resourceDir).map((f) => f.toLowerCase()) : [];
  const hasResourcePacks = packKeywords.every((kw) => resourceFiles.some((f) => f.includes(kw)));

  return { hasForge, hasMods, modCount, hasShaders, hasResourcePacks, ready: hasForge && hasMods && hasResourcePacks };
}

async function installAll(gameDir, apiKey, onProgress, { force = false } = {}) {
  await fs.ensureDir(gameDir);
  const state = await checkInstallation(gameDir);

  if (!state.hasForge) {
    await installForge(gameDir, onProgress);
  }

  if (force || !state.hasMods) {
    onProgress('step', { label: 'Téléchargement des mods…' });
    await downloadMods(gameDir, apiKey, onProgress);
  }

  await downloadShaders(gameDir, onProgress, force);
  await downloadResourcePacks(gameDir, onProgress, force);

  fs.writeFileSync(path.join(gameDir, 'launcherversion'), MODPACK_VERSION, 'utf8');
  onProgress('done', { label: '✓ Installation terminée !' });
}

function applyGameOptions(gameDir) {
  const resourceDir = path.join(gameDir, 'resourcepacks');
  const filenames = [];

  if (fs.existsSync(resourceDir)) {
    for (const pack of RESOURCEPACKS) {
      const kw = (pack.fileMatch || pack.projectId.split('-')[0]).toLowerCase();
      const found = fs.readdirSync(resourceDir).find((f) => f.toLowerCase().includes(kw));
      if (found) filenames.push(found);
    }
  }

  configureResourcePacks(gameDir, filenames);
}

module.exports = { checkInstallation, installAll, applyGameOptions };
