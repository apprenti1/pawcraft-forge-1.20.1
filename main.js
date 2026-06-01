const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { Auth } = require('msmc');
const { Authenticator } = require('minecraft-launcher-core');
const { checkInstallation, installAll, applyGameOptions } = require('./src/installer');
const { launch } = require('./src/launcher');
const { checkForUpdate } = require('./src/updater');
const { downloadExe, applyLauncherUpdate } = require('./src/self-updater');
const { MODPACK_VERSION, GITHUB_REPO } = require('./src/modlist');

let mainWindow;

const AUTH_FILE     = path.join(app.getPath('userData'), 'auth.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_CF_KEY = '$2a$10$oOuRcRqq8/HH.FsZ18Px1uvoAtaVrj4nvqqe4F2vw4whdCh8hyz0q';

function getSettings() {
  try { return fs.readJsonSync(SETTINGS_FILE); }
  catch {
    return {
      ram: 4,
      curseforgeKey: DEFAULT_CF_KEY,
      gameDir: path.join(app.getPath('userData'), 'minecraft'),
    };
  }
}

function saveSettings(settings) {
  fs.writeJsonSync(SETTINGS_FILE, settings, { spaces: 2 });
}

function getGameDir() {
  return getSettings().gameDir || path.join(app.getPath('userData'), 'minecraft');
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 780,
    minHeight: 520,
    resizable: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('window:close',    () => app.quit());
ipcMain.handle('window:minimize', () => mainWindow.minimize());

ipcMain.handle('settings:get',  ()            => getSettings());
ipcMain.handle('settings:save', (_, settings) => saveSettings(settings));

ipcMain.handle('dialog:openDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choisir le dossier de jeu',
    defaultPath: getGameDir(),
  });
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

async function refreshMicrosoftToken(savedAuth) {
  if (savedAuth.type !== 'microsoft') return savedAuth;
  const expiry = savedAuth.meta?.exp;
  if (expiry && expiry > Date.now() + 5 * 60 * 1000) return savedAuth;
  try {
    const authManager = new Auth('select_account');
    const xbox  = await authManager.refresh(savedAuth.meta.refresh);
    const token = await xbox.getMinecraft();
    const newAuth = { type: 'microsoft', ...token.mclc() };
    fs.writeJsonSync(AUTH_FILE, newAuth);
    return newAuth;
  } catch {
    return savedAuth;
  }
}

ipcMain.handle('auth:getSaved', async () => {
  try {
    let data = fs.readJsonSync(AUTH_FILE);
    data = await refreshMicrosoftToken(data);
    return { success: true, auth: data };
  } catch {
    return { success: false };
  }
});

ipcMain.handle('auth:offline', async (_, username) => {
  if (!username || username.trim().length < 3) {
    return { success: false, error: 'Pseudo trop court (3 caractères min)' };
  }
  const raw  = await Authenticator.getAuth(username.trim());
  const auth = { type: 'offline', ...raw };
  fs.writeJsonSync(AUTH_FILE, auth);
  return { success: true, auth };
});

ipcMain.handle('auth:microsoft', async () => {
  try {
    const authManager = new Auth('select_account');
    const xboxManager = await authManager.launch('electron');
    const token = await xboxManager.getMinecraft();
    const auth = token.mclc();
    fs.writeJsonSync(AUTH_FILE, { type: 'microsoft', ...auth });
    return { success: true, auth };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  try { fs.removeSync(AUTH_FILE); } catch {}
  return { success: true };
});

// ── Install ───────────────────────────────────────────────────────────────────

ipcMain.handle('install:check', async () => checkInstallation(getGameDir()));

ipcMain.handle('install:start', async () => {
  const settings = getSettings();
  const gameDir  = getGameDir();
  const send = (type, data) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install:progress', { type, ...data });
    }
  };
  try {
    await installAll(gameDir, settings.curseforgeKey, send);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Launch ────────────────────────────────────────────────────────────────────

ipcMain.handle('game:launch', async (_, auth) => {
  const settings = getSettings();
  const gameDir  = getGameDir();
  try {
    const freshAuth = await refreshMicrosoftToken(auth);
    applyGameOptions(gameDir);
    await launch(freshAuth, gameDir, settings.ram, (event, data) => {
      if (mainWindow.isDestroyed()) return;
      if (event === 'start') { mainWindow.minimize(); }
      if (event === 'close') { mainWindow.restore(); mainWindow.focus(); }
      mainWindow.webContents.send('game:event', { event, data });
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Update ────────────────────────────────────────────────────────────────────

ipcMain.handle('update:check', async () => {
  const gameDir       = getGameDir();
  const versionFile   = path.join(gameDir, 'launcherversion');
  const installedGame = fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, 'utf8').trim()
    : null;

  const launcher = await checkForUpdate(MODPACK_VERSION, GITHUB_REPO);
  const gameFiles = {
    upToDate:         installedGame === MODPACK_VERSION,
    installedVersion: installedGame,
    currentVersion:   MODPACK_VERSION,
  };
  return { launcher, gameFiles, isPackaged: app.isPackaged };
});

ipcMain.handle('update:download-launcher', async (_, assetUrl) => {
  const send = (type, data) => {
    if (!mainWindow.isDestroyed())
      mainWindow.webContents.send('install:progress', { type, ...data });
  };
  try {
    if (!assetUrl) return { success: false, error: 'Aucun .exe dans la release GitHub' };
    const tempPath = path.join(app.getPath('temp'), 'pawcraft-update.exe');
    await downloadExe(assetUrl, tempPath, send);
    send('done', { label: '✓ Téléchargement terminé — relancement…' });
    return { success: true, tempPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:apply-launcher', async (_, tempPath) => {
  try {
    const gameDir = getGameDir();
    await fs.ensureDir(gameDir);
    applyLauncherUpdate(tempPath, process.execPath, gameDir);
    setTimeout(() => app.quit(), 500);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('gamefiles:delete', async () => {
  try {
    const gameDir = getGameDir();
    if (fs.existsSync(gameDir)) fs.removeSync(gameDir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:apply-gamefiles', async () => {
  const settings = getSettings();
  const gameDir  = getGameDir();
  const send = (type, data) => {
    if (!mainWindow.isDestroyed())
      mainWindow.webContents.send('install:progress', { type, ...data });
  };
  try {
    await installAll(gameDir, settings.curseforgeKey, send, { force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
