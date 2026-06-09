import { getAuth, setHint } from './auth.js';
import { displayVersions }  from './settings.js';

let _installing = false;
let _playing    = false;
let _launcherUpdatePending  = false;
let _gameFilesUpdatePending = false;
let _lastUpdateResult       = null;

// ── Update checks ─────────────────────────────────────────────────────────────

export function checkLauncherUpdate(result) {
  _lastUpdateResult = result;
  if (!result?.launcher || result.launcher.upToDate) return;

  _launcherUpdatePending = true;

  const banner = document.getElementById('banner-launcher');
  const verEl  = document.getElementById('launcher-version');
  if (banner && verEl) {
    verEl.textContent = `v${result.launcher.latestVersion}`;
    banner.classList.remove('hidden');
  }

  // Block the play button
  setBtn('disabled', '');
  setHint(`Mise à jour requise avant de jouer`, 'warn');

  const btn = document.getElementById('btn-update-launcher');
  if (!btn) return;

  if (!result.isPackaged) {
    btn.textContent = 'Disponible (dev)';
    btn.disabled = true;
    return;
  }

  // Détection asset selon plateforme
  function findPlatformAsset(assets) {
    if (!assets || !assets.length) return null;
    const platform = window.launcher.getPlatform();
    const arch = window.launcher.getArch();

    switch (platform) {
      case 'win32':
        return assets.find(a => a.name.endsWith('.exe'));
      case 'darwin':
        // Préférer l'architecture correspondante
        if (arch === 'arm64') {
          return assets.find(a => a.name.includes('arm64') && a.name.endsWith('.dmg'))
              || assets.find(a => a.name.endsWith('.dmg'))
              || assets.find(a => a.name.includes('mac') && a.name.endsWith('.zip'));
        }
        return assets.find(a => a.name.endsWith('.dmg') && !a.name.includes('arm64'))
            || assets.find(a => a.name.endsWith('.dmg'))
            || assets.find(a => a.name.includes('mac') && a.name.endsWith('.zip'));
      case 'linux':
        return assets.find(a => a.name.endsWith('.AppImage'))
            || assets.find(a => a.name.endsWith('.deb'))
            || assets.find(a => a.name.includes('linux') && a.name.endsWith('.tar.gz'));
      default:
        return null;
    }
  }

  const platformAsset = findPlatformAsset(result.launcher.assets);
  btn.addEventListener('click', async () => {
    if (_installing) return;
    if (banner) banner.classList.add('hidden');
    _installing = true;
    showProgress(true);
    document.getElementById('log-box').innerHTML = '';
    setBtn('loading', 'Téléchargement…');

    const dl = await window.launcher.downloadLauncherUpdate(platformAsset?.url);
    if (!dl.success) {
      _installing = false;
      showProgress(false);
      setBtn('disabled', '');
      setHint(`Erreur : ${dl.error}`, 'error');
      return;
    }

    const apply = await window.launcher.applyLauncherUpdate(dl.tempPath);
    if (!apply.success) {
      _installing = false;
      showProgress(false);
      setBtn('disabled', '');
      setHint(`Erreur : ${apply.error}`, 'error');
    }
    // On success the app quits within 500ms — nothing more to do
  }, { once: true });
}

export function checkGameFilesUpdate(result) {
  _lastUpdateResult = result;
  if (!result?.gameFiles || result.gameFiles.upToDate) return;
  _gameFilesUpdatePending = true;
  // No banner — the update runs transparently when the user clicks JOUER
}

// ── Play button state ─────────────────────────────────────────────────────────

export async function refreshPlayButton() {
  const auth = getAuth();
  if (!auth) {
    setBtn('disabled', ''); setHint('Connectez-vous pour jouer'); return;
  }
  if (_launcherUpdatePending) {
    setBtn('disabled', '');
    setHint('Mise à jour requise avant de jouer', 'warn');
    return;
  }
  const check = await window.launcher.checkInstall();
  if (!check.ready) {
    const label = check.hasForge ? 'Télécharger les mods' : 'Installer le modpack';
    setBtn('install', label); setHint('');
  } else {
    setBtn('play', ''); setHint('');
  }
}

// ── Play / Reinstall ──────────────────────────────────────────────────────────

export async function onPlay() {
  if (_installing || _playing || _launcherUpdatePending) return;

  const check = await window.launcher.checkInstall();
  if (!check.ready) {
    await startInstall();
    return;
  }

  if (_gameFilesUpdatePending) {
    await updateGameFilesThenLaunch();
  } else {
    await startGame();
  }
}

export async function onReinstall() {
  if (_installing || _playing || _launcherUpdatePending) return;
  await startInstall();
}

async function startInstall() {
  _installing = true;
  showProgress(true);
  document.getElementById('log-box').innerHTML = '';
  setBtn('loading', 'Installation…');

  const res = await window.launcher.startInstall();
  _installing = false;

  if (res.success) {
    showProgress(false);
    await refreshPlayButton();
  } else {
    setHint(`Erreur : ${res.error}`, 'error');
    setBtn('install', 'Réessayer');
  }
}

