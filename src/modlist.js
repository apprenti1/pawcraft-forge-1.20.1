const MODS = [
  // Tech & Automation
  { name: 'Create',                  source: 'curseforge', projectId: 328085 },
  { name: 'Applied Energistics 2',   source: 'curseforge', projectId: 223794 },
  { name: 'CC: Tweaked',             source: 'modrinth',   projectId: 'cc-tweaked' },
  { name: 'Create: Applied Kinetics',source: 'curseforge', projectId: 867328 },
  { name: 'CC:C Bridge',             source: 'curseforge', projectId: 656214 },
  { name: 'Ars Creo',                source: 'curseforge', projectId: 575698 },

  // Magie
  { name: 'Ars Nouveau',             source: 'curseforge', projectId: 401955 },

  // Exploration
  { name: 'Waystones',               source: 'curseforge', projectId: 245755 },
  { name: 'Balm',                    source: 'curseforge', projectId: 531761 },

  // QoL & Interface
  { name: 'JEI',                     source: 'curseforge', projectId: 238222 },
  { name: 'JADE',                    source: 'curseforge', projectId: 324717 },
  { name: 'FTB Chunks',              source: 'curseforge', projectId: 314906 },

  // Performance & Shaders
  { name: 'Embeddium',               source: 'curseforge', projectId: 908741 },
  { name: 'Oculus',                  source: 'curseforge', projectId: 581495 },

  // Cosmetique (client)
  { name: 'Better Foliage Renewed',  source: 'curseforge', projectId: 470013 },
  { name: 'Falling Leaves',          source: 'modrinth',   projectId: 'fallingleavesforge' },
  { name: 'Particular Reforged',     source: 'curseforge', projectId: 1219053 },
  { name: 'Subtle Effects',          source: 'curseforge', projectId: 1023913, fileId: 7283799 }, // 1.13.2 — 1.14.x crash NPE subtle_effects:short_spark
  { name: 'Particle Rain',           source: 'curseforge', projectId: 421897 },

  // Connected Textures (OptiFine CTM via Sinytra Connector)
  { name: 'Sinytra Connector',       source: 'modrinth',   projectId: 'connector' },
  { name: 'Forgified Fabric API',    source: 'modrinth',   projectId: 'forgified-fabric-api' },
  { name: 'Continuity',              source: 'modrinth',   projectId: 'continuity' },
  { name: 'Entity Model Features',   source: 'modrinth',   projectId: 'entity-model-features' },
  { name: 'Entity Texture Features', source: 'modrinth',   projectId: 'entitytexturefeatures' },

  // Dependances
  { name: 'GuideMeForge',            source: 'modrinth',   projectId: 'guideme' },
  { name: 'Curios API',              source: 'modrinth',   projectId: 'curios' },
  { name: 'Architectury API',        source: 'modrinth',   projectId: 'architectury-api' },
  { name: 'Fzzy Config',             source: 'modrinth',   projectId: 'fzzy-config' },
  { name: 'Kotlin for Forge',        source: 'curseforge', projectId: 351264 },
  { name: 'FTB Library',             source: 'curseforge', projectId: 404465 },
  { name: 'FTB Teams',               source: 'curseforge', projectId: 404468 },
];

const SHADERS = [
  { name: 'Complementary Reimagined', source: 'modrinth', projectId: 'complementary-reimagined' },
];

const RESOURCEPACKS = [
  { name: 'Patrix 32x Basic', source: 'modrinth', projectId: 'patrix-32x',   fileMatch: 'basic' },
  { name: 'Patrix 32x Addon', source: 'modrinth', projectId: 'patrix-32x',   fileMatch: 'addon' },
  { name: 'CTM Overhaul',     source: 'modrinth', projectId: 'ctm-overhaul' },
  { name: 'Round Trees',      source: 'modrinth', projectId: 'round-trees' },
  { name: 'Pawcraft GUI',     source: 'local',    keyword:   'pawcraft-gui' },
];

const MC_VERSION      = '1.20.1';
const FORGE_VERSION   = '1.20.1-47.4.20';
const MODPACK_VERSION = '1.0.1';
const GITHUB_REPO     = 'apprenti1/pawcraft-forge-1.20.1';

module.exports = { MODS, SHADERS, RESOURCEPACKS, MC_VERSION, FORGE_VERSION, MODPACK_VERSION, GITHUB_REPO };
