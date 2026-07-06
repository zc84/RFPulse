import path from 'path';

function decodeUtf8Mojibake(value) {
  if (!/[\u0080-\u00ff]/.test(value)) return value;

  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) return value;

  const looksLikeUtf8Mojibake = /[ÐÑРС]/.test(value);
  const decodedContainsCyrillic = /[\u0400-\u052f]/.test(decoded);
  return looksLikeUtf8Mojibake || decodedContainsCyrillic ? decoded : value;
}

export function normalizeDocumentName(value) {
  const decoded = decodeUtf8Mojibake(String(value || ''));
  const basename = path.basename(decoded.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .normalize('NFC')
    .trim();
  return basename || 'document';
}

export function createStoredFilename(originalName) {
  const normalizedName = normalizeDocumentName(originalName);
  const extension = path.extname(normalizedName).toLowerCase();
  const safeExtension = /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : '';
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExtension}`;
}
