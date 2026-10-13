<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { KeyRound, Plus, Power, Radio } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import BulkDialog from '#lib/features/rfid/BulkDialog.svelte';
	import ReaderDialog from '#lib/features/rfid/ReaderDialog.svelte';
	import RegisterTagsDialog from '#lib/features/rfid/RegisterTagsDialog.svelte';
	import TagDialog from '#lib/features/rfid/TagDialog.svelte';
	import { manualStatuses, readerKindLabel, tagLabel, tagTone } from '#lib/features/rfid/status';
	import { ago, dateTime, num } from '#lib/utils/format';
	import { get, patch } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import type { RfidReader, RfidTag, RfidVarianceRow, TagStatus } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let tab = $state<'tags' | 'readers' | 'variance'>('tags');
	let search = $state('');
	let status = $state('');
	let pageNo = $state(1);
	let selected = $state<string[]>([]);
	let registering = $state(false);
	let bulk = $state(false);
	let enrolling = $state(false);
	let rotating = $state<{ id: string; code: string } | null>(null);
	let rotateOpen = $state(false);
	let openEpc = $state<string | null>(null);

	const canManage = $derived(can(data.me.grants, 'rfid.manage'));
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const underPath = $derived(scope.storeId === 'all' ? scope.path : undefined);

	const tags = createQuery(() => ({
		queryKey: ['rfid', 'tags', storeId, underPath, status, search, pageNo],
		enabled: tab === 'tags',
		queryFn: () => get<RfidTag[]>('/rfid/tags', { store_id: storeId, under_path: underPath, status, q: search, page: pageNo, per_page: 30 })
	}));
	const readers = createQuery(() => ({ queryKey: ['rfid', 'readers', storeId], enabled: tab === 'readers', refetchInterval: 30_000, queryFn: async () => (await get<RfidReader[]>('/rfid/readers', { store_id: storeId })).data }));
	const variance = createQuery(() => ({
		queryKey: ['rfid', 'variance', storeId, underPath],
		enabled: tab === 'variance',
		queryFn: async () => (await get<RfidVarianceRow[]>('/rfid/variance', { store_id: storeId, under_path: underPath, only_diff: 'false', limit: 300 })).data
	}));

	const toggle = (epc: string) => (selected = selected.includes(epc) ? selected.filter((e) => e !== epc) : [...selected, epc]);
	const pageEpcs = $derived(tags.data?.data.map((t) => t.epc) ?? []);
	const allOnPage = $derived(pageEpcs.length > 0 && pageEpcs.every((e) => selected.includes(e)));
	const togglePage = () => (selected = allOnPage ? selected.filter((e) => !pageEpcs.includes(e)) : [...new Set([...selected, ...pageEpcs])]);

	const online = (r: RfidReader) => !!r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 5 * 60_000;
	const setStatus = createMutation(() => ({
		mutationFn: (v: { id: string; status: 'active' | 'inactive' }) => patch(`/rfid/readers/${v.id}`, { status: v.status }),
		onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['rfid'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
	function startRotate(r: RfidReader) {
		rotating = { id: r.id, code: r.code };
		rotateOpen = true;
	}
	const diff = (v: RfidVarianceRow) => v.tag_qty - Number(v.system_qty);
</script>

<PageHeader title="RFID" description="{scope.label} · tag, reader, dan selisih tag vs stok sistem">
	{#snippet actions()}
		{#if canManage && tab === 'tags'}<Button onclick={() => (registering = true)}><Plus class="size-4" />Daftarkan tag</Button>{/if}
		{#if canManage && tab === 'readers'}<Button onclick={() => (enrolling = true)}><Plus class="size-4" />Daftarkan reader</Button>{/if}
	{/snippet}
</PageHeader>

<div class="mb-4 flex gap-2" role="tablist">
	{#each [['tags', 'Tag'], ['readers', 'Reader'], ['variance', 'Tag vs stok']] as [k, label]}
		<button role="tab" aria-selected={tab === k} class="rounded-md border border-border px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (tab = k as typeof tab)}>{label}</button>
	{/each}
</div>

{#if tab === 'tags'}
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<Input class="w-64" placeholder="EPC, SKU, atau nama produk" bind:value={search} oninput={() => (pageNo = 1)} />
		<Select class="w-44" bind:value={status} onchange={() => (pageNo = 1)}>
			<option value="">Semua status</option>
			{#each Object.entries(tagLabel) as [k, v]}<option value={k}>{v}</option>{/each}
		</Select>
		{#if selected.length && canManage}
			<span class="ml-auto text-muted">{selected.length} dipilih</span>
			<Button size="sm" onclick={() => (bulk = true)}>Ubah / pindahkan</Button>
			<Button size="sm" variant="ghost" onclick={() => (selected = [])}>Kosongkan</Button>
		{/if}
	</div>
	<Card>
		{#if tags.isPending}<Empty title="Memuat…" />
		{:else if tags.isError}<Empty title="Gagal memuat" hint={tags.error.message} />
		{:else if !tags.data.data.length}<Empty title="Belum ada tag" hint="Tandai produk sebagai “Lacak dengan tag RFID”, lalu daftarkan EPC-nya di sini." />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase">
					<tr>{#if canManage}<th class="w-10 px-4 py-2.5"><input type="checkbox" checked={allOnPage} onchange={togglePage} aria-label="Pilih halaman ini" /></th>{/if}<th class="px-2">EPC</th><th>Produk</th><th>Lokasi</th><th>Status</th><th class="pr-4 text-right">Terakhir terbaca</th></tr>
				</thead>
				<tbody>
					{#each tags.data.data as t (t.id)}
						<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => (openEpc = t.epc)}>
							{#if canManage}<td class="px-4 py-2" onclick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(t.epc)} onchange={() => toggle(t.epc)} aria-label="Pilih {t.epc}" /></td>{/if}
							<td class="px-2 font-mono text-[12px]">{t.epc}</td>
							<td>{t.product_name} <span class="text-muted">{t.variant_name}</span><br /><span class="font-mono text-[12px] text-muted">{t.sku}</span></td>
							<td class="text-muted">{t.store_name || 'Gudang pusat'}{t.location ? ` · ${t.location}` : ''}</td>
							<td><Badge tone={tagTone[t.status]}>{tagLabel[t.status]}</Badge></td>
							<td class="num pr-4 text-right text-muted">{t.last_seen_at ? ago(t.last_seen_at) : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if tags.data.meta}
				<div class="flex items-center justify-between border-t border-border px-4 py-2">
					<span class="text-muted">{num(tags.data.meta.total)} tag</span>
					<div class="flex gap-2">
						<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
						<Button size="sm" variant="secondary" disabled={pageNo >= tags.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
					</div>
				</div>
			{/if}
		{/if}
	</Card>
{:else if tab === 'readers'}
	<Card>
		{#if readers.isPending}<Empty title="Memuat…" />
		{:else if readers.isError}<Empty title="Gagal memuat" hint={readers.error.message} />
		{:else if !readers.data.length}<Empty title="Belum ada reader" hint="Daftarkan reader/gerbang, lalu pasang token-nya di agent toko." />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Reader</th><th>Toko</th><th>Jenis</th><th>Koneksi</th><th class="text-right">Antrean</th><th class="text-right">Alarm lokal</th><th class="pr-4"></th></tr></thead>
				<tbody>
					{#each readers.data as r (r.id)}
						<tr class="border-b border-border last:border-0 {r.status === 'inactive' ? 'opacity-60' : ''}">
							<td class="px-4 py-2.5"><span class="font-medium">{r.code}</span><br /><span class="text-[12px] text-muted">{r.name} · …{r.token_hint}</span></td>
							<td>{r.store_name}</td>
							<td class="text-muted">{readerKindLabel[r.kind]}</td>
							<td>
								{#if r.status === 'inactive'}<Badge>Nonaktif</Badge>
								{:else if online(r)}<Badge tone="ok">Online</Badge> <span class="text-[12px] text-muted">{r.agent_version}</span>
								{:else}<Badge tone="danger">Offline</Badge> <span class="text-[12px] text-muted">{r.last_seen_at ? ago(r.last_seen_at) : 'belum pernah'}</span>{/if}
							</td>
							<td class="num text-right {Number(r.stats.buffered) > 0 ? 'text-warn' : 'text-muted'}" title="Event yang belum terkirim ke server">{r.stats.buffered ?? '—'}</td>
							<td class="num text-right text-muted">{r.stats.local_alarms ?? '—'}</td>
							<td class="pr-4 text-right">
								{#if canManage}
									<Button size="sm" variant="ghost" onclick={() => startRotate(r)} title="Terbitkan token baru"><KeyRound class="size-4" /></Button>
									<Button size="sm" variant="ghost" onclick={() => setStatus.mutate({ id: r.id, status: r.status === 'active' ? 'inactive' : 'active' })} title={r.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}><Power class="size-4" /></Button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card>
	<p class="mt-3 flex items-center gap-2 text-[12px] text-muted"><Radio class="size-3.5" />Reader dianggap offline bila tidak melapor selama 5 menit. Gerbang yang diam memicu peringatan “Reader offline” di menu Keamanan.</p>
{:else}
	<Card>
		{#if variance.isPending}<Empty title="Memuat…" />
		{:else if variance.isError}<Empty title="Gagal memuat" hint={variance.error.message} />
		{:else if !variance.data.length}<Empty title="Belum ada tag di toko" />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Produk</th><th>Toko</th><th class="text-right">Tag di toko</th><th class="text-right">Stok sistem</th><th class="pr-4 text-right">Selisih</th></tr></thead>
				<tbody>
					{#each variance.data as v (v.variant_id + v.store_id)}
						{@const d = diff(v)}
						<tr class="border-b border-border last:border-0 {d !== 0 ? 'bg-warn/5' : ''}">
							<td class="px-4 py-2">{v.product_name} <span class="text-muted">{v.variant_name}</span><br /><span class="font-mono text-[12px] text-muted">{v.sku}</span></td>
							<td>{v.store_name}</td>
							<td class="num text-right">{num(v.tag_qty)}</td>
							<td class="num text-right">{num(v.system_qty)}</td>
							<td class="num pr-4 text-right font-medium {d < 0 ? 'text-danger' : d > 0 ? 'text-warn' : 'text-ok'}">{d > 0 ? '+' : ''}{num(d)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card>
	<p class="mt-3 text-[12px] text-muted">Tag di toko = tag berstatus gudang/rak/dipesan/diretur. Selisih biasanya berarti ada barang tanpa tag, tag belum didaftarkan, atau stok sistem perlu dihitung ulang (opname dengan RFID).</p>
{/if}

<RegisterTagsDialog bind:open={registering} me={data.me} />
<BulkDialog epcs={selected} bind:open={bulk} me={data.me} ondone={() => (selected = [])} />
<ReaderDialog bind:open={enrolling} />
<ReaderDialog bind:open={rotateOpen} rotate={rotating} />
<TagDialog bind:epc={openEpc} />
