export async function loadSettings() {
  const s = await window.launcher.getSettings();
  document.getElementById('ram-slider').value       = s.ram ?? 4;
  document.getElementById('ram-value').textContent  = `${s.ram ?? 4} Go`;
  document.getElementById('input-cf-key').value     = s.curseforgeKey ?? '';
  document.getElementById('input-game-dir').value   = s.gameDir ?? '';
}

export async function saveSettings() {
  const ram           = parseInt(document.getElementById('ram-slider').value);
  const curseforgeKey = document.getElementById('input-cf-key').value.trim();
  const gameDir       = document.getElementById('input-game-dir').value.trim();
  await window.launcher.saveSettings({ ram, curseforgeKey, gameDir });
}

export function displayVersions(updateResult) {
  if (!updateResult) return;
  const current = updateResult.gameFiles?.currentVersion; // MODPACK_VERSION du code
  const latest  = updateResult.launcher?.latestVersion;   // dernière release GitHub
  const upToDate = updateResult.launcher?.upToDate ?? true;

  const instEl   = document.getElementById('version-installed');
  const latestEl = document.getElementById('version-latest');
  if (!instEl || !latestEl) return;

  instEl.textContent = current ? `v${current}` : '—';
  instEl.className   = 'version-badge' + (upToDate ? ' version-ok' : ' version-outdated');

  latestEl.textContent = latest ? `v${latest}` : '…';
  latestEl.className   = 'version-badge version-ok';
}
