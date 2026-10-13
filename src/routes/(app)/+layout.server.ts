import { redirect } from '@sveltejs/kit';
import type { Me, OrgUnit } from '#lib/types/api';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	depends('app:scope');
	const meRes = await locals.api('/auth/me');
	if (meRes.status === 401) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	if (!meRes.ok) throw new Error('Failed to load session');
	const me = (await meRes.json()).data as Me;

	let units: OrgUnit[] = [];
	if (me.grants['organization.view']) {
		const t = await locals.api('/organization/scope-tree');
		if (t.ok) units = (await t.json()).data as OrgUnit[];
	}
	return { me, units };
};
