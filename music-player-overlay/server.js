import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import qrcode from 'qrcode-terminal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'client', 'dist');
const PLAYLISTS_FILE = path.join(__dirname, 'playlists.json');
const MAX_QUEUE = 200;

const fail = (...lines) => {
    console.error('\n[ERROR]', ...lines, '\n');
    process.exit(1);
}

const REQUIRED = ['PORT', 'MUSIC_DIR', 'WIFI_INTERFACE'];
const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length) {
    fail(
        'Konfigurasi .env belum lengkap. Variabel berikut wajib diisi:\n' +
        missing.map((k) => `  - ${k}`).join('\n') +
        '\n\nLihat contoh di file .env.example'
    );
}

const PORT = Number(process.env.PORT.trim());
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    fail(`PORT tidak valid: "${process.env.PORT}". Isi angka 1-65535.`);
}

const MUSIC_DIR = path.resolve(__dirname, process.env.MUSIC_DIR.trim());
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    console.log(`[INFO] Folder lagu belum ada, dibuat otomatis: ${MUSIC_DIR}`);
} else if (!fs.statSync(MUSIC_DIR).isDirectory()) {
    fail(`MUSIC_DIR menunjuk ke file, bukan folder: ${MUSIC_DIR}`);
}

const getWifiIp = () => {
    const nets = os.networkInterfaces();
    const name = process.env.WIFI_INTERFACE.trim();
    const isV4 = (n) => (n.family === 'IPv4' || n.family === 4) && !n.internal;

    const ip = nets[name]?.find(isV4)?.address;
    if (ip) return ip;

    const available = Object.entries(nets)
        .map(([n, list]) => [n, list.find(isV4)?.address])
        .filter(([, addr]) => addr)
        .map(([n, addr]) => `  - ${n}  (${addr})`)
        .join('\n');

    fail(
        `Adapter "${name}" tidak ditemukan atau belum punya alamat IPv4.\n` +
        `Adapter yang tersedia:\n${available || '  (tidak ada)'}\n\n` +
        'Salin salah satu nama di atas ke WIFI_INTERFACE di .env'
    );
}
const WIFI_IP = getWifiIp();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const isLoopback = (addr = '') => {
    const a = addr.replace(/^::ffff:/, '');
    return a === '::1' || a.startsWith('127.');
};

app.use('/overlay', (req, res, next) => {
    if (isLoopback(req.socket.remoteAddress)) return next();
    res
        .status(403)
        .type('text')
        .send('403 - Overlay hanya bisa dibuka dari komputer ini (localhost).');
});

io.use((socket, next) => {
    const wantsOverlay = socket.handshake.query.role === 'overlay';
    if (wantsOverlay && !isLoopback(socket.request.socket.remoteAddress)) {
        return next(new Error('Overlay hanya boleh terhubung dari localhost'));
    }
    next();
});

const parseTrack = (file) => {
    const name = path.parse(file).name;
    const m = name.match(/^(.+?)\s[-–—]\s(.+)$/);
    return m
    ? { file, artist: m[1].trim(), title: m[2].trim() }
    : { file, artist: '', title: name.trim() };
}

const listTracks = () => {
    return fs
        .readdirSync(MUSIC_DIR)
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .sort((a, b) => a.localeCompare(b))
        .map(parseTrack);
}

const trackExists = (file) => listTracks().some((t) => t.file === file);

const loadPlaylists = () => {
    if (!fs.existsSync(PLAYLISTS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
        if (!Array.isArray(data)) throw new Error('format harus berupa array');
        return data
            .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
            .map((p) => ({
            id: p.id,
            name: p.name,
            files: Array.isArray(p.files) ? p.files.filter((f) => typeof f === 'string') : [],
        }));
    } catch(e) {
        const bak = PLAYLISTS_FILE + '.bak';
        fs.copyFileSync(PLAYLISTS_FILE, bak);
        console.warn(
            `[WARN] playlists.json rusak (${e.message}). Disalin ke ${path.basename(bak)}, memulai dengan daftar kosong.`
        );
        return [];
    }
}

let playlists = loadPlaylists();

const savePlaylists = () => {
    const tmp = PLAYLISTS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(playlists, null, 2));
    fs.renameSync(tmp, PLAYLISTS_FILE);
}

