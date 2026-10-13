<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn';
	let { tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info'; children: Snippet } = $props();
	const tones = {
		neutral: 'bg-surface-2 text-muted',
		ok: 'bg-ok/15 text-ok',
		warn: 'bg-warn/15 text-warn',
		danger: 'bg-danger/15 text-danger',
		info: 'bg-primary/15 text-primary'
	};
</script>

<span class={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[12px] font-medium', tones[tone])}>{@render children()}</span>
