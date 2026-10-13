<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { ChevronRight, Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { can, canAll } from '#lib/permissions';
	import PriceDialog from '#lib/features/products/PriceDialog.svelte';
	import { idr } from '#lib/utils/format';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Named, Product } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(canAll(data.me.grants, 'product.manage'));

	let search = $state('');
	let pageNo = $state(1);
	let opened = $state<string | null>(null);
	let pricing = $state<{ id: string; sku: string; name: string } | null>(null);
	const canPrice = $derived(can(data.me.grants, 'pricing.view'));

	const products = createQuery(() => ({ queryKey: ['products', search, pageNo], queryFn: () => get<Product[]>('/products', { q: search, page: pageNo, per_page: 25 }) }));
	const cats = createQuery(() => ({ queryKey: ['categories'], queryFn: async () => (await get<Named[]>('/categories')).data }));
	const brands = createQuery(() => ({ queryKey: ['brands'], queryFn: async () => (await get<Named[]>('/brands')).data }));
	const uoms = createQuery(() => ({ queryKey: ['uoms'], queryFn: async () => (await get<Named[]>('/uoms')).data }));
	const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name ?? '—';

	let creating = $state(false);
	let f = $state({ code: '', name: '', category_id: '', brand_id: '', uom_id: '', sku: '', barcode: '', kind: 'EAN13', purchase_price: '0', selling_price: '', rfid: false });
	let errors = $state<Record<string, string>>({});

	const create = createMutation(() => ({
		mutationFn: () =>
			post('/products', {
				code: f.code.trim(),
				name: f.name.trim(),
				category_id: f.category_id || undefined,
				brand_id: f.brand_id || undefined,
				uom_id: f.uom_id || uoms.data?.[0]?.id,
				is_rfid_tracked: f.rfid,
				variants: [{ sku: f.sku.trim() || f.code.trim(), purchase_price: f.purchase_price || '0', cost: f.purchase_price || '0', selling_price: f.selling_price === '' ? undefined : Number(f.selling_price), barcodes: f.barcode ? [{ barcode: f.barcode.trim(), kind: f.kind }] : [] }]
			}),
		onSuccess: async () => {
			toast.ok('Produk dibuat — langsung tersedia di semua toko');
			creating = false;
			f = { ...f, code: '', name: '', sku: '', barcode: '', purchase_price: '0', selling_price: '', rfid: false };
			errors = {};
			await qc.invalidateQueries({ queryKey: ['products'] });
		},
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
</script>

<PageHeader title="Produk" description="Master data global — satu definisi, tersedia di seluruh toko.">
	{#snippet actions()}
		<Input class="w-64" placeholder="Cari nama, kode, SKU, barcode" bind:value={search} oninput={() => (pageNo = 1)} />
		{#if canManage}<Button onclick={() => (creating = true)}><Plus class="size-4" />Tambah produk</Button>{/if}
	{/snippet}
</PageHeader>

<Card>
	{#if products.isPending}<Empty title="Memuat…" />
	{:else if products.isError}<Empty title="Gagal memuat" hint={products.error.message} />
	{:else if !products.data.data.length}<Empty title="Belum ada produk" hint={search ? 'Coba kata kunci lain.' : undefined} />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase">
				<tr><th class="w-8 px-3 py-2.5"></th><th>Kode</th><th>Nama</th><th>Kategori</th><th>SKU</th><th class="pr-4 text-right">Harga beli</th><th>Status</th></tr>
			</thead>
			<tbody>
				{#each products.data.data as p (p.id)}
					<tr class="cursor-pointer border-b border-border hover:bg-surface-2/60" onclick={() => (opened = opened === p.id ? null : p.id)}>
						<td class="px-3 py-2.5"><ChevronRight class="size-4 text-muted transition {opened === p.id ? 'rotate-90' : ''}" /></td>
						<td class="font-mono text-[13px]">{p.code}</td>
						<td class="font-medium">{p.name}{#if p.is_rfid_tracked} <Badge tone="info">RFID</Badge>{/if}</td>
						<td class="text-muted">{catName(p.category_id)}</td>
						<td class="text-muted">{p.variants.length}</td>
						<td class="num pr-4 text-right">{idr(p.variants[0]?.purchase_price ?? 0)}</td>
						<td><Badge tone={p.status === 'active' ? 'ok' : 'warn'}>{p.status}</Badge></td>
					</tr>
					{#if opened === p.id}
						<tr class="border-b border-border bg-surface-2/40"><td></td><td colspan="6" class="py-3 pr-4">
							<table class="w-full text-[13px]">
								<thead class="text-[11px] text-muted uppercase"><tr><th class="text-left">SKU</th><th class="text-left">Varian</th><th class="text-left">Barcode</th><th class="text-right">Harga beli</th><th></th></tr></thead>
								<tbody>
									{#each p.variants as v (v.id)}
										<tr><td class="font-mono">{v.sku}</td><td>{v.name || '—'}</td>
											<td class="font-mono">{v.barcodes.map((b) => b.barcode).join(', ') || '—'}</td>
											<td class="num text-right">{idr(v.purchase_price)}</td>
											<td class="text-right">{#if canPrice}<Button size="sm" variant="ghost" onclick={() => (pricing = { id: v.id, sku: v.sku, name: p.name })}>Harga jual</Button>{/if}</td></tr>
									{/each}
								</tbody>
							</table>
						</td></tr>
					{/if}
				{/each}
			</tbody>
		</table>
		{#if products.data.meta}
			<div class="flex items-center justify-between px-4 py-2">
				<span class="text-muted">{products.data.meta.total} produk</span>
				<div class="flex gap-2">
					<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
					<Button size="sm" variant="secondary" disabled={pageNo >= products.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
				</div>
			</div>
		{/if}
	{/if}
</Card>

<Dialog bind:open={creating} title="Tambah produk" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Kode produk" for="pc" error={errors.code}><Input id="pc" bind:value={f.code} /></Field>
		<Field label="Nama" for="pn" error={errors.name}><Input id="pn" bind:value={f.name} /></Field>
		<Field label="Kategori" for="pcat"><Select id="pcat" bind:value={f.category_id}><option value="">—</option>{#each cats.data ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</Select></Field>
		<Field label="Merek" for="pb"><Select id="pb" bind:value={f.brand_id}><option value="">—</option>{#each brands.data ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</Select></Field>
		<Field label="Satuan" for="pu"><Select id="pu" bind:value={f.uom_id}>{#each uoms.data ?? [] as c (c.id)}<option value={c.id}>{c.code} — {c.name}</option>{/each}</Select></Field>
		<Field label="Harga beli" for="pp" error={errors.purchase_price}><Input id="pp" inputmode="decimal" bind:value={f.purchase_price} /></Field>
		<Field label="Harga jual (semua toko)" for="psp" hint="Region/toko bisa override nanti"><Input id="psp" inputmode="decimal" bind:value={f.selling_price} /></Field>
		<Field label="SKU" for="ps" hint="Kosong = pakai kode produk" error={errors.sku}><Input id="ps" bind:value={f.sku} /></Field>
		<Field label="Barcode" for="pbc" error={errors.barcode} hint="EAN-13 divalidasi checksum"><Input id="pbc" inputmode="numeric" bind:value={f.barcode} /></Field>
		<label class="col-span-2 flex items-center gap-2"><input type="checkbox" bind:checked={f.rfid} /><span>Lacak dengan tag RFID <span class="text-muted">— setiap unit punya tag; keluar gerbang tanpa bayar akan menyalakan alarm</span></span></label>
		<Field label="Jenis barcode" for="pk"><Select id="pk" bind:value={f.kind}><option value="EAN13">EAN-13</option><option value="INTERNAL">Internal</option><option value="CODE128">Code 128</option><option value="UPC">UPC</option></Select></Field>
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (creating = false)}>Batal</Button>
		<Button loading={create.isPending} disabled={!f.code || !f.name} onclick={() => create.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>

<PriceDialog bind:variant={pricing} me={data.me} />
