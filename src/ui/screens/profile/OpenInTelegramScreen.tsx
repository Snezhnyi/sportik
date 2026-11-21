import { useEffect, useState } from 'react';

/** Production build opened in a regular browser: the app works only inside Telegram. */
export function OpenInTelegramScreen() {
  const [bot, setBot] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/info`)
      .then((r) => r.json() as Promise<{ bot: string | null }>)
      .then((r) => setBot(r.bot))
      .catch(() => {});
  }, []);

  return (
    <div className="screen no-tabbar" style={{ display: 'grid', placeItems: 'center', minHeight: '100%' }}>
      <div className="hero center" style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 40 }}>✈️</div>
        <h2>Откройте в Telegram</h2>
        <p className="muted small">Это приложение работает только внутри Telegram — через кнопку меню в боте.</p>
        {bot && (
          <a className="btn primary block mt-12" href={`https://t.me/${bot}`} style={{ textDecoration: 'none' }}>
            Открыть @{bot}
          </a>
        )}
      </div>
    </div>
  );
}
