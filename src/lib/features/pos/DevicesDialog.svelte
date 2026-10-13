<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { errMsg } from '#lib/utils/errors';
	import { edgeHealth, edgeOpenDrawer, loadEdge, saveEdge } from './edge';

	let { open = $bindable() }: { open: boolean } = $props();
	let url = $state('http://127.0.0.1:9100');
	let token = $state('');
	let status = $state('');

	$effect(() => {
		if (open) {
			const c = loadEdge();
			url = c?.url ?? 'http://127.0.0.1:9100';
			token = c?.token ?? '';
			status = '';
		}
	});

	async function test() {
		saveEdge({ url, token });
		try {
			const h = await edgeHealth();
			status = `Terhubung · printer ${h.printer} · v${h.version}`;
		} catch (e) {
			status = `Gagal: ${errMsg(e)}`;
		}
	}
</script>

<Dialog bind:open title="Perangkat toko">
	<p class="text-muted">Printer thermal dan laci kas dihubungkan lewat <code>ritel35k-edge</code> di komputer ini. Tanpa edge, struk dicetak lewat dialog browser.</p>
	<Field label="Alamat edge agent" for="e-url"><Input id="e-url" bind:value={url} /></Field>
	<Field label="Token" for="e-tok"><Input id="e-tok" type="password" bind:value={token} autocomplete="off" /></Field>
	{#if status}<p class={status.startsWith('Gagal') ? 'text-danger' : 'text-ok'}>{status}</p>{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => { saveEdge(null); token = ''; status = 'Edge dinonaktifkan'; }}>Nonaktifkan</Button>
		<Button variant="secondary" disabled={!token} onclick={() => edgeOpenDrawer().then(() => toast.ok('Laci dibuka')).catch((e) => toast.error(errMsg(e)))}>Tes laci</Button>
		<Button disabled={!token} onclick={test}>Simpan & tes</Button>
	{/snippet}
</Dialog>
