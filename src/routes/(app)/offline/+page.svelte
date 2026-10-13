<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Clock, TriangleAlert, WifiOff } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { severityLabel, severityTone } from '#lib/features/rfid/status';
	import { get, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime, idr, num } from '#lib/utils/format';
	import { errMsg } from '#lib/utils/errors';
	import type { OfflineException, Terminal, TerminalSync } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const canReview = $derived(can(data.me.grants, 'security.resolve'));
	let status = $state('open');
	let type = $state('');
	let pageNo = $state(1);

	const typeLabel: Record<string, string> = {
		PRICE_MISMATCH: 'Selisih harga',
		NEGATIVE_STOCK: 'Stok jadi minus',
		TAG_CONFLICT: 'Konflik tag RFID',
		LATE_SALE: 'Masuk shift tertutup',
		UNPRICEABLE: 'Tidak bisa dihitung ulang',
		MEMBER_MISSING: 'Member tidak ditemukan',
		PAYMENT_METHOD: 'Metode bayar nonaktif',
		REJECTED_SALE: 'Transaksi ditolak (perlu input manual)'
	};

	const terminals = createQuery(() => ({ queryKey: ['terminals', storeId], queryFn: async () => (await get<Terminal[]>('/pos/terminals', { store_id: storeId })).data }));
	const syncs = createQuery(() => ({ queryKey: ['terminal-sync', storeId], refetchInterval: 15000, queryFn: async () => (await get<TerminalSync[]>('/pos/sync-status', { store_id: storeId })).data }));
	const list = createQuery(() => ({
		queryKey: ['offline-exceptions', storeId, status, type, pageNo],
		placeholderData: (p) => p,
		queryFn: () => get<OfflineException[]>('/pos/exceptions', { store_id: storeId, status, type, page: pageNo, per_page: 20 })
	}));
	const rows = $derived(list.data?.data ?? []);
	const total = $derived(list.data?.meta?.total ?? 0);
	const termOf = (id: string) => terminals.data?.find((t) => t.id === id);
	const stale = (s: TerminalSync) => !s.last_sync_at || Date.now() - new Date(s.last_sync_at).getTime() > 10 * 60_000;

	let openRow = $state<OfflineException | null>(null);
	let dialog = $state(false);
	let note = $state('');
	const review = createMutation(() => ({
		mutationFn: (v: 'reviewed' | 'dismissed') => post(`/pos/exceptions/${openRow!.id}/review`, { status: v, note }),
		onSuccess: async () => { toast.ok('Tersimpan'); dialog = false; note = ''; await qc.invalidateQueries({ queryKey: ['offline-exceptions'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const show = (r: OfflineException) => { openRow = r; note = ''; dialog = true; };
	const detailRows = $derived(openRow ? Object.entries(openRow.detail).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object') : []);
</script>

<PageHeader title="Penjualan offline" description="{scope.label} · toko tetap jual saat internet putus; transaksi dikirim otomatis dan selisihnya ditinjau di sini" />

<Card class="mb-4">
	<div class="border-b border-border px-4 py-2.5 font-semibold">Status sinkron terminal</div>
	{#if syncs.isPending}<Empty title="Memuat…" />
	{:else if !syncs.data?.length}<Empty title="Belum ada terminal yang disetel offline" hint="Buat token di Terminal POS → Token offline, lalu tempel di konfigurasi agen toko." />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Terminal</th><th>Sinkron terakhir</th><th class="text-right">Antrean</th><th>Katalog</th><th>Agen</th><th class="pr-4">Token</th></tr></thead>
			<tbody>
				{#each syncs.data as s (s.terminal_id)}
					{@const t = termOf(s.terminal_id)}
					<tr class="border-b border-border last:border-0">
						<td class="px-4 py-2.5">{t?.store_name ?? ''} <span class="font-mono text-[13px]">{t?.code ?? s.terminal_id.slice(0, 8)}</span></td>
						<td>{#if s.last_sync_at}<span class="inline-flex items-center gap-1 {stale(s) ? 'text-danger' : 'text-ok'}"><Clock class="size-3.5" />{dateTime(s.last_sync_at)}</span>{:else}<span class="text-muted">belum pernah</span>{/if}</td>
						<td class="num text-right">{#if s.pending > 0}<Badge tone="warn">{num(s.pending)} menunggu</Badge>{:else}<span class="text-muted">0</span>{/if}</td>
						<td class="font-mono text-[12px] text-muted">{s.snapshot_version || '—'}</td>
						<td class="text-muted">{s.agent_version || '—'}</td>
						<td class="pr-4 font-mono text-[12px] text-muted">…{s.token_hint}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<Card>
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
		<span class="font-semibold">Pengecualian untuk ditinjau</span>
		<div class="flex gap-2">
			<Select bind:value={status} onchange={() => (pageNo = 1)} aria-label="Status"><option value="open">Perlu ditinjau</option><option value="reviewed">Sudah ditinjau</option><option value="dismissed">Diabaikan</option><option value="">Semua</option></Select>
			<Select bind:value={type} onchange={() => (pageNo = 1)} aria-label="Jenis"><option value="">Semua jenis</option>{#each Object.entries(typeLabel) as [k, v]}<option value={k}>{v}</option>{/each}</Select>
		</div>
	</div>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if !rows.length}<Empty title="Tidak ada pengecualian" hint="Semua transaksi offline masuk tanpa selisih." />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Waktu</th><th>Jenis</th><th>Toko / terminal</th><th>No. transaksi</th><th class="text-right">Total</th><th>Tingkat</th><th class="pr-4"></th></tr></thead>
			<tbody>
				{#each rows as r (r.id)}
					<tr class="border-b border-border last:border-0 hover:bg-surface-2/50">
						<td class="px-4 py-2.5 whitespace-nowrap">{dateTime(r.created_at)}</td>
						<td>{typeLabel[r.type] ?? r.type}</td>
						<td>{r.store_name} <span class="font-mono text-[12px] text-muted">{r.terminal_code}</span></td>
						<td class="font-mono text-[12px]">{r.document_number || '—'}{#if r.local_number}<br /><span class="text-muted">{r.local_number}</span>{/if}</td>
						<td class="num text-right">{Number(r.grand_total) ? idr(r.grand_total) : '—'}</td>
						<td><Badge tone={severityTone[r.severity]}>{severityLabel[r.severity]}</Badge></td>
						<td class="pr-4 text-right"><Button size="sm" variant="ghost" onclick={() => show(r)}>{r.status === 'open' ? 'Tinjau' : 'Lihat'}</Button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="flex items-center justify-between px-4 py-2.5 text-muted">
			<span>{num(total)} pengecualian</span>
			<span class="flex gap-1"><Button size="sm" variant="ghost" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button><Button size="sm" variant="ghost" disabled={pageNo * 20 >= total} onclick={() => pageNo++}>Berikutnya</Button></span>
		</div>
	{/if}
</Card>

<Dialog bind:open={dialog} title={openRow ? (typeLabel[openRow.type] ?? openRow.type) : ''} wide>
	{#if openRow}
		<p class="flex items-center gap-2"><TriangleAlert class="size-4 text-warn" />{openRow.title}</p>
		{#if openRow.type === 'REJECTED_SALE'}<p class="rounded-md bg-danger/10 px-3 py-2 text-danger">Transaksi ini tidak bisa dibukukan otomatis. Seluruh isinya tersimpan di bawah — masukkan manual lalu tandai selesai.</p>{/if}
		<dl class="grid grid-cols-[160px_1fr] gap-y-1.5">
			{#each detailRows as [k, v]}<dt class="text-muted">{k}</dt><dd class="font-mono text-[12px] break-all">{String(v)}</dd>{/each}
		</dl>
		{#if openRow.detail.lines}<pre class="max-h-48 overflow-auto rounded-md border border-border bg-surface-2 p-2 font-mono text-[11px]">{JSON.stringify(openRow.detail.lines, null, 1)}</pre>{/if}
		{#if openRow.detail.command}<pre class="max-h-64 overflow-auto rounded-md border border-border bg-surface-2 p-2 font-mono text-[11px]">{JSON.stringify(openRow.detail.command, null, 1)}</pre>{/if}
		{#if openRow.status !== 'open'}<p class="text-muted">{openRow.status === 'reviewed' ? 'Ditinjau' : 'Diabaikan'} oleh {openRow.reviewed_by_name} · {dateTime(openRow.reviewed_at)}{openRow.review_note ? ` — ${openRow.review_note}` : ''}</p>
		{:else if canReview}<Field label="Catatan" for="oe-note"><Input id="oe-note" bind:value={note} placeholder="mis. harga diperbarui pusat, sesuai" /></Field>
		{:else}<p class="text-muted">Hanya pengguna dengan izin “Resolve security events” yang dapat menutup pengecualian ini.</p>{/if}
	{/if}
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (dialog = false)}>Tutup</Button>
		{#if openRow?.status === 'open' && canReview}
			<Button variant="secondary" loading={review.isPending} onclick={() => review.mutate('dismissed')}>Abaikan (alarm palsu)</Button>
			<Button loading={review.isPending} onclick={() => review.mutate('reviewed')}>Tandai ditinjau</Button>
		{/if}
	{/snippet}
</Dialog>
