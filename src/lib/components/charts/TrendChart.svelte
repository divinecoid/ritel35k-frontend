<script lang="ts">
	import { idr } from '#lib/utils/format';

	/** Daily line/area chart in plain SVG (no chart dependency). `previous` draws the earlier period as a dashed line. */
	let { points, previous = [], height = 190, label = 'Penjualan bersih' }: { points: { date: string; value: number }[]; previous?: number[]; height?: number; label?: string } = $props();

	const W = 720;
	const pad = { l: 56, r: 12, t: 12, b: 24 };
	const max = $derived(Math.max(1, ...points.map((p) => p.value), ...previous));
	const nice = $derived.by(() => {
		const mag = 10 ** Math.floor(Math.log10(max));
		const n = max / mag;
		return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
	});
	const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
	const y = (v: number) => pad.t + (1 - v / nice) * (height - pad.t - pad.b);
	const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
	const area = $derived(points.length ? `${line(points.map((p) => p.value))} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '');
	const hasData = $derived(points.some((p) => p.value > 0));
	const ticks = $derived(hasData ? [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice) : [0]); // an empty chart shows only the baseline
	const short = (v: number) => (v >= 1e9 ? `${+(v / 1e9).toFixed(1)} M` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} jt` : v >= 1e3 ? `${+(v / 1e3).toFixed(0)} rb` : String(Math.round(v)));
	const every = $derived(Math.max(1, Math.ceil(points.length / 8)));
	const dayLabel = (d: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(d));
	let hover = $state<number | null>(null);
</script>

<div class="relative">
	<svg viewBox="0 0 {W} {height}" class="w-full" role="img" aria-label="Grafik {label} per hari" onmouseleave={() => (hover = null)}>
		{#each ticks as t}
			<line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" stroke-width="1" />
			<text x={pad.l - 8} y={y(t) + 4} text-anchor="end" font-size="11" fill="var(--muted)">{short(t)}</text>
		{/each}
		{#if area}<path d={area} fill="var(--primary)" opacity="0.12" />{/if}
		{#if previous.length > 1}<path d={line(previous)} fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4" />{/if}
		{#if points.length}<path d={line(points.map((p) => p.value))} fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" />{/if}
		{#each points as p, i}
			{#if i % every === 0}<text x={x(i)} y={height - 6} text-anchor="middle" font-size="11" fill="var(--muted)">{dayLabel(p.date)}</text>{/if}
			<rect x={x(i) - (W - pad.l - pad.r) / Math.max(1, points.length - 1) / 2} y={pad.t} width={(W - pad.l - pad.r) / Math.max(1, points.length - 1)} height={height - pad.t - pad.b} fill="transparent" role="presentation" onmouseenter={() => (hover = i)} />
		{/each}
		{#if hover !== null && points[hover]}
			<line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--muted)" stroke-dasharray="3 3" />
			<circle cx={x(hover)} cy={y(points[hover].value)} r="4" fill="var(--primary)" />
		{/if}
	</svg>
	{#if hover !== null && points[hover]}
		<div class="pointer-events-none absolute top-1 right-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-sm">
			<p class="text-muted">{dayLabel(points[hover].date)}</p>
			<p class="num font-medium">{idr(points[hover].value)}</p>
		</div>
	{/if}
</div>
