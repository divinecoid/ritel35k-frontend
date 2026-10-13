<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import AssignmentsEditor, { type Row } from '#lib/features/users/AssignmentsEditor.svelte';
	import { get, patch, post, put } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { dateTime } from '#lib/utils/format';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Role, User } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(can(data.me.grants, 'user.manage'));
	const canSeeRoles = $derived(can(data.me.grants, 'role.view'));

	let search = $state('');
	let pageNo = $state(1);

	const users = createQuery(() => ({
		queryKey: ['users', search, pageNo],
		queryFn: () => get<User[]>('/users', { q: search, page: pageNo, per_page: 25 })
	}));
	const roles = createQuery(() => ({ queryKey: ['roles'], enabled: canSeeRoles, queryFn: async () => (await get<Role[]>('/roles')).data }));

	// create
	let creating = $state(false);
	let f = $state({ name: '', email: '', password: '', pin: '' });
	let rows = $state<Row[]>([{ role_id: '', org_unit_id: '' }]);
	let errors = $state<Record<string, string>>({});

	const create = createMutation(() => ({
		mutationFn: () =>
			post('/users', {
				...f,
				pin: f.pin || undefined,
				assignments: rows.filter((r) => r.role_id).map((r) => ({ role_id: r.role_id, org_unit_id: r.org_unit_id || null }))
			}),
		onSuccess: async () => {
			toast.ok('Pengguna dibuat');
			creating = false;
			f = { name: '', email: '', password: '', pin: '' };
			rows = [{ role_id: '', org_unit_id: '' }];
			await qc.invalidateQueries({ queryKey: ['users'] });
		},
		onError: (e) => {
			errors = fieldErrors(e);
			toast.error(errMsg(e));
		}
	}));

	// edit assignments
	let editing = $state<User | null>(null);
	let editOpen = $state(false);
	let editRows = $state<Row[]>([]);
	function openEdit(u: User) {
		editing = u;
		editRows = u.assignments.map((a) => ({ role_id: a.role_id, org_unit_id: a.org_unit_id ?? '' }));
		editOpen = true;
	}
	const saveAssign = createMutation(() => ({
		mutationFn: () => put(`/users/${editing!.id}/assignments`, { assignments: editRows.filter((r) => r.role_id).map((r) => ({ role_id: r.role_id, org_unit_id: r.org_unit_id || null })) }),
		onSuccess: async () => { toast.ok('Akses diperbarui'); editOpen = false; await qc.invalidateQueries({ queryKey: ['users'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const toggle = createMutation(() => ({
		mutationFn: (u: User) => patch(`/users/${u.id}`, { status: u.status === 'active' ? 'inactive' : 'active' }),
		onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['users'] }); },
		onError: (e) => toast.error(errMsg(e))
	}));
</script>

<PageHeader title="Pengguna" description="Role + lingkup organisasi menentukan apa yang bisa dilihat dan dilakukan.">
	{#snippet actions()}
		<Input class="w-56" placeholder="Cari nama / email" bind:value={search} oninput={() => (pageNo = 1)} />
		{#if canManage}<Button onclick={() => (creating = true)}><Plus class="size-4" />Tambah pengguna</Button>{/if}
	{/snippet}
</PageHeader>

<Card>
	{#if users.isPending}<Empty title="Memuat…" />
	{:else if users.isError}<Empty title="Gagal memuat" hint={users.error.message} />
	{:else if !users.data.data.length}<Empty title="Tidak ada pengguna" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase">
				<tr><th class="px-4 py-2.5">Nama</th><th>Akses</th><th>Login terakhir</th><th>Status</th><th class="pr-4"></th></tr>
			</thead>
			<tbody>
				{#each users.data.data as u (u.id)}
					<tr class="border-b border-border align-top last:border-0">
						<td class="px-4 py-2.5"><p class="font-medium">{u.name}</p><p class="text-[12px] text-muted">{u.email}</p></td>
						<td class="py-2.5">
							<div class="flex flex-wrap gap-1">
								{#each u.assignments as a}<Badge tone="info">{a.role_name} · {a.org_unit_name ?? 'Semua'}</Badge>{/each}
							</div>
						</td>
						<td class="py-2.5 text-muted">{dateTime(u.last_login_at)}</td>
						<td class="py-2.5"><Badge tone={u.status === 'active' ? 'ok' : 'warn'}>{u.status}</Badge></td>
						<td class="py-2 pr-4 text-right">
							{#if canManage && u.id !== data.me.user.id}
								<Button size="sm" variant="ghost" onclick={() => openEdit(u)}>Akses</Button>
								<Button size="sm" variant="ghost" onclick={() => toggle.mutate(u)}>{u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</Button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if users.data.meta && users.data.meta.total_pages > 1}
			<div class="flex items-center justify-between border-t border-border px-4 py-2">
				<span class="text-muted">{users.data.meta.total} pengguna</span>
				<div class="flex gap-2">
					<Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button>
					<Button size="sm" variant="secondary" disabled={pageNo >= users.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button>
				</div>
			</div>
		{/if}
	{/if}
</Card>

<Dialog bind:open={creating} title="Tambah pengguna" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Nama" for="n" error={errors.name}><Input id="n" bind:value={f.name} /></Field>
		<Field label="Email" for="e" error={errors.email}><Input id="e" type="email" bind:value={f.email} /></Field>
		<Field label="Password awal" for="p" error={errors.password} hint="Min. 8 karakter"><Input id="p" type="password" autocomplete="new-password" bind:value={f.password} /></Field>
		<Field label="PIN supervisor (opsional)" for="pin" error={errors.pin} hint="4–8 digit"><Input id="pin" inputmode="numeric" bind:value={f.pin} /></Field>
	</div>
	<div>
		<p class="mb-1.5 text-[13px] font-medium">Akses</p>
		{#if roles.data}<AssignmentsEditor bind:rows roles={roles.data} units={data.units} />{:else}<p class="text-muted">Anda tidak punya izin melihat daftar role.</p>{/if}
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (creating = false)}>Batal</Button>
		<Button loading={create.isPending} disabled={!f.name || !f.email || f.password.length < 8} onclick={() => create.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={editOpen} title="Akses — {editing?.name ?? ''}" wide>
	{#if roles.data}<AssignmentsEditor bind:rows={editRows} roles={roles.data} units={data.units} />{/if}
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (editOpen = false)}>Batal</Button>
		<Button loading={saveAssign.isPending} onclick={() => saveAssign.mutate()}>Simpan akses</Button>
	{/snippet}
</Dialog>
