import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket.js';

export default function Remote() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/items');
      setItems(await res.json());
      setError('');
    } catch {
      setError('Gagal memuat daftar file.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ws = useSocket((msg) => {
    if (msg.type === 'items-changed') load();
  });

  const send = (obj) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(obj));
    }
  };

  const press = (item) => {
    send({ type: 'play', file: item.file });
    setActive(item.file);
    if (navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => setActive(null), 200);
  };

  return (
    <div className='remote'>
      <header>
        <h1>Remote</h1>
        <div>
          <button className='ctl' onClick={load}>Refresh</button>
          <button className='ctl stop' onClick={() => send({ type: 'stop' })}>Stop</button>
        </div>
      </header>

      {error && <p className='err'>{error}</p>}
      {!error && items.length === 0 && <p>Folder masih kosong. Tambahkan file .wav atau .webm.</p>}

      <div className='grid'>
        {items.map((it) => (
          <button
            key={it.file}
            className={`tile ${it.type} ${active === it.file ? 'on' : ''}`}
            onClick={() => press(it)}
          >
            <span className='icon'>{it.type === 'meme' ? '🎬' : '🔊'}</span>
            <span className='label'>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}