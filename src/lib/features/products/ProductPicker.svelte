<script lang="ts">
	import Input from '#lib/components/ui/Input.svelte';
	import { get } from '#lib/api/client';
	import type { Product } from '#lib/types/api';

	export interface Picked {
		variant_id: string;
		sku: string;
		name: string;
	}
	let { onpick, placeholder = 'Cari produk / SKU / barcode…' }: { onpick: (p: Picked) => void; placeholder?: string } = $props();
	let q = $state('');
	let results = $state<Product[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function input() {
		clearTimeout(timer);
		if (q.trim().length < 2) return (results = []);
		timer = setTimeout(async () => {
			results = (await get<Product[]>('/products', { q: q.trim(), per_page: 8 }).catch(() => ({ data: [] as Product[] }))).data;
		}, 200);
	}
</script>

<div class="relative">
	<Input bind:value={q} oninput={input} {placeholder} autocomplete="off" />
	{#if results.length}
		<ul class="mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-surface">
			{#each results as p (p.id)}
				{#each p.variants as v (v.id)}
					<li>
						<button type="button" class="flex w-full justify-between px-3 py-2 text-left hover:bg-surface-2" onclick={() => { onpick({ variant_id: v.id, sku: v.sku, name: p.name + (v.name ? ' ' + v.name : '') }); q = ''; results = []; }}>
							<span>{p.name} <span class="text-muted">{v.name}</span></span><span class="font-mono text-[12px] text-muted">{v.sku}</span>
						</button>
					</li>
				{/each}
			{/each}
		</ul>
	{/if}
</div>
