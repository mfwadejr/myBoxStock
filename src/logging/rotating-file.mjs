// LOGGING / rotating-file — append-only file that rotates by size (file.log -> file.log.1 -> ...).
import fs from 'node:fs';
import path from 'node:path';

export class RotatingFile {
  constructor(file, maxBytes, keep) {
    this.file = file; this.maxBytes = maxBytes; this.keep = keep;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    this.open();
  }
  open() { this.stream = fs.createWriteStream(this.file, { flags: 'a' }); this.stream.on('error', () => {}); }
  write(line) {
    if (this.size + line.length > this.maxBytes) this.rotate();
    this.stream.write(line); this.size += line.length;
  }
  rotate() {
    this.stream.end();
    for (let i = this.keep - 1; i >= 1; i--) { try { fs.renameSync(`${this.file}.${i}`, `${this.file}.${i + 1}`); } catch {} }
    try { fs.renameSync(this.file, `${this.file}.1`); } catch {}
    try { fs.rmSync(`${this.file}.${this.keep + 1}`, { force: true }); } catch {}
    this.size = 0; this.open();
  }
  close() { return new Promise(res => this.stream.end(res)); }
}
