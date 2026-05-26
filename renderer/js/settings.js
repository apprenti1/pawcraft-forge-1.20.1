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
