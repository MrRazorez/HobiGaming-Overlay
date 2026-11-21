import React from 'react';
import { createRoot } from 'react-dom/client';
import Overlay from './Overlay.jsx';
import Remote from './Remote.jsx';
import './styles.css';

const isOverlay = window.location.pathname.startsWith('/overlay');
document.body.className = isOverlay ? 'overlay-mode' : 'remote-mode';

createRoot(document.getElementById('root')).render(isOverlay ? <Overlay /> : <Remote />);