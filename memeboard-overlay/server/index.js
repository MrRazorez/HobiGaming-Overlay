import 'dotenv/config';
import express from 'express';
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import qrcode from 'qrcode-terminal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REQUIRED_ENV = ['PORT', 'MEDIA_DIR', 'WIFI_INTERFACE'];

const envPath = path.join(ROOT, '.env');
if (!fs.existsSync(envPath)) {
  console.error('[!] File .env tidak ditemukan di: ' + envPath);
  console.error('    Buat file .env dengan isi:');
  console.error('      PORT=3001');
  console.error('      MEDIA_DIR=kumpulan_media');
  console.error('      WIFI_INTERFACE=Nama Perangkat Wi-Fi');
  process.exit(1);
}

const missing = REQUIRED_ENV.filter((k) => !process.env[k] || !process.env[k].trim());
if (missing.length > 0) {
  console.error('[!] Variabel berikut belum diisi di .env: ' + missing.join(', '));
  process.exit(1);
}

const PORT = Number(process.env.PORT);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[!] PORT tidak valid: '${process.env.PORT}'. Gunakan angka 1-65535.`);
  process.exit(1);
}

const MEDIA_DIR = path.resolve(ROOT, process.env.MEDIA_DIR.trim());
const WIFI_INTERFACE = process.env.WIFI_INTERFACE.trim();

const ALLOWED = { '.wav': 'sound', '.webm': 'meme' };

try {
  if (fs.existsSync(MEDIA_DIR)) {
    if (!fs.statSync(MEDIA_DIR).isDirectory()) {
      console.error(`[!] '${MEDIA_DIR}' sudah ada tetapi bukan folder.`);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    console.log(`[i] Folder media belum ada, sudah dibuat otomatis: ${MEDIA_DIR}`);
  }
} catch (err) {
  console.error(`[!] Gagal menyiapkan folder media '${MEDIA_DIR}': ${err.message}`);
  process.exit(1);
}

const listItems = () => {
  return fs
    .readdirSync(MEDIA_DIR, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => ({ file: d.name, ext: path.extname(d.name).toLowerCase() }))
    .filter((f) => ALLOWED[f.ext])
    .map((f) => ({
      file: f.file,
      label: path.basename(f.file, path.extname(f.file)),
      type: ALLOWED[f.ext],
      url: '/media/' + encodeURIComponent(f.file),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id', { numeric: true }));
}

const getWifiIp = () => {
  const nets = os.networkInterfaces();
  const isV4 = (n) => (n.family === 'IPv4' || n.family === 4) && !n.internal;
  const found = (nets[WIFI_INTERFACE] || []).find(isV4);
  if (found) return found.address;

  console.warn(`[!] Interface '${WIFI_INTERFACE}' tidak ditemukan atau tidak punya IPv4.`);
  console.warn('    Interface yang tersedia: ' + Object.keys(nets).join(', '));
  console.warn('    Atur WIFI_INTERFACE di file .env.');
  return 'localhost';
}

const app = express();

app.use('/media', express.static(MEDIA_DIR));

app.get('/api/items', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(listItems());
});

app.get('/', (req, res) => res.redirect('/remote'));
app.use(express.static(DIST));
app.get(['/overlay', '/remote'], (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'play') {
      const item = listItems().find((i) => i.file === msg.file);
      if (item) broadcast({ type: 'play', item });
    } else if (msg.type === 'stop') {
      broadcast({ type: 'stop' });
    }
  });
});

let timer;
try {
  fs.watch(MEDIA_DIR, () => {
    clearTimeout(timer);
    timer = setTimeout(() => broadcast({ type: 'items-changed' }), 300);
  });
} catch (err) {
  console.warn('fs.watch tidak aktif, gunakan tombol refresh di remote.', err.message);
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getWifiIp();
  const links = [
    { nama: 'Untuk overlay di OBS, Prism Live, dll', url: `http://localhost:${PORT}/overlay` },
    { nama: 'Untuk remote control di HP', url: `http://${ip}:${PORT}/remote` },
  ];

  console.log('');
  console.log('=== HobiGaming Soundboard & Memeboard ===');
  links.forEach((l, i) => {
    console.log(`${i + 1}. ${l.nama}`);
    console.log(`   ${l.url}`);
  });
  console.log('');
  console.log(`Folder media : ${MEDIA_DIR}`);
  console.log(`Item terbaca : ${listItems().length} file`);
  if (!fs.existsSync(DIST)) {
    console.warn('[!] Folder dist belum ada. Jalankan: npm run build');
  }
  console.log('');
  console.log('--- QR CODE untuk mengakses Remote Control ---');
  qrcode.generate(links[1].url, { small: true });
});