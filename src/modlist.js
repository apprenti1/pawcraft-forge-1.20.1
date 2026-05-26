// Modpack Pawcraft — Forge 1.20.1
// CurseForge IDs : vérifiables sur https://www.curseforge.com/minecraft/mc-mods/<slug>
// Modrinth IDs   : vérifiables sur https://modrinth.com/mod/<slug>
//
// Pour mettre à jour un ID CurseForge : chercher le mod, l'URL contient /mc-mods/<id>-<slug>
// ou ouvrir la page et noter l'ID numérique dans l'URL de téléchargement.

const MODS = [
  // ── Tech & Automation ─────────────────────────────────────────────────────
  {
    name: 'Create',
    source: 'curseforge',
    projectId: 328085,
  },
  {
    name: 'Applied Energistics 2',
    source: 'curseforge',
    projectId: 223794,
  },
  {
    name: 'CC: Tweaked',
    source: 'modrinth',
    projectId: 'gu7yAkud',
  },
  {
    name: 'Create: Applied Kinetics',
    source: 'curseforge',
    projectId: 622112, // TODO: vérifier
  },
  {
    name: 'CC×Create Compat Patch',
    source: 'curseforge',
    projectId: 854144, // TODO: vérifier — computercraft-create-compatibility-patch
  },
  {
    name: 'Ars Creo',
    source: 'curseforge',
    projectId: 566353, // TODO: vérifier
  },

  // ── Magie ─────────────────────────────────────────────────────────────────
  {
    name: 'Ars Nouveau',
    source: 'curseforge',
    projectId: 401955,
  },

  // ── Exploration ───────────────────────────────────────────────────────────
  {
    name: 'Waystones',
    source: 'curseforge',
    projectId: 245755,
  },
  {
    name: 'Balm',
    source: 'curseforge',
    projectId: 531761, // Dépendance de Waystones
  },

  // ── QoL & Interface ───────────────────────────────────────────────────────
  {
    name: 'JEI',
    source: 'curseforge',
    projectId: 238222,
  },
  {
    name: 'JADE',
    source: 'curseforge',
    projectId: 324717,
  },
  {
    name: 'FTB Chunks',
    source: 'curseforge',
    projectId: 314906, // TODO: vérifier
  },

  // ── Performance & Shaders ─────────────────────────────────────────────────
  {
    name: 'Embeddium',
    source: 'curseforge',
    projectId: 908741, // TODO: vérifier
  },
  {
    name: 'Oculus',
    source: 'curseforge',
    projectId: 581495, // TODO: vérifier
  },

  // ── Cosmétique (client) ───────────────────────────────────────────────────
  {
    name: 'Better Foliage Renewed',
    source: 'curseforge',
    projectId: 678374, // TODO: vérifier
  },
  {
    name: 'Falling Leaves',
    source: 'modrinth',
    projectId: 'fallingleavesforge',
  },
  {
    name: 'Particular Reforged',
    source: 'curseforge',
    projectId: 895466, // TODO: vérifier
  },
  {
    name: 'Subtle Effects',
    source: 'curseforge',
    projectId: 873899, // TODO: vérifier — à installer côté serveur ET client
  },
  {
    name: 'Particle Rain',
    source: 'curseforge',
    projectId: 517299, // TODO: vérifier
  },
];

const MC_VERSION    = '1.20.1';
const FORGE_VERSION = '1.20.1-47.2.0';

module.exports = { MODS, MC_VERSION, FORGE_VERSION };
