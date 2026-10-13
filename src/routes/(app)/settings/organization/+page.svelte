<script lang="ts">
	import { createMutation } from '@tanstack/svelte-query';
	import { invalidateAll } from '$app/navigation';
	import { Plus, Store, MapPin, Building } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { errMsg, fieldErrors } from '#lib/utils/errors';

	let { data } = $props();
	let open = $state(false);
	let type = $state('region');
	let parent = $state('');
	let code = $state('');
	let name = $state('');
	let errors = $state<Record<string, string>>({});

	const parents = $derived(data.units.filter((u) => u.type !== 'store' && can(data.me.grants, 'organization.unit.manage', u.path)));
	const canManage = $derived(parents.length > 0);
	const depth = (p: string) => p.split('.').length - 1;
	const icon = { company: Building, business_unit: Building, region: MapPin, store: Store } as const;
	const typeLabel = { company: 'Perusahaan', business_unit: 'Business unit', region: 'Region', store: 'Toko' } as const;

	const m = createMutation(() => ({
		mutationFn: () => post('/organization/units', { parent_id: parent, type, code: code.trim(), name: name.trim() }),
		onSuccess: async () => {
			toast.ok(`${typeLabel[type as keyof typeof typeLabel]} ${name} dibuat`);
			open = false;
			code = name = '';
			errors = {};
			await invalidateAll();
		},
		onError: (e) => {
			errors = fieldErrors(e);
			if (!Object.keys(errors).length) toast.error(errMsg(e));
		}
	}));
</script>

<PageHeader title="Struktur organisasi" description="Perusahaan → business unit → region → toko. Level opsional.">
	{#snippet actions()}
		{#if canManage}<Button onclick={() => { parent ||= parents[0]?.id ?? ''; open = true; }}><Plus class="size-4" />Tambah region / unit</Button>{/if}
	{/snippet}
</PageHeader>

<Card class="divide-y divide-border">
	{#each data.units as u (u.id)}
		{@const Icon = icon[u.type]}
		<div class="flex items-center gap-3 px-4 py-2.5 {u.accessible ? '' : 'opacity-50'}" style="padding-left: {16 + depth(u.path) * 24}px">
			<Icon class="size-4 text-muted" aria-hidden="true" />
			<span class="font-medium">{u.name}</span>
			<span class="font-mono text-[12px] text-muted">{u.code}</span>
			<Badge tone={u.type === 'store' ? 'info' : 'neutral'}>{typeLabel[u.type]}</Badge>
			{#if !u.accessible}<span class="text-[12px] text-muted">di luar akses Anda</span>{/if}
			{#if u.store_status && u.store_status !== 'active'}<Badge tone="warn">{u.store_status}</Badge>{/if}
		</div>
	{/each}
</Card>

<Dialog bind:open title="Tambah region / business unit">
	<Field label="Tipe" for="u-type">
		<Select id="u-type" bind:value={type}><option value="region">Region</option><option value="business_unit">Business unit</option></Select>
	</Field>
	<Field label="Induk" for="u-parent" error={errors.parent_id}>
		<Select id="u-parent" bind:value={parent}>{#each parents as p (p.id)}<option value={p.id}>{p.name}</option>{/each}</Select>
	</Field>
	<Field label="Kode" for="u-code" error={errors.code} hint="Unik, tidak bisa diubah."><Input id="u-code" bind:value={code} placeholder="JABODETABEK" /></Field>
	<Field label="Nama" for="u-name" error={errors.name}><Input id="u-name" bind:value={name} placeholder="Jabodetabek" /></Field>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={m.isPending} disabled={!code.trim() || !name.trim() || !parent} onclick={() => m.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>
