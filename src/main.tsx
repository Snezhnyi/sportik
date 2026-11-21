import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './ui/App';
import { initStore, onLocalChange } from './data/store';
import { schedule, startSyncLoop } from './data/sync';
import { initTelegram, isTelegram, setChrome } from './telegram/tg';
import { OpenInTelegramScreen } from './ui/screens/profile/OpenInTelegramScreen';

function applyTheme(scheme: 'light' | 'dark') {
  document.documentElement.dataset.theme = scheme;
  setChrome(scheme === 'light' ? '#f3f4f6' : '#0d0f12');
}

applyTheme('dark');
initTelegram(applyTheme);

// The production build only runs inside Telegram; a regular browser gets a pointer to the bot
// and never touches local storage. `npm run dev` stays usable in a browser.
const allowed = isTelegram() || import.meta.env.DEV;

if (allowed) {
  // Ask the browser not to evict IndexedDB under storage pressure.
  void navigator.storage?.persist?.();
  void initStore().then(() => {
    onLocalChange(() => schedule());
    startSyncLoop();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {allowed ? <App /> : <OpenInTelegramScreen />}
  </StrictMode>,
);
