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
	import { can, canAll } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Me, PODetail, Supplier, Warehouse } from '#lib/types/api';

	let { open = $bindable(), me, oncreated }: { open: boolean; me: Me; oncreated?: (po: PODetail) => void } = $props();
	const scope = useScope();
	const qc = useQueryClient();

	const suppliers = createQuery(() => ({ queryKey: ['suppliers', 'all'], enabled: open, queryFn: async () => (await get<Supplier[]>('/suppliers', { per_page: 200 })).data }));
	const warehouses = createQuery(() => ({ queryKey: ['warehouses'], enabled: open, queryFn: async () => (await get<Warehouse[]>('/warehouses')).data }));
	// warehouses the caller may order for: store warehouses within their purchase_order.create scope, central ones only company-wide
	const options = $derived(
		(warehouses.data ?? []).filter((w) => {
			if (w.status !== 'active') return false;
			if (!w.store_id) return canAll(me.grants, 'purchase_order.create');
			const path = scope.units.find((u) => u.store_id === w.store_id)?.path;
			return !!path && can(me.grants, 'purchase_order.create', path);
		})
	);
	const label = (w: Warehouse) => `${w.store_id ? (scope.units.find((u) => u.store_id === w.store_id)?.name ?? '') : 'Pusat'} — ${w.code}`;

	let supplier = $state('');
	let warehouse = $state('');
	let expected = $state('');
	let note = $state('');
	let lines = $state<{ variant_id: string; label: string; qty: string; price: string }[]>([]);
	let errors = $state<Record<string, string>>({});

	$effect(() => {
		if (open) {
			supplier ||= suppliers.data?.[0]?.id ?? '';
			warehouse ||= options.find((w) => w.is_default && scope.selected?.store_id === w.store_id)?.id ?? options[0]?.id ?? '';
		}
	});

	const add = (p: Picked) => {
		if (!lines.some((l) => l.variant_id === p.variant_id)) lines.push({ variant_id: p.variant_id, label: `${p.name} (${p.sku})`, qty: '1', price: '' });
	};
	const m = createMutation(() => ({
		mutationFn: () =>
			post<PODetail>('/purchase-orders', {
				supplier_id: supplier,
				warehouse_id: warehouse,
				expected_date: expected ? new Date(expected).toISOString() : undefined,
				note,
				lines: lines.map((l) => ({ variant_id: l.variant_id, qty: Number(l.qty), unit_price: l.price === '' ? undefined : Number(l.price) }))
			}),
		onSuccess: async (r) => {
			toast.ok(`PO ${r.data.document_number} dibuat sebagai draft`);
			open = false;
			lines = [];
			note = expected = '';
			errors = {};
			await qc.invalidateQueries({ queryKey: ['pos'] });
			oncreated?.(r.data);
		},
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
	const valid = $derived(!!supplier && !!warehouse && lines.length > 0 && lines.every((l) => Number(l.qty) > 0));
</script>

<Dialog bind:open title="Purchase order baru" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Supplier" for="po-sup" error={errors.supplier_id}><Select id="po-sup" bind:value={supplier}>{#each suppliers.data ?? [] as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</Select></Field>
		<Field label="Kirim ke gudang" for="po-wh" error={errors.warehouse_id}><Select id="po-wh" bind:value={warehouse}>{#each options as w (w.id)}<option value={w.id}>{label(w)}</option>{/each}</Select></Field>
		<Field label="Perkiraan tiba" for="po-date"><Input id="po-date" type="date" bind:value={expected} /></Field>
		<Field label="Catatan" for="po-note"><Input id="po-note" bind:value={note} /></Field>
	</div>
	<div>
		<p class="mb-1.5 text-[13px] font-medium">Barang</p>
		<ProductPicker onpick={add} />
		{#if errors.lines}<p class="mt-1 text-[12px] text-danger">{errors.lines}</p>{/if}
		<div class="mt-2 space-y-2">
			{#each lines as l, i (l.variant_id)}
				<div class="grid grid-cols-[1fr_90px_140px_auto] items-center gap-2">
					<span class="truncate">{l.label}</span>
					<Input inputmode="decimal" bind:value={l.qty} aria-label="Jumlah" class="num text-right" />
					<Input inputmode="decimal" bind:value={l.price} placeholder="Harga supplier" aria-label="Harga beli" class="num text-right" />
					<button class="rounded p-2 text-muted hover:text-danger" aria-label="Hapus" onclick={() => lines.splice(i, 1)}><Trash2 class="size-4" /></button>
				</div>
			{/each}
		</div>
		<p class="mt-2 text-[12px] text-muted">Kosongkan harga untuk memakai harga supplier (atau harga beli standar produk).</p>
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!valid} onclick={() => m.mutate()}>Simpan draft</Button>
	{/snippet}
</Dialog>
