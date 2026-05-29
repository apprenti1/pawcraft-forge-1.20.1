import { getAuth, setHint } from './auth.js';

let _installing = false;
let _playing    = false;

export async function checkUpdate() {
  const result = await window.launcher.checkUpdate();
  if (!result || result.upToDate) return;
  const banner  = document.getElementById('update-banner');
  const verEl   = document.getElementById('update-version');
  const btnUpd  = document.getElementById('btn-update');
  if (!banner) return;
  verEl.textContent = `v${result.latestVersion}`;
  banner.classList.remove('hidden');
  btnUpd.addEventListener('click', onUpdate, { once: true });
}

async function onUpdate() {
  if (_installing || _playing) return;
  document.getElementById('update-banner').classList.add('hidden');
  _installing = true;
  showProgress(true);
  document.getElementById('log-box').innerHTML = '';
  setBtn('loading', 'Mise à jour…');

  const res = await window.launcher.applyUpdate();
  _installing = false;

  if (res.success) {
    showProgress(false);
    await refreshPlayButton();
  } else {
    setHint(`Erreur : ${res.error}`, 'error');
    setBtn('play', '');
  }
}

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

export async function onReinstall() {
  if (_installing || _playing) return;
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

// ── helpers ───────────────────────────────────────────────────────────────────

function showProgress(visible) {
  document.getElementById('card-progress').classList.toggle('hidden', !visible);
}

function setBtn(state, hint) {
  const btn = document.getElementById('btn-play');
  const btnReinstall = document.getElementById('btn-reinstall');
  const busy = state === 'loading' || state === 'playing';
  if (btnReinstall) btnReinstall.disabled = busy;
  switch (state) {
    case 'disabled': btn.disabled = true;  btn.textContent = 'JOUER';    break;
    case 'install':  btn.disabled = false; btn.textContent = 'INSTALLER'; break;
    case 'play':     btn.disabled = false; btn.textContent = 'JOUER';    break;
    case 'loading':  btn.disabled = true;  btn.textContent = hint;       break;
    case 'playing':  btn.disabled = true;  btn.textContent = 'EN JEU';   break;
  }
  if (hint && state !== 'loading') setHint(hint);
}
