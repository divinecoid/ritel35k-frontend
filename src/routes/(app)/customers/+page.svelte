<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { Plus } from '@lucide/svelte';
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
	import { get, patch, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { date, idr, num } from '#lib/utils/format';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Customer, MembershipLevel } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	let tab = $state<'customers' | 'levels'>('customers');
	let search = $state('');
	let level = $state('');
	let pageNo = $state(1);
	let creating = $state(false);
	const canCreate = $derived(can(data.me.grants, 'customer.create') || can(data.me.grants, 'customer.manage'));
	const canManage = $derived(!!data.me.grants['customer.manage']?.all);

	const levels = createQuery(() => ({ queryKey: ['levels'], queryFn: async () => (await get<MembershipLevel[]>('/membership-levels')).data }));
	const list = createQuery(() => ({ queryKey: ['customers', search, level, pageNo], enabled: tab === 'customers', queryFn: () => get<Customer[]>('/customers', { q: search, level_id: level, page: pageNo, per_page: 30 }) }));

	let f = $state({ name: '', phone: '', email: '' });
	let errors = $state<Record<string, string>>({});
	const create = createMutation(() => ({
		mutationFn: () => post<Customer>('/customers', { name: f.name.trim(), phone: f.phone, email: f.email || undefined }),
		onSuccess: async (r) => { toast.ok(`Member ${r.data.member_no} terdaftar`); creating = false; f = { name: '', phone: '', email: '' }; errors = {}; await qc.invalidateQueries({ queryKey: ['customers'] }); await goto(`/customers/${r.data.id}`); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));

	let editing = $state<Record<string, { min_spend: string; earn_multiplier: string }>>({});
	const saveLevel = createMutation(() => ({
		mutationFn: (l: MembershipLevel) => patch(`/membership-levels/${l.id}`, { min_spend: Number(editing[l.id].min_spend), earn_multiplier: Number(editing[l.id].earn_multiplier) }),
		onSuccess: async () => { toast.ok('Level disimpan'); await qc.invalidateQueries({ queryKey: ['levels'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
	$effect(() => { for (const l of levels.data ?? []) editing[l.id] ??= { min_spend: String(Number(l.min_spend)), earn_multiplier: String(Number(l.earn_multiplier)) }; });
</script>

<PageHeader title="Pelanggan & member" description="Satu data pelanggan untuk semua toko — poin dan level berlaku di mana saja">
	{#snippet actions()}{#if canCreate}<Button onclick={() => (creating = true)}><Plus class="size-4" />Member baru</Button>{/if}{/snippet}
</PageHeader>

<div class="mb-3 flex items-center justify-between">
	<div class="inline-flex rounded-md border border-border bg-surface p-0.5" role="tablist">
		{#each [['customers', 'Pelanggan'], ['levels', 'Level & poin']] as [k, label]}
			<button role="tab" aria-selected={tab === k} class="rounded px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (tab = k as typeof tab)}>{label}</button>
		{/each}
	</div>
	{#if tab === 'customers'}
		<div class="flex gap-2">
			<Input class="w-64" placeholder="Nama, no. HP, no. member" bind:value={search} oninput={() => (pageNo = 1)} />
			<Select class="w-40" bind:value={level} onchange={() => (pageNo = 1)}><option value="">Semua level</option>{#each levels.data ?? [] as l (l.id)}<option value={l.id}>{l.name}</option>{/each}</Select>
		</div>
	{/if}
</div>

{#if tab === 'customers'}
	<Card>
		{#if list.isPending}<Empty title="Memuat…" />
		{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
		{:else if !list.data.data.length}<Empty title="Belum ada pelanggan" hint={search ? 'Coba kata kunci lain.' : 'Daftarkan member pertama dari sini atau langsung di kasir.'} />
		{:else}
			<table class="w-full text-left">
				<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Member</th><th>No. HP</th><th>Level</th><th class="text-right">Poin</th><th class="text-right">Total belanja</th><th class="pr-4">Terakhir belanja</th></tr></thead>
				<tbody>
					{#each list.data.data as c (c.id)}
						<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => goto(`/customers/${c.id}`)}>
							<td class="px-4 py-2.5"><p class="font-medium">{c.name}</p><p class="font-mono text-[12px] text-muted">{c.member_no}</p></td>
							<td class="text-muted">{c.phone}</td><td><Badge tone="info">{c.level_name}</Badge></td>
							<td class="num text-right">{num(c.points_balance)}</td><td class="num text-right">{idr(c.lifetime_spend)}</td><td class="num pr-4 pl-4 text-muted">{date(c.last_purchase_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if list.data.meta && list.data.meta.total_pages > 1}
				<div class="flex items-center justify-between border-t border-border px-4 py-2"><span class="text-muted">{list.data.meta.total} pelanggan</span>
					<div class="flex gap-2"><Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button><Button size="sm" variant="secondary" disabled={pageNo >= list.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button></div></div>
			{/if}
		{/if}
	</Card>
{:else}
	<Card>
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Level</th><th class="text-right">Syarat total belanja (Rp)</th><th class="text-right">Pengali poin</th><th class="pr-4"></th></tr></thead>
			<tbody>
				{#each levels.data ?? [] as l (l.id)}
					<tr class="border-b border-border last:border-0">
						<td class="px-4 py-2.5 font-medium">{l.name}{#if l.is_default} <Badge>awal</Badge>{/if}</td>
						<td class="text-right">{#if canManage && editing[l.id] && !l.is_default}<Input class="num ml-auto h-8 w-40 text-right" inputmode="numeric" bind:value={editing[l.id].min_spend} />{:else}<span class="num">{idr(l.min_spend)}</span>{/if}</td>
						<td class="text-right">{#if canManage && editing[l.id]}<Input class="num ml-auto h-8 w-24 text-right" inputmode="decimal" bind:value={editing[l.id].earn_multiplier} />{:else}<span class="num">×{l.earn_multiplier}</span>{/if}</td>
						<td class="pr-4 text-right">{#if canManage}<Button size="sm" variant="secondary" loading={saveLevel.isPending} onclick={() => saveLevel.mutate(l)}>Simpan</Button>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="border-t border-border px-4 py-3 text-[12px] text-muted">Member naik level otomatis saat total belanja mencapai syarat (tidak turun otomatis). Aturan poin (Rp per poin, nilai tukar, masa berlaku) ada di <a class="text-primary hover:underline" href="/settings/config">Konfigurasi → Loyalty</a>.</p>
	</Card>
{/if}

<Dialog bind:open={creating} title="Member baru">
	<Field label="Nama" for="m-name" error={errors.name}><Input id="m-name" bind:value={f.name} /></Field>
	<Field label="No. HP" for="m-phone" error={errors.phone} hint="+62 / 62 / 08 dianggap sama"><Input id="m-phone" inputmode="tel" bind:value={f.phone} /></Field>
	<Field label="Email (opsional)" for="m-email" error={errors.email}><Input id="m-email" type="email" bind:value={f.email} /></Field>
	{#snippet footer()}<Button variant="secondary" onclick={() => (creating = false)}>Batal</Button><Button loading={create.isPending} disabled={!f.name.trim() || !f.phone.trim()} onclick={() => create.mutate()}>Daftarkan</Button>{/snippet}
</Dialog>
