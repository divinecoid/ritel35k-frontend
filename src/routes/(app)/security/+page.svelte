<script lang="ts">
	import { page } from '$app/state';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { ShieldAlert, Radio, PackageSearch } from '@lucide/svelte';
	import BarList from '#lib/components/charts/BarList.svelte';
	import TrendChart from '#lib/components/charts/TrendChart.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import DateRange from '#lib/components/ui/DateRange.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { eventStatusLabel, eventStatusTone, securityLabel, severityLabel, severityTone } from '#lib/features/rfid/status';
	import { get, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime, num } from '#lib/utils/format';
	import { errMsg } from '#lib/utils/errors';
	import type { SecurityEventDetail, SecurityEventRow, SecurityOverview, SecurityType } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let from = $state('');
	let to = $state('');
	let status = $state('active');
	let type = $state<'' | SecurityType>('');
	let pageNo = $state(1);
	let openId = $state<string | null>(page.url.searchParams.get('event'));
	let dialog = $state(!!page.url.searchParams.get('event'));
	let note = $state('');

	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const underPath = $derived(scope.storeId === 'all' ? scope.path : undefined);
	const common = $derived({ from, to, store_id: storeId, under_path: underPath });
	const canResolve = $derived(can(data.me.grants, 'security.resolve'));

	const overview = createQuery(() => ({
		queryKey: ['security', 'overview', common],
		enabled: !!from && !!to,
		placeholderData: (p) => p,
		queryFn: async () => (await get<SecurityOverview>('/security/overview', common)).data
	}));
	const events = createQuery(() => ({
		queryKey: ['security', 'events', common, status, type, pageNo],
		enabled: !!from && !!to,
		placeholderData: (p) => p,
		queryFn: () => get<SecurityEventRow[]>('/security/events', { ...common, status, type, page: pageNo, per_page: 20 })
	}));
	const detail = createQuery(() => ({ queryKey: ['security', 'event', openId], enabled: !!openId, queryFn: async () => (await get<SecurityEventDetail>(`/security/events/${openId}`)).data }));
	const o = $derived(overview.data);
	const d = $derived(detail.data);

	const act = createMutation(() => ({
		mutationFn: (v: { status: 'acknowledged' | 'resolved' | 'false_alarm' }) => post(`/security/events/${openId}/status`, { status: v.status, note: note || undefined }),
		onSuccess: async () => { note = ''; await qc.invalidateQueries({ queryKey: ['security'] }); toast.ok('Tersimpan'); },
		onError: (e) => toast.error(errMsg(e))
	}));
	function open(id: string) { openId = id; dialog = true; note = ''; }
	$effect(() => { if (!dialog) openId = null; });
	const maxType = $derived(Math.max(1, ...(o?.by_type ?? []).map((t) => t.total)));
	const maxStore = $derived(Math.max(1, ...(o?.by_store ?? []).map((t) => t.total)));
	const closed = $derived(d?.status === 'resolved' || d?.status === 'false_alarm');
	const detailRows = $derived(d ? Object.entries(d.detail).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object') : []);
</script>

<PageHeader title="Keamanan & loss prevention" description="{scope.label} · alarm RFID dan pelanggaran aturan dari penjualan">
	{#snippet actions()}<DateRange bind:from bind:to onchange={() => (pageNo = 1)} />{/snippet}
</PageHeader>

{#if o}
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<Card class="p-4"><p class="flex items-center gap-1.5 text-muted"><ShieldAlert class="size-4 {o.active_critical ? 'text-danger' : ''}" />Perlu ditangani</p><p class="num mt-1 text-2xl font-semibold">{num(o.active)}</p><p class="mt-1 text-[12px] {o.active_critical ? 'font-medium text-danger' : 'text-muted'}">{o.active_critical} kritis</p></Card>
		<Card class="p-4"><p class="text-muted">Kejadian periode ini</p><p class="num mt-1 text-2xl font-semibold">{num(o.total)}</p><p class="mt-1 text-[12px] text-muted">semua status</p></Card>
		{#if o.readers}
			<a href="/rfid" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><Radio class="size-4 {o.readers.offline ? 'text-danger' : ''}" />Reader online</p><p class="num mt-1 text-2xl font-semibold">{o.readers.online}<span class="text-base font-normal text-muted"> / {o.readers.total}</span></p><p class="mt-1 text-[12px] {o.readers.offline ? 'font-medium text-danger' : 'text-muted'}">{o.readers.offline} offline</p></Card></a>
		{/if}
		{#if o.stock_mismatch !== undefined}
			<a href="/rfid" class="block"><Card class="h-full p-4 hover:bg-surface-2/50"><p class="flex items-center gap-1.5 text-muted"><PackageSearch class="size-4 {o.stock_mismatch ? 'text-warn' : ''}" />Tag ≠ stok sistem</p><p class="num mt-1 text-2xl font-semibold">{num(o.stock_mismatch)}</p><p class="mt-1 text-[12px] text-muted">SKU/toko berselisih</p></Card></a>
		{/if}
	</div>

	<div class="mt-4 grid gap-4 lg:grid-cols-3">
		<Card class="p-4 lg:col-span-2"><h2 class="mb-2 font-semibold">Kejadian per hari</h2><TrendChart label="Kejadian" points={o.by_day.map((x) => ({ date: x.day, value: x.total }))} /></Card>
		<Card class="p-4">
			<h2 class="mb-3 font-semibold">Per toko</h2>
			{#if o.by_store.length}<BarList rows={o.by_store.map((s) => ({ key: s.store_id, label: s.store_name, sub: s.active ? `${s.active} aktif` : '', value: String(s.total), share: (s.total / maxStore) * 100, tone: s.critical ? 'warn' : 'primary' }))} />{:else}<p class="py-6 text-center text-muted">Tidak ada kejadian.</p>{/if}
		</Card>
	</div>
{/if}

<div class="mt-4 flex flex-wrap items-center gap-2">
	<Select class="w-44" bind:value={status} onchange={() => (pageNo = 1)} aria-label="Status">
		<option value="active">Perlu ditangani</option><option value="">Semua status</option><option value="resolved">Selesai</option><option value="false_alarm">Alarm palsu</option>
	</Select>
	<Select class="w-52" bind:value={type} onchange={() => (pageNo = 1)} aria-label="Jenis">
		<option value="">Semua jenis</option>
		{#each Object.entries(securityLabel) as [k, v]}<option value={k}>{v}{o ? ` (${o.by_type.find((t) => t.type === k)?.total ?? 0})` : ''}</option>{/each}
	</Select>
</div>

<Card class="mt-3">
	{#if events.isPending}<Empty title="Memuat…" />
	{:else if events.isError}<Empty title="Gagal memuat" hint={events.error.message} />
	{:else if !events.data.data.length}<Empty title={status === 'active' ? 'Tidak ada yang perlu ditangani' : 'Tidak ada kejadian'} hint="Alarm gerbang RFID dan pelanggaran aturan muncul di sini secara otomatis." />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Kejadian</th><th>Jenis</th><th>Toko</th><th>Waktu</th><th class="pr-4">Status</th></tr></thead>
			<tbody>
				{#each events.data.data as e (e.id)}
					<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => open(e.id)}>
						<td class="px-4 py-2.5"><Badge tone={severityTone[e.severity]}>{severityLabel[e.severity]}</Badge> <span class="ml-1 font-medium">{e.title}</span></td>
						<td class="text-muted">{securityLabel[e.type]}</td>
						<td>{e.store_name}</td>
						<td class="num text-muted">{dateTime(e.occurred_at)}</td>
						<td class="pr-4"><Badge tone={eventStatusTone[e.status]}>{eventStatusLabel[e.status]}</Badge></td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if events.data.meta && events.data.meta.total_pages > 1}
			<div class="flex items-center justify-between border-t border-border px-4 py-2">
				<span class="text-muted">{events.data.meta.total} kejadian</span>
				<div class="flex gap-2">
					<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
					<Button size="sm" variant="secondary" disabled={pageNo >= events.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
				</div>
			</div>
		{/if}
	{/if}
</Card>

<Dialog bind:open={dialog} title={d ? securityLabel[d.type] : 'Kejadian'} wide>
	{#if !d}<p class="text-muted">Memuat…</p>
	{:else}
		<div class="flex items-start justify-between gap-3">
			<p class="font-medium">{d.title}</p>
			<span class="flex shrink-0 gap-1.5"><Badge tone={severityTone[d.severity]}>{severityLabel[d.severity]}</Badge><Badge tone={eventStatusTone[d.status]}>{eventStatusLabel[d.status]}</Badge></span>
		</div>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-2">
			<div><dt class="text-[12px] text-muted">Toko</dt><dd>{d.store_name}{d.reader_code ? ` · ${d.reader_code}` : ''}</dd></div>
			<div><dt class="text-[12px] text-muted">Waktu</dt><dd>{dateTime(d.occurred_at)}</dd></div>
			{#if d.product_name}<div><dt class="text-[12px] text-muted">Produk</dt><dd>{d.product_name}<br /><span class="font-mono text-[12px] text-muted">{d.sku}</span></dd></div>{/if}
			{#if d.epc}<div><dt class="text-[12px] text-muted">Tag</dt><dd class="font-mono text-[12px] break-all"><a href="/rfid" class="text-primary hover:underline">{d.epc}</a></dd></div>{/if}
			{#if d.user_name}<div><dt class="text-[12px] text-muted">Pengguna terkait</dt><dd>{d.user_name}</dd></div>{/if}
			{#if d.sale_id}<div><dt class="text-[12px] text-muted">Transaksi</dt><dd><a href="/sales" class="text-primary hover:underline">Lihat penjualan</a></dd></div>{/if}
		</dl>
		{#if detailRows.length}
			<div class="rounded-md bg-surface-2 p-3 text-[13px]">
				{#each detailRows as [k, v]}<p><span class="text-muted">{k.replaceAll('_', ' ')}:</span> {String(v)}</p>{/each}
			</div>
		{/if}
		{#if d.acknowledged_by_name}<p class="text-[13px] text-muted">Ditangani oleh {d.acknowledged_by_name} · {dateTime(d.acknowledged_at)}</p>{/if}
		{#if closed}
			<div class="rounded-md border border-border p-3"><p class="text-[13px] text-muted">{eventStatusLabel[d.status]} oleh {d.resolved_by_name} · {dateTime(d.resolved_at)}</p><p class="mt-1">{d.resolution_note}</p></div>
		{:else if canResolve}
			<Field label="Catatan penyelesaian" for="sn" hint="Wajib untuk Selesai / Alarm palsu — tercatat di audit log"><textarea id="sn" bind:value={note} rows="2" class="w-full rounded-md border border-border bg-surface p-2"></textarea></Field>
		{/if}
	{/if}
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (dialog = false)}>Tutup</Button>
		{#if d && !closed && canResolve}
			{#if d.status === 'open'}<Button variant="secondary" loading={act.isPending} onclick={() => act.mutate({ status: 'acknowledged' })}>Tandai ditangani</Button>{/if}
			<Button variant="secondary" disabled={note.trim().length < 3} loading={act.isPending} onclick={() => act.mutate({ status: 'false_alarm' })}>Alarm palsu</Button>
			<Button disabled={note.trim().length < 3} loading={act.isPending} onclick={() => act.mutate({ status: 'resolved' })}>Selesai</Button>
		{/if}
	{/snippet}
</Dialog>