const playlistsView = () => {
    const byFile = new Map(listTracks().map((t) => [t.file, t]));
    return playlists.map((p) => ({
        id: p.id,
        name: p.name,
        tracks: p.files.map((f) => byFile.get(f)).filter(Boolean),
    }));
}

const emitPlaylists = (to = io.to('remote')) => to.emit('playlists', playlistsView());

const persistPlaylists = () => {
    try {
        savePlaylists();
    } catch(e) {
        console.warn('[WARN] Gagal menyimpan playlists.json:', e.message);
    }
    emitPlaylists();
}

const findPl = (id) => playlists.find((p) => p.id === id);

app.get('/api/tracks', (req, res) => res.json(listTracks()));
app.use('/media', express.static(MUSIC_DIR));

app.use(express.static(DIST));
app.get(['/overlay', '/remote'], (req, res) =>
  res.sendFile(path.join(DIST, 'index.html'))
);
app.get('/', (req, res) => res.redirect('/remote'));

let watchTimer;
fs.watch(MUSIC_DIR, () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
        io.emit('tracks-changed');
        emitPlaylists();
    }, 300);
});

const state = {
    track: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    shuffle: false,
    loop: 'off',
    queue: [],
    activePlaylist: null,
    fromQueue: false,
};
let ctxRef = null;

const toOverlay = (ev, data) => io.to('overlay').emit(ev, data);
const broadcast = () => io.to('remote').emit('state', state);

const contextList = (plId = state.activePlaylist) => {
    const all = listTracks();
    const pl = plId && findPl(plId);
    if (!pl) return all;
    const byFile = new Map(all.map((t) => [t.file, t]));
    return pl.files.map((f) => byFile.get(f)).filter(Boolean);
}

const playFile = (file, fromQueue = false) => {
    const track = listTracks().find((t) => t.file === file);
    if (!track) return false;
    state.track = track;
    state.fromQueue = fromQueue;
    if (!fromQueue) ctxRef = file;
    state.playing = true;
    state.currentTime = 0;
    state.duration = 0;
    toOverlay('load', { track, autoplay: true, startAt: 0, volume: state.volume });
    broadcast();
    return true;
}

const stop = () => {
    state.track = null;
    state.fromQueue = false;
    state.playing = false;
    state.currentTime = 0;
    state.duration = 0;
    toOverlay('stop');
    broadcast();
}

const takeFromQueue = () => {
    const existing = new Set(listTracks().map((t) => t.file));
    while (state.queue.length) {
        const item = state.queue.shift();
        if (existing.has(item.file)) return item;
    }
    return null;
}

const pickFromContext = (dir, auto) => {
    const list = contextList();
    if (!list.length) return null;
    const i = list.findIndex((t) => t.file === ctxRef);

    if (state.shuffle && list.length > 1) {
        let j;
        do { j = Math.floor(Math.random() * list.length); } while (j === i);
        return list[j];
    }
    if (i < 0) return dir > 0 ? list[0] : list[list.length - 1];

    let j = i + dir;
    if (j >= list.length || j < 0) {
        if (auto && state.loop !== 'all') return null; // habis & tidak loop
        j = (j + list.length) % list.length;
    }
    return list[j];
}

const advance = (auto) => {
    const q = takeFromQueue();
    if (q) { playFile(q.file, true); return; }
    const n = pickFromContext(1, auto);
    n ? playFile(n.file) : stop();
}

const queueAdd = (file, front) => {
    const t = listTracks().find((x) => x.file === file);
    if (!t || state.queue.length >= MAX_QUEUE) return;
    const item = { id: crypto.randomUUID(), ...t };
    front ? state.queue.unshift(item) : state.queue.push(item);
    state.track ? broadcast() : advance(false);
}

