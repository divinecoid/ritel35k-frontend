<script lang="ts">
	import { goto } from '$app/navigation';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { CheckCheck } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { get, post } from '#lib/api/client';
	import { ago, dateTime } from '#lib/utils/format';
	import type { AppNotification } from '#lib/types/api';

	const qc = useQueryClient();
	let unreadOnly = $state(false);
	let pageNo = $state(1);
	const list = createQuery(() => ({ queryKey: ['notifications', 'page', unreadOnly, pageNo], queryFn: () => get<AppNotification[]>('/notifications', { unread: unreadOnly ? 'true' : undefined, page: pageNo, per_page: 30 }) }));
	const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
	const readOne = createMutation(() => ({ mutationFn: (id: string) => post(`/notifications/${id}/read`), onSuccess: refresh }));
	const readAll = createMutation(() => ({ mutationFn: () => post('/notifications/read-all'), onSuccess: refresh }));

	const tone = { info: 'info', warning: 'warn', critical: 'danger' } as const;
	const label = { info: 'Info', warning: 'Perhatian', critical: 'Penting' };
	const target = (n: AppNotification) =>
		n.entity_type === 'security_event' ? `/security?event=${n.entity_id}` : ({ sale: '/sales', shift: '/shifts', stock_transfer: '/transfers', store: '/reports?report=low_stock', user: '/sales?status=voided' })[n.entity_type];
	function open(n: AppNotification) {
		if (!n.read_at) readOne.mutate(n.id);
		const t = target(n);
		if (t) goto(t);
	}
</script>

<PageHeader title="Notifikasi" description="Peringatan operasional untuk lingkup Anda: void berulang, selisih kas, retur besar, stok menipis">
	{#snippet actions()}
		<label class="flex items-center gap-2 text-muted"><input type="checkbox" bind:checked={unreadOnly} onchange={() => (pageNo = 1)} />Belum dibaca</label>
		<Button variant="secondary" onclick={() => readAll.mutate()}><CheckCheck class="size-4" />Tandai semua dibaca</Button>
	{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
	{:else if !list.data.data.length}<Empty title={unreadOnly ? 'Semua sudah dibaca' : 'Belum ada notifikasi'} hint="Peringatan muncul otomatis saat ada kejadian yang perlu perhatian." />
	{:else}
		<ul>
			{#each list.data.data as n (n.id)}
				<li class="border-b border-border last:border-0">
					<button type="button" class="flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-surface-2/60 {n.read_at ? '' : 'bg-primary/5'}" onclick={() => open(n)}>
						<Badge tone={tone[n.severity]}>{label[n.severity]}</Badge>
						<span class="min-w-0 flex-1">
							<span class="block {n.read_at ? '' : 'font-medium'}">{n.title}</span>
							{#if n.body}<span class="block text-muted">{n.body}</span>{/if}
						</span>
						<span class="shrink-0 text-right text-[12px] text-muted" title={dateTime(n.created_at)}>{ago(n.created_at)}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if list.data.meta && list.data.meta.total_pages > 1}
			<div class="flex items-center justify-between border-t border-border px-4 py-2">
				<span class="text-muted">{list.data.meta.total} notifikasi</span>
				<div class="flex gap-2">
					<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
					<Button size="sm" variant="secondary" disabled={pageNo >= list.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
				</div>
			</div>
		{/if}
	{/if}
</Card>
