# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Electron desktop launcher for the **Pawcraft** Minecraft modpack (Forge 1.20.1, 18 mods, 2-player coop).  
Handles Microsoft + offline authentication, automated Forge installation, mod downloads, and game launch.

## Commands

```bash
npm install          # install dependencies (first time)
npm start            # run in dev mode (opens Electron window)
npm run build        # package as Windows installer → dist/
```

## Architecture

**Process model** (standard Electron):
- `main.js` — main process. Creates the window, registers all `ipcMain` handlers, reads/writes `auth.json` and `settings.json` to `app.getPath('userData')`. Game files go to `userData/minecraft/`.
- `preload.js` — exposes a `window.launcher` API to the renderer via `contextBridge` (no `nodeIntegration`).
- `renderer/` — plain HTML/CSS/JS. Communicates with main only through `window.launcher.*`.

**Source modules** (`src/`):
- `modlist.js` — single source of truth for the 18 mods. Each entry has `{ name, source: 'curseforge'|'modrinth', projectId }`. Also exports `MC_VERSION` and `FORGE_VERSION`.
- `installer.js` — orchestrates full installation: finds Java 17+, downloads the Forge installer JAR from `maven.minecraftforge.net`, runs it with `--installClient <gameDir>`, then downloads mods via the CurseForge API (`x-api-key` header) or Modrinth API (no key needed).
- `launcher.js` — wraps `minecraft-launcher-core` (`Client`). The `custom` version field points to the Forge profile name created by the installer (e.g. `1.20.1-forge-47.2.0`).

**Auth flow**:
- Offline: `Authenticator.getAuth(username)` from `minecraft-launcher-core`, saved to `auth.json`.
- Microsoft: `msmc` v4 opens an OAuth popup (`authManager.launch('electron')`), gets a Minecraft token, calls `token.mclc()` for MCLC compatibility.

## Key configuration

**Forge version**: `FORGE_VERSION` in `src/modlist.js` (currently `1.20.1-47.2.0`).  
**CurseForge API key**: entered by the user in the launcher settings UI; stored in `settings.json`. Free key at https://console.curseforge.com/  
**CurseForge project IDs**: most are set in `src/modlist.js`; entries marked `// TODO: vérifier` need to be confirmed against the CurseForge website before the first install.

## Packaging

`electron-builder.yml` targets Windows x64 NSIS installer → `dist/`.  
An `assets/icon.ico` must be present before running `npm run build` (add any 256×256 `.ico`).
