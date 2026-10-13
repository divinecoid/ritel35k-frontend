<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { errMsg } from '#lib/utils/errors';
	import { date, dateTime, idr, num } from '#lib/utils/format';
	import type { GRNRow, Me, PODetail } from '#lib/types/api';

	let { poId = $bindable(), me }: { poId: string | null; me: Me } = $props();
	const qc = useQueryClient();
	let open = $state(false);
	let mode = $state<'view' | 'receive' | 'cancel'>('view');
	let reason = $state('');
	let ref = $state('');
	let recv = $state<Record<string, { qty: string; cost: string }>>({});

	$effect(() => {
		if (poId) {
			open = true;
			mode = 'view';
			reason = ref = '';
			recv = {};
		}
	});

	const po = createQuery(() => ({ queryKey: ['po', poId], enabled: !!poId, queryFn: async () => (await get<PODetail>(`/purchase-orders/${poId}`)).data }));
	const grns = createQuery(() => ({ queryKey: ['grns', poId], enabled: !!poId, queryFn: async () => (await get<GRNRow[]>('/goods-receipts', { po_id: poId })).data }));
	const refresh = async () => {
		await qc.invalidateQueries({ queryKey: ['po', poId] });
		await qc.invalidateQueries({ queryKey: ['pos'] });
		await qc.invalidateQueries({ queryKey: ['grns'] });
		await qc.invalidateQueries({ queryKey: ['balances'] });
	};
	const path = $derived(po.data?.path);
	const c = (perm: string) => can(me.grants, perm, path || undefined) && (path ? true : me.grants[perm]?.all);

	const act = (name: string, body: unknown = {}) =>
		createMutation(() => ({
			mutationFn: () => post(`/purchase-orders/${poId}/${name}`, body),
			onSuccess: async () => { toast.ok('Berhasil'); mode = 'view'; await refresh(); },
			onError: (e) => toast.error(errMsg(e))
		}));
	const submit = act('submit');
	const approve = act('approve');
	const close = act('close');
	const cancel = createMutation(() => ({
		mutationFn: () => post(`/purchase-orders/${poId}/cancel`, { reason }),
		onSuccess: async () => { toast.ok('PO dibatalkan'); mode = 'view'; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));

	function startReceive() {
		recv = Object.fromEntries((po.data?.lines ?? []).map((l) => [l.id, { qty: String(Math.max(0, Number(l.qty_ordered) - Number(l.qty_received))), cost: '' }]));
		mode = 'receive';
	}
	const receive = createMutation(() => ({
		mutationFn: () =>
			post<{ document_number: string }>('/goods-receipts', {
				po_id: poId,
				supplier_ref: ref,
				lines: (po.data?.lines ?? []).filter((l) => Number(recv[l.id]?.qty) > 0).map((l) => ({ po_item_id: l.id, variant_id: l.variant_id, qty: Number(recv[l.id].qty), unit_cost: recv[l.id].cost === '' ? undefined : Number(recv[l.id].cost) }))
			}),
		onSuccess: async (r) => { toast.ok(`Penerimaan ${r.data.document_number} diposting — stok bertambah`); mode = 'view'; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const canReceive = $derived(po.data && ['approved', 'partially_received'].includes(po.data.status) && c('goods_receipt.create'));
	const recvValid = $derived((po.data?.lines ?? []).some((l) => Number(recv[l.id]?.qty) > 0));
</script>

<Dialog bind:open title={po.data?.document_number ?? 'Purchase order'} wide onclose={() => (poId = null)}>
	{#if !po.data}<p class="text-muted">Memuat…</p>
	{:else}
		{@const p = po.data}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
			<StatusBadge status={p.status} /><span>{p.supplier_name}</span><span>·</span><span>→ {p.store_name ?? 'Pusat'} / {p.warehouse_code}</span>
			{#if p.expected_date}<span>· tiba {date(p.expected_date)}</span>{/if}<span>· dibuat {dateTime(p.created_at)}</span>
		</div>
		{#if p.cancel_reason}<p class="text-danger">Dibatalkan: {p.cancel_reason}</p>{/if}

		<table class="w-full text-left [&_td]:px-2 [&_th]:px-2">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="py-2">Barang</th><th class="text-right">Dipesan</th><th class="text-right">Diterima</th><th class="text-right">Harga</th><th class="text-right">Total</th>{#if mode === 'receive'}<th class="text-right">Terima sekarang</th><th class="text-right">Biaya (ops.)</th>{/if}</tr></thead>
			<tbody>
				{#each p.lines as l (l.id)}
					<tr class="border-b border-border last:border-0">
						<td class="py-2">{l.product_name}<br /><span class="font-mono text-[12px] text-muted">{l.sku}</span></td>
						<td class="num text-right">{num(l.qty_ordered)}</td>
						<td class="num text-right {Number(l.qty_received) >= Number(l.qty_ordered) ? 'text-ok' : ''}">{num(l.qty_received)}</td>
						<td class="num text-right">{idr(l.unit_price)}</td><td class="num text-right">{idr(l.line_total)}</td>
						{#if mode === 'receive'}
							<td class="text-right"><Input class="num ml-auto h-8 w-20 text-right" inputmode="decimal" bind:value={recv[l.id].qty} aria-label="Jumlah diterima" /></td>
							<td class="text-right"><Input class="num ml-auto h-8 w-24 text-right" inputmode="decimal" placeholder={String(Number(l.unit_price))} bind:value={recv[l.id].cost} aria-label="Biaya" /></td>
						{/if}
					</tr>
				{/each}
			</tbody>
			<tfoot><tr><td colspan="4" class="py-2 text-right font-semibold">Total PO</td><td class="num text-right font-semibold">{idr(p.total)}</td></tr></tfoot>
		</table>

		{#if mode === 'receive'}
			<Field label="No. surat jalan / referensi supplier" for="r-ref"><Input id="r-ref" bind:value={ref} /></Field>
			<p class="text-[12px] text-muted">Penerimaan tidak bisa diedit setelah diposting; koreksi lewat retur ke supplier. Biaya yang berbeda dari harga PO memperbarui HPP rata-rata.</p>
		{:else if mode === 'cancel'}
			<Field label="Alasan pembatalan" for="c-why"><Input id="c-why" bind:value={reason} /></Field>
		{:else if grns.data?.length}
			<div>
				<p class="mb-1 text-[13px] font-medium">Penerimaan</p>
				<ul class="divide-y divide-border rounded-md border border-border">
					{#each grns.data as g (g.id)}<li class="flex justify-between px-3 py-1.5"><span class="font-mono text-[13px]">{g.document_number}{g.supplier_ref ? ` · ${g.supplier_ref}` : ''}</span><span class="num">{idr(g.total_cost)} · {date(g.received_date)}</span></li>{/each}
				</ul>
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		{#if po.data}
			{@const s = po.data.status}
			{#if mode === 'view'}
				{#if s === 'draft' && c('purchase_order.create')}<Button loading={submit.isPending} onclick={() => submit.mutate()}>Ajukan</Button>{/if}
				{#if s === 'submitted' && c('purchase_order.approve')}<Button loading={approve.isPending} onclick={() => approve.mutate()}>Setujui</Button>{/if}
				{#if canReceive}<Button onclick={startReceive}>Terima barang</Button>{/if}
				{#if s === 'partially_received' && (c('goods_receipt.create') || c('purchase_order.approve'))}<Button variant="secondary" loading={close.isPending} onclick={() => close.mutate()}>Tutup (sisa tidak dikirim)</Button>{/if}
				{#if ['draft', 'submitted', 'approved'].includes(s) && (c('purchase_order.create') || c('purchase_order.approve'))}<Button variant="ghost" onclick={() => (mode = 'cancel')}>Batalkan PO</Button>{/if}
			{:else if mode === 'receive'}
				<Button variant="secondary" onclick={() => (mode = 'view')}>Batal</Button>
				<Button loading={receive.isPending} disabled={!recvValid} onclick={() => receive.mutate()}>Posting penerimaan</Button>
			{:else}
				<Button variant="secondary" onclick={() => (mode = 'view')}>Kembali</Button>
				<Button variant="danger" loading={cancel.isPending} disabled={!reason.trim()} onclick={() => cancel.mutate()}>Batalkan PO</Button>
			{/if}
		{/if}
	{/snippet}
</Dialog>
