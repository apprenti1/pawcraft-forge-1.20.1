const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const { execSync } = require('child_process');
const extractZip = require('extract-zip');
const tar = require('tar');

// ═══════════════════════════════════════════════════════════
// TÉLÉCHARGEMENT HTTPS AVEC REDIRECTIONS
// ═══════════════════════════════════════════════════════════

function httpsGet(url, options = {}, depth = 0) {
  console.log('[Java] httpsGet depth', depth, ':', url.substring(0, 80));
  return new Promise((resolve, reject) => {
    console.log('[Java] Creating request...');
    const req = https.get(url, {
      headers: { 'User-Agent': 'PawcraftLauncher/1.0' },
      family: 4, // Force IPv4
      ...options
    }, (res) => {
      console.log('[Java] Got response:', res.statusCode);
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location;
        console.log('[Java] Redirect to:', redirectUrl.substring(0, 80) + '...');
        res.resume(); // Consume response to free up memory
        resolve(httpsGet(redirectUrl, options, depth + 1));
        return;
      }
      resolve(res);
    });
    req.on('error', (err) => {
      console.error('[Java] Request error:', err.message);
      reject(err);
    });
    req.setTimeout(30000, () => {
      console.error('[Java] Request timeout!');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    console.log('[Java] Request sent');
  });
}

// ═══════════════════════════════════════════════════════════
// DÉTECTION PLATEFORME
// ═══════════════════════════════════════════════════════════

const PLATFORM = (() => {
  switch (process.platform) {
    case 'win32': return 'windows';
    case 'darwin': return 'mac';
    case 'linux': return 'linux';
    default: throw new Error(`Plateforme non supportée: ${process.platform}`);
  }
})();

const ARCH = process.arch === 'arm64' ? 'aarch64' : 'x64';

const JAVA_EXE = process.platform === 'win32' ? 'java.exe' : 'java';

function getAdoptiumUrl() {
  return `https://api.adoptium.net/v3/binary/latest/21/ga/${PLATFORM}/${ARCH}/jre/hotspot/normal/eclipse`;
}

// ═══════════════════════════════════════════════════════════
// CHEMINS DE RECHERCHE PAR PLATEFORME
// ═══════════════════════════════════════════════════════════

function getJavaSearchPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || '';

  switch (process.platform) {
    case 'win32':
      return [
        'C:/Program Files/Java',
        'C:/Program Files/Eclipse Adoptium',
        'C:/Program Files/Microsoft',
        'C:/Program Files/BellSoft',
        'C:/Program Files/Zulu',
        'C:/Program Files (x86)/Java',
      ];
    case 'darwin':
      return [
        '/Library/Java/JavaVirtualMachines',
        '/System/Library/Java/JavaVirtualMachines',
        path.join(home, 'Library/Java/JavaVirtualMachines'),
        '/opt/homebrew/opt/openjdk',
        '/opt/homebrew/opt/openjdk@21',
        '/opt/homebrew/opt/openjdk@17',
        '/usr/local/opt/openjdk',
        '/usr/local/opt/openjdk@21',
      ];
    case 'linux':
      return [
        '/usr/lib/jvm',
        '/usr/java',
        '/opt/java',
        '/opt/jdk',
        path.join(home, '.sdkman/candidates/java'),
        path.join(home, '.jdks'),
        '/snap/openjdk',
      ];
    default:
      return [];
  }
}

// ═══════════════════════════════════════════════════════════
// VÉRIFICATION VERSION JAVA
// ═══════════════════════════════════════════════════════════

