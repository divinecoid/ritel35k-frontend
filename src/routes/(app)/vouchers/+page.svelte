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
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, patch, post } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { date, idr } from '#lib/utils/format';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { Voucher } from '#lib/types/api';

	let { data } = $props();
	const qc = useQueryClient();
	const canManage = $derived(canAll(data.me.grants, 'promotion.manage'));
	let search = $state('');
	let status = $state('');
	let pageNo = $state(1);
	let creating = $state(false);
	let created = $state<Voucher[]>([]);
	let errors = $state<Record<string, string>>({});

	const list = createQuery(() => ({ queryKey: ['vouchers', search, status, pageNo], queryFn: () => get<Voucher[]>('/vouchers', { q: search, status, page: pageNo, per_page: 30 }) }));
	const blank = () => ({ code: '', count: '1', kind: 'fixed', value: '', min_spend: '', max_discount: '', max_uses: '1', valid_to: '', batch: '' });
	let f = $state(blank());

	const create = createMutation(() => ({
		mutationFn: () => post<Voucher[]>('/vouchers', {
			code: f.code.trim() || undefined, count: Number(f.count) || 1, kind: f.kind, value: Number(f.value), min_spend: Number(f.min_spend) || 0,
			max_discount: f.kind === 'percent' && f.max_discount ? Number(f.max_discount) : undefined, max_uses: f.max_uses ? Number(f.max_uses) : undefined,
			valid_to: f.valid_to ? new Date(f.valid_to + 'T23:59:59').toISOString() : undefined, batch: f.batch
		}),
		onSuccess: async (r) => { created = r.data; creating = false; f = blank(); errors = {}; toast.ok(`${r.data.length} voucher dibuat`); await qc.invalidateQueries({ queryKey: ['vouchers'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
	const toggle = createMutation(() => ({
		mutationFn: (v: Voucher) => patch(`/vouchers/${v.id}`, { status: v.status === 'active' ? 'inactive' : 'active' }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] }), onError: (e) => toast.error(errMsg(e))
	}));
	const val = (v: Voucher) => (v.kind === 'fixed' ? idr(v.value) : `${Number(v.value)}%${v.max_discount ? ` (maks ${idr(v.max_discount)})` : ''}`);
	let createdOpen = $state(false);
	$effect(() => { createdOpen = created.length > 0; });
</script>

<PageHeader title="Voucher" description="Kode diskon sekali/beberapa kali pakai — pemakaian diklaim atomik sehingga tidak bisa melebihi kuota">
	{#snippet actions()}
		<Input class="w-52" placeholder="Cari kode / batch" bind:value={search} oninput={() => (pageNo = 1)} />
		<Select class="w-36" bind:value={status} onchange={() => (pageNo = 1)}><option value="">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></Select>
		{#if canManage}<Button onclick={() => (creating = true)}><Plus class="size-4" />Buat voucher</Button>{/if}
	{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
	{:else if !list.data.data.length}<Empty title="Belum ada voucher" />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Kode</th><th>Nilai</th><th>Min. belanja</th><th>Pemakaian</th><th>Berlaku s/d</th><th>Batch</th><th class="pr-4">Status</th></tr></thead>
			<tbody>
				{#each list.data.data as v (v.id)}
					<tr class="border-b border-border last:border-0">
						<td class="px-4 py-2.5 font-mono text-[13px] font-medium">{v.code}{#if v.customer_name} <Badge tone="info">{v.customer_name}</Badge>{/if}</td>
						<td class="num">{val(v)}</td><td class="num text-muted">{Number(v.min_spend) ? idr(v.min_spend) : '—'}</td>
						<td class="num">{v.used_count}{v.max_uses ? ` / ${v.max_uses}` : ' / ∞'}</td><td class="text-muted">{date(v.valid_to)}</td><td class="text-muted">{v.batch || '—'}</td>
						<td class="pr-4">{#if canManage}<button class="rounded" onclick={() => toggle.mutate(v)} title="Klik untuk mengubah"><Badge tone={v.status === 'active' ? 'ok' : 'warn'}>{v.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></button>{:else}<Badge tone={v.status === 'active' ? 'ok' : 'warn'}>{v.status}</Badge>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if list.data.meta && list.data.meta.total_pages > 1}
			<div class="flex items-center justify-between border-t border-border px-4 py-2"><span class="text-muted">{list.data.meta.total} voucher</span>
				<div class="flex gap-2"><Button size="sm" variant="secondary" disabled={pageNo <= 1} onclick={() => pageNo--}>Sebelumnya</Button><Button size="sm" variant="secondary" disabled={pageNo >= list.data.meta.total_pages} onclick={() => pageNo++}>Berikutnya</Button></div></div>
		{/if}
	{/if}
</Card>

<Dialog bind:open={creating} title="Buat voucher" wide>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Jenis" for="v-kind"><Select id="v-kind" bind:value={f.kind}><option value="fixed">Potongan nominal (Rp)</option><option value="percent">Persen (%)</option></Select></Field>
		<Field label={f.kind === 'fixed' ? 'Nilai (Rp)' : 'Persen'} for="v-val" error={errors.value}><Input id="v-val" inputmode="decimal" bind:value={f.value} /></Field>
		<Field label="Minimal belanja (Rp)" for="v-min"><Input id="v-min" inputmode="numeric" bind:value={f.min_spend} /></Field>
		{#if f.kind === 'percent'}<Field label="Maksimal potongan (Rp)" for="v-max"><Input id="v-max" inputmode="numeric" bind:value={f.max_discount} /></Field>{:else}<span></span>{/if}
		<Field label="Kuota pakai per voucher" for="v-uses" hint="Kosong = tanpa batas"><Input id="v-uses" inputmode="numeric" bind:value={f.max_uses} /></Field>
		<Field label="Berlaku sampai" for="v-to"><Input id="v-to" type="date" bind:value={f.valid_to} /></Field>
		<Field label="Jumlah voucher (kode acak)" for="v-count" hint="1–500" error={errors.count}><Input id="v-count" inputmode="numeric" bind:value={f.count} /></Field>
		<Field label="Kode khusus (jika 1 voucher)" for="v-code" error={errors.code}><Input id="v-code" bind:value={f.code} placeholder="HEMAT10" disabled={Number(f.count) > 1} /></Field>
		<Field label="Nama batch" for="v-batch"><Input id="v-batch" bind:value={f.batch} placeholder="Gajian Oktober" /></Field>
	</div>
	{#snippet footer()}<Button variant="secondary" onclick={() => (creating = false)}>Batal</Button><Button loading={create.isPending} disabled={!Number(f.value)} onclick={() => create.mutate()}>Buat</Button>{/snippet}
</Dialog>

<Dialog bind:open={createdOpen} title="Voucher dibuat" onclose={() => (created = [])}>
	<p class="text-muted">Salin kode ini sekarang atau lihat lagi di daftar voucher.</p>
	<textarea readonly class="h-48 w-full rounded-md border border-border bg-surface p-2 font-mono text-[13px]" value={created.map((v) => v.code).join('\n')}></textarea>
	{#snippet footer()}<Button variant="secondary" onclick={() => navigator.clipboard?.writeText(created.map((v) => v.code).join('\n')).then(() => toast.ok('Disalin'))}>Salin semua</Button><Button onclick={() => (createdOpen = false)}>Selesai</Button>{/snippet}
</Dialog>
