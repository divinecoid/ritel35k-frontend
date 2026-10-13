import type { Envelope, Meta } from '#lib/types/api';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public details?: unknown,
		public requestId?: string
	) {
		super(message);
	}
	/** Field-level validation messages, if the server sent any. */
	get fields(): Record<string, string> {
		return this.code === 'VALIDATION_FAILED' && this.details && typeof this.details === 'object'
			? (this.details as Record<string, string>)
			: {};
	}
}

export interface Page<T> {
	data: T;
	meta?: Meta;
}

/** Browser → SvelteKit BFF proxy → Go API. Tokens stay in HttpOnly cookies. */
export async function api<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined | null>, opts?: { timeoutMs?: number }): Promise<Page<T>> {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
	const res = await fetch(`/api${path}${qs.size ? `?${qs}` : ''}`, {
		method,
		headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		signal: opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined
	});
	if (res.status === 401) {
		window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
		throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired');
	}
	if (res.status === 204) return { data: undefined as T };
	const env = (await res.json().catch(() => null)) as (Envelope<T> & { error?: { code: string; message: string; details?: unknown; request_id?: string } }) | null;
	if (!res.ok || !env?.success) {
		throw new ApiError(res.status, env?.error?.code ?? 'UNKNOWN', env?.error?.message ?? `Request failed (${res.status})`, env?.error?.details, env?.error?.request_id);
	}
	return { data: env.data, meta: env.meta };
}

export const get = <T>(path: string, query?: Record<string, string | number | undefined | null>) => api<T>('GET', path, undefined, query);
export const post = <T>(path: string, body?: unknown, opts?: { timeoutMs?: number }) => api<T>('POST', path, body ?? {}, undefined, opts);
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, body);
export const patch = <T>(path: string, body: unknown) => api<T>('PATCH', path, body);
export const del = <T = void>(path: string, body?: unknown) => api<T>('DELETE', path, body);

/** True when the request never got a usable answer from the server (no network, timeout, gateway down): the sale may or may not have been recorded. */
export function isNetworkFailure(e: unknown): boolean {
	if (e instanceof ApiError) return e.status === 502 || e.status === 503 || e.status === 504;
	return e instanceof TypeError || (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError'));
}