function checkJavaVersion(javaExe) {
  console.log('[Java] Checking version of:', javaExe);
  try {
    const out = execSync(`"${javaExe}" -version 2>&1`, {
      encoding: 'utf8',
      timeout: 5000
    });
    console.log('[Java] Version output:', out.split('\n')[0]);
    const match = out.match(/version "(\d+)/);
    if (match) {
      const version = parseInt(match[1]);
      console.log('[Java] Parsed version:', version);
      if (version >= 17 && version <= 21) return version;
    }
  } catch (e) {
    console.log('[Java] Version check failed:', e.message);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// RECHERCHE JAVA DANS UN RÉPERTOIRE
// ═══════════════════════════════════════════════════════════

function findJavaInDir(dir) {
  if (!fs.existsSync(dir)) return null;

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      // Chemins possibles selon la plateforme
      const candidates = [];

      if (process.platform === 'darwin') {
        // macOS: structure Contents/Home/bin/java
        candidates.push(
          path.join(entryPath, 'Contents', 'Home', 'bin', JAVA_EXE),
          path.join(entryPath, 'bin', JAVA_EXE),
          path.join(entryPath, 'libexec', 'openjdk.jdk', 'Contents', 'Home', 'bin', JAVA_EXE)
        );
      } else {
        // Windows/Linux: bin/java[.exe]
        candidates.push(path.join(entryPath, 'bin', JAVA_EXE));
      }

      for (const javaExe of candidates) {
        if (fs.existsSync(javaExe) && checkJavaVersion(javaExe)) {
          return javaExe;
        }
      }
    }
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════
// RECHERCHE JAVA SYSTÈME
// ═══════════════════════════════════════════════════════════

function findInstalledJava() {
  console.log('[Java] findInstalledJava...');

  // 1. JAVA_HOME
  if (process.env.JAVA_HOME) {
    console.log('[Java] Checking JAVA_HOME:', process.env.JAVA_HOME);
    const javaExe = path.join(process.env.JAVA_HOME, 'bin', JAVA_EXE);
    if (fs.existsSync(javaExe) && checkJavaVersion(javaExe)) return javaExe;
  }

  // 2. PATH
  console.log('[Java] Checking PATH java...');
  if (checkJavaVersion('java')) return 'java';

  // 3. Chemins standards de la plateforme
  console.log('[Java] Checking standard paths...');
  for (const searchRoot of getJavaSearchPaths()) {
    console.log('[Java] Searching in:', searchRoot);
    const found = findJavaInDir(searchRoot);
    if (found) return found;
  }

  console.log('[Java] No system Java found');
  return null;
}

// ═══════════════════════════════════════════════════════════
// TÉLÉCHARGEMENT JAVA
// ═══════════════════════════════════════════════════════════

async function downloadJava(javaDir, onProgress) {
  const url = getAdoptiumUrl();
  const isWindows = process.platform === 'win32';
  const archiveExt = isWindows ? '.zip' : '.tar.gz';
  const archivePath = path.join(javaDir, `_java21${archiveExt}`);

  console.log('[Java] Starting download from:', url);
  if (onProgress) onProgress('step', { label: 'Téléchargement de Java 21 (requis par Forge)...' });
  await fs.ensureDir(javaDir);

  console.log('[Java] Fetching with https...');
  const res = await httpsGet(url);
  console.log('[Java] Response status:', res.statusCode);
  if (res.statusCode !== 200) throw new Error(`Échec téléchargement Java 21 (HTTP ${res.statusCode})`);

  const total = parseInt(res.headers['content-length'] || '0', 10);
  console.log('[Java] Content-Length:', total);
  let downloaded = 0;
  const out = fs.createWriteStream(archivePath);

  await new Promise((resolve, reject) => {
    res.on('data', (chunk) => {
      downloaded += chunk.length;
      if (downloaded % 5000000 < chunk.length) {
        console.log('[Java] Downloaded:', Math.round(downloaded / 1024 / 1024), 'MB');
      }
      if (total && onProgress) {
        onProgress('download', {
          label: 'Java 21',
          percent: Math.round((downloaded / total) * 100)
        });
      }
    });
    res.pipe(out);
    res.on('error', (err) => {
      console.error('[Java] Stream error:', err);
      reject(err);
    });
    out.on('error', (err) => {
      console.error('[Java] Write error:', err);
      reject(err);
    });
    out.on('finish', () => {
      console.log('[Java] Download complete:', downloaded, 'bytes');
      resolve();
    });
  });

  // Extraction
  console.log('[Java] Starting extraction...');
  if (onProgress) onProgress('step', { label: 'Extraction de Java 21...' });

  if (isWindows) {
    await extractZip(archivePath, { dir: path.resolve(javaDir) });
  } else {
    console.log('[Java] Extracting tar.gz to:', javaDir);
    await tar.extract({ file: archivePath, cwd: javaDir });
    console.log('[Java] Extraction done');
  }

  console.log('[Java] Removing archive...');
  fs.removeSync(archivePath);

  // Trouver l'exécutable extrait
  console.log('[Java] Looking for java executable in:', javaDir);
  const entries = fs.readdirSync(javaDir);
  console.log('[Java] Found entries:', entries);

  for (const entry of entries) {
    const entryPath = path.join(javaDir, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;

    let javaExe;
    if (process.platform === 'darwin') {
      javaExe = path.join(entryPath, 'Contents', 'Home', 'bin', JAVA_EXE);
      if (!fs.existsSync(javaExe)) {
        javaExe = path.join(entryPath, 'bin', JAVA_EXE);
      }
    } else {
      javaExe = path.join(entryPath, 'bin', JAVA_EXE);
    }

    console.log('[Java] Checking:', javaExe);
    if (fs.existsSync(javaExe)) {
      // Permissions Unix
      if (process.platform !== 'win32') {
        fs.chmodSync(javaExe, 0o755);
      }
      console.log('[Java] Found java at:', javaExe);
      return javaExe;
    }
  }

  throw new Error(`Java 21 téléchargé mais ${JAVA_EXE} introuvable dans l'archive`);
}

// ═══════════════════════════════════════════════════════════
// FONCTION PRINCIPALE EXPORTÉE
// ═══════════════════════════════════════════════════════════

async function findOrDownloadJava(javaDir, onProgress) {
  console.log('[Java] findOrDownloadJava called, javaDir:', javaDir);

  // 1. Vérifier le JRE portable déjà téléchargé
  if (fs.existsSync(javaDir)) {
    console.log('[Java] Checking existing javaDir...');
    for (const entry of fs.readdirSync(javaDir)) {
      const entryPath = path.join(javaDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      let javaExe;
      if (process.platform === 'darwin') {
        javaExe = path.join(entryPath, 'Contents', 'Home', 'bin', JAVA_EXE);
        if (!fs.existsSync(javaExe)) {
          javaExe = path.join(entryPath, 'bin', JAVA_EXE);
        }
      } else {
        javaExe = path.join(entryPath, 'bin', JAVA_EXE);
      }

      if (fs.existsSync(javaExe) && checkJavaVersion(javaExe)) {
        return javaExe;
      }
    }
  }

  // 2. Vérifier Java système (17-21)
  const systemJava = findInstalledJava();
  if (systemJava) return systemJava;

  // 3. Télécharger depuis Adoptium
  return downloadJava(javaDir, onProgress);
}

module.exports = { findOrDownloadJava, JAVA_EXE, PLATFORM, ARCH };
