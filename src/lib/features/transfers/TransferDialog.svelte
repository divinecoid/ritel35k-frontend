<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { canAtPath } from '#lib/permissions';
	import { errMsg } from '#lib/utils/errors';
	import { dateTime, idr, num } from '#lib/utils/format';
	import type { Me, TransferDetail } from '#lib/types/api';

	let { transferId = $bindable(), me }: { transferId: string | null; me: Me } = $props();
	const qc = useQueryClient();
	let open = $state(false);
	let mode = $state<'view' | 'ship' | 'receive' | 'cancel'>('view');
	let qty = $state<Record<string, string>>({});
	let reason = $state('');

	$effect(() => { if (transferId) { open = true; mode = 'view'; qty = {}; reason = ''; } });
	const q = createQuery(() => ({ queryKey: ['transfer', transferId], enabled: !!transferId, queryFn: async () => (await get<TransferDetail>(`/stock-transfers/${transferId}`)).data }));
	const refresh = async () => {
		await qc.invalidateQueries({ queryKey: ['transfer', transferId] });
		await qc.invalidateQueries({ queryKey: ['transfers'] });
		await qc.invalidateQueries({ queryKey: ['balances'] });
	};
	const step = (name: string) =>
		createMutation(() => ({
			mutationFn: () => post(`/stock-transfers/${transferId}/${name}`, {}),
			onSuccess: async () => { toast.ok('Berhasil'); await refresh(); },
			onError: (e) => toast.error(errMsg(e))
		}));
	const submit = step('submit');
	const approve = step('approve');
	const ship = createMutation(() => ({
		mutationFn: () => post(`/stock-transfers/${transferId}/ship`, { lines: (q.data?.lines ?? []).map((l) => ({ variant_id: l.variant_id, qty: Number(qty[l.id] ?? l.qty_requested) })) }),
		onSuccess: async () => { toast.ok('Barang dikirim — stok asal berkurang, tujuan tercatat dalam perjalanan'); mode = 'view'; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const receive = createMutation(() => ({
		mutationFn: () => post(`/stock-transfers/${transferId}/receive`, { lines: (q.data?.lines ?? []).filter((l) => Number(l.qty_shipped) > 0).map((l) => ({ variant_id: l.variant_id, qty: Number(qty[l.id] ?? l.qty_shipped) })) }),
		onSuccess: async () => { toast.ok('Barang diterima — stok tujuan bertambah'); mode = 'view'; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const cancel = createMutation(() => ({
		mutationFn: () => post(`/stock-transfers/${transferId}/cancel`, { reason }),
		onSuccess: async () => { toast.ok('Transfer dibatalkan'); mode = 'view'; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));

	function begin(m: 'ship' | 'receive') {
		qty = Object.fromEntries((q.data?.lines ?? []).map((l) => [l.id, m === 'ship' ? l.qty_requested : l.qty_shipped]));
		mode = m;
	}
	const t = $derived(q.data);
	const atFrom = (perm: string) => !!t && canAtPath(me.grants, perm, t.from_path);
	const atTo = (perm: string) => !!t && canAtPath(me.grants, perm, t.to_path);
	const shortage = $derived((t?.lines ?? []).reduce((s, l) => s + (Number(l.qty_shipped) - Number(l.qty_received)) * Number(l.unit_cost), 0));
</script>

<Dialog bind:open title={t?.document_number ?? 'Transfer stok'} wide onclose={() => (transferId = null)}>
	{#if !t}<p class="text-muted">Memuat…</p>
	{:else}
		<div class="flex flex-wrap items-center gap-2 text-muted"><StatusBadge status={t.status} /><span>{t.from_code} → {t.to_code}</span><span>· {dateTime(t.created_at)}</span></div>
		{#if t.cancel_reason}<p class="text-danger">Dibatalkan: {t.cancel_reason}</p>{/if}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="py-2">Barang</th><th class="text-right">Diminta</th><th class="text-right">Dikirim</th><th class="text-right">Diterima</th>{#if mode === 'ship' || mode === 'receive'}<th class="text-right">{mode === 'ship' ? 'Kirim' : 'Terima'}</th>{/if}</tr></thead>
			<tbody>
				{#each t.lines as l (l.id)}
					<tr class="border-b border-border last:border-0">
						<td class="py-2">{l.product_name}<br /><span class="font-mono text-[12px] text-muted">{l.sku}</span></td>
						<td class="num text-right">{num(l.qty_requested)}</td><td class="num text-right">{num(l.qty_shipped)}</td>
						<td class="num text-right {t.status === 'received' && Number(l.qty_received) < Number(l.qty_shipped) ? 'font-semibold text-danger' : ''}">{t.status === 'received' ? num(l.qty_received) : '—'}</td>
						{#if mode === 'ship' || mode === 'receive'}<td class="text-right"><Input class="num ml-auto h-8 w-20 text-right" inputmode="decimal" bind:value={qty[l.id]} aria-label="Jumlah" /></td>{/if}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if t.status === 'received' && shortage > 0}<p class="rounded-md bg-danger/10 p-2 text-danger">Selisih terima: nilai kekurangan {idr(shortage)} tercatat di audit untuk ditelusuri.</p>{/if}
		{#if mode === 'cancel'}<Field label="Alasan pembatalan" for="tc-why"><Input id="tc-why" bind:value={reason} /></Field>{/if}
		{#if mode === 'receive'}<p class="text-[12px] text-muted">Terima lebih sedikit dari yang dikirim akan mencatat kekurangan. HPP barang mengikuti HPP asal.</p>{/if}
	{/if}
	{#snippet footer()}
		{#if t}
			{#if mode === 'view'}
				{#if t.status === 'draft' && atFrom('inventory.transfer')}<Button loading={submit.isPending} onclick={() => submit.mutate()}>Ajukan</Button>{/if}
				{#if t.status === 'submitted' && atFrom('inventory.transfer.approve')}<Button loading={approve.isPending} onclick={() => approve.mutate()}>Setujui</Button>{/if}
				{#if t.status === 'approved' && atFrom('inventory.transfer')}<Button onclick={() => begin('ship')}>Kirim barang</Button>{/if}
				{#if t.status === 'shipped' && atTo('inventory.transfer')}<Button onclick={() => begin('receive')}>Terima barang</Button>{/if}
				{#if ['draft', 'submitted', 'approved'].includes(t.status) && (atFrom('inventory.transfer') || atFrom('inventory.transfer.approve'))}<Button variant="ghost" onclick={() => (mode = 'cancel')}>Batalkan</Button>{/if}
			{:else if mode === 'ship'}
				<Button variant="secondary" onclick={() => (mode = 'view')}>Batal</Button><Button loading={ship.isPending} onclick={() => ship.mutate()}>Konfirmasi kirim</Button>
			{:else if mode === 'receive'}
				<Button variant="secondary" onclick={() => (mode = 'view')}>Batal</Button><Button loading={receive.isPending} onclick={() => receive.mutate()}>Konfirmasi terima</Button>
			{:else}
				<Button variant="secondary" onclick={() => (mode = 'view')}>Kembali</Button><Button variant="danger" loading={cancel.isPending} disabled={!reason.trim()} onclick={() => cancel.mutate()}>Batalkan transfer</Button>
			{/if}
		{/if}
	{/snippet}
</Dialog>
