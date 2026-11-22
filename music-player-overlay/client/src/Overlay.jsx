import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { fmt } from './util.js';

const FADE_MS = 500;

export default function Overlay() {
    const videoRef = useRef(null);
    const [track, setTrack] = useState(null);
    const [visible, setVisible] = useState(false);
    const [prog, setProg] = useState({ cur: 0, dur: 0 });

    useEffect(() => {
        const v = videoRef.current;
        const socket = io({ query: { role: 'overlay' } });
        let current = null;
        let startAt = 0;
        let autoplay = true;
        let hideTimer = null;

        const tryPlay = () =>
            v.play().catch((e) => console.warn('play() ditolak:', e.name));

        socket.on('load', (d) => {
            clearTimeout(hideTimer);
            current = d.track.file;
            startAt = d.startAt || 0;
            autoplay = d.autoplay;
            v.volume = d.volume;
            setTrack(d.track);
            setVisible(true);
            v.src = `/media/${encodeURIComponent(d.track.file)}`;
            v.load();
        });
        socket.on('play', tryPlay);
        socket.on('pause', () => v.pause());
        socket.on('seek', (t) => { v.currentTime = t; });
        socket.on('volume', (x) => { v.volume = x; });
        socket.on('stop', () => {
            current = null;
            v.pause();
            setVisible(false);
            hideTimer = setTimeout(() => {
            v.removeAttribute('src');
            v.load();
            setTrack(null);
            setProg({ cur: 0, dur: 0 });
            }, FADE_MS + 50);
        });

        v.onloadedmetadata = () => {
            if (startAt) v.currentTime = startAt;
            if (autoplay) tryPlay();
        };

        const report = () => {
            if (!current) return;
            const dur = v.duration || 0;
            setProg({ cur: v.currentTime, dur });
            socket.emit('progress', {
            file: current,
            currentTime: v.currentTime,
            duration: dur,
            playing: !v.paused && !v.ended,
            });
        };
        v.ontimeupdate = report;
        v.onplay = report;
        v.onpause = report;
        v.onended = () => socket.emit('ended');

        return () => {
            clearTimeout(hideTimer);
            socket.close();
        };
    }, []);

    const pct = prog.dur ? (prog.cur / prog.dur) * 100 : 0;

    return (
        <div className={`ov ${visible ? 'show' : ''}`}>
            <video ref={videoRef} className="ov-cover" playsInline />
            <div className="ov-info">
                <div className="ov-title">{track?.title}</div>
                {track?.artist && <div className="ov-artist">{track.artist}</div>}
                <div className="ov-time">{fmt(prog.cur)} / {fmt(prog.dur)}</div>
                <div className="ov-bar"><div style={{ width: `${pct}%` }} /></div>
            </div>
        </div>
    );
}