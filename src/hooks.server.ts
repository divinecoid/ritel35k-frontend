import type { Handle } from '@sveltejs/kit/hooks';
import { apiBase, clearSession, getAccess, getRefresh, refreshTokens, setSession } from '#lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	// Authenticated call to the Go API. Attaches the session's bearer token and, if it has expired,
	// transparently refreshes once and retries. Tokens never reach the browser.
	event.locals.api = async (path, init = {}) => {
		const call = (token?: string) => {
			const headers = new Headers(init.headers);
			if (token) headers.set('authorization', `Bearer ${token}`);
			return fetch(`${apiBase()}${path}`, { ...init, headers });
		};
		let token = getAccess(event.cookies);
		let res: Response | undefined;
		if (token) res = await call(token);
		if (!token || res!.status === 401) {
			const rt = getRefresh(event.cookies);
			if (!rt) {
				clearSession(event.cookies);
				return res ?? new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No session' } }), { status: 401 });
			}
			const fresh = await refreshTokens(rt);
			if (!fresh) {
				clearSession(event.cookies);
				return res ?? new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session expired' } }), { status: 401 });
			}
			setSession(event.cookies, fresh);
			res = await call(fresh.access_token);
		}
		return res!;
	};
	return resolve(event, {
		transformPageChunk: ({ html }) => html
	});
};
