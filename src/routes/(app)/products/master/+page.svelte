<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { errMsg } from '#lib/utils/errors';
	import type { Named } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(canAll(data.me.grants, 'product.manage'));

	const lists = [
		{ key: 'categories', title: 'Kategori' },
		{ key: 'brands', title: 'Merek' },
		{ key: 'uoms', title: 'Satuan (UoM)' }
	] as const;

	const queries = Object.fromEntries(lists.map((l) => [l.key, createQuery(() => ({ queryKey: [l.key], queryFn: async () => (await get<Named[]>(`/${l.key}`)).data }))]));
	let draft = $state<Record<string, { code: string; name: string }>>({ categories: { code: '', name: '' }, brands: { code: '', name: '' }, uoms: { code: '', name: '' } });

	const add = createMutation(() => ({
		mutationFn: (key: string) => post(`/${key}`, draft[key]),
		onSuccess: async (_r, key) => { toast.ok('Ditambahkan'); draft[key] = { code: '', name: '' }; await qc.invalidateQueries({ queryKey: [key] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
</script>

<PageHeader title="Kategori & merek" description="Taksonomi produk tingkat perusahaan." />

<div class="grid gap-5 md:grid-cols-3">
	{#each lists as l (l.key)}
		<Card>
			<h2 class="border-b border-border px-4 py-2.5 font-semibold">{l.title}</h2>
			<ul class="max-h-72 divide-y divide-border overflow-y-auto">
				{#each queries[l.key].data ?? [] as it (it.id)}
					<li class="flex justify-between px-4 py-2"><span>{it.name}</span><span class="font-mono text-[12px] text-muted">{it.code}</span></li>
				{:else}
					<li class="px-4 py-6 text-center text-muted">Belum ada</li>
				{/each}
			</ul>
			{#if canManage}
				<form class="flex gap-2 border-t border-border p-3" onsubmit={(e) => { e.preventDefault(); add.mutate(l.key); }}>
					<Input class="w-24" placeholder="Kode" bind:value={draft[l.key].code} />
					<Input placeholder="Nama" bind:value={draft[l.key].name} />
					<Button type="submit" size="sm" disabled={!draft[l.key].code || !draft[l.key].name}>Tambah</Button>
				</form>
			{/if}
		</Card>
	{/each}
</div>
