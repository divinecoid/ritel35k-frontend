import { fail, redirect } from '@sveltejs/kit';
import { apiBase, setSession, type Tokens } from '#lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	if (cookies.get('r35k_rt')) {
		const res = await locals.api('/auth/me');
		if (res.ok) redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || !password) return fail(400, { email, error: 'Email dan password wajib diisi' });

		const res = await fetch(`${apiBase()}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-forwarded-for': getClientAddress() },
			body: JSON.stringify({ email, password })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			const code = body?.error?.code;
			const msg =
				code === 'LOGIN_THROTTLED' || res.status === 429
					? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
					: 'Email atau password salah';
			return fail(res.status === 429 ? 429 : 401, { email, error: msg });
		}
		setSession(cookies, (await res.json()).data as Tokens);
		const next = url.searchParams.get('next');
		redirect(303, next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
	}
};
