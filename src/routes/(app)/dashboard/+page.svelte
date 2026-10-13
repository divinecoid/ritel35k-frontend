<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ClipboardCheck, Clock, PackageX, ShieldAlert } from '@lucide/svelte';
	import BarList from '#lib/components/charts/BarList.svelte';
	import HourChart from '#lib/components/charts/HourChart.svelte';
	import TrendChart from '#lib/components/charts/TrendChart.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import DateRange from '#lib/components/ui/DateRange.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { get } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { ago, idr, idrShort, num } from '#lib/utils/format';
	import type { ApprovalInbox, DashOverview, Product, SecurityOverview, User } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let from = $state('');
	let to = $state('');

	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const underPath = $derived(scope.storeId === 'all' ? scope.path : undefined);
	const canView = $derived(can(data.me.grants, 'dashboard.view'));
	const ov = createQuery(() => ({
		queryKey: ['dashboard', from, to, storeId, underPath],
		enabled: canView && !!from && !!to,
		placeholderData: (prev) => prev, // keep the old figures on screen while a new filter loads
		queryFn: async () => (await get<DashOverview>('/dashboard/overview', { from, to, store_id: storeId, under_path: underPath })).data
	}));
	const o = $derived(ov.data);

	const canApprove = $derived(['purchase_order.approve', 'inventory.transfer.approve', 'inventory.count.approve'].some((p) => can(data.me.grants, p)));
	const approvals = createQuery(() => ({ queryKey: ['approvals'], enabled: canApprove, queryFn: async () => (await get<ApprovalInbox>('/approvals')).data }));

	const canSecurity = $derived(can(data.me.grants, 'security.view'));
	const security = createQuery(() => ({
		queryKey: ['dashboard', 'security', storeId, underPath],
		enabled: canSecurity,
		queryFn: async () => (await get<SecurityOverview>('/security/overview', { store_id: storeId, under_path: underPath })).data
	}));

	// first-run checklist, only while the company is still being set up
	const products = createQuery(() => ({ queryKey: ['products', '', 1, 'count'], enabled: can(data.me.grants, 'product.view'), queryFn: () => get<Product[]>('/products', { per_page: 1 }) }));
	const users = createQuery(() => ({ queryKey: ['users', '', 1, 'count'], enabled: can(data.me.grants, 'user.view'), queryFn: () => get<User[]>('/users', { per_page: 1 }) }));
	const steps = $derived(
		[
			{ done: scope.regions.length > 0, text: 'Buat region', href: '/settings/organization', show: can(data.me.grants, 'organization.unit.manage') },
			{ done: scope.stores.length > 0, text: 'Tambah toko pertama', href: '/settings/stores', show: can(data.me.grants, 'organization.store.create') },
			{ done: (products.data?.meta?.total ?? 0) > 0, text: 'Input produk & barcode', href: '/products', show: can(data.me.grants, 'product.manage') },
			{ done: (users.data?.meta?.total ?? 0) > 1, text: 'Undang kasir & manajer toko', href: '/settings/users', show: can(data.me.grants, 'user.manage') }
		].filter((s) => s.show)
	);

	const delta = (cur: string | number, prev: string | number) => {
		const p = Number(prev);
		return p > 0 ? ((Number(cur) - p) / p) * 100 : null;
	};
	const cards = $derived.by(() => {
		if (!o) return [];
		const c = o.current,
			p = o.previous;
		const list = [
			{ label: 'Penjualan bersih', value: idr(c.net_sales), d: delta(c.net_sales, p.net_sales), hint: `sebelumnya ${idrShort(p.net_sales)}` },
			{ label: 'Transaksi', value: num(c.transactions), d: delta(c.transactions, p.transactions), hint: `${num(c.items_sold)} item terjual` },
			{ label: 'Rata-rata per transaksi', value: idr(c.avg_basket), d: delta(c.avg_basket, p.avg_basket), hint: 'termasuk pajak' }
		];
		list.push(
			o.show_profit
				? { label: 'Laba kotor', value: idr(c.gross_profit), d: delta(c.gross_profit, p.gross_profit), hint: `margin ${num(c.margin_pct)}%` }
				: { label: 'Retur', value: idr(c.refund), d: delta(c.refund, p.refund), hint: `${num(c.discount)} diskon` }
		);
		return list;
	});

	const breakdownTitle = $derived(o?.breakdown_level === 'store' ? 'Penjualan per toko' : o?.breakdown_level === 'region' ? 'Penjualan per region' : 'Penjualan per unit');
	const maxNet = $derived(Math.max(1, ...(o?.breakdown ?? []).map((b) => Number(b.net_sales))));
	function drill(unitId: string) {
		const u = scope.units.find((x) => x.id === unitId);
		if (!u) return;
		if (u.type === 'store') scope.setStore(u.id);
		else scope.setRegion(u.id);
	}
	const hasSales = $derived((o?.current.transactions ?? 0) > 0);
