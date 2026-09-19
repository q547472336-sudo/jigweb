import assert from "node:assert/strict";
import test from "node:test";
import { decodeImageMetadata } from "./image-metadata.ts";

test("image decoder reads PNG dimensions and rejects unknown bytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0x2c, 0, 0, 1, 0x2c, 8, 6, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(decodeImageMetadata(png), { mimeType: "image/png", width: 300, height: 300, animated: false });
  assert.equal(decodeImageMetadata(new Uint8Array([1, 2, 3])), null);
});
