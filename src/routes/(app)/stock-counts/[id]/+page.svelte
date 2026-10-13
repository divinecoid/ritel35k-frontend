<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { Radio, ScanBarcode } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { ApiError, get, post, put } from '#lib/api/client';
	import { canAtPath } from '#lib/permissions';
	import { errMsg } from '#lib/utils/errors';
	import { dateTime, idr, num } from '#lib/utils/format';
	import type { CountDetail, RfidScanResult } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const id = $derived(page.params.id);
	const q = createQuery(() => ({ queryKey: ['count', id], queryFn: async () => (await get<CountDetail>(`/stock-counts/${id}`)).data }));
	const c = $derived(q.data);
	const refresh = async () => { await qc.invalidateQueries({ queryKey: ['count', id] }); await qc.invalidateQueries({ queryKey: ['counts'] }); await qc.invalidateQueries({ queryKey: ['balances'] }); };

	let scan = $state('');
	let last = $state('');
	let filter = $state('');
	let submitOpen = $state(false);
	let policy = $state<'zero' | 'ignore'>('zero');
	let scanEl: HTMLInputElement | undefined = $state();

	async function doScan() {
		const code = scan.trim();
		if (!code) return;
		scan = '';
		try {
			const r = await post<{ name: string; counted_qty: string }>(`/stock-counts/${id}/scan`, { barcode: code });
			last = `${r.data.name} → ${num(r.data.counted_qty)}`;
			await refresh();
		} catch (e) {
			toast.error(errMsg(e));
		}
		scanEl?.focus();
	}
	// RFID: a handheld reader types each EPC followed by Enter, or a whole sweep can be pasted; batches may overlap.
	let rfidOpen = $state(false);
	let rfidText = $state('');
	let rfidResult = $state<RfidScanResult | null>(null);
	const rfidScan = createMutation(() => ({
		mutationFn: () => post<RfidScanResult>(`/stock-counts/${id}/rfid`, { epcs: rfidText.split(/[\s,;]+/).filter(Boolean) }),
		onSuccess: async (r) => { rfidResult = r.data; rfidText = ''; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const rfidNotes = $derived(rfidResult ? ([['unknown', 'tag tidak dikenal'], ['foreign', 'tag milik toko lain'], ['sold', 'tercatat TERJUAL tetapi ada di toko'], ['flagged', 'tag berstatus hilang/rusak ditemukan'], ['not_in_count', 'produk di luar cakupan opname ini']] as const).filter(([k]) => rfidResult![k].length) : []);

	async function setQty(variantId: string, v: string) {
		if (v === '') return;
		try { await put(`/stock-counts/${id}/items`, { items: [{ variant_id: variantId, counted_qty: Number(v) }] }); await refresh(); } catch (e) { toast.error(errMsg(e)); }
	}

	const submit = createMutation(() => ({
		mutationFn: (uncounted?: string) => post(`/stock-counts/${id}/submit`, { uncounted }),
		onSuccess: async () => { toast.ok('Hitungan dikirim — periksa selisih'); submitOpen = false; await refresh(); },
		onError: (e) => { if (e instanceof ApiError && e.code === 'UNCOUNTED_ITEMS') submitOpen = true; else toast.error(errMsg(e)); }
	}));
	const approve = createMutation(() => ({ mutationFn: () => post(`/stock-counts/${id}/approve`, {}), onSuccess: async () => { toast.ok('Disetujui — penyesuaian stok diposting'); await refresh(); }, onError: (e) => toast.error(errMsg(e)) }));
	const cancel = createMutation(() => ({ mutationFn: () => post(`/stock-counts/${id}/cancel`, {}), onSuccess: async () => { toast.ok('Opname dibatalkan'); await refresh(); }, onError: (e) => toast.error(errMsg(e)) }));

	const lines = $derived((c?.lines ?? []).filter((l) => !filter || l.product_name.toLowerCase().includes(filter.toLowerCase()) || l.sku.toLowerCase().includes(filter.toLowerCase()) || l.barcode === filter));
	const uncounted = $derived((c?.lines ?? []).filter((l) => l.counted_qty === null).length);
	const mayCount = $derived(!!c && canAtPath(data.me.grants, 'inventory.count', c.path));
	const mayApprove = $derived(!!c && canAtPath(data.me.grants, 'inventory.count.approve', c.path));
	const tone = { counting: 'warn', submitted: 'info', approved: 'ok', cancelled: 'danger' } as const;
	const label = { counting: 'Sedang dihitung', submitted: 'Menunggu persetujuan', approved: 'Selesai', cancelled: 'Dibatalkan' } as const;
	const v = (x: string | null) => (x === null ? null : Number(x));
</script>

{#if !c}<p class="text-muted">Memuat…</p>
{:else}
	<PageHeader title={c.document_number} description="{c.store_name ?? 'Pusat'} / {c.warehouse_code} · snapshot {dateTime(c.snapshot_at)}">
		{#snippet actions()}
			<Badge tone={tone[c.status]}>{label[c.status]}</Badge>
			{#if c.status === 'counting' && mayCount}<Button loading={submit.isPending} onclick={() => (uncounted ? (submitOpen = true) : submit.mutate(undefined))}>Selesai menghitung</Button>{/if}
			{#if c.status === 'submitted' && mayApprove}<Button loading={approve.isPending} onclick={() => approve.mutate()}>Setujui & posting selisih</Button>{/if}
			{#if (c.status === 'counting' || c.status === 'submitted') && (mayCount || mayApprove)}<Button variant="ghost" onclick={() => cancel.mutate()}>Batalkan</Button>{/if}
		{/snippet}
	</PageHeader>

	{#if c.status === 'counting'}
		<div class="mb-4 grid grid-cols-[1fr_260px] gap-3">
			<form class="relative" onsubmit={(e) => { e.preventDefault(); doScan(); }}>
				<ScanBarcode class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
				<input bind:this={scanEl} bind:value={scan} autocomplete="off" placeholder="Scan barcode (tiap scan +1)" aria-label="Scan barcode" class="h-11 w-full rounded-lg border-2 border-border bg-surface pr-4 pl-11 focus:border-primary focus:outline-none" />
			</form>
			<Input placeholder="Cari di daftar" bind:value={filter} />
		</div>
		{#if mayCount && c.store_name}
			<div class="mb-4">
				<button type="button" class="flex items-center gap-2 text-primary hover:underline" onclick={() => (rfidOpen = !rfidOpen)}><Radio class="size-4" />Hitung dengan RFID</button>
				{#if rfidOpen}
					<Card class="mt-2 p-3">
						<textarea bind:value={rfidText} rows="3" class="w-full rounded-md border border-border bg-surface p-2 font-mono text-[12px]" placeholder="Tempel/scan EPC, satu per baris. Boleh berulang — tag yang sama dihitung sekali." aria-label="Daftar EPC"></textarea>
						<div class="mt-2 flex items-center gap-3">
							<Button size="sm" loading={rfidScan.isPending} disabled={!rfidText.trim()} onclick={() => rfidScan.mutate()}>Hitung tag</Button>
							{#if rfidResult}<span class="text-muted">+{rfidResult.added} baru{rfidResult.already_counted ? ` · ${rfidResult.already_counted} sudah dihitung` : ''}</span>{/if}
						</div>
						{#each rfidNotes as [k, text]}<p class="mt-1 text-[13px] text-warn">{rfidResult![k].length} {text}: <span class="font-mono text-[11px]">{rfidResult![k].slice(0, 3).join(', ')}{rfidResult![k].length > 3 ? '…' : ''}</span></p>{/each}
						<p class="mt-2 text-[12px] text-muted">Untuk produk ber-RFID, jumlah tag unik menggantikan hitungan barcode.</p>
					</Card>
				{/if}
			</div>
		{/if}
		<p class="mb-3 text-muted">Dihitung <b class="text-text">{c.summary.counted}/{c.summary.items}</b>{last ? ` · terakhir: ${last}` : ''} · jumlah sistem disembunyikan agar hitungan objektif.</p>
	{/if}

	{#if c.status !== 'counting'}
		<div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
			<Card class="p-3"><p class="text-muted">Barang dihitung</p><p class="num text-xl font-semibold">{c.summary.counted}/{c.summary.items}</p></Card>
			<Card class="p-3"><p class="text-muted">Kurang (unit)</p><p class="num text-xl font-semibold {Number(c.summary.shortage_qty) > 0 ? 'text-danger' : ''}">{num(c.summary.shortage_qty)}</p></Card>
			<Card class="p-3"><p class="text-muted">Lebih (unit)</p><p class="num text-xl font-semibold">{num(c.summary.surplus_qty)}</p></Card>
			<Card class="p-3"><p class="text-muted">Nilai selisih (HPP)</p><p class="num text-xl font-semibold {Number(c.summary.variance_value) < 0 ? 'text-danger' : ''}">{idr(c.summary.variance_value)}</p></Card>
		</div>
	{/if}

	<Card>
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Barang</th><th>Barcode</th>{#if c.status !== 'counting'}<th class="text-right">Seharusnya</th>{/if}<th class="text-right">Dihitung</th>{#if c.status !== 'counting'}<th class="text-right">Selisih</th><th class="pr-4 text-right">Nilai</th>{/if}</tr></thead>
			<tbody>
				{#each lines as l (l.id)}
					{@const d = v(l.variance)}
					<tr class="border-b border-border last:border-0 {d !== null && d !== 0 ? 'bg-warn/5' : ''}">
						<td class="px-4 py-2">{l.product_name}<br /><span class="font-mono text-[12px] text-muted">{l.sku}</span></td>
						<td class="font-mono text-[12px] text-muted">{l.barcode ?? '—'}</td>
						{#if c.status !== 'counting'}<td class="num text-right">{num(l.expected_qty ?? l.system_qty)}</td>{/if}
						<td class="text-right">
							{#if c.status === 'counting' && mayCount}<Input class="num ml-auto h-8 w-24 text-right" inputmode="decimal" value={l.counted_qty ?? ''} placeholder="—" aria-label="Dihitung {l.sku}" onchange={(e) => setQty(l.variant_id, e.currentTarget.value)} />
							{:else}<span class="num">{l.counted_qty === null ? '—' : num(l.counted_qty)}</span>{/if}
						</td>
						{#if c.status !== 'counting'}
							<td class="num text-right font-medium {d === null ? 'text-muted' : d < 0 ? 'text-danger' : d > 0 ? 'text-ok' : ''}">{d === null ? 'diabaikan' : d > 0 ? `+${num(d)}` : num(d)}</td>
							<td class="num pr-4 text-right">{d === null || d === 0 ? '—' : idr(l.variance_value)}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</Card>
{/if}

<Dialog bind:open={submitOpen} title="Ada barang yang belum dihitung">
	<p><b>{uncounted}</b> barang belum dihitung. Pilih perlakuan:</p>
	<label class="flex gap-2 rounded-md border border-border p-3"><input type="radio" bind:group={policy} value="zero" /><span><b>Anggap kosong (0)</b><br /><span class="text-muted">Cocok untuk full count: barang yang tidak ditemukan di rak dianggap tidak ada.</span></span></label>
	<label class="flex gap-2 rounded-md border border-border p-3"><input type="radio" bind:group={policy} value="ignore" /><span><b>Abaikan</b><br /><span class="text-muted">Stok barang itu tidak diubah.</span></span></label>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (submitOpen = false)}>Kembali menghitung</Button>
		<Button loading={submit.isPending} onclick={() => submit.mutate(policy)}>Kirim hitungan</Button>
	{/snippet}
</Dialog>
