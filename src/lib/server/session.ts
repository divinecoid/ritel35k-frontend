import { dev } from '$app/env';
import type { Cookies } from '@sveltejs/kit';

const AT = 'r35k_at';
const RT = 'r35k_rt';

export interface Tokens {
	access_token: string;
	access_expires_at: string;
	refresh_token: string;
	refresh_expires_at: string;
}

// Server-only module (src/lib/server). Read at call time so the value can differ per deployment.
export const apiBase = () => `${process.env.API_URL ?? 'http://localhost:8080'}/api/v1`;

export function setSession(cookies: Cookies, t: Tokens) {
	const base = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: !dev };
	cookies.set(AT, t.access_token, { ...base, expires: new Date(t.access_expires_at) });
	cookies.set(RT, t.refresh_token, { ...base, expires: new Date(t.refresh_expires_at) });
}

export function clearSession(cookies: Cookies) {
	cookies.delete(AT, { path: '/' });
	cookies.delete(RT, { path: '/' });
}

export const getAccess = (c: Cookies) => c.get(AT);
export const getRefresh = (c: Cookies) => c.get(RT);

// Parallel browser requests can all carry the same expired session. Refresh tokens rotate and a
// replayed one revokes the whole family (theft detection), so refreshes are single-flighted per
// token and the result is shared for a short grace window.
const inflight = new Map<string, Promise<Tokens | null>>();

export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
	const existing = inflight.get(refreshToken);
	if (existing) return existing;
	const p = (async () => {
		try {
			const res = await fetch(`${apiBase()}/auth/refresh`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ refresh_token: refreshToken })
			});
			if (!res.ok) return null;
			return ((await res.json()).data as Tokens) ?? null;
		} catch {
			return null;
		}
	})();
	inflight.set(refreshToken, p);
	setTimeout(() => inflight.delete(refreshToken), 30_000);
	return p;
}
