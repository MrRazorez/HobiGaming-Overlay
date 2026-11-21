import { useState, useRef } from 'react';
import { useSocket } from './useSocket.js';

export default function Overlay() {
  const [memes, setMemes] = useState([]);
  const audios = useRef(new Set());
  const seq = useRef(0);

  const removeMeme = (id) => setMemes((list) => list.filter((m) => m.id !== id));

  useSocket((msg) => {
    if (msg.type === 'play') {
      const { item } = msg;
      if (item.type === 'sound') {
        const a = new Audio(item.url);
        audios.current.add(a);
        a.onended = () => audios.current.delete(a);
        a.play().catch((err) => console.warn('Audio gagal diputar:', err));
      } else {
        const id = ++seq.current;
        setMemes((list) => [...list, { id, url: item.url }]);
      }
    }

    if (msg.type === 'stop') {
      audios.current.forEach((a) => a.pause());
      audios.current.clear();
      setMemes([]);
    }
  });

  return (
    <div className='stage'>
      {memes.map((m) => (
        <video
          key={m.id}
          className='meme'
          src={m.url}
          autoPlay
          playsInline
          disablePictureInPicture
          onEnded={() => removeMeme(m.id)}
          onError={() => removeMeme(m.id)}
        />
      ))}
    </div>
  );
}