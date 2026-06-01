# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Electron desktop launcher for the **Pawcraft** Minecraft modpack (Forge 1.20.1, 31 mods).  
Server: `hainu.fr:25565`. GitHub: `apprenti1/pawcraft-forge-1.20.1`.  
Handles Microsoft + offline authentication, automated Forge installation, mod downloads, game launch, and modpack version updates.

## Commands

```bash
npm install              # install dependencies (first time)
npm start                # run in dev mode (opens Electron window)
npm run build            # package as Windows installer → dist/
npm run build:guipack    # regenerate assets/pawcraft-gui/ resource pack
```

## Architecture

**Process model** (standard Electron):
- `main.js` — main process. All `ipcMain` handlers, auth.json / settings.json management, token refresh, update check/apply.
- `preload.js` — exposes `window.launcher` API via `contextBridge` (no `nodeIntegration`).
- `renderer/` — plain HTML/CSS/JS SPA. Communicates with main only through `window.launcher.*`.

**Source modules** (`src/`):
- `modlist.js` — single source of truth: MODS array, SHADERS, RESOURCEPACKS, `MC_VERSION`, `FORGE_VERSION`, `MODPACK_VERSION`, `GITHUB_REPO`.
- `installer.js` — full install orchestration. `installAll(gameDir, apiKey, onProgress, { force })` — `force: true` wipes and redownloads everything.
- `launcher.js` — wraps `minecraft-launcher-core`.
- `updater.js` — `checkForUpdate(version, repo)` fetches GitHub releases API.

**Auth flow**:
- Offline: `Authenticator.getAuth(username)`, saved to `auth.json`.
- Microsoft: `msmc` v4 OAuth popup → `token.mclc()`. Token auto-refreshed on startup and before launch using `meta.refresh` stored in auth.json.

## Key configuration

**Forge version**: `FORGE_VERSION` in `src/modlist.js` (currently `1.20.1-47.4.20`).  
**Modpack version**: `MODPACK_VERSION` in `src/modlist.js`. Bump this + create a GitHub release tag `v<version>` to trigger the update banner for users.  
**CurseForge API key**: entered in launcher settings UI, stored in `settings.json`.  
**CurseForge fileId pinning**: add `fileId: <number>` to a mod entry to lock it to a specific version (used for Subtle Effects 1.13.2, fileId 7283799).

## Server-side mods (hainu.fr)

These cosmetic mods **must also be installed on the server** or they crash/disconnect:
- **Particular Reforged** — registers `particular:main` network channel
- **Subtle Effects** — registry objects need server-side presence (Sinytra Connector environment)

## GUI Resource Pack

`assets/pawcraft-gui/` — dark theme (#0c0b10) resource pack installed automatically.  
Regenerate with `npm run build:guipack` after color changes.  
Contains: 6 panorama images (512×512) + menu_background.png (16×16).

## Packaging

`electron-builder.yml` targets Windows x64 portable → `dist/`.  
An `assets/icon.ico` must be present before running `npm run build`.
