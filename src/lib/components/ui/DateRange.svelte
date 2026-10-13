<script lang="ts">
	import Input from './Input.svelte';
	import Select from './Select.svelte';
	import { addDays, ymd } from '#lib/utils/format';

	let { from = $bindable(), to = $bindable(), onchange }: { from: string; to: string; onchange?: () => void } = $props();

	const presets = [
		{ key: 'today', label: 'Hari ini' },
		{ key: 'yesterday', label: 'Kemarin' },
		{ key: '7', label: '7 hari terakhir' },
		{ key: '30', label: '30 hari terakhir' },
		{ key: 'month', label: 'Bulan ini' },
		{ key: 'lastmonth', label: 'Bulan lalu' },
		{ key: 'year', label: 'Tahun ini' },
		{ key: 'custom', label: 'Kustom…' }
	];
	let preset = $state('7');

	function apply(key: string) {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		if (key === 'today') [from, to] = [ymd(today), ymd(today)];
		else if (key === 'yesterday') [from, to] = [ymd(addDays(today, -1)), ymd(addDays(today, -1))];
		else if (key === '7') [from, to] = [ymd(addDays(today, -6)), ymd(today)];
		else if (key === '30') [from, to] = [ymd(addDays(today, -29)), ymd(today)];
		else if (key === 'month') [from, to] = [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(today)];
		else if (key === 'lastmonth') [from, to] = [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
		else if (key === 'year') [from, to] = [ymd(new Date(now.getFullYear(), 0, 1)), ymd(today)];
		preset = key;
		onchange?.();
	}
	if (!from || !to) apply('7');
</script>

<div class="flex items-center gap-2">
	<Select class="w-40" value={preset} onchange={(e) => apply(e.currentTarget.value)} aria-label="Periode">
		{#each presets as p}<option value={p.key}>{p.label}</option>{/each}
	</Select>
	{#if preset === 'custom'}
		<Input type="date" class="w-38" bind:value={from} max={to} onchange={() => onchange?.()} aria-label="Dari tanggal" />
		<span class="text-muted">–</span>
		<Input type="date" class="w-38" bind:value={to} min={from} onchange={() => onchange?.()} aria-label="Sampai tanggal" />
	{/if}
</div>
