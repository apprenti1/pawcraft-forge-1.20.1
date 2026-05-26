import { getAuth, setHint } from './auth.js';

let _installing = false;
let _playing    = false;

export async function refreshPlayButton() {
  const auth = getAuth();
  if (!auth) {
    setBtn('disabled', ''); setHint('Connectez-vous pour jouer'); return;
  }
  const check = await window.launcher.checkInstall();
  if (!check.ready) {
    const label = check.hasForge ? 'Télécharger les mods' : 'Installer le modpack';
    setBtn('install', label); setHint('');
  } else {
    setBtn('play', ''); setHint('');
  }
}

export async function onPlay() {
  if (_installing || _playing) return;
  const check = await window.launcher.checkInstall();
  if (!check.ready) await startInstall();
  else              await startGame();
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
  if (data.event === 'close') {
    _playing = false;
    refreshPlayButton();
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function showProgress(visible) {
  document.getElementById('card-progress').classList.toggle('hidden', !visible);
}

function setBtn(state, hint) {
  const btn = document.getElementById('btn-play');
  switch (state) {
    case 'disabled': btn.disabled = true;  btn.textContent = 'JOUER';    break;
    case 'install':  btn.disabled = false; btn.textContent = 'INSTALLER'; break;
    case 'play':     btn.disabled = false; btn.textContent = 'JOUER';    break;
    case 'loading':  btn.disabled = true;  btn.textContent = hint;       break;
    case 'playing':  btn.disabled = true;  btn.textContent = 'EN JEU';   break;
  }
  if (hint && state !== 'loading') setHint(hint);
}
