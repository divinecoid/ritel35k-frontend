<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Role } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(canAll(data.me.grants, 'role.manage'));

	const roles = createQuery(() => ({ queryKey: ['roles'], queryFn: async () => (await get<Role[]>('/roles')).data }));
	const perms = createQuery(() => ({ queryKey: ['permissions'], enabled: canManage, queryFn: async () => (await get<{ code: string; description: string }[]>('/permissions')).data }));

	const byPrefix = $derived.by(() => {
		const m = new Map<string, { code: string; description: string }[]>();
		for (const p of perms.data ?? []) m.set(p.code.split('.')[0], [...(m.get(p.code.split('.')[0]) ?? []), p]);
		return [...m];
	});

	let open = $state(false);
	let code = $state('');
	let name = $state('');
	let selected = $state<Record<string, boolean>>({});
	let errors = $state<Record<string, string>>({});
	let expanded = $state<string | null>(null);

	const create = createMutation(() => ({
		mutationFn: () => post('/roles', { code, name, permissions: Object.keys(selected).filter((k) => selected[k]) }),
		onSuccess: async () => { toast.ok('Role dibuat'); open = false; code = name = ''; selected = {}; await qc.invalidateQueries({ queryKey: ['roles'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
</script>

<PageHeader title="Role" description="Role bawaan tidak bisa diubah; buat role kustom untuk kebutuhan khusus.">
	{#snippet actions()}{#if canManage}<Button onclick={() => (open = true)}><Plus class="size-4" />Role kustom</Button>{/if}{/snippet}
</PageHeader>

<Card class="divide-y divide-border">
	{#each roles.data ?? [] as r (r.id)}
		<button class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2/60" onclick={() => (expanded = expanded === r.id ? null : r.id)}>
			<div class="flex items-center gap-2"><span class="font-medium">{r.name}</span><span class="font-mono text-[12px] text-muted">{r.code}</span>{#if r.is_system}<Badge>bawaan</Badge>{/if}</div>
			<span class="text-muted">{r.permissions.length} izin</span>
		</button>
		{#if expanded === r.id}
			<div class="flex flex-wrap gap-1 bg-surface-2/40 px-4 py-3">
				{#each r.permissions as p}<span class="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px]">{p}</span>{/each}
			</div>
		{/if}
	{/each}
</Card>

<Dialog bind:open title="Role kustom" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Kode" for="rc" error={errors.code} hint="huruf kecil, angka, _"><Input id="rc" bind:value={code} /></Field>
		<Field label="Nama" for="rn" error={errors.name}><Input id="rn" bind:value={name} /></Field>
	</div>
	<div class="space-y-3">
		{#each byPrefix as [prefix, list] (prefix)}
			<fieldset>
				<legend class="text-[12px] font-semibold tracking-wide text-muted uppercase">{prefix}</legend>
				<div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
					{#each list as p (p.code)}
						<label class="flex items-start gap-2"><input type="checkbox" class="mt-1" bind:checked={selected[p.code]} /><span><span class="font-mono text-[12px]">{p.code}</span><br /><span class="text-[12px] text-muted">{p.description}</span></span></label>
					{/each}
				</div>
			</fieldset>
		{/each}
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={create.isPending} disabled={!code || !name} onclick={() => create.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>
