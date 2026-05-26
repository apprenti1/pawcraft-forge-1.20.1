const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  // Window
  close:    () => ipcRenderer.invoke('window:close'),
  minimize: () => ipcRenderer.invoke('window:minimize'),

  // Settings
  getSettings:  ()  => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),

  // Auth
  getSavedAuth:   ()  => ipcRenderer.invoke('auth:getSaved'),
  loginOffline:   (u) => ipcRenderer.invoke('auth:offline', u),
  loginMicrosoft: ()  => ipcRenderer.invoke('auth:microsoft'),
  logout:         ()  => ipcRenderer.invoke('auth:logout'),

  // Install
  checkInstall: ()  => ipcRenderer.invoke('install:check'),
  startInstall: ()  => ipcRenderer.invoke('install:start'),

  // Game
  launch: (auth) => ipcRenderer.invoke('game:launch', auth),

  // Dialog
  openDirPicker: () => ipcRenderer.invoke('dialog:openDir'),

  // Events
  onInstallProgress: (cb) => ipcRenderer.on('install:progress', (_, d) => cb(d)),
  onGameEvent:       (cb) => ipcRenderer.on('game:event',       (_, d) => cb(d)),
  removeListeners:   (ch) => ipcRenderer.removeAllListeners(ch),
});
