import { refreshPlayButton } from './installer.js';

let _auth = null;
export const getAuth = () => _auth;

export async function initAuth() {
  const saved = await window.launcher.getSavedAuth();
  if (saved.success) applyAuth(saved.auth);
}

export function applyAuth(auth) {
  _auth = auth;
  const name = auth.name ?? auth.selectedProfile?.name ?? 'Joueur';
  const uuid = auth.uuid ?? auth.selectedProfile?.id;

  // Home page: hide choices, show player info
  document.getElementById('login-choices').classList.add('hidden');
  document.getElementById('offline-form').classList.add('hidden');
  document.getElementById('player-info').classList.remove('hidden');
  document.getElementById('auth-label').textContent = name;

  // Load avatar only when uuid is a real value
  if (uuid) {
    const avatarUrl = `https://api.mineatar.io/face/${encodeURIComponent(uuid)}?size=64&overlay=true`;
    _setAvatar(document.getElementById('player-avatar'), avatarUrl);
    _setAvatar(document.getElementById('settings-avatar'), avatarUrl);
  }

  // Settings page
  const connected    = document.getElementById('settings-account-connected');
  const disconnected = document.getElementById('settings-account-disconnected');
  if (connected)    connected.classList.remove('hidden');
  if (disconnected) disconnected.classList.add('hidden');
  const settingsUsername = document.getElementById('settings-username');
  if (settingsUsername) settingsUsername.textContent = name;

  refreshPlayButton();
}

export function clearAuth() {
  _auth = null;

  // Home page
  document.getElementById('login-choices').classList.remove('hidden');
  document.getElementById('offline-form').classList.add('hidden');
  document.getElementById('player-info').classList.add('hidden');

  // Settings page
  const connected    = document.getElementById('settings-account-connected');
  const disconnected = document.getElementById('settings-account-disconnected');
  if (connected)    connected.classList.add('hidden');
  if (disconnected) disconnected.classList.remove('hidden');

  refreshPlayButton();
}

export async function loginOffline() {
  const username = document.getElementById('input-username').value.trim();
  const res = await window.launcher.loginOffline(username);
  if (res.success) {
    applyAuth(res.auth);
  } else {
    setHint(res.error, 'error');
  }
}

export async function loginMicrosoft() {
  setPlayLoading('Connexion Microsoft…');
  const res = await window.launcher.loginMicrosoft();
  if (res.success) {
    applyAuth(res.auth);
  } else {
    setHint(`Erreur : ${res.error}`, 'error');
    await refreshPlayButton();
  }
}

export async function logout() {
  await window.launcher.logout();
  clearAuth();
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _setAvatar(el, url) {
  if (!el) return;
  // Remove stale src first so the CSS :not([src]) rule hides it while loading
  el.removeAttribute('src');
  el.onerror = () => { el.removeAttribute('src'); };
  el.onload  = null;
  el.src = url;
}

export function setHint(msg, type) {
  const el = document.getElementById('play-hint');
  el.textContent = msg ?? '';
  el.className   = `play-hint${type ? ' ' + type : ''}`;
}

export function setPlayLoading(text) {
  const btn = document.getElementById('btn-play');
  btn.disabled    = true;
  btn.textContent = text;
}
