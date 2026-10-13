export const idr = (v: string | number | null | undefined) =>
	v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v));

export const num = (v: string | number | null | undefined) =>
	v === null || v === undefined ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(Number(v));

export const dateTime = (iso: string | null | undefined) =>
	iso ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';

export const date = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(iso)) : '—');

/** Local calendar date as YYYY-MM-DD (what the API expects for from/to). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (d: Date, n: number) => {
	const c = new Date(d);
	c.setDate(c.getDate() + n);
	return c;
};

/** Short money for tight spaces: 1,2 jt / 3,4 M. */
export const idrShort = (v: string | number) => {
	const n = Number(v);
	const a = Math.abs(n);
	const f = (x: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(x);
	return a >= 1e9 ? `Rp ${f(n / 1e9)} M` : a >= 1e6 ? `Rp ${f(n / 1e6)} jt` : a >= 1e4 ? `Rp ${f(n / 1e3)} rb` : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
};

/** Relative time in Indonesian ("5 menit lalu"). */
export const ago = (iso: string) => {
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return 'baru saja';
	if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
	if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
	return `${Math.floor(s / 86400)} hari lalu`;
};
