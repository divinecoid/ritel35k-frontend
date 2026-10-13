<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { ApiError, post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg } from '#lib/utils/errors';
	import type { Me } from '#lib/types/api';
	import { manualStatuses, tagLabel } from './status';

	/** Change status or move a selection of tags. The server applies it all-or-nothing and says which tags blocked it. */
	let { epcs, open = $bindable(), me, ondone }: { epcs: string[]; open: boolean; me: Me; ondone: () => void } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let mode = $state<'status' | 'move'>('status');
	let status = $state('ON_SHELF');
	let reason = $state('');
	let store = $state('');
	let location = $state('');
	let blocked = $state<Record<string, string>>({});
	const stores = $derived(scope.units.filter((u) => u.type === 'store' && u.accessible && u.store_id));
	$effect(() => {
		if (!open) blocked = {};
	});

	const run = createMutation(() => ({
		mutationFn: () => (mode === 'status' ? post('/rfid/tags/status', { epcs, status, reason: reason || undefined }) : post('/rfid/tags/move', { epcs, store_id: store || undefined, location })),
		onSuccess: async () => {
			toast.ok(mode === 'status' ? `${epcs.length} tag diubah` : `${epcs.length} tag dipindahkan`);
			open = false;
			reason = '';
			await qc.invalidateQueries({ queryKey: ['rfid'] });
			ondone();
		},
		onError: (e) => {
			if (e instanceof ApiError && e.code === 'TAG_CHANGE_REJECTED' && e.details && typeof e.details === 'object') blocked = e.details as Record<string, string>;
			else toast.error(errMsg(e));
		}
	}));
	const blockedList = $derived(Object.entries(blocked));
</script>

<Dialog bind:open title="{epcs.length} tag dipilih">
	<div class="flex gap-2" role="tablist">
		<button role="tab" aria-selected={mode === 'status'} class="rounded-md border border-border px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (mode = 'status')}>Ubah status</button>
		<button role="tab" aria-selected={mode === 'move'} class="rounded-md border border-border px-3 py-1.5 aria-selected:bg-primary aria-selected:text-primary-fg" onclick={() => (mode = 'move')}>Pindahkan</button>
	</div>
	{#if mode === 'status'}
		<Field label="Status baru" for="bs"><Select id="bs" bind:value={status}>{#each manualStatuses as s}<option value={s}>{tagLabel[s]}</option>{/each}</Select></Field>
		{#if status === 'LOST' || status === 'DAMAGED'}<Field label="Alasan" for="br" hint="Wajib — tercatat di audit log"><Input id="br" bind:value={reason} placeholder="Mis. tidak ditemukan saat opname" /></Field>{/if}
		<p class="text-[12px] text-muted">Status “Terjual” hanya terjadi lewat kasir. Perubahan berlaku untuk semua tag atau tidak sama sekali.</p>
	{:else}
		<Field label="Pindah ke" for="bm"><Select id="bm" bind:value={store}>{#if canAll(me.grants, 'rfid.manage')}<option value="">Gudang pusat (tanpa toko)</option>{/if}{#each stores as s (s.id)}<option value={s.store_id}>{s.name}</option>{/each}</Select></Field>
		<Field label="Lokasi (opsional)" for="bl"><Input id="bl" bind:value={location} placeholder="Mis. dock penerimaan" /></Field>
	{/if}
	{#if blockedList.length}
		<div class="rounded-md border border-danger/40 bg-danger/5 p-3" role="alert">
			<p class="font-medium text-danger">Tidak ada yang diubah — {blockedList.length} tag menghalangi:</p>
			<ul class="mt-1 max-h-32 overflow-auto text-[12px]">{#each blockedList.slice(0, 20) as [epc, why]}<li><span class="font-mono">{epc.slice(-10)}</span> — {why}</li>{/each}</ul>
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={run.isPending} onclick={() => run.mutate()}>Terapkan</Button>
	{/snippet}
</Dialog>
