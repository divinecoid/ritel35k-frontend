<script lang="ts">
	import { Printer } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { errMsg } from '#lib/utils/errors';
	import { loadEdge, printReceipt } from './edge';

	let { saleId = $bindable(), text: prerendered, hasCash = false, change = '0', autoPrint = false, onclose }: { saleId: string | null; text?: string; hasCash?: boolean; change?: string; autoPrint?: boolean; onclose?: () => void } = $props();
	let open = $state(false);
	let text = $state('');
	let loading = $state(false);

	$effect(() => {
		if (!saleId) return;
		open = true;
		if (prerendered !== undefined) { // a receipt printed by the store agent while offline: nothing to fetch
			text = prerendered;
			loading = false;
			if (autoPrint && loadEdge()) void print();
			return;
		}
		loading = true;
		fetch(`/api/pos/sales/${saleId}/receipt?format=text`)
			.then((r) => (r.ok ? r.text() : Promise.reject(new Error('Gagal memuat struk'))))
			.then(async (t) => {
				text = t;
				if (autoPrint && loadEdge()) await print();
			})
			.catch((e) => toast.error(errMsg(e)))
			.finally(() => (loading = false));
	});

	async function print() {
		try {
			const via = await printReceipt(text, hasCash);
			if (via === 'edge') toast.ok('Struk dicetak');
		} catch (e) {
			toast.error(`Gagal cetak: ${errMsg(e)} — gunakan Cetak browser`);
		}
	}

	function close() {
		open = false;
		saleId = null;
		onclose?.();
	}
</script>

<Dialog bind:open title="Transaksi selesai" onclose={close}>
	{#if Number(change) > 0}
		<div class="rounded-md bg-ok/10 px-4 py-3 text-center"><p class="text-muted">Kembalian</p><p class="num text-3xl font-semibold text-ok">{new Intl.NumberFormat('id-ID').format(Number(change))}</p></div>
	{/if}
	{#if loading}<p class="text-muted">Memuat struk…</p>{:else}
		<pre class="print-area max-h-80 overflow-auto rounded-md border border-border bg-white p-3 font-mono text-[12px] leading-snug whitespace-pre text-black">{text}</pre>
	{/if}
	{#snippet footer()}
		<Button variant="secondary" onclick={() => window.print()}><Printer class="size-4" />Cetak browser</Button>
		{#if loadEdge()}<Button variant="secondary" onclick={print}>Cetak thermal</Button>{/if}
		<Button onclick={close}>Transaksi baru</Button>
	{/snippet}
</Dialog>
