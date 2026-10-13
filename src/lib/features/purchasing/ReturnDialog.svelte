<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { errMsg } from '#lib/utils/errors';
	import { date, idr } from '#lib/utils/format';
	import type { GRNDetail, GRNRow } from '#lib/types/api';

	let { open = $bindable() }: { open: boolean } = $props();
	const qc = useQueryClient();
	let grnId = $state('');
	let reason = $state('');
	let qty = $state<Record<string, string>>({});

	const grns = createQuery(() => ({ queryKey: ['grns', 'recent'], enabled: open, queryFn: async () => (await get<GRNRow[]>('/goods-receipts', { per_page: 50 })).data }));
	const grn = createQuery(() => ({ queryKey: ['grn', grnId], enabled: !!grnId, queryFn: async () => (await get<GRNDetail>(`/goods-receipts/${grnId}`)).data }));
	$effect(() => { if (open && !grnId) grnId = grns.data?.[0]?.id ?? ''; });
	$effect(() => { grnId; qty = {}; });

	const m = createMutation(() => ({
		mutationFn: () => post<{ document_number: string; total_cost: string }>('/purchase-returns', {
			grn_id: grnId, reason,
			lines: (grn.data?.lines ?? []).filter((l) => Number(qty[l.variant_id]) > 0).map((l) => ({ variant_id: l.variant_id, qty: Number(qty[l.variant_id]) }))
		}),
		onSuccess: async (r) => { toast.ok(`Retur ${r.data.document_number} (${idr(r.data.total_cost)}) — stok berkurang`); open = false; reason = ''; await qc.invalidateQueries({ queryKey: ['returns'] }); await qc.invalidateQueries({ queryKey: ['balances'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const valid = $derived(!!reason.trim() && Object.values(qty).some((v) => Number(v) > 0));
</script>

<Dialog bind:open title="Retur ke supplier" wide>
	<Field label="Penerimaan barang asal" for="rt-grn">
		<Select id="rt-grn" bind:value={grnId}>{#each grns.data ?? [] as g (g.id)}<option value={g.id}>{g.document_number} · {g.supplier_name} · {date(g.received_date)}</option>{/each}</Select>
	</Field>
	{#if grn.data}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="py-2">Barang</th><th class="text-right">Diterima</th><th class="text-right">Biaya</th><th class="text-right">Retur</th></tr></thead>
			<tbody>
				{#each grn.data.lines as l (l.id)}
					<tr class="border-b border-border last:border-0"><td class="py-2">{l.product_name} <span class="font-mono text-[12px] text-muted">{l.sku}</span></td><td class="num text-right">{Number(l.qty)}</td><td class="num text-right">{idr(l.unit_cost)}</td>
						<td class="text-right"><Input class="num ml-auto h-8 w-20 text-right" inputmode="decimal" bind:value={qty[l.variant_id]} aria-label="Jumlah retur" /></td></tr>
				{/each}
			</tbody>
		</table>
	{/if}
	<Field label="Alasan" for="rt-why"><Input id="rt-why" bind:value={reason} placeholder="rusak, salah kirim, kedaluwarsa…" /></Field>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!valid} onclick={() => m.mutate()}>Proses retur</Button>
	{/snippet}
</Dialog>
