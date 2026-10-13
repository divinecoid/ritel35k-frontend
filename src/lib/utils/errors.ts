import { ApiError } from '#lib/api/client';

export const errMsg = (e: unknown) => {
	if (e instanceof ApiError) {
		const f = Object.entries(e.fields);
		return f.length ? `${e.message}: ${f.map(([k, v]) => `${k} (${v})`).join(', ')}` : e.message;
	}
	return e instanceof Error ? e.message : 'Terjadi kesalahan';
};

export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError ? e.fields : {});
