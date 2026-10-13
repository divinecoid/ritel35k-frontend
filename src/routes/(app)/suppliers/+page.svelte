<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Supplier } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(canAll(data.me.grants, 'supplier.manage'));
	let search = $state('');
	let pageNo = $state(1);
	const list = createQuery(() => ({ queryKey: ['suppliers', search, pageNo], queryFn: () => get<Supplier[]>('/suppliers', { q: search, page: pageNo, per_page: 25 }) }));

	let open = $state(false);
	let f = $state({ code: '', name: '', pic: '', phone: '', email: '', payment_term_days: 0, lead_time_days: 0 });
	let errors = $state<Record<string, string>>({});
	const create = createMutation(() => ({
		mutationFn: () => post('/suppliers', f),
		onSuccess: async () => { toast.ok('Supplier dibuat'); open = false; f = { code: '', name: '', pic: '', phone: '', email: '', payment_term_days: 0, lead_time_days: 0 }; errors = {}; await qc.invalidateQueries({ queryKey: ['suppliers'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
</script>

<PageHeader title="Supplier">
	{#snippet actions()}
		<Input class="w-56" placeholder="Cari supplier" bind:value={search} oninput={() => (pageNo = 1)} />
		{#if canManage}<Button onclick={() => (open = true)}><Plus class="size-4" />Tambah supplier</Button>{/if}
	{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
	{:else if !list.data.data.length}<Empty title="Belum ada supplier" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Kode</th><th>Nama</th><th>PIC</th><th>Telepon</th><th>Termin</th><th>Lead time</th><th>Status</th></tr></thead>
			<tbody>
				{#each list.data.data as s (s.id)}
					<tr class="border-b border-border last:border-0 hover:bg-surface-2/60">
						<td class="px-4 py-2.5 font-mono text-[13px]">{s.code}</td><td class="font-medium">{s.name}</td><td>{s.pic || '—'}</td><td>{s.phone || '—'}</td>
						<td class="num">{s.payment_term_days} hari</td><td class="num">{s.lead_time_days} hari</td>
						<td><Badge tone={s.status === 'active' ? 'ok' : 'warn'}>{s.status}</Badge></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<Dialog bind:open title="Tambah supplier" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Kode" for="sc" error={errors.code}><Input id="sc" bind:value={f.code} /></Field>
		<Field label="Nama perusahaan" for="sn" error={errors.name}><Input id="sn" bind:value={f.name} /></Field>
		<Field label="PIC" for="sp"><Input id="sp" bind:value={f.pic} /></Field>
		<Field label="Telepon" for="sph"><Input id="sph" bind:value={f.phone} /></Field>
		<Field label="Email" for="se" error={errors.email}><Input id="se" type="email" bind:value={f.email} /></Field>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Termin (hari)" for="st"><Input id="st" type="number" min="0" bind:value={f.payment_term_days} /></Field>
			<Field label="Lead time (hari)" for="sl"><Input id="sl" type="number" min="0" bind:value={f.lead_time_days} /></Field>
		</div>
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={create.isPending} disabled={!f.code || !f.name} onclick={() => create.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>
