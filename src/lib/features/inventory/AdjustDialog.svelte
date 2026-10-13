<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import ProductPicker, { type Picked } from '#lib/features/products/ProductPicker.svelte';
	import { post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import type { Me } from '#lib/types/api';

	let { open = $bindable(), me }: { open: boolean; me: Me } = $props();
	const scope = useScope();
	const qc = useQueryClient();

	const stores = $derived(scope.units.filter((u) => u.type === 'store' && u.accessible && can(me.grants, 'inventory.adjust', u.path)));
	let storeId = $state('');
	let type = $state('OPENING');
	let reason = $state('');
	let lines = $state<{ variant_id: string; label: string; qty: string; cost: string }[]>([]);

	$effect(() => {
		if (open && !storeId) storeId = (scope.storeId !== 'all' ? scope.selected?.store_id : undefined) ?? stores[0]?.store_id ?? '';
	});

	const m = createMutation(() => ({
		mutationFn: () =>
			post<{ document_number: string }>('/inventory/adjustments', {
				store_id: storeId,
				type,
				reason,
				lines: lines.map((l) => ({ variant_id: l.variant_id, qty_delta: Number(l.qty) * (type === 'DAMAGE' ? -1 : 1), unit_cost: Number(l.cost) || 0 }))
			}),
		onSuccess: async (r) => {
			toast.ok(`Dokumen ${r.data.document_number} tercatat`);
			open = false;
			lines = [];
			reason = '';
			await qc.invalidateQueries({ queryKey: ['balances'] });
			await qc.invalidateQueries({ queryKey: ['movements'] });
		},
		onError: (e) => toast.error(errMsg(e))
	}));

	function add(p: Picked) {
		if (!lines.some((l) => l.variant_id === p.variant_id)) lines.push({ variant_id: p.variant_id, label: `${p.name} (${p.sku})`, qty: '', cost: '' });
	}
	const valid = $derived(!!storeId && !!reason.trim() && lines.length > 0 && lines.every((l) => Number(l.qty) !== 0 && l.qty !== ''));
</script>

<Dialog bind:open title="Penyesuaian stok" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Toko" for="a-store"><Select id="a-store" bind:value={storeId}>{#each stores as s (s.id)}<option value={s.store_id}>{s.name}</option>{/each}</Select></Field>
		<Field label="Jenis" for="a-type">
			<Select id="a-type" bind:value={type}>
				<option value="OPENING">Stok awal</option>
				<option value="ADJUSTMENT">Koreksi (+/−)</option>
				<option value="DAMAGE">Rusak / hilang (−)</option>
			</Select>
		</Field>
	</div>
	<Field label="Alasan" for="a-why"><Input id="a-why" bind:value={reason} placeholder="mis. stok awal toko baru, hasil hitung manual" /></Field>
	<div>
		<p class="mb-1.5 text-[13px] font-medium">Barang</p>
		<ProductPicker onpick={add} />
		<div class="mt-2 space-y-2">
			{#each lines as l, i (l.variant_id)}
				<div class="grid grid-cols-[1fr_110px_130px_auto] items-center gap-2">
					<span class="truncate">{l.label}</span>
					<Input inputmode="decimal" bind:value={l.qty} placeholder={type === 'DAMAGE' ? 'Jumlah rusak' : 'Qty (+/−)'} aria-label="Jumlah" class="num text-right" />
					<Input inputmode="decimal" bind:value={l.cost} placeholder="Harga pokok" aria-label="Harga pokok" class="num text-right" disabled={type === 'DAMAGE'} />
					<button class="rounded p-2 text-muted hover:text-danger" aria-label="Hapus" onclick={() => lines.splice(i, 1)}><Trash2 class="size-4" /></button>
				</div>
			{/each}
		</div>
		<p class="mt-2 text-[12px] text-muted">Harga pokok dipakai menghitung rata-rata bergerak untuk stok masuk. Stok tidak bisa dikoreksi hingga minus.</p>
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!valid} onclick={() => m.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>
