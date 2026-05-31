const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const SOURCE_ROOT = path.join(UPLOAD_ROOT, 'videos');
const HLS_ROOT = path.join(UPLOAD_ROOT, 'hls');
const TEMP_ROOT = path.join(UPLOAD_ROOT, 'tmp');
const HLS_QUALITIES = [
  { label: '360p', height: 360, bandwidth: 800000 },
  { label: '480p', height: 480, bandwidth: 1400000 },
  { label: '720p', height: 720, bandwidth: 2800000 },
  { label: '1080p', height: 1080, bandwidth: 5000000 }
];

const ensureDirectory = async (directoryPath) => {
  await fs.mkdir(directoryPath, { recursive: true });
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      windowsHide: true,
      ...options
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} finalizó con código ${code}`));
    });
  });

const escapeManifestPath = (value) =>
  String(value || '').replace(/\\/g, '/').replace(/#/g, '%23').replace(/ /g, '%20');

const getMovieSourceDir = (movieKey) => path.join(SOURCE_ROOT, String(movieKey));
const getMovieHlsDir = (movieKey) => path.join(HLS_ROOT, String(movieKey));
const getTempDir = (movieKey) => path.join(TEMP_ROOT, String(movieKey));

const cleanupDirectory = async (directoryPath) => {
  await fs.rm(directoryPath, { recursive: true, force: true });
};

const buildVariantArgs = (inputPath, outputPlaylist, outputSegmentPattern, quality) => {
  const scale = `scale=-2:${quality.height}`;

  return [
    '-y',
    '-i', inputPath,
    '-vf', scale,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '48000',
    '-b:v', String(quality.bandwidth),
    '-maxrate', String(Math.round(quality.bandwidth * 1.15)),
    '-bufsize', String(Math.round(quality.bandwidth * 1.5)),
    '-g', '48',
    '-keyint_min', '48',
    '-sc_threshold', '0',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', outputSegmentPattern,
    outputPlaylist
  ];
};

const generateMasterPlaylist = async (movieKey, variants) => {
  const movieHlsDir = getMovieHlsDir(movieKey);
  const masterPath = path.join(movieHlsDir, 'master.m3u8');

  const contents = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    ...variants.map((variant) =>
      `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution},CODECS="avc1.4d401f,mp4a.40.2"\n${escapeManifestPath(variant.playlist)}`
    )
  ].join('\n');

  await fs.writeFile(masterPath, contents, 'utf8');
  return masterPath;
};

const generateHlsPackage = async ({ movieKey, inputPath }) => {
  if (!movieKey) {
    throw new Error('movieKey es obligatorio');
  }

  if (!inputPath) {
    throw new Error('inputPath es obligatorio');
  }

  const tempDir = getTempDir(movieKey);
  const sourceDir = getMovieSourceDir(movieKey);
  const hlsDir = getMovieHlsDir(movieKey);

  await Promise.all([
    ensureDirectory(UPLOAD_ROOT),
    ensureDirectory(SOURCE_ROOT),
    ensureDirectory(HLS_ROOT),
    ensureDirectory(TEMP_ROOT),
    ensureDirectory(tempDir),
    ensureDirectory(sourceDir),
    ensureDirectory(hlsDir)
  ]);

  const savedSourcePath = path.join(sourceDir, path.basename(inputPath));
  await fs.copyFile(inputPath, savedSourcePath);

  const variants = [];

  for (const quality of HLS_QUALITIES) {
    const qualityDir = path.join(hlsDir, quality.label);
    await ensureDirectory(qualityDir);

    const playlistPath = path.join(qualityDir, `${quality.label}.m3u8`);
    const segmentPattern = path.join(qualityDir, 'segment_%05d.ts');
    const args = buildVariantArgs(savedSourcePath, playlistPath, segmentPattern, quality);

    await runCommand('ffmpeg', args);

    const width = Math.round((quality.height * 16) / 9);
    variants.push({
      label: quality.label,
      height: quality.height,
      bandwidth: quality.bandwidth,
      resolution: `${width}x${quality.height}`,
      playlist: `${quality.label}/${quality.label}.m3u8`
    });
  }

  const masterPath = await generateMasterPlaylist(movieKey, variants);
  await cleanupDirectory(tempDir);

  return {
    movieKey: String(movieKey),
    sourceFile: savedSourcePath,
    hlsDirectory: hlsDir,
    hlsManifest: masterPath,
    hlsQualities: variants
  };
};

const getManifestPath = (movieKey) => path.join(getMovieHlsDir(movieKey), 'master.m3u8');

const getAssetPath = (movieKey, relativeAssetPath) => {
  const cleanPath = String(relativeAssetPath || '').replace(/^\/+/, '');
  const movieDir = getMovieHlsDir(movieKey);
  const absolutePath = path.resolve(movieDir, cleanPath);

  if (!absolutePath.startsWith(path.resolve(movieDir))) {
    const error = new Error('Ruta inválida');
    error.statusCode = 400;
    throw error;
  }

  return absolutePath;
};

const transformPlaylist = (playlistContents, movieKey, token) => {
  const basePath = `/api/videos/${movieKey}/file`;
  return String(playlistContents)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }

      const normalizedLine = trimmed.replace(/^\/+/, '');
      return `${basePath}/${normalizedLine}?token=${encodeURIComponent(token)}`;
    })
    .join('\n');
};

module.exports = {
  generateHlsPackage,
  getManifestPath,
  getAssetPath,
  transformPlaylist,
  getMovieHlsDir,
  HLS_QUALITIES
};