async function updateGameFilesThenLaunch() {
  _installing = true;
  showProgress(true);
  document.getElementById('log-box').innerHTML = '';
  setBtn('loading', 'Mise à jour du modpack…');

  const res = await window.launcher.applyGameFilesUpdate();
  _installing = false;

  if (res.success) {
    _gameFilesUpdatePending = false;
    showProgress(false);
    if (_lastUpdateResult) {
      displayVersions({
        ..._lastUpdateResult,
        gameFiles: {
          ..._lastUpdateResult.gameFiles,
          installedVersion: _lastUpdateResult.gameFiles.currentVersion,
          upToDate: true,
        },
      });
    }
    await startGame();
  } else {
    setHint(`Erreur : ${res.error}`, 'error');
    setBtn('play', '');
    showProgress(false);
  }
}

async function startGame() {
  _playing = true;
  setBtn('playing', ''); setHint('');
  const res = await window.launcher.launch(getAuth());
  if (!res.success) {
    _playing = false;
    setHint(`Erreur : ${res.error}`, 'error');
    setBtn('play', '');
  }
}

// ── IPC event handlers ────────────────────────────────────────────────────────

export function handleInstallProgress(data) {
  const labelEl = document.getElementById('progress-label');
  const fillEl  = document.getElementById('progress-fill');
  const logEl   = document.getElementById('log-box');

  const log = (text, cls) => {
    const div = document.createElement('div');
    div.textContent = text;
    if (cls) div.className = cls;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  };

  switch (data.type) {
    case 'step':     labelEl.textContent = data.label; break;
    case 'mod':      labelEl.textContent = data.label; fillEl.style.width = `${data.percent}%`; break;
    case 'download': labelEl.textContent = `${data.label} (${data.percent}%)`; fillEl.style.width = `${data.percent}%`; break;
    case 'log':      log(data.text); break;
    case 'warn':     log(data.label, 'log-warn'); break;
    case 'done':     labelEl.textContent = data.label; fillEl.style.width = '100%'; break;
  }
}

export function handleGameEvent(data) {
  const { event, data: payload } = data;

  if (event === 'start') {
    navigateTo('console');
    setConsoleStatus('running', 'En jeu…');
    return;
  }

  if (event === 'log' || event === 'debug') {
    appendConsoleLine(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return;
  }

  if (event === 'progress') {
    const p = payload || {};
    if (p.total) {
      const pct = Math.round((p.task / p.total) * 100);
      setConsoleStatus('running', `Chargement ${p.type || ''} — ${p.task}/${p.total} (${pct}%)`);
    }
    return;
  }

  if (event === 'close') {
    _playing = false;
    setConsoleStatus('stopped', `Jeu fermé (code ${payload?.code ?? '?'})`);
    refreshPlayButton();
  }
}

// ── Console helpers ───────────────────────────────────────────────────────────

function navigateTo(page) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`.nav-tab[data-page="${page}"]`);
  const pg  = document.getElementById(`page-${page}`);
  if (tab) tab.classList.add('active');
  if (pg)  pg.classList.add('active');
}

function setConsoleStatus(cls, text) {
  const el = document.getElementById('console-status');
  if (!el) return;
  el.className = `console-status ${cls}`;
  el.textContent = text;
}

function appendConsoleLine(text, extraClass = '') {
  const out = document.getElementById('console-output');
  if (!out) return;
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line) continue;
    const div = document.createElement('div');
    div.className = 'console-line' + (extraClass ? ' ' + extraClass : getLineClass(line));
    div.textContent = line;
    out.appendChild(div);
  }
  out.scrollTop = out.scrollHeight;
}

function getLineClass(text) {
  if (/error|exception|crash/i.test(text)) return ' log-error';
  if (/warn/i.test(text))                  return ' log-warn';
  return '';
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showProgress(visible) {
  document.getElementById('card-progress').classList.toggle('hidden', !visible);
}

function setBtn(state, hint) {
  const btn = document.getElementById('btn-play');
  const btnReinstall = document.getElementById('btn-reinstall');
  const busy = state === 'loading' || state === 'playing';
  if (btnReinstall) btnReinstall.disabled = busy || _launcherUpdatePending;
  switch (state) {
    case 'disabled': btn.disabled = true;  btn.textContent = 'JOUER';     break;
    case 'install':  btn.disabled = false; btn.textContent = 'INSTALLER';  break;
    case 'play':     btn.disabled = false; btn.textContent = 'JOUER';     break;
    case 'loading':  btn.disabled = true;  btn.textContent = hint;         break;
    case 'playing':  btn.disabled = true;  btn.textContent = 'EN JEU';    break;
  }
  if (hint && state !== 'loading') setHint(hint);
}
