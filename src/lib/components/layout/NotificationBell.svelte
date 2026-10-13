<script lang="ts">
	import { goto } from '$app/navigation';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Bell, CheckCheck } from '@lucide/svelte';
	import { get, post } from '#lib/api/client';
	import { ago } from '#lib/utils/format';
	import type { AppNotification } from '#lib/types/api';

	const qc = useQueryClient();
	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();

	const unread = createQuery(() => ({ queryKey: ['notifications', 'unread'], refetchInterval: 60_000, queryFn: async () => (await get<{ unread: number }>('/notifications/unread-count')).data.unread }));
	const list = createQuery(() => ({ queryKey: ['notifications', 'panel'], enabled: open, queryFn: async () => (await get<AppNotification[]>('/notifications', { per_page: 12 })).data }));
	const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
	const readOne = createMutation(() => ({ mutationFn: (id: string) => post(`/notifications/${id}/read`), onSuccess: refresh }));
	const readAll = createMutation(() => ({ mutationFn: () => post('/notifications/read-all'), onSuccess: refresh }));

	const dot = { info: 'bg-primary', warning: 'bg-warn', critical: 'bg-danger' };
	const target = (n: AppNotification) =>
		n.entity_type === 'security_event' ? `/security?event=${n.entity_id}` : ({ sale: '/sales', shift: '/shifts', stock_transfer: '/transfers', store: '/reports?report=low_stock', user: '/sales?status=voided' })[n.entity_type] ?? '/notifications';

	function pick(n: AppNotification) {
		if (!n.read_at) readOne.mutate(n.id);
		open = false;
		goto(target(n));
	}
</script>

<svelte:window onclick={(e) => { if (open && root && !root.contains(e.target as Node)) open = false; }} onkeydown={(e) => { if (e.key === 'Escape') open = false; }} />

<div class="relative" bind:this={root}>
	<button type="button" class="relative rounded-md p-2 text-muted hover:bg-surface-2" aria-label="Notifikasi{unread.data ? `, ${unread.data} belum dibaca` : ''}" aria-expanded={open} onclick={() => (open = !open)}>
		<Bell class="size-4" />
		{#if unread.data}<span class="num absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">{unread.data > 99 ? '99+' : unread.data}</span>{/if}
	</button>
	{#if open}
		<div class="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-lg border border-border bg-surface shadow-lg" role="dialog" aria-label="Notifikasi">
			<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
				<p class="font-semibold">Notifikasi</p>
				<button type="button" class="flex items-center gap-1 text-[13px] text-primary hover:underline disabled:opacity-50" disabled={!unread.data} onclick={() => readAll.mutate()}><CheckCheck class="size-3.5" />Tandai semua dibaca</button>
			</div>
			<div class="max-h-96 overflow-y-auto">
				{#if list.isPending}<p class="px-4 py-8 text-center text-muted">Memuat…</p>
				{:else if !list.data?.length}<p class="px-4 py-8 text-center text-muted">Belum ada notifikasi.</p>
				{:else}
					{#each list.data as n (n.id)}
						<button type="button" class="flex w-full gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-surface-2/60 {n.read_at ? '' : 'bg-primary/5'}" onclick={() => pick(n)}>
							<span class="mt-1.5 size-2 shrink-0 rounded-full {n.read_at ? 'bg-border' : dot[n.severity]}"></span>
							<span class="min-w-0">
								<span class="block {n.read_at ? '' : 'font-medium'}">{n.title}</span>
								{#if n.body}<span class="block truncate text-[13px] text-muted">{n.body}</span>{/if}
								<span class="text-[12px] text-muted">{ago(n.created_at)}</span>
							</span>
						</button>
					{/each}
				{/if}
			</div>
			<a href="/notifications" class="block border-t border-border px-4 py-2 text-center text-primary hover:bg-surface-2/60" onclick={() => (open = false)}>Lihat semua</a>
		</div>
	{/if}
</div>
