import { initTheme, setTheme }                                    from './theme.js';
import { loadSettings, saveSettings }                              from './settings.js';
import { initAuth, loginOffline, loginMicrosoft, logout }          from './auth.js';
import { refreshPlayButton, onPlay, onReinstall, handleInstallProgress, handleGameEvent, checkLauncherUpdate, checkGameFilesUpdate } from './installer.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Theme ──────────────────────────────────────────────────────────────────
  initTheme();
  document.getElementById('btn-theme-dark') .addEventListener('click', () => setTheme('dark'));
  document.getElementById('btn-theme-light').addEventListener('click', () => setTheme('light'));

  // ── Window controls ────────────────────────────────────────────────────────
  document.getElementById('btn-close')   .addEventListener('click', () => window.launcher.close());
  document.getElementById('btn-minimize').addEventListener('click', () => window.launcher.minimize());

  // ── Navbar ─────────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`page-${tab.dataset.page}`).classList.add('active');
    });
  });

  // ── Auth — login choices (home page) ───────────────────────────────────────
  document.getElementById('btn-choice-offline').addEventListener('click', () => {
    document.getElementById('offline-form').classList.remove('hidden');
    document.getElementById('input-username').focus();
  });
  document.getElementById('btn-choice-ms').addEventListener('click', loginMicrosoft);

  document.getElementById('btn-login-offline').addEventListener('click', loginOffline);
  document.getElementById('input-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginOffline();
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  await loadSettings();

  document.getElementById('ram-slider').addEventListener('input', e => {
    document.getElementById('ram-value').textContent = `${e.target.value} Go`;
    saveSettings();
  });
  document.getElementById('input-cf-key').addEventListener('change', saveSettings);

  document.getElementById('btn-logout').addEventListener('click', logout);

  document.getElementById('btn-browse-dir').addEventListener('click', async () => {
    const dir = await window.launcher.openDirPicker();
    if (dir) {
      document.getElementById('input-game-dir').value = dir;
      saveSettings();
    }
  });

  // ── Console ────────────────────────────────────────────────────────────────
  document.getElementById('btn-console-clear').addEventListener('click', () => {
    document.getElementById('console-output').innerHTML = '';
  });

  // ── Play ───────────────────────────────────────────────────────────────────
  document.getElementById('btn-play').addEventListener('click', onPlay);
  document.getElementById('btn-reinstall').addEventListener('click', onReinstall);

  // ── IPC events ─────────────────────────────────────────────────────────────
  window.launcher.onInstallProgress(handleInstallProgress);
  window.launcher.onGameEvent(handleGameEvent);

  // ── Restore auth ───────────────────────────────────────────────────────────
  await initAuth();
  await refreshPlayButton();

  // ── Update checks (silencieux, non-bloquant) ───────────────────────────────
  window.launcher.checkUpdate().then(result => {
    checkLauncherUpdate(result);
    if (!result?.launcher || result.launcher.upToDate) {
      checkGameFilesUpdate(result);
    }
  }).catch(() => {});
});
