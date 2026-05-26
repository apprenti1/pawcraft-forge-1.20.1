const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { Auth } = require('msmc');
const { Authenticator } = require('minecraft-launcher-core');
const { checkInstallation, installAll } = require('./src/installer');
const { launch } = require('./src/launcher');

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
    width: 920,
    height: 620,
    resizable: false,
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

ipcMain.handle('auth:getSaved', async () => {
  try {
    const data = fs.readJsonSync(AUTH_FILE);
    return { success: true, auth: data };
  } catch {
    return { success: false };
  }
});

ipcMain.handle('auth:offline', async (_, username) => {
  if (!username || username.trim().length < 3) {
    return { success: false, error: 'Pseudo trop court (3 caractères min)' };
  }
  const auth = Authenticator.getAuth(username.trim());
  fs.writeJsonSync(AUTH_FILE, { type: 'offline', ...auth });
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
    launch(auth, gameDir, settings.ram, (event, data) => {
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
