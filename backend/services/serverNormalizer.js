const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be'
];

const EMBED_HOSTS = [
  'streamwish.to',
  'streamwish.com',
  'streamwish.eu',
  'voe.sx',
  'vidlink.pro',
  'filemoon.sx',
  'mixdrop.co',
  'dood.watch',
  'dailymotion.com',
  'www.dailymotion.com',
  'vimeo.com',
  'www.vimeo.com',
  'twitch.tv',
  'www.twitch.tv',
  'drive.google.com',
  'www.drive.google.com',
  'dropbox.com',
  'www.dropbox.com'
];

const normalizeString = (value) => String(value || '').trim();

const extractIframeSrc = (value) => {
  const text = normalizeString(value);
  if (!text) {
    return '';
  }

  const srcMatch = text.match(/<(?:iframe|embed|object)[^>]*\ssrc=["']([^"']+)["']/i);
  if (srcMatch?.[1]) {
    return normalizeString(srcMatch[1]);
  }

  const dataMatch = text.match(/data-src=["']([^"']+)["']/i);
  if (dataMatch?.[1]) {
    return normalizeString(dataMatch[1]);
  }

  return '';
};

const parseUrl = (value) => {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }

  try {
    return new URL(text);
  } catch {
    return null;
  }
};

const getPathExtension = (value) => {
  const parsedUrl = parseUrl(value);
  if (!parsedUrl) {
    return '';
  }

  const pathname = parsedUrl.pathname.split('/').pop() || '';
  const extension = pathname.includes('.') ? pathname.split('.').pop() : '';
  return extension.toLowerCase();
};

const parseYoutubeId = (value) => {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }

  const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/|u\/\w\/))([a-zA-Z0-9_-]{11})/i);
  if (match?.[1]) {
    return match[1];
  }

  try {
    const parsedUrl = new URL(text);
    const host = parsedUrl.hostname.toLowerCase();

    if (host.includes('youtu.be')) {
      const shortId = parsedUrl.pathname.replace('/', '').slice(0, 11);
      return shortId.length === 11 ? shortId : null;
    }

    const searchId = parsedUrl.searchParams.get('v');
    if (searchId && searchId.length === 11) {
      return searchId;
    }
  } catch {
    return null;
  }

  return null;
};

const getHostname = (value) => {
  const parsedUrl = parseUrl(value);
  return parsedUrl ? parsedUrl.hostname.toLowerCase() : '';
};

const isEmbedMarkup = (value) => /<(iframe|embed|object)\b/i.test(normalizeString(value));

const detectServerType = (value, declaredType = '') => {
  const text = normalizeString(value);
  const normalizedDeclaredType = normalizeString(declaredType).toLowerCase();

  if (!text) {
    return 'invalid';
  }

  if (parseYoutubeId(text) || normalizedDeclaredType === 'youtube') {
    return 'youtube';
  }

  if (isEmbedMarkup(text) || normalizedDeclaredType === 'embed') {
    return 'embed';
  }

  const extension = getPathExtension(text);
  if (extension === 'm3u8' || normalizedDeclaredType === 'm3u8' || normalizedDeclaredType === 'hls') {
    return 'hls';
  }

  if (['mp4', 'webm', 'mov', 'mkv'].includes(extension) || normalizedDeclaredType === 'mp4') {
    return 'mp4';
  }

  const host = getHostname(text);
  if (host && (YOUTUBE_HOSTS.includes(host) || host.endsWith('.youtube.com') || host.endsWith('.youtube-nocookie.com'))) {
    return 'youtube';
  }

  if (host && EMBED_HOSTS.some((knownHost) => host === knownHost || host.endsWith(`.${knownHost}`))) {
    return 'embed';
  }

  if (normalizedDeclaredType === 'iframe') {
    return 'iframe';
  }

  return 'iframe';
};

const normalizeServer = (entry, index = 0) => {
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string') {
    const text = normalizeString(entry);
    if (!text) {
      return null;
    }

    const extractedSrc = extractIframeSrc(text);
    const url = extractedSrc || text;
    const type = detectServerType(url, extractedSrc ? 'iframe' : '');

    return {
      name: `Servidor ${index + 1}`,
      type,
      url,
      status: 'active',
      order: index
    };
  }

  if (typeof entry !== 'object') {
    return null;
  }

  const name = normalizeString(entry.name) || `Servidor ${index + 1}`;
  const rawCode = normalizeString(entry.code || entry.html || entry.embed_code || entry.embed);
  const rawUrl = normalizeString(entry.url || entry.link || entry.value || entry.src || '');
  const extractedSrc = rawUrl || extractIframeSrc(rawCode);
  const url = extractedSrc || rawUrl || rawCode;

  if (!url) {
    return null;
  }

  const type = detectServerType(url, entry.type);
  const status = normalizeString(entry.status).toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const orderValue = Number(entry.order);

  return {
    name,
    type,
    url,
    status,
    order: Number.isFinite(orderValue) ? orderValue : index
  };
};

const parseServers = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeServer(entry, index)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const text = normalizeString(value);
    if (!text) {
      return [];
    }

    try {
      return parseServers(JSON.parse(text));
    } catch {
      return text
        .split(/\r?\n/)
        .map((line, index) => normalizeServer(line, index))
        .filter(Boolean);
    }
  }

  if (value && typeof value === 'object') {
    return [normalizeServer(value, 0)].filter(Boolean);
  }

  return [];
};

module.exports = {
  parseServers,
  normalizeServer,
  detectServerType,
  parseYoutubeId,
  extractIframeSrc
};
