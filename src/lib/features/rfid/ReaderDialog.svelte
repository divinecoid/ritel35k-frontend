<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Check, Copy } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { post } from '#lib/api/client';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { EnrolledReader } from '#lib/types/api';

	/** Enrolls a reader. The credential is displayed once; only its hash is stored server-side. */
	let { open = $bindable(), rotate = null }: { open: boolean; rotate?: { id: string; code: string } | null } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let store = $state('');
	let code = $state('');
	let name = $state('');
	let kind = $state('gate');
	let errors = $state<Record<string, string>>({});
	let token = $state('');
	let readerCode = $state('');
	let copied = $state(false);
	const stores = $derived(scope.units.filter((u) => u.type === 'store' && u.accessible && u.store_id));

	$effect(() => {
		if (open && !store) store = scope.selected?.type === 'store' ? (scope.selected.store_id ?? '') : (scope.stores[0]?.store_id ?? stores[0]?.store_id ?? '');
		if (!open) {
			token = '';
			copied = false;
			errors = {};
		}
	});

	const create = createMutation(() => ({
		mutationFn: () => post<EnrolledReader>('/rfid/readers', { store_id: store, code, name, kind }),
		onSuccess: async (r) => { token = r.data.token; readerCode = r.data.reader.code; await qc.invalidateQueries({ queryKey: ['rfid'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
	const rotateTok = createMutation(() => ({
		mutationFn: () => post<{ token: string }>(`/rfid/readers/${rotate!.id}/rotate-token`),
		onSuccess: async (r) => { token = r.data.token; readerCode = rotate!.code; await qc.invalidateQueries({ queryKey: ['rfid'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const snippet = $derived(`{\n  "name": "${readerCode.toLowerCase()}",\n  "token": "${token}",\n  "role": "${kind}",\n  "source": "tcp",\n  "address": "192.168.1.60:5084"\n}`);
	async function copy() {
		try { await navigator.clipboard.writeText(token); copied = true; } catch { toast.error('Salin manual dari kotak di atas'); }
	}
</script>

<Dialog bind:open title={rotate ? `Token baru — ${rotate.code}` : token ? 'Reader terdaftar' : 'Daftarkan reader RFID'} wide>
	{#if token}
		<div class="rounded-md border border-warn/50 bg-warn/10 p-3">
			<p class="font-medium">Simpan token ini sekarang — tidak akan ditampilkan lagi.</p>
			<div class="mt-2 flex items-center gap-2"><code class="min-w-0 flex-1 rounded bg-surface px-2 py-1.5 font-mono text-[12px] break-all select-all">{token}</code><Button size="sm" variant="secondary" onclick={copy}>{#if copied}<Check class="size-4" />Tersalin{:else}<Copy class="size-4" />Salin{/if}</Button></div>
		</div>
		<p class="text-muted">Tempel pada bagian <code>rfid</code> di config agent toko (<code>ritel35k-edge</code>):</p>
		<pre class="overflow-auto rounded-md bg-surface-2 p-3 font-mono text-[12px]">{snippet}</pre>
	{:else if rotate}
		<p>Token lama <b>{rotate.code}</b> langsung berhenti berlaku dan agent di toko harus diperbarui. Lanjutkan?</p>
	{:else}
		<div class="grid grid-cols-2 gap-3">
			<Field label="Toko" for="rd-s"><Select id="rd-s" bind:value={store}>{#each stores as s (s.id)}<option value={s.store_id}>{s.name}</option>{/each}</Select></Field>
			<Field label="Jenis" for="rd-k"><Select id="rd-k" bind:value={kind}><option value="gate">Gerbang (alarm keluar)</option><option value="pos">Pad kasir</option><option value="shelf">Rak</option><option value="handheld">Handheld</option></Select></Field>
			<Field label="Kode" for="rd-c" error={errors.code} hint="Mis. GATE-1 (unik per toko)"><Input id="rd-c" bind:value={code} /></Field>
			<Field label="Nama" for="rd-n" error={errors.name}><Input id="rd-n" bind:value={name} placeholder="Gerbang pintu utama" /></Field>
		</div>
	{/if}
	{#snippet footer()}
		{#if token}
			<Button onclick={() => (open = false)}>Selesai</Button>
		{:else}
			<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
			{#if rotate}<Button variant="danger" loading={rotateTok.isPending} onclick={() => rotateTok.mutate()}>Terbitkan token baru</Button>
			{:else}<Button loading={create.isPending} disabled={!store || !code || !name} onclick={() => create.mutate()}>Daftarkan</Button>{/if}
		{/if}
	{/snippet}
</Dialog>
