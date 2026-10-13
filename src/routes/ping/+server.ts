import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Is the cloud API reachable from this app server? The POS polls it to decide between the cloud and the store's
// local agent. If this app server itself is down the browser's fetch fails, which reads as offline too.
export const GET: RequestHandler = async () => {
	let ok = false;
	try {
		const res = await fetch(`${process.env.API_URL ?? 'http://localhost:8080'}/ready`, { signal: AbortSignal.timeout(2000) });
		ok = res.ok;
	} catch {
		ok = false;
	}
	return json({ ok }, { headers: { 'cache-control': 'no-store' } });
};
