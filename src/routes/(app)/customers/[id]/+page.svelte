<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, patch, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { date, dateTime, idr, num } from '#lib/utils/format';
	import { errMsg } from '#lib/utils/errors';
	import type { CustomerDetail, MembershipLevel } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const id = $derived(page.params.id);
	const q = createQuery(() => ({ queryKey: ['customer', id], queryFn: async () => (await get<CustomerDetail>(`/customers/${id}`)).data }));
	const levels = createQuery(() => ({ queryKey: ['levels'], queryFn: async () => (await get<MembershipLevel[]>('/membership-levels')).data }));
	const c = $derived(q.data);
	const canManage = $derived(can(data.me.grants, 'customer.manage'));
	const refresh = () => qc.invalidateQueries({ queryKey: ['customer', id] });

	let adjOpen = $state(false);
	let pts = $state('');
	let note = $state('');
	const adjust = createMutation(() => ({
		mutationFn: () => post(`/customers/${id}/points`, { points: Number(pts), note }),
		onSuccess: async () => { toast.ok('Poin disesuaikan'); adjOpen = false; pts = note = ''; await refresh(); },
		onError: (e) => toast.error(errMsg(e))
	}));
	const setLevel = createMutation(() => ({ mutationFn: (levelId: string) => patch(`/customers/${id}`, { level_id: levelId }), onSuccess: refresh, onError: (e) => toast.error(errMsg(e)) }));
	const toggle = createMutation(() => ({ mutationFn: () => patch(`/customers/${id}`, { status: c?.status === 'active' ? 'inactive' : 'active' }), onSuccess: refresh }));
	const kind: Record<string, string> = { earn: 'Dapat poin', redeem: 'Tukar poin', adjust: 'Penyesuaian', reverse_earn: 'Poin dibatalkan', restore_redeem: 'Poin dikembalikan', expire: 'Kedaluwarsa' };
</script>

{#if !c}<p class="text-muted">Memuat…</p>
{:else}
	<PageHeader title={c.name} description="{c.member_no} · {c.phone}{c.email ? ' · ' + c.email : ''}">
		{#snippet actions()}
			<Badge tone="info">{c.level_name}</Badge>{#if c.status !== 'active'}<Badge tone="warn">nonaktif</Badge>{/if}
			{#if canManage}<Button variant="secondary" onclick={() => (adjOpen = true)}>Sesuaikan poin</Button><Button variant="ghost" onclick={() => toggle.mutate()}>{c.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</Button>{/if}
		{/snippet}
	</PageHeader>

	<div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
		<Card class="p-4"><p class="text-muted">Saldo poin</p><p class="num text-2xl font-semibold">{num(c.points_balance)}</p></Card>
		<Card class="p-4"><p class="text-muted">Total belanja</p><p class="num text-2xl font-semibold">{idr(c.lifetime_spend)}</p></Card>
		<Card class="p-4"><p class="text-muted">Belanja terakhir</p><p class="text-lg font-semibold">{date(c.last_purchase_at)}</p></Card>
		<Card class="p-4"><p class="text-muted">Level berikutnya</p>{#if c.next_level}<p class="text-lg font-semibold">{c.next_level.name}</p><p class="text-[12px] text-muted">kurang {idr(c.next_level.remaining)}</p>{:else}<p class="text-lg font-semibold">Level tertinggi</p>{/if}</Card>
	</div>

	{#if canManage}
		<div class="mb-5 max-w-xs"><Field label="Level (manual)" for="lv"><Select id="lv" value={c.level_id} onchange={(e) => setLevel.mutate(e.currentTarget.value)}>{#each levels.data ?? [] as l (l.id)}<option value={l.id}>{l.name}</option>{/each}</Select></Field></div>
	{/if}

	<div class="grid gap-5 lg:grid-cols-2">
		<Card>
			<h2 class="border-b border-border px-4 py-2.5 font-semibold">Riwayat poin</h2>
			<ul class="divide-y divide-border">
				{#each c.ledger as l (l.id)}
					<li class="flex items-center justify-between px-4 py-2"><span>{kind[l.kind] ?? l.kind}<br /><span class="text-[12px] text-muted">{dateTime(l.created_at)}{l.note ? ' · ' + l.note : ''}</span></span>
						<span class="num text-right"><b class={l.points < 0 ? 'text-danger' : 'text-ok'}>{l.points > 0 ? '+' : ''}{num(l.points)}</b><br /><span class="text-[12px] text-muted">saldo {num(l.balance_after)}</span></span></li>
				{:else}<li class="px-4 py-6 text-center text-muted">Belum ada transaksi poin</li>{/each}
			</ul>
		</Card>
		<Card>
			<h2 class="border-b border-border px-4 py-2.5 font-semibold">Transaksi terakhir</h2>
			<ul class="divide-y divide-border">
				{#each c.sales as s (s.id)}
					<li class="flex items-center justify-between px-4 py-2"><span class="font-mono text-[13px]">{s.document_number}<br /><span class="font-sans text-[12px] text-muted">{s.store_name} · {dateTime(s.created_at)}</span></span>
						<span class="num text-right">{idr(s.grand_total)}{#if s.status === 'voided'} <Badge tone="danger">void</Badge>{/if}<br /><span class="text-[12px] text-muted">+{s.points_earned}{#if s.points_redeemed} / −{s.points_redeemed}{/if} poin</span></span></li>
				{:else}<li class="px-4 py-6 text-center text-muted">Belum ada transaksi</li>{/each}
			</ul>
		</Card>
	</div>
{/if}

<Dialog bind:open={adjOpen} title="Sesuaikan poin">
	<Field label="Poin (+ tambah, − kurangi)" for="a-pts"><Input id="a-pts" inputmode="numeric" bind:value={pts} placeholder="50 atau -20" /></Field>
	<Field label="Alasan" for="a-note"><Input id="a-note" bind:value={note} placeholder="kompensasi, koreksi…" /></Field>
	{#snippet footer()}<Button variant="secondary" onclick={() => (adjOpen = false)}>Batal</Button><Button loading={adjust.isPending} disabled={!Number(pts) || !note.trim()} onclick={() => adjust.mutate()}>Simpan</Button>{/snippet}
</Dialog>
