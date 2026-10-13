<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { Download } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import DateRange from '#lib/components/ui/DateRange.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { get } from '#lib/api/client';
	import { useScope } from '#lib/scope/scope.svelte';
	import { date, dateTime, idr, num } from '#lib/utils/format';
	import type { ColumnType, ReportDef, ReportTable } from '#lib/types/api';

	const scope = useScope();
	let key = $state(page.url.searchParams.get('report') ?? '');
	let from = $state('');
	let to = $state('');
	let order = $state('sales');
	let onlyVariance = $state(false);

	const catalog = createQuery(() => ({ queryKey: ['reports', 'catalog'], queryFn: async () => (await get<ReportDef[]>('/reports')).data }));
	const current = $derived(catalog.data?.find((r) => r.key === key));
	$effect(() => {
		if (catalog.data?.length && !catalog.data.some((r) => r.key === key)) key = catalog.data[0].key;
	});
	const groups = $derived.by(() => {
		const m = new Map<string, ReportDef[]>();
		for (const r of catalog.data ?? []) m.set(r.group, [...(m.get(r.group) ?? []), r]);
		return [...m.entries()];
	});

	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const underPath = $derived(scope.storeId === 'all' ? scope.path : undefined);
	const params = $derived({
		from: current?.uses_dates ? from : undefined,
		to: current?.uses_dates ? to : undefined,
		store_id: storeId,
		under_path: underPath,
		order: key === 'sales_by_product' ? order : undefined,
		only_variance: key === 'shift_variance' && onlyVariance ? 'true' : undefined
	});
	const table = createQuery(() => ({ queryKey: ['reports', 'run', key, params], enabled: !!current && (!current.uses_dates || (!!from && !!to)), queryFn: async () => (await get<ReportTable>(`/reports/${key}`, params)).data }));
	const csvHref = $derived.by(() => {
		const q = new URLSearchParams({ format: 'csv' });
		for (const [k, v] of Object.entries(params)) if (v) q.set(k, String(v));
		return `/api/reports/${key}?${q}`;
	});

	function cell(v: string | number | null | undefined, t: ColumnType): string {
		if (v === null || v === undefined || v === '') return '';
		switch (t) {
			case 'money': return idr(v);
			case 'int':
			case 'qty': return num(v);
			case 'percent': return `${num(v)}%`;
			case 'date': return Number.isNaN(Date.parse(String(v))) ? String(v) : date(String(v)); // the totals row puts "Total" in the first column
			case 'datetime': return Number.isNaN(Date.parse(String(v))) ? String(v) : dateTime(String(v));
			default: return String(v);
		}
	}
	const right = (t: ColumnType) => (t === 'money' || t === 'int' || t === 'qty' || t === 'percent' ? 'text-right num' : '');
</script>

<PageHeader title="Laporan" description="{scope.label} · dihitung dari ringkasan harian, bukan dari transaksi mentah">
	{#snippet actions()}
		{#if current?.uses_dates}<DateRange bind:from bind:to />{/if}
		{#if key === 'sales_by_product'}<Select class="w-40" bind:value={order}><option value="sales">Urut omzet</option><option value="qty">Urut jumlah</option></Select>{/if}
		{#if key === 'shift_variance'}<label class="flex items-center gap-2 text-muted"><input type="checkbox" bind:checked={onlyVariance} />Hanya yang selisih</label>{/if}
		<a href={csvHref} download class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 font-medium hover:bg-surface-2 {table.data ? '' : 'pointer-events-none opacity-50'}"><Download class="size-4" />Ekspor CSV</a>
	{/snippet}
</PageHeader>

<div class="grid gap-5 lg:grid-cols-[220px_1fr]">
	<nav class="space-y-4" aria-label="Daftar laporan">
		{#if catalog.isPending}<p class="text-muted">Memuat…</p>{/if}
		{#each groups as [group, defs]}
			<div>
				<p class="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{group}</p>
				{#each defs as d (d.key)}
					<button type="button" aria-current={d.key === key ? 'page' : undefined} class="block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2 aria-[current=page]:bg-primary/12 aria-[current=page]:font-medium aria-[current=page]:text-primary" onclick={() => (key = d.key)}>{d.title}</button>
				{/each}
			</div>
		{/each}
	</nav>

	<div class="min-w-0">
		{#if current}<p class="mb-2 text-muted">{current.description}</p>{/if}
		<Card class="overflow-x-auto">
			{#if catalog.isError}<Empty title="Gagal memuat daftar laporan" hint={catalog.error.message} />
			{:else if !current && !catalog.isPending}<Empty title="Tidak ada laporan" hint="Akun Anda belum memiliki izin laporan." />
			{:else if table.isPending}<Empty title="Memuat…" />
			{:else if table.isError}<Empty title="Gagal memuat laporan" hint={table.error.message} />
			{:else if !table.data.rows.length}<Empty title="Tidak ada data" hint="Coba ubah periode atau lokasi." />
			{:else}
				{@const t = table.data}
				<table class="w-full text-left">
					<thead class="border-b border-border text-[12px] text-muted uppercase">
						<tr>{#each t.columns as c, i}<th class="px-3 py-2.5 whitespace-nowrap {right(c.type)} {i === 0 ? 'pl-4' : ''}">{c.label}</th>{/each}</tr>
					</thead>
					<tbody>
						{#each t.rows as row}
							<tr class="border-b border-border last:border-0 hover:bg-surface-2/60">
								{#each t.columns as c, i}<td class="px-3 py-2 whitespace-nowrap {right(c.type)} {i === 0 ? 'pl-4' : ''} {c.type === 'text' && i > 0 ? 'text-muted' : ''} {c.key === 'variance' && Number(row[i]) < 0 ? 'text-danger' : ''}">{cell(row[i], c.type)}</td>{/each}
							</tr>
						{/each}
					</tbody>
					{#if t.totals}
						<tfoot class="border-t-2 border-border bg-surface-2/50 font-semibold">
							<tr>{#each t.columns as c, i}<td class="px-3 py-2.5 whitespace-nowrap {right(c.type)} {i === 0 ? 'pl-4' : ''}">{cell(t.totals[i], c.type)}</td>{/each}</tr>
						</tfoot>
					{/if}
				</table>
				<div class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-[12px] text-muted">
					<span>{t.rows.length} baris · dibuat {dateTime(t.generated_at)}</span>
					<span class="flex gap-2">
						{#if t.truncated}<Badge tone="warn">Dipotong — persempit filter atau ekspor CSV</Badge>{/if}
						{#if !t.show_profit && ['sales_by_day', 'sales_by_month', 'sales_by_store', 'sales_by_product', 'sales_by_category'].includes(t.report)}<Badge>Laba disembunyikan</Badge>{/if}
					</span>
				</div>
			{/if}
		</Card>
	</div>
</div>
