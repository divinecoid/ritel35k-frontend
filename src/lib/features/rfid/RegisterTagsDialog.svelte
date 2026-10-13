<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import ProductPicker, { type Picked } from '#lib/features/products/ProductPicker.svelte';
	import { post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import type { Me } from '#lib/types/api';

	let { open = $bindable(), me }: { open: boolean; me: Me } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let picked = $state<Picked | null>(null);
	let store = $state('');
	let status = $state('IN_STOCK');
	let text = $state('');
	let result = $state<{ created: number; duplicates: string[] } | null>(null);

	const stores = $derived(scope.units.filter((u) => u.type === 'store' && u.accessible && u.store_id));
	const epcs = $derived(text.split(/[\s,;]+/).filter(Boolean));
	$effect(() => {
		if (open && !store) store = scope.selected?.type === 'store' ? (scope.selected.store_id ?? '') : (scope.stores[0]?.store_id ?? stores[0]?.store_id ?? '');
		if (!open) result = null;
	});

	const register = createMutation(() => ({
		mutationFn: () => post<{ created: number; duplicates: string[] }>('/rfid/tags/register', { variant_id: picked!.variant_id, store_id: store || undefined, status, epcs }),
		onSuccess: async (r) => {
			result = r.data;
			toast.ok(`${r.data.created} tag didaftarkan`);
			text = '';
			await qc.invalidateQueries({ queryKey: ['rfid'] });
		},
		onError: (e) => toast.error(errMsg(e))
	}));
</script>

<Dialog bind:open title="Daftarkan tag RFID" wide>
	<p class="text-muted">Pasangkan tag ke satu produk saat barang diterima atau label di-encode. Produk harus ditandai “Lacak dengan tag RFID”.</p>
	<Field label="Produk" for="rp">
		{#if picked}
			<div class="flex items-center justify-between rounded-md border border-border px-3 py-2"><span>{picked.name} <span class="font-mono text-[12px] text-muted">{picked.sku}</span></span><button class="text-primary hover:underline" onclick={() => (picked = null)}>Ganti</button></div>
		{:else}
			<ProductPicker onpick={(p) => (picked = p)} />
		{/if}
	</Field>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Lokasi" for="rs">
			<Select id="rs" bind:value={store}>
				{#if canAll(me.grants, 'rfid.manage')}<option value="">Gudang pusat (tanpa toko)</option>{/if}
				{#each stores as s (s.id)}<option value={s.store_id}>{s.name}</option>{/each}
			</Select>
		</Field>
		<Field label="Status awal" for="rst">
			<Select id="rst" bind:value={status}><option value="IN_STOCK">Di gudang toko</option><option value="ON_SHELF">Di rak</option><option value="REGISTERED">Terdaftar saja</option></Select>
		</Field>
	</div>
	<Field label="Daftar EPC" for="re" hint="Satu per baris (atau pisahkan koma). Huruf besar/kecil dan awalan 0x diabaikan. Maksimal 2.000 per kirim.">
		<textarea id="re" bind:value={text} rows="6" class="w-full rounded-md border border-border bg-surface p-2 font-mono text-[12px]" placeholder="E2801160600002054A1B2C3D"></textarea>
	</Field>
	{#if result?.duplicates.length}
		<p class="text-warn">{result.duplicates.length} EPC sudah terdaftar dan dibiarkan: <span class="font-mono text-[11px]">{result.duplicates.slice(0, 3).join(', ')}{result.duplicates.length > 3 ? '…' : ''}</span></p>
	{/if}
	{#snippet footer()}
		<span class="mr-auto self-center text-muted">{epcs.length} EPC</span>
		<Button variant="secondary" onclick={() => (open = false)}>Tutup</Button>
		<Button loading={register.isPending} disabled={!picked || !epcs.length} onclick={() => register.mutate()}>Daftarkan</Button>
	{/snippet}
</Dialog>
