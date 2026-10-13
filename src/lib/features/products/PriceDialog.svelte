<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { del, get, put } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import { dateTime, idr } from '#lib/utils/format';
	import type { Me, PriceList, PriceRow } from '#lib/types/api';

	let { variant = $bindable(), me }: { variant: { id: string; sku: string; name: string } | null; me: Me } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let open = $state(false);
	let unit = $state('');
	let price = $state('');
	let listId = $state('');
	let minQty = $state('1');

	$effect(() => {
		if (variant) {
			open = true;
			price = '';
			unit = manageable[0]?.id ?? '';
		}
	});

	const manageable = $derived(scope.units.filter((u) => can(me.grants, 'pricing.manage', u.path)));
	const priceLists = createQuery(() => ({ queryKey: ['price-lists'], enabled: !!variant, queryFn: async () => (await get<PriceList[]>('/price-lists')).data }));
	$effect(() => { if (variant) listId ||= priceLists.data?.find((l) => l.is_default)?.id ?? ''; });
	const rows = createQuery(() => ({ queryKey: ['prices', variant?.id], enabled: !!variant, queryFn: async () => (await get<PriceRow[]>(`/variants/${variant!.id}/prices`)).data }));
	const current = $derived((rows.data ?? []).filter((r) => !r.effective_to));
	const refresh = () => qc.invalidateQueries({ queryKey: ['prices', variant?.id] });

	const save = createMutation(() => ({
		mutationFn: () => put('/prices', { org_unit_id: unit, variant_id: variant!.id, price: Number(price), price_list_id: listId || undefined, min_qty: Number(minQty) || 1 }),
		onSuccess: async () => { toast.ok('Harga disimpan — toko di bawahnya otomatis mengikuti'); price = ''; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const revert = createMutation(() => ({
		mutationFn: (r: PriceRow) => del('/prices', { org_unit_id: r.org_unit_id, variant_id: variant!.id, price_list_id: r.price_list_id, min_qty: Number(r.min_qty) }),
		onSuccess: async () => { toast.ok('Override dihapus — kembali ke harga turunan'); await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const label = (t: string) => (t === 'company' ? 'Seluruh perusahaan' : t === 'store' ? 'Toko' : 'Region');
</script>

<Dialog bind:open title="Harga jual — {variant?.sku ?? ''}" wide onclose={() => (variant = null)}>
	<p class="text-muted">Harga diwariskan: <b>toko → region → perusahaan</b>. Toko baru langsung memakai harga induknya, tanpa input ulang.</p>
	<table class="w-full text-left">
		<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="py-2">Daftar harga</th><th>Berlaku di</th><th class="text-right">Min. qty</th><th class="text-right">Harga</th><th>Sejak</th><th></th></tr></thead>
		<tbody>
			{#each current as r (r.id)}
				<tr class="border-b border-border last:border-0">
					<td class="py-2">{r.price_list_name}</td><td>{r.org_unit_name} <Badge>{label(r.org_unit_type)}</Badge></td><td class="num text-right">{Number(r.min_qty)}</td>
					<td class="num text-right font-medium">{idr(r.price)}</td><td class="num text-muted">{dateTime(r.effective_from)}</td>
					<td class="text-right">{#if r.org_unit_type !== 'company' && can(me.grants, 'pricing.manage', scope.units.find((u) => u.id === r.org_unit_id)?.path)}<Button size="sm" variant="ghost" onclick={() => revert.mutate(r)}>Hapus override</Button>{/if}</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="py-6 text-center text-muted">Belum ada harga. Barang ini tidak bisa dijual di kasir.</td></tr>
			{/each}
		</tbody>
	</table>
	{#if manageable.length}
		<div class="grid grid-cols-[1fr_1fr_90px_140px_auto] items-end gap-2 rounded-md border border-border p-3">
			<Field label="Daftar harga" for="p-list"><Select id="p-list" bind:value={listId}>{#each priceLists.data ?? [] as l (l.id)}<option value={l.id}>{l.name}</option>{/each}</Select></Field>
			<Field label="Atur harga di" for="p-unit"><Select id="p-unit" bind:value={unit}>{#each manageable as u (u.id)}<option value={u.id}>{u.name} ({label(u.type)})</option>{/each}</Select></Field>
			<Field label="Min. qty" for="p-qty"><Input id="p-qty" inputmode="decimal" bind:value={minQty} class="num text-right" /></Field>
			<Field label="Harga (Rp)" for="p-price"><Input id="p-price" inputmode="numeric" bind:value={price} class="num text-right" /></Field>
			<Button loading={save.isPending} disabled={!unit || price === ''} onclick={() => save.mutate()}>Simpan</Button>
		</div>
	{/if}
</Dialog>
