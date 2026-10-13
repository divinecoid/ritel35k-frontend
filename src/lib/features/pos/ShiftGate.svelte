<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { post } from '#lib/api/client';
	import { errMsg } from '#lib/utils/errors';
	import type { PosState } from './pos.svelte';

	let { pos }: { pos: PosState } = $props();
	let cash = $state('0');
	let busy = $state(false);

	async function open() {
		busy = true;
		try {
			await post('/pos/shifts/open', { terminal_id: pos.terminalId, opening_cash: Number(cash) || 0 });
			await pos.loadShift();
			toast.ok('Shift dibuka');
		} catch (e) {
			toast.error(errMsg(e));
		} finally {
			busy = false;
		}
	}
</script>

<div class="grid flex-1 place-items-center px-4">
	<form class="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6" onsubmit={(e) => { e.preventDefault(); open(); }}>
		<div>
			<h1 class="text-lg font-semibold">Buka shift</h1>
			<p class="text-muted">Hitung uang kas awal di laci sebelum mulai berjualan.</p>
		</div>
		{#if pos.terminals.length === 0}
			<p class="text-danger">Tidak ada terminal aktif di toko Anda. Minta manajer menambahkan terminal.</p>
		{:else}
			<Field label="Terminal" for="g-term">
				<Select id="g-term" value={pos.terminalId} onchange={(e) => pos.setTerminal(e.currentTarget.value)}>
					{#each pos.terminals as t (t.id)}<option value={t.id}>{t.store_name ?? ''} — {t.code} {t.name}</option>{/each}
				</Select>
			</Field>
			<Field label="Kas awal (Rp)" for="g-cash"><Input id="g-cash" inputmode="numeric" bind:value={cash} /></Field>
			<Button type="submit" class="w-full" loading={busy}>Buka shift</Button>
		{/if}
		<a href="/dashboard" class="block text-center text-muted hover:underline">← Kembali ke back office</a>
	</form>
</div>
