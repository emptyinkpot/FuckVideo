const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function normalizeStaticMediaPath(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('file://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }
  return raw.replace(/^\/+/, '').replace(/\\/g, '/');
}

export function isLikelyVideoFile(value?: string): boolean {
  const ext = extensionOf(value);
  return Boolean(ext && VIDEO_EXTENSIONS.has(ext));
}

export function isLikelyImageFile(value?: string): boolean {
  const ext = extensionOf(value);
  return Boolean(ext && IMAGE_EXTENSIONS.has(ext));
}

function extensionOf(value?: string): string {
  const path = normalizeStaticMediaPath(value).split(/[?#]/, 1)[0] || '';
  const match = path.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : '';
}
