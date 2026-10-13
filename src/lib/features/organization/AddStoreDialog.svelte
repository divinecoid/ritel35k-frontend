<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { invalidateAll } from '$app/navigation';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Me, Provisioned } from '#lib/types/api';

	let { open = $bindable(), me }: { open: boolean; me: Me } = $props();
	const scope = useScope();
	const qc = useQueryClient();

	// Parents the caller may add stores under (company root, business units, regions) — from the API's tree.
	const parents = $derived(scope.units.filter((u) => u.type !== 'store' && can(me.grants, 'organization.store.create', u.path)));

	let code = $state('');
	let name = $state('');
	let parent = $state('');
	let timezone = $state('Asia/Jakarta');
	let address = $state('');
	let errors = $state<Record<string, string>>({});

	$effect(() => {
		if (open && !parent) parent = (scope.selected && scope.selected.type !== 'store' ? scope.selected.id : parents.at(-1)?.id) ?? parents[0]?.id ?? '';
	});

	const m = createMutation(() => ({
		mutationFn: () =>
			post<Provisioned>('/organization/stores', {
				code: code.trim(),
				name: name.trim(),
				parent_org_unit_id: parent || undefined,
				timezone,
				address: address ? { line1: address } : undefined
			}),
		onSuccess: async (r) => {
			toast.ok(`Toko ${r.data.store.name} siap dipakai — gudang default ${r.data.default_warehouse.code} dibuat`);
			open = false;
			code = name = address = '';
			errors = {};
			await Promise.all([invalidateAll(), qc.invalidateQueries({ queryKey: ['stores'] })]);
		},
		onError: (e) => {
			errors = fieldErrors(e);
			if (!Object.keys(errors).length) toast.error(errMsg(e));
		}
	}));
</script>

<Dialog bind:open title="Tambah toko">
	<p class="text-muted">Toko baru otomatis mewarisi harga, pajak, metode bayar, dan aturan POS dari induknya. Tidak ada setup tambahan.</p>
	<Field label="Kode toko" for="s-code" error={errors.code} hint="Unik, tidak bisa diubah. Dipakai di nomor dokumen.">
		<Input id="s-code" bind:value={code} placeholder="JKT-BARAT" maxlength={32} />
	</Field>
	<Field label="Nama toko" for="s-name" error={errors.name}><Input id="s-name" bind:value={name} placeholder="Jakarta Barat" /></Field>
	<Field label="Induk (region)" for="s-parent" error={errors.parent_org_unit_id}>
		<Select id="s-parent" bind:value={parent}>
			{#each parents as p (p.id)}<option value={p.id}>{p.type === 'company' ? `${p.name} (langsung di bawah perusahaan)` : p.name}</option>{/each}
		</Select>
	</Field>
	<Field label="Zona waktu" for="s-tz" error={errors.timezone}>
		<Select id="s-tz" bind:value={timezone}>
			<option value="Asia/Jakarta">WIB — Asia/Jakarta</option>
			<option value="Asia/Makassar">WITA — Asia/Makassar</option>
			<option value="Asia/Jayapura">WIT — Asia/Jayapura</option>
		</Select>
	</Field>
	<Field label="Alamat" for="s-addr"><Input id="s-addr" bind:value={address} /></Field>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!code.trim() || !name.trim() || !parent} onclick={() => m.mutate()}>Simpan toko</Button>
	{/snippet}
</Dialog>
