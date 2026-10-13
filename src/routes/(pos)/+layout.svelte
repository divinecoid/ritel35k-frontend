<script lang="ts">
	let { children } = $props();
</script>

<div class="flex h-screen flex-col overflow-hidden bg-bg">{@render children()}</div>
