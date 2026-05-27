const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs-extra');
const { MC_VERSION, FORGE_VERSION } = require('./modlist');
const { findOrDownloadJava } = require('./java');

const FORGE_PROFILE = FORGE_VERSION.replace(`${MC_VERSION}-`, `${MC_VERSION}-forge-`);

function getForgeJvmArgs(gameDir) {
  const versionJsonPath = path.join(gameDir, 'versions', FORGE_PROFILE, `${FORGE_PROFILE}.json`);
  if (!fs.existsSync(versionJsonPath)) return [];

  const forgeJson = fs.readJsonSync(versionJsonPath);
  const jvmEntries = forgeJson.arguments?.jvm || [];
  if (!jvmEntries.length) return [];

  const libDir = path.join(gameDir, 'libraries');
  const sep = process.platform === 'win32' ? ';' : ':';

  const sub = (s) => s
    .replace(/\$\{library_directory\}/g, libDir)
    .replace(/\$\{classpath_separator\}/g, sep)
    .replace(/\$\{version_name\}/g, FORGE_PROFILE);

  return jvmEntries.flatMap((entry) => {
    if (typeof entry === 'string') return [sub(entry)];
    if (entry.value) return Array.isArray(entry.value) ? entry.value.map(sub) : [sub(entry.value)];
    return [];
  });
}

async function launch(auth, gameDir, ramGB, onEvent) {
  const launcher = new Client();

  launcher.on('debug',    (e) => onEvent('debug',    e));
  launcher.on('data',     (e) => onEvent('log',      e));
  launcher.on('progress', (e) => onEvent('progress', e));
  launcher.on('close',    (c) => onEvent('close',    { code: c }));

  onEvent('start', {});

  const javaDir  = path.join(gameDir, '..', 'java');
  const javaPath = await findOrDownloadJava(javaDir, onEvent.bind(null, 'debug'));

  launcher.launch({
    authorization: auth,
    root: gameDir,
    version: {
      number: MC_VERSION,
      type: 'release',
      custom: FORGE_PROFILE,
    },
    memory: {
      max: `${ramGB}G`,
      min: `${Math.max(1, Math.floor(ramGB / 2))}G`,
    },
    javaPath,
    customArgs: getForgeJvmArgs(gameDir),
    overrides: {
      gameDirectory: gameDir,
    },
  });
}

module.exports = { launch };