</script>

<PageHeader title="Dashboard" description={o ? `${scope.label} · ${o.from === o.to ? o.from : `${o.from} s/d ${o.to}`} · diperbarui ${ago(o.updated_at)}` : scope.label}>
	{#snippet actions()}
		{#if canView}<DateRange bind:from bind:to />{/if}
	{/snippet}
</PageHeader>

{#if steps.length && steps.some((s) => !s.done)}
	<Card class="mb-5 p-5">
		<h2 class="mb-3 font-semibold">Mulai dari sini</h2>
		<ul class="space-y-2">
			{#each steps as s}
				<li class="flex items-center gap-3">
					<span class="grid size-5 place-items-center rounded-full border border-border {s.done ? 'border-ok bg-ok text-white' : ''}">{#if s.done}<Check class="size-3" />{/if}</span>
					<a href={s.href} class={s.done ? 'text-muted line-through' : 'text-primary hover:underline'}>{s.text}</a>
				</li>
			{/each}
		</ul>
	</Card>
{/if}

{#if !canView}
	<Card><Empty title="Dashboard penjualan tidak tersedia" hint="Akun Anda belum memiliki izin dashboard. Hubungi administrator." /></Card>
{:else if ov.isError}
	<Card><Empty title="Gagal memuat dashboard" hint={ov.error.message} /></Card>
{:else if !o}
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">{#each [0, 1, 2, 3] as i (i)}<Card class="h-24 animate-pulse bg-surface-2/60"><span class="sr-only">Memuat</span></Card>{/each}</div>
{:else}
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		{#each cards as c (c.label)}
			<Card class="p-4">
				<p class="text-muted">{c.label}</p>
				<p class="num mt-1 text-2xl font-semibold">{c.value}</p>
				<p class="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
					{#if c.d !== null}
						<span class="inline-flex items-center font-medium {c.d >= 0 ? 'text-ok' : 'text-danger'}">
							{#if c.d >= 0}<ArrowUpRight class="size-3.5" />{:else}<ArrowDownRight class="size-3.5" />{/if}{Math.abs(c.d).toFixed(1)}%
						</span>
					{/if}
					{c.hint}
				</p>
			</Card>
		{/each}
	</div>

	<div class="mt-4 grid gap-4 lg:grid-cols-3">
		<Card class="p-4 lg:col-span-2">
			<h2 class="mb-2 font-semibold">Penjualan bersih per hari</h2>
			<TrendChart points={o.trend.map((t) => ({ date: t.date, value: Number(t.net_sales) }))} />
		</Card>
		<Card class="p-4">
			<h2 class="mb-3 font-semibold">Jam ramai</h2>
			{#if hasSales}<HourChart hours={o.hourly.map((h) => ({ hour: h.hour, transactions: h.transactions, value: Number(h.net_sales) }))} />{:else}<p class="py-8 text-center text-muted">Belum ada penjualan pada periode ini.</p>{/if}
		</Card>
	</div>

	<div class="mt-4 grid gap-4 lg:grid-cols-3">
		<Card class="p-4">
			<div class="mb-3 flex items-baseline justify-between"><h2 class="font-semibold">{breakdownTitle}</h2>{#if o.breakdown.length}<span class="text-[12px] text-muted">klik untuk rinci</span>{/if}</div>
			{#if o.breakdown.length}
				<BarList onselect={drill} rows={o.breakdown.slice(0, 10).map((b) => ({ key: b.unit_id, label: b.name, sub: b.type === 'store' ? '' : `${b.stores} toko`, value: idrShort(b.net_sales), share: (Number(b.net_sales) / maxNet) * 100 }))} />
			{:else}
				<p class="py-6 text-center text-muted">{scope.storeId !== 'all' ? 'Satu toko dipilih — lihat grafik harian di samping.' : 'Belum ada toko di lingkup ini.'}</p>
			{/if}
		</Card>
		<Card class="p-4">
			<h2 class="mb-3 font-semibold">Produk terlaris</h2>
			{#if o.top_products.length}
				{@const top = Number(o.top_products[0].net_sales) || 1}
				<BarList rows={o.top_products.slice(0, 8).map((p) => ({ key: p.variant_id, label: p.name, sub: `${num(p.qty)} pcs`, value: idrShort(p.net_sales), share: (Number(p.net_sales) / top) * 100, tone: 'ok' }))} />
			{:else}<p class="py-6 text-center text-muted">Belum ada data.</p>{/if}
		</Card>
		<Card class="p-4">
			<h2 class="mb-3 font-semibold">Metode pembayaran</h2>
			{#if o.payments.length}
				<BarList rows={o.payments.map((p) => ({ key: p.method, label: p.method, sub: `${num(p.payments)}×`, value: `${num(p.share_pct)}%`, share: Number(p.share_pct), tone: 'warn' }))} />
			{:else}<p class="py-6 text-center text-muted">Belum ada data.</p>{/if}
		</Card>
	</div>

	{#if o.categories.length}
		<Card class="mt-4 p-4">
			<h2 class="mb-3 font-semibold">Kategori</h2>
			<div class="grid gap-x-8 gap-y-3 md:grid-cols-2">
				<BarList rows={o.categories.slice(0, 4).map((c) => ({ key: c.name, label: c.name, value: `${idrShort(c.net_sales)} · ${num(c.share_pct)}%`, share: Number(c.share_pct) }))} />
				<BarList rows={o.categories.slice(4, 8).map((c) => ({ key: c.name, label: c.name, value: `${idrShort(c.net_sales)} · ${num(c.share_pct)}%`, share: Number(c.share_pct) }))} />
			</div>
		</Card>
	{/if}

	<div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#if o.stock}
			<a href="/reports?report=inventory_valuation" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="text-muted">Nilai persediaan</p><p class="num mt-1 text-xl font-semibold">{idrShort(o.stock.stock_value)}</p></Card></a>
			<a href="/reports?report=low_stock" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><AlertTriangle class="size-4 {o.stock.low_stock ? 'text-warn' : ''}" />Stok menipis</p><p class="num mt-1 text-xl font-semibold">{num(o.stock.low_stock)} <span class="text-[13px] font-normal text-muted">SKU</span></p></Card></a>
			<a href="/inventory" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><PackageX class="size-4 {o.stock.out_of_stock ? 'text-danger' : ''}" />Stok habis</p><p class="num mt-1 text-xl font-semibold">{num(o.stock.out_of_stock)} <span class="text-[13px] font-normal text-muted">SKU</span></p></Card></a>
		{/if}
		{#if o.open_shifts !== undefined}
			<a href="/shifts" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><Clock class="size-4" />Shift kasir terbuka</p><p class="num mt-1 text-xl font-semibold">{num(o.open_shifts)}</p></Card></a>
		{/if}
		{#if canSecurity}
			<a href="/security" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><ShieldAlert class="size-4 {security.data?.active_critical ? 'text-danger' : ''}" />Peringatan keamanan</p><p class="num mt-1 text-xl font-semibold">{security.data ? num(security.data.active) : '—'}{#if security.data?.active_critical}<span class="ml-1 text-[13px] font-medium text-danger">{security.data.active_critical} kritis</span>{/if}</p></Card></a>
		{/if}
		{#if canApprove}
			<a href="/approvals" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><ClipboardCheck class="size-4 {approvals.data?.total ? 'text-primary' : ''}" />Menunggu persetujuan</p><p class="num mt-1 text-xl font-semibold">{approvals.data ? num(approvals.data.total) : '—'}</p></Card></a>
		{/if}
	</div>
{/if}
