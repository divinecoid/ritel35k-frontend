<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import ProductPicker, { type Picked } from '#lib/features/products/ProductPicker.svelte';
	import { get, post } from '#lib/api/client';
	import { canAll, can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import type { Me, TransferDetail, Warehouse, WarehouseDir } from '#lib/types/api';

	let { open = $bindable(), me, oncreated }: { open: boolean; me: Me; oncreated?: (t: TransferDetail) => void } = $props();
	const scope = useScope();
	const qc = useQueryClient();

	const mine = createQuery(() => ({ queryKey: ['warehouses'], enabled: open, queryFn: async () => (await get<Warehouse[]>('/warehouses')).data }));
	const dir = createQuery(() => ({ queryKey: ['warehouse-dir'], enabled: open, queryFn: async () => (await get<WarehouseDir[]>('/warehouses/directory')).data }));
	const from = $derived(
		(mine.data ?? []).filter((w) => {
			if (w.status !== 'active') return false;
			if (!w.store_id) return canAll(me.grants, 'inventory.transfer');
			const path = scope.units.find((u) => u.store_id === w.store_id)?.path;
			return !!path && can(me.grants, 'inventory.transfer', path);
		})
	);
	const fromLabel = (w: Warehouse) => `${w.store_id ? (scope.units.find((u) => u.store_id === w.store_id)?.name ?? '') : 'Pusat'} — ${w.code}`;

	let fromId = $state('');
	let toId = $state('');
	let note = $state('');
	let lines = $state<{ variant_id: string; label: string; qty: string }[]>([]);
	$effect(() => {
		if (open) {
			fromId ||= from[0]?.id ?? '';
			if (!toId || toId === fromId) toId = dir.data?.find((d) => d.id !== fromId)?.id ?? '';
		}
	});

	const m = createMutation(() => ({
		mutationFn: () => post<TransferDetail>('/stock-transfers', { from_warehouse_id: fromId, to_warehouse_id: toId, note, lines: lines.map((l) => ({ variant_id: l.variant_id, qty: Number(l.qty) })) }),
		onSuccess: async (r) => { toast.ok(`Transfer ${r.data.document_number} dibuat`); open = false; lines = []; note = ''; await qc.invalidateQueries({ queryKey: ['transfers'] }); oncreated?.(r.data); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const add = (p: Picked) => { if (!lines.some((l) => l.variant_id === p.variant_id)) lines.push({ variant_id: p.variant_id, label: `${p.name} (${p.sku})`, qty: '1' }); };
	const valid = $derived(!!fromId && !!toId && fromId !== toId && lines.length > 0 && lines.every((l) => Number(l.qty) > 0));
</script>

<Dialog bind:open title="Transfer stok baru" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Dari gudang" for="t-from"><Select id="t-from" bind:value={fromId}>{#each from as w (w.id)}<option value={w.id}>{fromLabel(w)}</option>{/each}</Select></Field>
		<Field label="Ke gudang" for="t-to"><Select id="t-to" bind:value={toId}>{#each (dir.data ?? []).filter((d) => d.id !== fromId) as d (d.id)}<option value={d.id}>{d.store_name ?? 'Pusat'} — {d.code}</option>{/each}</Select></Field>
	</div>
	<Field label="Catatan" for="t-note"><Input id="t-note" bind:value={note} /></Field>
	<div>
		<p class="mb-1.5 text-[13px] font-medium">Barang</p>
		<ProductPicker onpick={add} />
		<div class="mt-2 space-y-2">
			{#each lines as l, i (l.variant_id)}
				<div class="grid grid-cols-[1fr_100px_auto] items-center gap-2">
					<span class="truncate">{l.label}</span>
					<Input inputmode="decimal" bind:value={l.qty} aria-label="Jumlah" class="num text-right" />
					<button class="rounded p-2 text-muted hover:text-danger" aria-label="Hapus" onclick={() => lines.splice(i, 1)}><Trash2 class="size-4" /></button>
				</div>
			{/each}
		</div>
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!valid} onclick={() => m.mutate()}>Simpan draft</Button>
	{/snippet}
</Dialog>
