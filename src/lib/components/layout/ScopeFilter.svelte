<script lang="ts">
	import { Building2, Store } from '@lucide/svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { useScope } from '#lib/scope/scope.svelte';

	const scope = useScope();
	const depth = (path: string) => path.split('.').length - 2;
</script>

<div class="flex items-center gap-2" role="group" aria-label="Filter lokasi">
	{#if scope.regions.length > 0}
		<label class="flex items-center gap-1.5 text-muted">
			<Building2 class="size-4" aria-hidden="true" />
			<span class="sr-only">Region</span>
			<Select class="h-8 w-44" value={scope.regionId} onchange={(e) => scope.setRegion(e.currentTarget.value)}>
				<option value="all">Semua region</option>
				{#each scope.regions as r (r.id)}
					<option value={r.id}>{' '.repeat(Math.max(0, depth(r.path) - 1))}{r.name}</option>
				{/each}
			</Select>
		</label>
	{/if}
	<label class="flex items-center gap-1.5 text-muted">
		<Store class="size-4" aria-hidden="true" />
		<span class="sr-only">Toko</span>
		<Select class="h-8 w-48" value={scope.storeId} onchange={(e) => scope.setStore(e.currentTarget.value)}>
			<option value="all">Semua toko ({scope.stores.length})</option>
			{#each scope.stores as s (s.id)}
				<option value={s.id}>{s.name}</option>
			{/each}
		</Select>
	</label>
</div>
