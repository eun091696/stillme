import { deflateSync } from "node:zlib";

function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    8 + data.length,
  );
  return result;
}

export function pngFixture(width = 4, height = 4) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc(height * (1 + width * 4));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function jpegFixture(width = 4, height = 4) {
  const startOfFrame = Buffer.alloc(17);
  startOfFrame.writeUInt16BE(17, 0);
  startOfFrame[2] = 8;
  startOfFrame.writeUInt16BE(height, 3);
  startOfFrame.writeUInt16BE(width, 5);
  startOfFrame[7] = 3;
  startOfFrame.set([1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0], 8);

  const startOfScan = Buffer.from([
    0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x3f, 0x00,
  ]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xc0]),
    startOfFrame,
    Buffer.from([0xff, 0xda]),
    startOfScan,
    Buffer.from([0x00, 0xff, 0xd9]),
  ]);
}
