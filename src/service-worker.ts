/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Keeps the POS screen loadable when the server is unreachable: the app's own code is cached at install, and the last
// good /pos page (which already carries the session's user and terminals) is served when the network fails. API calls
// are never cached — prices and sales always come from the cloud or the store agent, never from a stale response.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

const sw = self as unknown as ServiceWorkerGlobalScope;
const ASSETS = `r35k-assets-${version}`;
const PAGES = 'r35k-pages-v1';
const norm = (p: string) => (p.startsWith('/') ? p : `/${p}`);
const STATIC = new Set([...immutable, ...assets].map((e) => norm(e.path)));
const NETWORK_WAIT_MS = 3500;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(ASSETS)
			.then((c) => c.addAll([...STATIC]))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== ASSETS && k !== PAGES).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

/** Network first, but never wait long: a hanging server must not freeze the till. */
async function pageFirstNetwork(req: Request): Promise<Response> {
	const cache = await caches.open(PAGES);
	try {
		const res = await Promise.race([fetch(req), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('slow')), NETWORK_WAIT_MS))]);
		if (res.ok) {
			void cache.put(req, res.clone());
			return res;
		}
		if (res.status < 500) return res; // redirects to /login etc. are real answers
	} catch {
		/* fall through to the cached copy */
	}
	const cached = await cache.match(req, { ignoreSearch: false });
	if (cached) return cached;
	return fetch(req); // nothing cached yet: let the browser show the real error
}

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;

	if (STATIC.has(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}
	// the POS shell and its route data
	if (url.pathname === '/pos' || url.pathname.startsWith('/pos/')) {
		if (req.mode === 'navigate' || url.pathname.endsWith('__data.json')) {
			event.respondWith(pageFirstNetwork(req));
		}
	}
});

// logging out must not leave a signed-in POS page behind on a shared till
sw.addEventListener('message', (event) => {
	if (event.data === 'purge-pages') event.waitUntil(caches.delete(PAGES));
});
