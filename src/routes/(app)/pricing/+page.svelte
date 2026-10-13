<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, patch, post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { MembershipLevel, PriceList } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(canAll(data.me.grants, 'pricing.manage'));
	const lists = createQuery(() => ({ queryKey: ['price-lists'], queryFn: async () => (await get<PriceList[]>('/price-lists')).data }));
	const levels = createQuery(() => ({ queryKey: ['levels'], queryFn: async () => (await get<MembershipLevel[]>('/membership-levels')).data }));
	let open = $state(false);
	let f = $state({ code: '', name: '', level: '' });
	let errors = $state<Record<string, string>>({});
	const create = createMutation(() => ({
		mutationFn: () => post('/price-lists', { code: f.code.trim().toUpperCase(), name: f.name.trim(), membership_level_id: f.level || undefined }),
		onSuccess: async () => { toast.ok('Daftar harga dibuat — isi harganya dari menu Produk → Harga jual'); open = false; f = { code: '', name: '', level: '' }; errors = {}; await qc.invalidateQueries({ queryKey: ['price-lists'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
	const toggle = createMutation(() => ({
		mutationFn: (l: PriceList) => patch(`/price-lists/${l.id}`, { status: l.status === 'active' ? 'inactive' : 'active' }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['price-lists'] }), onError: (e) => toast.error(errMsg(e))
	}));
</script>

<PageHeader title="Daftar harga" description="Harga diwariskan perusahaan → region → toko. Daftar harga khusus level member otomatis dipakai kasir bila lebih murah.">
	{#snippet actions()}{#if canManage}<Button onclick={() => (open = true)}><Plus class="size-4" />Daftar harga baru</Button>{/if}{/snippet}
</PageHeader>

<Card>
	<table class="w-full text-left">
		<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Nama</th><th>Kode</th><th>Berlaku untuk</th><th class="pr-4">Status</th></tr></thead>
		<tbody>
			{#each lists.data ?? [] as l (l.id)}
				<tr class="border-b border-border last:border-0">
					<td class="px-4 py-2.5 font-medium">{l.name}{#if l.is_default} <Badge>utama</Badge>{/if}</td><td class="font-mono text-[13px] text-muted">{l.code}</td>
					<td>{l.level_name ? `Member ${l.level_name}` : 'Semua pelanggan'}</td>
					<td class="pr-4">{#if canManage && !l.is_default}<button onclick={() => toggle.mutate(l)}><Badge tone={l.status === 'active' ? 'ok' : 'warn'}>{l.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></button>{:else}<Badge tone="ok">Aktif</Badge>{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="border-t border-border px-4 py-3 text-[12px] text-muted">Harga per barang diatur di <a class="text-primary hover:underline" href="/products">Produk</a> → baris produk → <i>Harga jual</i>: pilih daftar harga, lokasi (perusahaan/region/toko), dan jumlah minimum untuk harga grosir bertingkat.</p>
</Card>

<Dialog bind:open title="Daftar harga baru">
	<Field label="Kode" for="pl-code" error={errors.code}><Input id="pl-code" bind:value={f.code} placeholder="MEMBER-GOLD" /></Field>
	<Field label="Nama" for="pl-name" error={errors.name}><Input id="pl-name" bind:value={f.name} placeholder="Harga Member Gold" /></Field>
	<Field label="Khusus level member" for="pl-level" hint="Kosong = untuk semua pelanggan (misalnya harga grosir)"><Select id="pl-level" bind:value={f.level}><option value="">— semua pelanggan —</option>{#each levels.data ?? [] as l (l.id)}<option value={l.id}>{l.name}</option>{/each}</Select></Field>
	{#snippet footer()}<Button variant="secondary" onclick={() => (open = false)}>Batal</Button><Button loading={create.isPending} disabled={!f.code.trim() || !f.name.trim()} onclick={() => create.mutate()}>Simpan</Button>{/snippet}
</Dialog>
