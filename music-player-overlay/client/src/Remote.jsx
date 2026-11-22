import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { fmt } from './util.js';

const Row = ({ t, active, onPlay, onMore }) => {
    return (
        <li className={active ? 'active' : ''}>
            <div className="row-main" onClick={onPlay}>
                <div className="row-title">{t.title}</div>
                {t.artist && <div className="row-artist">{t.artist}</div>}
            </div>
            <button className="row-btn" onClick={onMore}>⋯</button>
        </li>
    );
}

export default function Remote() {
    const [tracks, setTracks] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [st, setSt] = useState(null);
    const [tab, setTab] = useState('songs');
    const [openPl, setOpenPl] = useState(null);
    const [sheet, setSheet] = useState(null);
    const [q, setQ] = useState('');
    const [seek, setSeek] = useState(null);
    const sock = useRef(null);

    const loadTracks = () =>
        fetch('/api/tracks').then((r) => r.json()).then(setTracks);

    useEffect(() => {
        loadTracks();
        const s = io({ query: { role: 'remote' } });
        sock.current = s;
        s.on('state', setSt);
        s.on('playlists', setPlaylists);
        s.on('tracks-changed', loadTracks);
        return () => s.close();
    }, []);

    const send = (ev, data) => sock.current?.emit(ev, data);
    const act = (fn) => { fn(); setSheet(null); };

    const dur = st?.duration || 0;
    const cur = seek ?? st?.currentTime ?? 0;
    const activeFile = st?.track?.file;
    const queue = st?.queue ?? [];
    const pl = playlists.find((p) => p.id === openPl);
    const ctxName = playlists.find((p) => p.id === st?.activePlaylist)?.name;
    const filtered = tracks.filter((t) =>
        `${t.artist} ${t.title}`.toLowerCase().includes(q.toLowerCase())
    );

    const tabs = [
        ['songs', 'Lagu'],
        ['playlists', 'Playlist'],
        ['queue', `Antrean${queue.length ? ` (${queue.length})` : ''}`],
    ];

    return (
        <div className="rc">
            <div className="rc-now">
                <div className="rc-label">
                    Sedang diputar
                    {st?.fromQueue ? ' • dari antrean' : ctxName ? ` • ${ctxName}` : ''}
                </div>
                <div className="rc-title">{st?.track?.title || '— Tidak ada lagu —'}</div>
                {st?.track?.artist && <div className="rc-artist">{st.track.artist}</div>}

                <input
                    type="range" min="0" max={dur || 1} step="0.1" value={cur}
                    disabled={!st?.track}
                    onChange={(e) => setSeek(Number(e.target.value))}
                    onPointerUp={() => { if (seek !== null) send('seek', seek); setSeek(null); }}
                />
                <div className="rc-times"><span>{fmt(cur)}</span><span>{fmt(dur)}</span></div>

                <div className="rc-ctrl">
                    <button className={st?.shuffle ? 'on' : ''} onClick={() => send('shuffle')}>🔀</button>
                    <button onClick={() => send('prev')}>⏮</button>
                    <button className="big" onClick={() => send('toggle')}>{st?.playing ? '⏸' : '▶️'}</button>
                    <button onClick={() => send('next')}>⏭</button>
                    <button className={st?.loop !== 'off' ? 'on' : ''} onClick={() => send('loop')}>
                    {st?.loop === 'one' ? '🔂' : '🔁'}
                    </button>
                </div>

                <div className="rc-vol">
                    <button onClick={() => send('stop')}>⏹</button>
                    🔊
                    <input type="range" min="0" max="1" step="0.01" value={st?.volume ?? 1}
                            onChange={(e) => send('volume', Number(e.target.value))} />
                </div>
            </div>

            <nav className="rc-tabs">
                {tabs.map(([k, label]) => (
                    <button key={k} className={tab === k ? 'on' : ''}
                            onClick={() => { setTab(k); setOpenPl(null); }}>
                    {label}
                    </button>
                ))}
            </nav>

            {tab === 'songs' && (
                <>
                    <input className="rc-search" placeholder="Cari artis atau judul…"
                            value={q} onChange={(e) => setQ(e.target.value)} />
                    <ul className="rc-list">
                    {filtered.map((t) => (
                        <Row key={t.file} t={t} active={t.file === activeFile}
                            onPlay={() => send('play-track', { file: t.file, playlistId: null })}
                            onMore={() => setSheet({ track: t, plId: null })} />
                    ))}
                    {!filtered.length && (
                        <li className="empty">Tidak ada file .mp4 yang cocok di folder lagu</li>
                    )}
                    </ul>
                </>
            )}

            {tab === 'playlists' && !pl && (
                <>
                    <button className="rc-btn wide" onClick={() => {
                    const n = window.prompt('Nama playlist:');
                    if (n?.trim()) send('pl-create', n);
                    }}>＋ Playlist baru</button>
                    <ul className="rc-list">
                    {playlists.map((p) => (
                        <li key={p.id} className="clickable" onClick={() => setOpenPl(p.id)}>
                        <div className="row-main">
                            <div className="row-title">{p.name}</div>
                            <div className="row-artist">{p.tracks.length} lagu</div>
                        </div>
                        <span className="chev">›</span>
                        </li>
                    ))}
                    {!playlists.length && <li className="empty">Belum ada playlist</li>}
                    </ul>
                </>
            )}

            {tab === 'playlists' && pl && (
                <>
                    <div className="pl-head">
                    <button className="rc-btn" onClick={() => setOpenPl(null)}>‹ Kembali</button>
                    <h2>{pl.name}</h2>
                    </div>
                    <div className="pl-actions">
                    <button className="rc-btn primary" onClick={() => send('pl-play', pl.id)}>
                        ▶ Putar playlist
                    </button>
                    <button className="rc-btn" onClick={() => {
                        const n = window.prompt('Ganti nama playlist:', pl.name);
                        if (n?.trim()) send('pl-rename', { id: pl.id, name: n });
                    }}>✏️</button>
                    <button className="rc-btn" onClick={() => {
                        if (window.confirm(`Hapus playlist "${pl.name}"?`)) {
                        send('pl-delete', pl.id);
                        setOpenPl(null);
                        }
                    }}>🗑</button>
                    </div>
                    <ul className="rc-list">
                    {pl.tracks.map((t) => (
                        <Row key={t.file} t={t} active={t.file === activeFile}
                            onPlay={() => send('play-track', { file: t.file, playlistId: pl.id })}
                            onMore={() => setSheet({ track: t, plId: pl.id })} />
                    ))}
                    {!pl.tracks.length && (
                        <li className="empty">Playlist kosong. Tambahkan lewat menu ⋯ di tab Lagu.</li>
                    )}
                    </ul>
                </>
            )}

            {tab === 'queue' && (
                <>
                    {queue.length > 0 && (
                    <button className="rc-btn wide" onClick={() => send('queue-clear')}>
                        Kosongkan antrean
                    </button>
                    )}
                    <ul className="rc-list">
                    {queue.map((item) => (
                        <li key={item.id}>
                        <div className="row-main">
                            <div className="row-title">{item.title}</div>
                            {item.artist && <div className="row-artist">{item.artist}</div>}
                        </div>
                        <button className="row-btn" onClick={() => send('queue-remove', item.id)}>✕</button>
                        </li>
                    ))}
                    {!queue.length && (
                        <li className="empty">Antrean kosong. Pakai menu ⋯ → "Putar berikutnya".</li>
                    )}
                    </ul>
                </>
            )}

            {sheet && (
                <div className="sheet-bg" onClick={() => setSheet(null)}>
                    <div className="sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sheet-title">
                            {sheet.track.title}{sheet.track.artist && ` — ${sheet.track.artist}`}
                        </div>
                        <button onClick={() => act(() =>
                            send('play-track', { file: sheet.track.file, playlistId: sheet.plId }))}>
                            ▶ Putar sekarang
                        </button>
                        <button onClick={() => act(() => send('queue-next', sheet.track.file))}>
                            ⏭ Putar berikutnya
                        </button>
                        <button onClick={() => act(() => send('queue-add', sheet.track.file))}>
                            ➕ Tambah ke antrean
                        </button>
                        {sheet.plId && (
                            <button onClick={() => act(() =>
                            send('pl-remove', { id: sheet.plId, file: sheet.track.file }))}>
                            🗑 Hapus dari playlist ini
                            </button>
                        )}
                        <h4>Tambah ke playlist</h4>
                        {playlists.map((p) => (
                            <button key={p.id} onClick={() => act(() =>
                            send('pl-add', { id: p.id, file: sheet.track.file }))}>
                            📁 {p.name}
                            </button>
                        ))}
                        {!playlists.length && <div className="sheet-empty">Belum ada playlist</div>}
                    </div>
                </div>
            )}
        </div>
    );
}