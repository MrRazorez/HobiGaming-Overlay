import { createRoot } from 'react-dom/client';
import Overlay from './Overlay.jsx';
import Remote from './Remote.jsx';
import './index.css';

const Page = location.pathname.startsWith('/overlay') ? Overlay : Remote;
createRoot(document.getElementById('root')).render(<Page />);