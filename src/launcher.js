const { Client } = require('minecraft-launcher-core');
const { MC_VERSION, FORGE_VERSION } = require('./modlist');

function launch(auth, gameDir, ramGB, onEvent) {
  const launcher = new Client();

  launcher.on('debug',    (e) => onEvent('debug',    e));
  launcher.on('data',     (e) => onEvent('log',      e));
  launcher.on('progress', (e) => onEvent('progress', e));
  launcher.on('close',    (c) => onEvent('close',    { code: c }));

  // Emit start so main.js can minimize the window
  onEvent('start', {});

  launcher.launch({
    authorization: auth,
    root: gameDir,
    version: {
      number: MC_VERSION,
      type: 'release',
      custom: FORGE_VERSION,   // version profile name created by the Forge installer
    },
    memory: {
      max: `${ramGB}G`,
      min: `${Math.max(1, Math.floor(ramGB / 2))}G`,
    },
    overrides: {
      gameDirectory: gameDir,
    },
  });
}

module.exports = { launch };
