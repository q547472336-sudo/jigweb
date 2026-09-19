export type DecodedImageMetadata = { mimeType: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number; animated: boolean };

function u32(view: DataView, offset: number) { return view.getUint32(offset, false); }
function u24le(view: DataView, offset: number) { return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16); }
function ascii(view: DataView, offset: number, length: number) { return String.fromCharCode(...Array.from({ length }, (_, index) => view.getUint8(offset + index))); }

export function decodeImageMetadata(bytes: Uint8Array): DecodedImageMetadata | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 1, 3) === "PNG") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8; let animated = false; let width = 0; let height = 0;
    while (offset + 12 <= bytes.length) {
      const length = u32(view, offset); const type = ascii(view, offset + 4, 4);
      if (type === "IHDR" && offset + 24 <= bytes.length) { width = view.getUint32(offset + 8); height = view.getUint32(offset + 12); }
      if (type === "acTL") animated = true;
      offset += 12 + length;
      if (offset > bytes.length) break;
    }
    return width > 0 && height > 0 ? { mimeType: "image/png", width, height, animated } : null;
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = 2;
    while (offset + 4 < bytes.length) {
      if (view.getUint8(offset) !== 0xff) { offset += 1; continue; }
      const marker = view.getUint8(offset + 1); offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset); if (length < 2 || offset + length > bytes.length) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { mimeType: "image/jpeg", width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), animated: false };
      }
      offset += length;
    }
    return null;
  }
  if (bytes.length >= 30 && ascii(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0, 4) === "RIFF" && ascii(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 8, 4) === "WEBP") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = 12;
    while (offset + 8 <= bytes.length) {
      const type = ascii(view, offset, 4); const length = view.getUint32(offset + 4, true); const data = offset + 8;
      if (type === "VP8X" && data + 10 <= bytes.length) return { mimeType: "image/webp", width: 1 + u24le(view, data + 4), height: 1 + u24le(view, data + 7), animated: (view.getUint8(data) & 0x02) !== 0 };
      offset = data + length + (length % 2);
    }
  }
  return null;
}
