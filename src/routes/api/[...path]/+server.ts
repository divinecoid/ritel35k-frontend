import type { RequestHandler } from './$types';

// Backend-for-frontend proxy: the browser calls /api/<path>; we add the session token server-side.
const handler: RequestHandler = async ({ params, url, request, locals }) => {
	const hasBody = !['GET', 'HEAD'].includes(request.method);
	const headers = new Headers();
	const ct = request.headers.get('content-type');
	if (ct) headers.set('content-type', ct);
	const rid = request.headers.get('x-request-id');
	if (rid) headers.set('x-request-id', rid);
	const res = await locals.api(`/${params.path}${url.search}`, {
		method: request.method,
		headers,
		body: hasBody ? await request.text() : undefined,
		signal: request.signal // stop the upstream call (and SSE streams) when the browser goes away
	});
	const out = new Headers();
	const rct = res.headers.get('content-type');
	if (rct) out.set('content-type', rct);
	const cd = res.headers.get('content-disposition'); // CSV exports arrive as attachments
	if (cd) out.set('content-disposition', cd);
	const rrid = res.headers.get('x-request-id');
	if (rrid) out.set('x-request-id', rrid);
	out.set('cache-control', 'no-store');
	return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: out });
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
