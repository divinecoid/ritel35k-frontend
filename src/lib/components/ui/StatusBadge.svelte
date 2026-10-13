<script lang="ts">
	import Badge from './Badge.svelte';
	let { status }: { status: string } = $props();
	const tones: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'info'> = {
		draft: 'neutral', submitted: 'warn', approved: 'info', partially_received: 'warn', received: 'ok', cancelled: 'danger',
		shipped: 'info', counting: 'warn', completed: 'ok'
	};
	const labels: Record<string, string> = {
		draft: 'Draft', submitted: 'Menunggu persetujuan', approved: 'Disetujui', partially_received: 'Diterima sebagian', received: 'Diterima',
		cancelled: 'Dibatalkan', shipped: 'Dalam perjalanan', counting: 'Sedang dihitung'
	};
</script>

<Badge tone={tones[status] ?? 'neutral'}>{labels[status] ?? status}</Badge>
