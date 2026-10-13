import { redirect } from '@sveltejs/kit';
import type { Me, Terminal } from '#lib/types/api';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const meRes = await locals.api('/auth/me');
	if (meRes.status === 401) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	if (!meRes.ok) throw new Error('Failed to load session');
	const me = (await meRes.json()).data as Me;
	if (!me.grants['pos.transaction.create']) redirect(303, '/dashboard');
	const t = await locals.api('/pos/terminals');
	const terminals = t.ok ? (((await t.json()).data as Terminal[]) ?? []).filter((x) => x.status === 'active') : [];
	return { me, terminals };
};
