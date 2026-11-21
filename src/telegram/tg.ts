/**
 * Thin wrapper around Telegram.WebApp. Every call is a no-op in a regular browser,
 * so the app works the same in development without Telegram.
 */

interface HapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

interface BackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface WebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; username?: string } };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  platform: string;
  version: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  setHeaderColor(c: string): void;
  setBackgroundColor(c: string): void;
  setBottomBarColor?(c: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  onEvent(event: string, cb: () => void): void;
  HapticFeedback: HapticFeedback;
  BackButton: BackButton;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

function webApp(): WebApp | null {
  const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  // telegram-web-app.js defines WebApp even outside Telegram; initData is empty there.
  return wa && wa.initData ? wa : null;
}

export const isTelegram = () => webApp() !== null;
export const getInitData = () => webApp()?.initData ?? '';
export const telegramUserName = () => webApp()?.initDataUnsafe.user?.first_name ?? '';
export const telegramUserId = () => webApp()?.initDataUnsafe.user?.id ?? null;

export function initTelegram(onThemeChange: (scheme: 'light' | 'dark') => void) {
  const wa = webApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
  if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes?.();
  onThemeChange(wa.colorScheme);
  wa.onEvent('themeChanged', () => onThemeChange(wa.colorScheme));
}

export function setChrome(color: string) {
  const wa = webApp();
  if (!wa || !wa.isVersionAtLeast('6.1')) return;
  wa.setHeaderColor(color);
  wa.setBackgroundColor(color);
  if (wa.isVersionAtLeast('7.10')) wa.setBottomBarColor?.(color);
}

export const haptic = {
  tap: () => webApp()?.HapticFeedback.impactOccurred('light'),
  impact: () => webApp()?.HapticFeedback.impactOccurred('medium'),
  select: () => webApp()?.HapticFeedback.selectionChanged(),
  success: () => {
    const wa = webApp();
    if (wa) wa.HapticFeedback.notificationOccurred('success');
    else navigator.vibrate?.(60);
  },
  warning: () => webApp()?.HapticFeedback.notificationOccurred('warning'),
};

export function setClosingConfirmation(on: boolean) {
  const wa = webApp();
  if (!wa || !wa.isVersionAtLeast('6.2')) return;
  if (on) wa.enableClosingConfirmation();
  else wa.disableClosingConfirmation();
}

/** Shows Telegram's native back button while `handler` is set. */
export function bindBackButton(handler: (() => void) | null): () => void {
  const wa = webApp();
  if (!wa || !wa.isVersionAtLeast('6.1')) return () => {};
  if (!handler) {
    wa.BackButton.hide();
    return () => {};
  }
  wa.BackButton.onClick(handler);
  wa.BackButton.show();
  return () => {
    wa.BackButton.offClick(handler);
    wa.BackButton.hide();
  };
}
