<script lang="ts">
	import { LogOut } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { connectStream } from '#lib/realtime/stream';
	import NotificationBell from '#lib/components/layout/NotificationBell.svelte';
	import { ScopeState, provideScope } from '#lib/scope/scope.svelte';
	import Sidebar from '#lib/components/layout/Sidebar.svelte';
	import ScopeFilter from '#lib/components/layout/ScopeFilter.svelte';

	let { data, children } = $props();

	// Constructed once; refreshed when the tree reloads (e.g. after adding a store).
	const scope = new ScopeState(untrack(() => data.units));
	provideScope(scope);
	$effect(() => scope.update(data.units));
	const qc = useQueryClient();
	onMount(() => {
		scope.update(data.units); // re-apply persisted selection once localStorage is readable
		// live updates: a rebuilt summary / new notification makes the matching queries refetch (bursts are coalesced)
		let pending: ReturnType<typeof setTimeout> | undefined;
		const stop = connectStream((kind) => {
			if (kind === 'notification') {
				qc.invalidateQueries({ queryKey: ['notifications'] });
				qc.invalidateQueries({ queryKey: ['security'] }); // alarms arrive as notifications; the loss-prevention board follows live
			}
			else if (!pending) pending = setTimeout(() => { pending = undefined; qc.invalidateQueries({ queryKey: ['dashboard'] }); }, 2500);
		});
		return () => { stop(); clearTimeout(pending); };
	});
</script>

<div class="flex min-h-screen">
	<Sidebar me={data.me} />
	<div class="flex min-w-0 flex-1 flex-col">
		<header class="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
			<ScopeFilter />
			<div class="flex items-center gap-3">
				<NotificationBell />
				<div class="text-right leading-tight">
					<p class="font-medium">{data.me.user.name}</p>
					<p class="text-[12px] text-muted">{data.me.roles.map((r) => r.role_name).join(', ')}</p>
				</div>
				<form method="POST" action="/logout" onsubmit={() => navigator.serviceWorker?.controller?.postMessage('purge-pages')}>
					<button class="rounded-md p-2 text-muted hover:bg-surface-2" title="Keluar" aria-label="Keluar"><LogOut class="size-4" /></button>
				</form>
			</div>
		</header>
		<main class="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{@render children()}</main>
	</div>
</div>
