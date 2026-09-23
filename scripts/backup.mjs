import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { projectFiles, projectRoot } from './project-files.mjs';

// Standard ZIP (deflate + UTF-8), with no platform-specific zip command or runtime dependency.
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDate(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date:
      ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}
const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const files = await projectFiles();
if (files.length > 65535) throw new Error('Archive exceeds ZIP32 file count limit.');
const entries = [];
const directory = [];
let offset = 0;
for (const file of files) {
  const filename = Buffer.from(`Bozkurt-Obasi/${file}`, 'utf8');
  const bytes = await readFile(path.join(projectRoot, file));
  const compressed = deflateRawSync(bytes, { level: 9 });
  const crc = crc32(bytes);
  const modified = dosDate((await stat(path.join(projectRoot, file))).mtime);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(modified.time, 10);
  header.writeUInt16LE(modified.date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(modified.time, 12);
  central.writeUInt16LE(modified.date, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE(offset, 42);
  entries.push(header, filename, compressed);
  directory.push(central, filename);
  offset += header.length + filename.length + compressed.length;
  if (offset > 0xffffffff) throw new Error('Archive exceeds ZIP32 size limit.');
}
const centralDirectory = Buffer.concat(directory);
const footer = Buffer.alloc(22);
footer.writeUInt32LE(0x06054b50, 0);
footer.writeUInt16LE(files.length, 8);
footer.writeUInt16LE(files.length, 10);
footer.writeUInt32LE(centralDirectory.length, 12);
footer.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...entries, centralDirectory, footer]);
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const name = `Bozkurt-Obasi-v${packageInfo.version}-${timestamp}.zip`;
const output = path.join(projectRoot, 'artifacts', name);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, archive);
const sha256 = createHash('sha256').update(archive).digest('hex');
await writeFile(`${output}.sha256`, `${sha256}  ${name}\n`);
console.log(
  JSON.stringify({ output, files: files.length, bytes: archive.length, sha256 }, null, 2),
);
