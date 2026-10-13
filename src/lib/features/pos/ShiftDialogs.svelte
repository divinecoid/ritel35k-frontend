<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { post } from '#lib/api/client';
	import { errMsg } from '#lib/utils/errors';
	import { idr } from '#lib/utils/format';
	import type { Shift } from '#lib/types/api';
	import type { PosState } from './pos.svelte';

	let { pos, cashOpen = $bindable(), closeOpen = $bindable() }: { pos: PosState; cashOpen: boolean; closeOpen: boolean } = $props();

	let type = $state('CASH_OUT');
	let amount = $state('');
	let reason = $state('');
	let busy = $state(false);

	async function saveCash() {
		busy = true;
		try {
			await post(`/pos/shifts/${pos.shift!.id}/cash-movements`, { type, amount: Number(amount), reason });
			toast.ok(type === 'CASH_IN' ? 'Kas masuk dicatat' : 'Kas keluar dicatat');
			cashOpen = false;
			amount = reason = '';
			await pos.loadShift();
		} catch (e) {
			toast.error(errMsg(e));
		} finally {
			busy = false;
		}
	}

	// Blind count: the expected amount is revealed only after the cashier commits their count.
	let counted = $state('');
	let note = $state('');
	let result = $state<Shift | null>(null);

	async function close() {
		busy = true;
		try {
			result = (await post<Shift>(`/pos/shifts/${pos.shift!.id}/close`, { counted_cash: Number(counted) || 0, note })).data;
		} catch (e) {
			toast.error(errMsg(e));
		} finally {
			busy = false;
		}
	}

	async function done() {
		closeOpen = false;
		result = null;
		counted = note = '';
		await pos.loadShift();
	}
</script>

<Dialog bind:open={cashOpen} title="Kas masuk / keluar">
	<Field label="Jenis" for="c-type"><Select id="c-type" bind:value={type}><option value="CASH_OUT">Kas keluar (mis. beli galon, parkir)</option><option value="CASH_IN">Kas masuk (tambah modal receh)</option></Select></Field>
	<Field label="Jumlah (Rp)" for="c-amt"><Input id="c-amt" inputmode="numeric" bind:value={amount} /></Field>
	<Field label="Keterangan" for="c-why"><Input id="c-why" bind:value={reason} /></Field>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (cashOpen = false)}>Batal</Button>
		<Button loading={busy} disabled={!Number(amount) || !reason} onclick={saveCash}>Simpan</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={closeOpen} title="Tutup shift" onclose={() => result && done()}>
	{#if !result}
		<p class="text-muted">Hitung seluruh uang tunai di laci, lalu masukkan jumlahnya. Selisih dihitung otomatis.</p>
		<Field label="Uang tunai di laci (Rp)" for="cl-cnt"><Input id="cl-cnt" inputmode="numeric" bind:value={counted} class="num text-lg" /></Field>
		<Field label="Catatan" for="cl-note"><Input id="cl-note" bind:value={note} /></Field>
	{:else}
		{@const v = Number(result.variance ?? 0)}
		<dl class="grid grid-cols-2 gap-y-2">
			<dt class="text-muted">Seharusnya</dt><dd class="num text-right">{idr(result.expected_cash)}</dd>
			<dt class="text-muted">Dihitung</dt><dd class="num text-right">{idr(result.counted_cash)}</dd>
			<dt class="font-medium">Selisih</dt><dd class="num text-right font-semibold {v === 0 ? 'text-ok' : 'text-danger'}">{v === 0 ? 'Sesuai' : idr(v)}</dd>
			<dt class="text-muted">Penjualan</dt><dd class="num text-right">{result.totals.sale_count} transaksi · {idr(result.totals.gross_sales)}</dd>
		</dl>
	{/if}
	{#snippet footer()}
		{#if !result}
			<Button variant="secondary" onclick={() => (closeOpen = false)}>Batal</Button>
			<Button loading={busy} disabled={counted === ''} onclick={close}>Tutup shift</Button>
		{:else}
			<Button onclick={done}>Selesai</Button>
		{/if}
	{/snippet}
</Dialog>
