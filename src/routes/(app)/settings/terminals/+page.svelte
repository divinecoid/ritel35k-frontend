<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { KeyRound, Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, patch, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Terminal } from '#lib/types/api';

	let { data } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	const storeId = $derived(scope.storeId !== 'all' ? scope.selected?.store_id : undefined);
	const list = createQuery(() => ({ queryKey: ['terminals', storeId], queryFn: async () => (await get<Terminal[]>('/pos/terminals', { store_id: storeId })).data }));
	const managedStores = $derived(scope.units.filter((u) => u.type === 'store' && u.accessible && can(data.me.grants, 'pos.terminal.manage', u.path)));

	let open = $state(false);
	let store = $state('');
	let code = $state('');
	let name = $state('');
	let errors = $state<Record<string, string>>({});
	const create = createMutation(() => ({
		mutationFn: () => post('/pos/terminals', { store_id: store || managedStores[0]?.store_id, code: code.trim(), name: name.trim() }),
		onSuccess: async () => { toast.ok('Terminal dibuat'); open = false; code = name = ''; errors = {}; await qc.invalidateQueries({ queryKey: ['terminals'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
	let token = $state<{ code: string; value: string } | null>(null);
	let tokenOpen = $state(false);
	const issue = createMutation(() => ({
		mutationFn: async (t: Terminal) => ({ code: t.code, ...(await post<{ token: string; hint: string }>(`/pos/terminals/${t.id}/sync-token`)).data }),
		onSuccess: (r) => { token = { code: r.code, value: r.token }; tokenOpen = true; },
		onError: (e) => toast.error(errMsg(e))
	}));
	const toggle = createMutation(() => ({
		mutationFn: (t: Terminal) => patch(`/pos/terminals/${t.id}`, { status: t.status === 'active' ? 'inactive' : 'active' }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['terminals'] }),
		onError: (e) => toast.error(errMsg(e))
	}));
</script>

<PageHeader title="Terminal POS" description="Setiap toko baru otomatis punya POS-01. Tambah kasir lain di sini.">
	{#snippet actions()}{#if managedStores.length}<Button onclick={() => (open = true)}><Plus class="size-4" />Tambah terminal</Button>{/if}{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if !list.data?.length}<Empty title="Belum ada terminal" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Toko</th><th>Kode</th><th>Nama</th><th>Status</th><th class="pr-4"></th></tr></thead>
			<tbody>
				{#each list.data as t (t.id)}
					<tr class="border-b border-border last:border-0">
						<td class="px-4 py-2.5">{t.store_name}</td><td class="font-mono text-[13px]">{t.code}</td><td>{t.name}</td>
						<td><Badge tone={t.status === 'active' ? 'ok' : 'warn'}>{t.status}</Badge></td>
						<td class="pr-4 text-right">{#if managedStores.length}<Button size="sm" variant="ghost" onclick={() => issue.mutate(t)} title="Kredensial agen toko untuk mode offline"><KeyRound class="size-4" />Token offline</Button><Button size="sm" variant="ghost" onclick={() => toggle.mutate(t)}>{t.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</Button>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<Dialog bind:open={tokenOpen} title="Token sinkron terminal {token?.code ?? ''}">
	<p class="text-muted">Tempel token ini di konfigurasi agen toko (<code>pos</code>). Token hanya ditampilkan sekali; membuat ulang token mencabut yang lama.</p>
	<pre class="overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[12px] break-all whitespace-pre-wrap select-all">{token?.value}</pre>
	<pre class="overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[12px] select-all">{`"pos": [{ "name": "${token?.code.toLowerCase()}", "token": "${token?.value}" }]`}</pre>
	{#snippet footer()}<Button onclick={() => { tokenOpen = false; token = null; }}>Selesai</Button>{/snippet}
</Dialog>

<Dialog bind:open title="Tambah terminal">
	<Field label="Toko" for="t-store"><Select id="t-store" bind:value={store}>{#each managedStores as s (s.id)}<option value={s.store_id}>{s.name}</option>{/each}</Select></Field>
	<Field label="Kode" for="t-code" error={errors.code}><Input id="t-code" bind:value={code} placeholder="POS-02" /></Field>
	<Field label="Nama" for="t-name" error={errors.name}><Input id="t-name" bind:value={name} placeholder="Kasir 2" /></Field>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={create.isPending} disabled={!code || !name} onclick={() => create.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>
