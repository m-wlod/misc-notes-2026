import { inflateSync } from "node:zlib";

/**
 * WOFF 1 → plain TrueType/OpenType (sfnt), in memory. pdf-lib's fontkit reads sfnt
 * only; our fonts ship as .woff (what the share images use too). WOFF 1 is the sfnt
 * tables, each optionally zlib-compressed, behind a 44-byte header and a directory.
 * https://www.w3.org/TR/WOFF/
 */
export function woffToSfnt(woff: Uint8Array): Uint8Array {
  const src = Buffer.from(woff.buffer, woff.byteOffset, woff.byteLength);
  if (src.toString("latin1", 0, 4) !== "wOFF") throw new Error("not a WOFF 1 file");
  const flavor = src.readUInt32BE(4);
  const numTables = src.readUInt16BE(12);

  const tables: { tag: number; checksum: number; data: Buffer }[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const tag = src.readUInt32BE(e);
    const offset = src.readUInt32BE(e + 4);
    const compLength = src.readUInt32BE(e + 8);
    const origLength = src.readUInt32BE(e + 12);
    const checksum = src.readUInt32BE(e + 16);
    const raw = src.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(raw) : Buffer.from(raw);
    if (data.length !== origLength) throw new Error("WOFF table length mismatch");
    tables.push({ tag, checksum, data });
  }

  // sfnt offset table: version, numTables, searchRange, entrySelector, rangeShift.
  const pow2 = 2 ** Math.floor(Math.log2(numTables));
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(pow2 * 16, 6);
  header.writeUInt16BE(Math.log2(pow2), 8);
  header.writeUInt16BE(numTables * 16 - pow2 * 16, 10);

  const chunks: Buffer[] = [header];
  let offset = header.length;
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    header.writeUInt32BE(t.tag, r);
    header.writeUInt32BE(t.checksum, r + 4);
    header.writeUInt32BE(offset, r + 8);
    header.writeUInt32BE(t.data.length, r + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  });
  return new Uint8Array(Buffer.concat(chunks));
}