io.on('connection', (socket) => {
    const role = socket.handshake.query.role === 'overlay' ? 'overlay' : 'remote';
    socket.join(role);

    if (role === 'overlay') {
        if (state.track) {
            socket.emit('load', {
            track: state.track,
            autoplay: state.playing,
            startAt: state.currentTime,
            volume: state.volume,
            });
        }
        socket.on('progress', (p) => {
            if (!state.track || p?.file !== state.track.file) return;
            state.currentTime = p.currentTime || 0;
            state.duration = p.duration || 0;
            state.playing = !!p.playing;
            broadcast();
        });
        socket.on('ended', () => {
            if (!state.track) return;
            if (state.loop === 'one') return void playFile(state.track.file, state.fromQueue);
            advance(true);
        });
        return;
    }

    socket.emit('state', state);
    emitPlaylists(socket);

    socket.on('play-track', (p) => {
        const { file, playlistId } = p || {};
        if (!trackExists(file)) return;
        state.activePlaylist = playlistId && findPl(playlistId) ? playlistId : null;
        playFile(file);
    });
    socket.on('toggle', () => {
        if (state.track) toOverlay(state.playing ? 'pause' : 'play');
    });
    socket.on('stop', stop);
    socket.on('seek', (t) => {
        if (!state.track || typeof t !== 'number') return;
        state.currentTime = t;
        toOverlay('seek', t);
        broadcast();
    });
    socket.on('volume', (v) => {
        state.volume = Math.min(1, Math.max(0, Number(v) || 0));
        toOverlay('volume', state.volume);
        broadcast();
    });
    socket.on('next', () => advance(false));
    socket.on('prev', () => {
        if (!state.track) return;
        if (state.currentTime > 3 || state.fromQueue) {
            state.currentTime = 0;
            toOverlay('seek', 0);
            broadcast();
            return;
        }
        const n = pickFromContext(-1, false);
        if (n) playFile(n.file);
    });
    socket.on('shuffle', () => { state.shuffle = !state.shuffle; broadcast(); });
    socket.on('loop', () => {
        state.loop = { off: 'all', all: 'one', one: 'off' }[state.loop];
        broadcast();
    });

    socket.on('queue-next', (file) => queueAdd(file, true));
    socket.on('queue-add', (file) => queueAdd(file, false));
    socket.on('queue-remove', (id) => {
        state.queue = state.queue.filter((q) => q.id !== id);
        broadcast();
    });
    socket.on('queue-clear', () => { state.queue = []; broadcast(); });

    socket.on('pl-create', (name) => {
        name = String(name ?? '').trim().slice(0, 60);
        if (!name) return;
        playlists.push({ id: crypto.randomUUID(), name, files: [] });
        persistPlaylists();
    });
    socket.on('pl-rename', (p) => {
        const pl = findPl(p?.id);
        const name = String(p?.name ?? '').trim().slice(0, 60);
        if (!pl || !name) return;
        pl.name = name;
        persistPlaylists();
    });
    socket.on('pl-delete', (id) => {
        if (!findPl(id)) return;
        playlists = playlists.filter((p) => p.id !== id);
        if (state.activePlaylist === id) { state.activePlaylist = null; broadcast(); }
        persistPlaylists();
    });
    socket.on('pl-add', (p) => {
        const pl = findPl(p?.id);
        if (!pl || !trackExists(p.file) || pl.files.includes(p.file)) return;
        pl.files.push(p.file);
        persistPlaylists();
    });
    socket.on('pl-remove', (p) => {
        const pl = findPl(p?.id);
        if (!pl) return;
        pl.files = pl.files.filter((f) => f !== p.file);
        persistPlaylists();
    });
    socket.on('pl-play', (id) => {
        const list = contextList(id);
        if (!findPl(id) || !list.length) return;
        state.activePlaylist = id;
        const t = state.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0];
        playFile(t.file);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const overlayUrl = `http://localhost:${PORT}/overlay`;
    const remoteUrl = `http://${WIFI_IP}:${PORT}/remote`;
    const line = '─'.repeat(54);

    console.log(`\n${line}\n  === HobiGaming Music Player ===\n${line}`);
    console.log(`  Overlay (OBS/Prism, 850x150) : ${overlayUrl}`);
    console.log(`  Remote  (HP)                 : ${remoteUrl}`);
    console.log(`  Folder lagu                  : ${MUSIC_DIR}`);
    console.log(`  Playlist                     : ${PLAYLISTS_FILE}`);
    console.log(`\n  --- QR CODE untuk mengakses Remote Control ---\n`);
    qrcode.generate(remoteUrl, { small: true });
    console.log(line);
});