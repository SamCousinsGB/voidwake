import { createRoot } from 'react-dom/client';
import Game from './game/Game';
import './globals.css';
import './game/expansion.css';

createRoot(document.getElementById('root')!).render(<Game />);
