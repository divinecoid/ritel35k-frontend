import { redirect } from '@sveltejs/kit';
import { apiBase, clearSession, getRefresh } from '#lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const rt = getRefresh(cookies);
	if (rt) {
		await fetch(`${apiBase()}/auth/logout`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ refresh_token: rt })
		}).catch(() => {});
	}
	clearSession(cookies);
	redirect(303, '/login');
};
