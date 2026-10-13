<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Plus, SlidersHorizontal } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import AddStoreDialog from '#lib/features/organization/AddStoreDialog.svelte';
	import { get } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import type { Store } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	let adding = $state(false);

	const stores = createQuery(() => ({
		queryKey: ['stores', scope.path ?? 'all', data.units.length],
		queryFn: async () => (await get<Store[]>('/organization/stores', { under_path: scope.path })).data
	}));
	const canAdd = $derived(can(data.me.grants, 'organization.store.create'));
	const tone = (s: string) => (s === 'active' ? 'ok' : s === 'closed' ? 'danger' : 'warn');
</script>

<PageHeader title="Toko" description={`${scope.label} · ${stores.data?.length ?? '…'} toko`}>
	{#snippet actions()}
		{#if canAdd}<Button onclick={() => (adding = true)}><Plus class="size-4" />Tambah toko</Button>{/if}
	{/snippet}
</PageHeader>

<Card>
	{#if stores.isPending}
		<Empty title="Memuat…" />
	{:else if stores.isError}
		<Empty title="Gagal memuat toko" hint={stores.error.message} />
	{:else if !stores.data?.length}
		<Empty title="Belum ada toko di lokasi ini" hint={canAdd ? 'Klik “Tambah toko” untuk membuat toko pertama.' : undefined} />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase">
				<tr><th class="px-4 py-2.5">Kode</th><th>Nama</th><th>Induk</th><th>Zona waktu</th><th>Status</th><th class="pr-4"></th></tr>
			</thead>
			<tbody>
				{#each stores.data as s (s.id)}
					<tr class="border-b border-border last:border-0 hover:bg-surface-2/60">
						<td class="px-4 py-2.5 font-mono text-[13px]">{s.code}</td>
						<td class="font-medium">{s.name}</td>
						<td class="text-muted">{scope.unitName(s.parent_org_unit_id)}</td>
						<td class="text-muted">{s.timezone}</td>
						<td><Badge tone={tone(s.status)}>{s.status}</Badge></td>
						<td class="pr-4 text-right">
							{#if can(data.me.grants, 'settings.view', s.path)}
								<a class="inline-flex items-center gap-1 text-primary hover:underline" href="/settings/config?unit={s.org_unit_id}"><SlidersHorizontal class="size-3.5" />Konfigurasi</a>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<AddStoreDialog bind:open={adding} me={data.me} />
