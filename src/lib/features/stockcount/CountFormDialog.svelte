<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
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
	import { errMsg } from '#lib/utils/errors';
	import type { CountDetail, Me, Named, Warehouse } from '#lib/types/api';

	let { open = $bindable(), me }: { open: boolean; me: Me } = $props();
	const scope = useScope();
	const qc = useQueryClient();

	const whs = createQuery(() => ({ queryKey: ['warehouses'], enabled: open, queryFn: async () => (await get<Warehouse[]>('/warehouses')).data }));
	const cats = createQuery(() => ({ queryKey: ['categories'], enabled: open, queryFn: async () => (await get<Named[]>('/categories')).data }));
	const options = $derived(
		(whs.data ?? []).filter((w) => {
			if (w.status !== 'active') return false;
			if (!w.store_id) return canAll(me.grants, 'inventory.count');
			const path = scope.units.find((u) => u.store_id === w.store_id)?.path;
			return !!path && can(me.grants, 'inventory.count', path);
		})
	);
	let wh = $state('');
	let kind = $state('full');
	let category = $state('');
	let note = $state('');
	let picked = $state<Picked[]>([]);
	$effect(() => { if (open) wh ||= options.find((w) => w.is_default && scope.selected?.store_id === w.store_id)?.id ?? options[0]?.id ?? ''; });
	const label = (w: Warehouse) => `${w.store_id ? (scope.units.find((u) => u.store_id === w.store_id)?.name ?? '') : 'Pusat'} — ${w.code}`;

	const m = createMutation(() => ({
		mutationFn: () => post<CountDetail>('/stock-counts', { warehouse_id: wh, kind, category_id: kind === 'category' ? category : undefined, variant_ids: picked.map((p) => p.variant_id), note }),
		onSuccess: async (r) => { toast.ok(`Opname ${r.data.document_number} dimulai — snapshot stok dibekukan`); open = false; picked = []; await qc.invalidateQueries({ queryKey: ['counts'] }); await goto(`/stock-counts/${r.data.id}`); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const valid = $derived(!!wh && (kind === 'full' || (kind === 'category' && !!category) || ((kind === 'partial' || kind === 'cycle') && picked.length > 0)));
</script>

<Dialog bind:open title="Mulai stok opname">
	<Field label="Gudang" for="c-wh"><Select id="c-wh" bind:value={wh}>{#each options as w (w.id)}<option value={w.id}>{label(w)}</option>{/each}</Select></Field>
	<Field label="Jenis" for="c-kind" hint="Toko tetap boleh berjualan selama penghitungan; selisih dihitung dengan memperhitungkan penjualan setelah snapshot.">
		<Select id="c-kind" bind:value={kind}><option value="full">Seluruh stok (full count)</option><option value="category">Per kategori</option><option value="partial">Barang tertentu</option><option value="cycle">Cycle count (barang tertentu, rutin)</option></Select>
	</Field>
	{#if kind === 'category'}<Field label="Kategori" for="c-cat"><Select id="c-cat" bind:value={category}><option value="">Pilih…</option>{#each cats.data ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</Select></Field>{/if}
	{#if kind === 'partial' || kind === 'cycle'}
		<div><p class="mb-1.5 text-[13px] font-medium">Barang yang dihitung</p><ProductPicker onpick={(p) => !picked.some((x) => x.variant_id === p.variant_id) && picked.push(p)} />
			<ul class="mt-2 space-y-1">{#each picked as p, i (p.variant_id)}<li class="flex items-center justify-between rounded border border-border px-2 py-1">{p.name} <span class="font-mono text-[12px] text-muted">{p.sku}</span><button class="p-1 text-muted hover:text-danger" aria-label="Hapus" onclick={() => picked.splice(i, 1)}><Trash2 class="size-4" /></button></li>{/each}</ul></div>
	{/if}
	<Field label="Catatan" for="c-note"><Input id="c-note" bind:value={note} /></Field>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!valid} onclick={() => m.mutate()}>Mulai opname</Button>
	{/snippet}
</Dialog>
