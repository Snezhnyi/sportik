import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
// @ts-expect-error server uses .ts import specifiers (run natively by Node)
import { openStore } from '../server/db.ts';
// @ts-expect-error see above
import { isAllowed, parseAllowlist, verifyInitData } from '../server/auth.ts';

describe('doc store', () => {
  it('is last-write-wins and idempotent', () => {
    const s = openStore(':memory:');
    s.push('u', [{ id: 'a', type: 'workout', updatedAt: 2, data: { v: 2 } }]);
    s.push('u', [{ id: 'a', type: 'workout', updatedAt: 1, data: { v: 1 } }]); // older — ignored
    s.push('u', [{ id: 'a', type: 'workout', updatedAt: 2, data: { v: 2 } }]); // duplicate — ignored
    const r = s.pullSince('u', 0);
    expect(r.docs).toHaveLength(1);
    expect(r.docs[0].data).toEqual({ v: 2 });
    expect(s.pullSince('u', r.cursor).docs).toHaveLength(0);
    expect(s.pullSince('other', 0).docs).toHaveLength(0);
  });
});

describe('telegram initData', () => {
  it('accepts a correctly signed payload and rejects a tampered one', () => {
    const token = '123:abc';
    const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'A' }) });
    const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
    expect(verifyInitData(params.toString(), token)?.id).toBe(42);
    params.set('user', JSON.stringify({ id: 43 }));
    expect(verifyInitData(params.toString(), token)).toBeNull();
  });
});

describe('allowlist', () => {
  it('parses ids and restricts access only when set', () => {
    expect(parseAllowlist('')).toBeNull();
    expect(parseAllowlist(undefined)).toBeNull();
    const list = parseAllowlist(' 123, 456;789 abc ');
    expect([...list!]).toEqual([123, 456, 789]);
    expect(isAllowed(list, 456)).toBe(true);
    expect(isAllowed(list, 1)).toBe(false);
    expect(isAllowed(null, 1)).toBe(true);
  });
});
