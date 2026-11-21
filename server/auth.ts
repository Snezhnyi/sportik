import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

const MAX_AGE_SEC = 7 * 24 * 3600;

/**
 * Validates Telegram Mini App initData as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the user on success, null otherwise.
 */
export function verifyInitData(initData: string, botToken: string, nowSec = Date.now() / 1000): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowSec - authDate > MAX_AGE_SEC) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TelegramUser | null;
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

/** "123, 456" → Set{123, 456}; empty or missing → null (no restriction). */
export function parseAllowlist(raw: string | undefined): Set<number> | null {
  const ids = (raw ?? '').split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return ids.length ? new Set(ids) : null;
}

export const isAllowed = (allowlist: Set<number> | null, userId: number) => !allowlist || allowlist.has(userId);
