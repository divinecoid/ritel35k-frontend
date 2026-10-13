<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { get } from '#lib/api/client';
	import { useScope } from '#lib/scope/scope.svelte';
	import { dateTime } from '#lib/utils/format';
	import type { AuditLog } from '#lib/types/api';

	const scope = useScope();
	let action = $state('');
	let pageNo = $state(1);
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const logs = createQuery(() => ({
		queryKey: ['audit', action, storeId, pageNo],
		queryFn: async () => (await get<AuditLog[]>('/audit-logs', { action, store_id: storeId, page: pageNo, per_page: 50 })).data
	}));
	const actionOptions = ['STORE_CREATED', 'STORE_UPDATED', 'SETTING_CHANGED', 'USER_CREATED', 'USER_PERMISSION_CHANGED', 'PRODUCT_CREATED', 'PIN_APPROVAL', 'LOGIN_FAILED'];
</script>

<PageHeader title="Audit log" description="Catatan append-only untuk semua aksi sensitif.">
	{#snippet actions()}
		<Select class="w-56" bind:value={action} onchange={() => (pageNo = 1)}><option value="">Semua aksi</option>{#each actionOptions as a}<option value={a}>{a}</option>{/each}</Select>
	{/snippet}
</PageHeader>

<Card>
	{#if logs.isPending}<Empty title="Memuat…" />
	{:else if logs.isError}<Empty title="Gagal memuat" hint={logs.error.message} />
	{:else if !logs.data.length}<Empty title="Tidak ada catatan" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Waktu</th><th>Aksi</th><th>Entitas</th><th>IP</th></tr></thead>
			<tbody>
				{#each logs.data as l (l.id)}
					<tr class="border-b border-border last:border-0">
						<td class="num px-4 py-2 whitespace-nowrap text-muted">{dateTime(l.created_at)}</td>
						<td><Badge tone={l.action.includes('FAIL') ? 'danger' : 'info'}>{l.action}</Badge></td>
						<td class="font-mono text-[12px]">{l.entity} {l.entity_id.slice(0, 8)}</td>
						<td class="text-muted">{l.ip_address || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>
