<script lang="ts">
	let { title, hint }: { title: string; hint?: string } = $props();
</script>

<div class="px-4 py-12 text-center">
	<p class="font-medium">{title}</p>
	{#if hint}<p class="mt-1 text-muted">{hint}</p>{/if}
</div>
