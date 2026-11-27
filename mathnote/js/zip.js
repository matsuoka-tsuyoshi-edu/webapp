// 外部依存ゼロの純粋JavaScript ZIPリーダ・ライタ
// 書き込み: Store (method 0) + UTF-8ファイル名フラグ (0x0800) + 正確なCRC32
// 読み込み: Store (method 0) および Deflate (method 8: DecompressionStream対応)

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/**
 * 複数ファイルをZIPアーカイブ(Blob)にまとめる
 * @param {Array<{name: string, data: Uint8Array|string}>} files
 * @returns {Blob}
 */
export function createZipBlob(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const dataBytes = typeof file.data === 'string'
      ? textEncoder.encode(file.data)
      : (file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data));
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local File Header (30 bytes + name)
    const lfh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true);         // version needed
    lv.setUint16(6, 0x0800, true);     // UTF-8 flag
    lv.setUint16(8, 0, true);          // compression: Store
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // extra len
    lfh.set(nameBytes, 30);

    localParts.push(lfh, dataBytes);

    // Central Directory Header (46 bytes + name)
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true);         // version made by
    cv.setUint16(6, 20, true);         // version needed
    cv.setUint16(8, 0x0800, true);     // UTF-8 flag
    cv.setUint16(10, 0, true);         // compression: Store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // extra len
    cv.setUint16(32, 0, true);         // comment len
    cv.setUint16(34, 0, true);         // disk number
    cv.setUint16(36, 0, true);         // internal attr
    cv.setUint32(38, 0, true);         // external attr
    cv.setUint32(42, offset, true);    // local header offset
    cdh.set(nameBytes, 46);

    centralParts.push(cdh);
    offset += lfh.length + dataBytes.length;
  }

  let cdSize = 0;
  for (const part of centralParts) cdSize += part.length;

  // End of Central Directory (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

async function inflateRaw(compressedBytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('このブラウザでは圧縮ZIP(Deflate)の展開に対応していません。');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressedBytes);
  writer.close();
  const res = new Response(ds.readable);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * ZIPバイナリ(ArrayBuffer)を読み取り、Map<filename, Uint8Array>を返す
 */
export async function readZipBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // End of Central Directory を後ろから探索
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('有効なZIPファイルではありません。');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const result = new Map();

  for (let idx = 0; idx < totalEntries; idx++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) {
      throw new Error('ZIPのセントラルディレクトリが破損しています。');
    }
    const compression = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const nameBytes = bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen);
    const fileName = textDecoder.decode(nameBytes);

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error('ZIPのローカルヘッダが破損しています。');
    }
    const lhNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lhExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const rawSlice = bytes.slice(dataStart, dataStart + compSize);

    if (!fileName.endsWith('/')) {
      if (compression === 0) {
        result.set(fileName, rawSlice);
      } else if (compression === 8) {
        result.set(fileName, await inflateRaw(rawSlice));
      } else {
        throw new Error(`未対応のZIP圧縮方式です (method=${compression})`);
      }
    }

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  return result;
}
