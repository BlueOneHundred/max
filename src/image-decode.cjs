// Max build 22 (26 Nov 2026): Electron's nativeImage reads only PNG and JPEG, so a WebP photo (Marshall Electrics'
// website serves all its photos as WebP) could not be saved as a JPEG, cropped or looked at: Fact Finder's photo saves
// all failed and the run paused. decodeImage tries nativeImage first, and for a WebP (or anything else Chromium can
// show) draws it in a hidden page and takes a PNG of it, at most maxSide pixels on the long side.
const fs = require('fs'); const os = require('os'); const path = require('path'); const crypto = require('crypto');

function webpSize(b) {
  b = Buffer.from(b);
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return {w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff};
  if (kind === 'VP8L') { const bits = b.readUInt32LE(21); return {w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1}; }
  if (kind === 'VP8X') return {w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3)};
  return null;
}

async function decodeImage(bytes, {nativeImage, renderPage, root, maxSide = 4096}) {
  const buf = Buffer.from(bytes), image = nativeImage.createFromBuffer(buf);
  if (!image.isEmpty()) return image;
  const size = webpSize(buf);
  if (!size || !renderPage) return image;
  const k = Math.min(1, maxSide / Math.max(size.w, size.h)), w = Math.max(1, Math.round(size.w * k)), h = Math.max(1, Math.round(size.h * k));
  // Inside the team folder: the page guard allows one folder at a time, and every other drawing uses the team folder.
  const dir = fs.mkdtempSync(path.join(root || os.tmpdir(), '.decode-')), file = path.join(dir, crypto.randomUUID() + '.html');
  try {
    fs.writeFileSync(file, `<!doctype html><html><head><style>*{margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden;background:#fff}img{width:${w}px;height:${h}px;display:block}</style></head><body><img src="data:image/webp;base64,${buf.toString('base64')}"></body></html>`);
    const shot = await renderPage({file, width: w, height: h, root: root || dir, quality: 95});
    return nativeImage.createFromBuffer(Buffer.from(shot.png));
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
module.exports = {decodeImage, webpSize};
