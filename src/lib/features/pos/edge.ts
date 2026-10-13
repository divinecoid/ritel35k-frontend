// Talks to the store's ritel35k-edge agent (loopback). Optional: without it we fall back to the
// browser print dialog. Config lives in localStorage because it is per-terminal, not per-user.
const KEY = 'r35k_edge_v1';

export interface EdgeConfig {
	url: string;
	token: string;
}

export function loadEdge(): EdgeConfig | null {
	try {
		const c = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return c?.url && c?.token ? c : null;
	} catch {
		return null;
	}
}

export function saveEdge(c: EdgeConfig | null) {
	try {
		if (c) localStorage.setItem(KEY, JSON.stringify(c));
		else localStorage.removeItem(KEY);
	} catch {
		/* storage unavailable */
	}
}

export async function edgeCall(path: string, body?: unknown, timeoutMs = 6000) {
	const c = loadEdge();
	if (!c) throw new Error('Edge agent belum dikonfigurasi');
	const res = await fetch(c.url.replace(/\/$/, '') + path, {
		method: body === undefined ? 'GET' : 'POST',
		headers: { 'X-Edge-Token': c.token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Edge error ${res.status}`);
	return res.json();
}

export const edgeHealth = () => edgeCall('/health');
export const edgePrint = (text: string, openDrawer = false) => edgeCall('/print/receipt', { text, open_drawer: openDrawer });
export const edgeOpenDrawer = () => edgeCall('/drawer/open', {});

/** Prints via the edge agent when configured, otherwise the browser print dialog. */
export async function printReceipt(text: string, openDrawer = false): Promise<'edge' | 'browser'> {
	if (loadEdge()) {
		await edgePrint(text, openDrawer);
		return 'edge';
	}
	window.print();
	return 'browser';
}

/** Plain-text GET from the edge (receipts). */
export async function edgeText(path: string): Promise<string> {
	const c = loadEdge();
	if (!c) throw new Error('Edge agent belum dikonfigurasi');
	const res = await fetch(c.url.replace(/\/$/, '') + path, { headers: { 'X-Edge-Token': c.token }, signal: AbortSignal.timeout(6000) });
	if (!res.ok) throw new Error(`Edge error ${res.status}`);
	return res.text();
}
