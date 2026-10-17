import { assert, sha, hex, good, bad, CODEC, clone } from './pilot-oracle.mjs';
import { deflateSync } from 'node:zlib'; // Negative compressed-DEFLATE fixture only.
export const u32le = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
export const u32be = n => u32le(n).reverse();
export const be32 = (b, i) => ((b[i] * 0x1000000) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]) >>> 0;
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
export function adler32(bytes) {
  let a = 1, b = 0; for (const value of bytes) { a = (a + value) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0;
}
export function stored(bytes) {
  const out = [0x78, 0x01];
  for (let p = 0; p < bytes.length; p += 65535) {
    const len = Math.min(65535, bytes.length - p), complement = 65535 - len;
    out.push(p + len === bytes.length ? 1 : 0, len & 255, len >>> 8, complement & 255, complement >>> 8);
    for (let i = p; i < p + len; i++) out.push(bytes[i]);
  }
  out.push(...u32be(adler32(bytes))); return Uint8Array.from(out);
}
export function parseStored(bytes) {
  assert.deepEqual([...bytes.slice(0, 2)], [120, 1]);
  let p = 2; const blocks = [], out = [];
  while (p < bytes.length - 4) {
    const start = p, final = bytes[p++], length = bytes[p++] | bytes[p++] << 8, complement = bytes[p++] | bytes[p++] << 8;
    assert(final === 0 || final === 1); assert.equal(complement, length ^ 65535); assert(length > 0 && length <= 65535);
    assert(p + length <= bytes.length - 4);
    for (const v of bytes.slice(p, p + length)) out.push(v);
    p += length; blocks.push({ start, end: p, length, final }); assert.equal(final, p === bytes.length - 4 ? 1 : 0);
  }
  assert.equal(p, bytes.length - 4); assert.equal(be32(bytes, p), adler32(out)); return { blocks, payload: Uint8Array.from(out) };
}
export function chunk(type, data) {
  const name = [...new TextEncoder().encode(type)], body = [...name, ...data];
  return Uint8Array.from([...u32be(data.length), ...body, ...u32be(crc32(body))]);
}
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export function png(width, height, rgba) {
  const scanlines = [];
  for (let y = 0; y < height; y++) { scanlines.push(0); for (const b of rgba.slice(y * width * 4, (y + 1) * width * 4)) scanlines.push(b); }
  return Uint8Array.from([...SIGNATURE, ...chunk('IHDR', [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]), ...chunk('IDAT', stored(scanlines)), ...chunk('IEND', [])]);
}
export function decode(bytes) {
  assert.deepEqual([...bytes.slice(0, 8)], SIGNATURE); let p = 8; const chunks = [];
  while (p < bytes.length) {
    const n = be32(bytes, p), type = new TextDecoder().decode(bytes.slice(p + 4, p + 8)), data = bytes.slice(p + 8, p + 8 + n);
    assert.equal(be32(bytes, p + 8 + n), crc32(bytes.slice(p + 4, p + 8 + n))); chunks.push({ type, data }); p += n + 12;
  }
  assert.equal(p, bytes.length); assert.deepEqual(chunks.map(c => c.type), ['IHDR', 'IDAT', 'IEND']);
  const ihdr = chunks[0].data, width = be32(ihdr, 0), height = be32(ihdr, 4);
  assert(width > 0 && height > 0); assert.deepEqual([...ihdr.slice(8)], [8, 6, 0, 0, 0]); assert.equal(chunks[2].data.length, 0);
  const { payload, blocks } = parseStored(chunks[1].data); assert.equal(payload.length, height * (1 + width * 4));
  const rgba = [];
  for (let y = 0; y < height; y++) { assert.equal(payload[y * (1 + width * 4)], 0); for (const v of payload.slice(y * (1 + width * 4) + 1, (y + 1) * (1 + width * 4))) rgba.push(v); }
  return { width, height, rgba, blocks, idat: chunks[1].data };
}
export const rgbaHash = (w, h, pixels) => sha(Uint8Array.from([...u32le(w), ...u32le(h), ...pixels]));
export function pixelPattern(w, h) {
  const rgba = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.push(x & 255, y & 255, (x + y) & 255, 255); return rgba;
}
export function cropBounds(bounds, transform) {
  const [x, y, w, h] = bounds, [a, b, c, d, e, f] = transform;
  const points = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
  return [Math.floor(Math.min(...points.map(p => p[0]))), Math.floor(Math.min(...points.map(p => p[1]))), Math.ceil(Math.max(...points.map(p => p[0]))), Math.ceil(Math.max(...points.map(p => p[1])))];
}
export const sourcePixels = [1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255,13,14,15,255,16,17,18,255];
export const maskedPixels = [1,2,3,255,127,127,127,255,7,8,9,255,10,11,12,255,13,14,15,255,16,17,18,255];
export function imageCases() {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(adler32(new TextEncoder().encode('Wikipedia')), 0x11e60398);
  const bytes = png(3, 2, maskedPixels);
  assert.equal(rgbaHash(3, 2, maskedPixels), 'ce498a4c03778d930ccd0fb7c8d131354411078735b91921825efd511d94d7a8');
  assert.equal(sha(bytes), 'facaaab2f65212b4f83f6ff6201e11cb802bb04b0ff1a8b5003bfe0a0578891c'); assert.equal(bytes.length, 94);
  assert.deepEqual(decode(bytes).rgba, maskedPixels);
  const base = { widthPx: 3, heightPx: 2, sourceRgba: sourcePixels, derivativeRgba: maskedPixels, maskRectanglesPx: [[1,0,1,1]], codecId: CODEC, pngBytes: [...bytes], derivativeFileSha256: sha(bytes), derivativeRgbaSha256: rgbaHash(3,2,maskedPixels) };
  good('derivative', base, { widthPx: 3, heightPx: 2, fileSha256: sha(bytes), rgbaSha256: rgbaHash(3,2,maskedPixels), byteLength: 94 });
  for (const [label, fn, field] of [
    ['exterior', f => { f.derivativeRgba[0] ^= 1; }, 'derivativeRgba'],
    ['mask-alpha', f => { f.derivativeRgba[7] = 254; }, 'derivativeRgba'],
    ['duplicate-mask', f => f.maskRectanglesPx.push([1,0,1,1]), 'maskRectanglesPx'],
    ['out-of-range-mask', f => { f.maskRectanglesPx[0][0] = 3; }, 'maskRectanglesPx'],
    ['zero-width-mask', f => { f.maskRectanglesPx[0][2] = 0; }, 'maskRectanglesPx'],
    ['big-endian-dimensions', f => { f.derivativeRgbaSha256 = sha(Uint8Array.from([...u32be(3),...u32be(2),...maskedPixels])); }, 'derivativeRgbaSha256'],
    ['bottom-up', f => { f.derivativeRgba = [...f.derivativeRgba.slice(12), ...f.derivativeRgba.slice(0,12)]; }, 'derivativeRgba'],
    ['decode-width', f => { f.widthPx = 2; }, 'widthPx'], ['decode-hash', f => { f.derivativeRgbaSha256 = '0'.repeat(64); }, 'derivativeRgbaSha256'],
  ]) bad('derivative', base, fn, 'canonical-png', field, 'RangeError', label);
  for (const [width,height,payloadBytes,streamLength,idatHash,pngLength,pngHash] of [
    [64,255,65535,65546,'eb44697f4de622d087fdc539c6f1b61bf1c856b24897f53bbf424d8be16e71ac',65603,'c0b5b070084e0f58cea7b60449ea1a99719c619adfdd6375a4cf2c686c60dc07'],
    [16384,1,65537,65553,'b6ecf0d57058bc7883248568655c57f103fd6926f9330e69db3ad4eb515ef5b4',65610,'eb8d1eca0e065338a3a6ca9c04898568af22ec4e013530c5d9ef869664fed154'],
    [64,511,131327,131348,'030b8718c90dd509aac5b3312f6677e3a87c267413e83de4873a378325a27c54',131405,'c0a06dbe2d0e810ae986be96cdd6db45dc42050367599d27d9d89c68c3bee333'],
  ]) {
    const rgba = pixelPattern(width,height), encoded = png(width,height,rgba), parsed = decode(encoded);
    assert.equal(height*(1+4*width), payloadBytes); assert.equal(parsed.idat.length,streamLength); assert.equal(sha(parsed.idat),idatHash); assert.equal(encoded.length,pngLength); assert.equal(sha(encoded),pngHash); assert.deepEqual(parsed.rgba,rgba);
    good('canonical-png', { pngBytes: [...encoded], widthPx: width, heightPx: height, rgbaSha256: rgbaHash(width,height,rgba) }, { byteLength: pngLength, fileSha256: pngHash, rgbaSha256: rgbaHash(width,height,rgba), storedBlockLengths: parsed.blocks.map(b => b.length) });
  }
  for (const [length,streamLength,expected,adler] of [
    [65535,65546,'9881331fd58a9bbabb90ab8183df28d656aa8842e9803b9c59887f4dba2e5652','76e7fc24'],
    [65536,65552,'859a87cf3e62ebc586ea75afd22590201cec9f4b7264e77660902135d20fa2db','7332fc3c'],
    [131071,131092,'1f94cbdc18866a65579e3affe1306e380cce9a444b7548c92f0aa79b784073a8','6517fac6'],
  ]) {
    const payload = Array.from({length}, (_,i)=>i%251), stream = stored(payload), parsed = parseStored(stream);
    assert.equal(stream.length,streamLength); assert.equal(sha(stream),expected); assert.equal(hex(stream.slice(-4)),adler); assert.deepEqual([...parsed.payload],payload);
    const fixture = { zlibBytes: [...stream], expectedPayloadBytes: payload };
    good('stored-deflate',fixture, { payloadByteLength:length, storedBlockLengths:parsed.blocks.map(b=>b.length), adler32Hex:adler });
    for (const block of parsed.blocks) for (const [label, offset, bit] of [['BFINAL',0,1],['BTYPE',0,2],['LEN',1,1],['NLEN',3,1]]) bad('stored-deflate',fixture,f=>{ f.zlibBytes[block.start+offset]^=bit; },'canonical-deflate','zlibBytes','RangeError',`${length}/${block.start}/${label}`);
    for (const label of ['missing-block','extra-block','reorder-block','payload-missing','payload-duplicate','bad-adler']) {
      if (label==='reorder-block' && parsed.blocks.length<2) continue;
      bad('stored-deflate',fixture,f=>{
        if(label==='missing-block') f.zlibBytes.splice(parsed.blocks[0].start,parsed.blocks[0].end-parsed.blocks[0].start);
        if(label==='extra-block') f.zlibBytes.splice(stream.length-4,0,...stream.slice(2,7));
        if(label==='reorder-block') { const a=parsed.blocks[0],b=parsed.blocks[1]; f.zlibBytes=[...stream.slice(0,2),...stream.slice(b.start,b.end),...stream.slice(a.start,a.end),...stream.slice(b.end)]; }
        if(label==='payload-missing') f.zlibBytes.splice(7,1);
        if(label==='payload-duplicate') f.zlibBytes.splice(7,0,f.zlibBytes[7]);
        if(label==='bad-adler') f.zlibBytes[f.zlibBytes.length-1]^=1;
      },'canonical-deflate','zlibBytes','RangeError',`${length}/${label}`);
    }
  }
  const parsed = decode(bytes), ihdr = bytes.slice(8,33), idat = parsed.idat;
  const make = chunks => [...SIGNATURE,...chunks.flatMap(c=>[...c])];
  for (const type of ['iCCP','eXIf','tEXt','tIME','gAMA']) bad('derivative',base,f=>{f.pngBytes=make([ihdr,chunk(type,[0]),chunk('IDAT',idat),chunk('IEND',[])]);},'canonical-png','pngBytes','RangeError',type);
  for (const type of ['IHDR','IDAT','IEND']) bad('derivative',base,f=>{const ch=[ihdr,chunk('IDAT',idat),chunk('IEND',[])];ch.splice(type==='IHDR'?1:type==='IDAT'?2:3,0,ch[type==='IHDR'?0:type==='IDAT'?1:2]);f.pngBytes=make(ch);},'canonical-png','pngBytes','RangeError',`duplicate-${type}`);
  bad('derivative',base,f=>{f.pngBytes=make([ihdr,chunk('IDAT',idat.slice(0,10)),chunk('IDAT',idat.slice(10)),chunk('IEND',[])]);},'canonical-png','pngBytes','RangeError','split-IDAT');
  for (const [label,mutate] of [['filter',s=>{s[7]=1;}],['compressed',s=>{s[2]=3;}],['bad-crc',s=>{s[s.length-1]^=1;}]]) bad('derivative',base,f=>{const s=[...idat];mutate(s);f.pngBytes=make([ihdr,chunk('IDAT',s),chunk('IEND',[])]);},'canonical-png','pngBytes','RangeError',label);
  const rawScanlines=parseStored(idat).payload;
  bad('derivative',base,f=>{const raw=Uint8Array.from(rawScanlines);raw[0]=1;f.pngBytes=make([ihdr,chunk('IDAT',stored(raw)),chunk('IEND',[])]);},'canonical-png','pngBytes','RangeError','filter-nonzero-with-valid-Adler-and-CRC');
  bad('derivative',base,f=>{f.pngBytes=make([ihdr,chunk('IDAT',deflateSync(rawScanlines,{level:9})),chunk('IEND',[])]);},'canonical-png','pngBytes','RangeError','compressed-with-valid-Adler-and-CRC');
  for(const position of [32,81,93])bad('derivative',base,f=>{f.pngBytes[position]^=1;},'canonical-png','pngBytes','RangeError',`chunk-CRC-${position}`);
  bad('derivative',base,f=>{f.derivativeRgba=f.derivativeRgba.slice();for(let y=0;y<2;y++){const row=f.derivativeRgba.slice(y*12,y*12+12);f.derivativeRgba.splice(y*12,12,...row.slice(8,12),...row.slice(4,8),...row.slice(0,4));}},'canonical-png','derivativeRgba','RangeError','horizontal-flip');
  const viewport = { panelBoundsPdfPt:[0.2,0.3,1.1,0.8],viewportTransform:[1.25,0.1,-0.2,1.5,1,2],pageWidthPx:10,pageHeightPx:10,cropPixelBounds:[1,2,3,4],paddingAllowed:false };
  assert.deepEqual(cropBounds(viewport.panelBoundsPdfPt,viewport.viewportTransform),[1,2,3,4]);good('viewport-crop',viewport,[1,2,3,4]);
  for(const [label,fn,field] of [['round',f=>{f.cropPixelBounds[0]=2;},'cropPixelBounds'],['clamp',f=>{f.panelBoundsPdfPt[0]=-10;},'panelBoundsPdfPt'],['padding',f=>{f.paddingAllowed=true;},'paddingAllowed'],['rotation',f=>{f.viewportTransform=[0,1,-1,0,10,0];},'cropPixelBounds'],['interpolation',f=>{f.interpolation='bilinear';},'interpolation']]) bad('viewport-crop',viewport,fn,'crop-invalid',field,'RangeError',label);
  const crop={pageWidthPx:3,pageHeightPx:2,pageRgba:sourcePixels,panelBoundsPdfPt:[1,0,2,2],viewportTransform:[1,0,0,1,0,0],cropPixelBounds:[1,0,3,2],sourceCropWidthPx:2,sourceCropHeightPx:2,sourceCropRgba:[4,5,6,255,7,8,9,255,13,14,15,255,16,17,18,255]};
  assert.deepEqual(cropBounds(crop.panelBoundsPdfPt,crop.viewportTransform),[1,0,3,2]);
  good('raster-crop',crop,{widthPx:2,heightPx:2,rgba:crop.sourceCropRgba,rgbaSha256:rgbaHash(2,2,crop.sourceCropRgba)});
  for(const [label,fn,field]of[['inclusive-end',f=>{f.sourceCropWidthPx=3;},'sourceCropWidthPx'],['row-order',f=>{f.sourceCropRgba=[...f.sourceCropRgba.slice(8),...f.sourceCropRgba.slice(0,8)];},'sourceCropRgba'],['outside-page',f=>{f.cropPixelBounds[2]=4;},'cropPixelBounds'],['wrong-copy',f=>{f.sourceCropRgba[0]^=1;},'sourceCropRgba']])bad('raster-crop',crop,fn,'crop-invalid',field,'RangeError',label);
  return clone(base);
}
