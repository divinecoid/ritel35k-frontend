<script lang="ts">
	import { UserPlus } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { get, post } from '#lib/api/client';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import { num } from '#lib/utils/format';
	import type { Customer } from '#lib/types/api';
	import type { PosCustomer } from './pos.svelte';

	let { open = $bindable(), canRegister = false, onpick }: { open: boolean; canRegister?: boolean; onpick: (c: PosCustomer) => void } = $props();
	let q = $state('');
	let results = $state<Customer[]>([]);
	let registering = $state(false);
	let f = $state({ name: '', phone: '' });
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	let inputEl: HTMLInputElement | undefined = $state();
	$effect(() => { if (open) { q = ''; results = []; registering = false; errors = {}; setTimeout(() => inputEl?.focus(), 50); } });

	function search() {
		clearTimeout(timer);
		if (q.trim().length < 3) return (results = []);
		timer = setTimeout(async () => {
			results = (await get<Customer[]>('/customers', { q: q.trim(), status: 'active', per_page: 6 }).catch(() => ({ data: [] as Customer[] }))).data;
		}, 200);
	}
	const pick = (c: Customer) => { onpick({ id: c.id, member_no: c.member_no, name: c.name, phone: c.phone, level_name: c.level_name, points_balance: c.points_balance }); open = false; };

	async function register() {
		busy = true;
		try {
			const c = (await post<Customer>('/customers', f)).data;
			toast.ok(`Member ${c.member_no} terdaftar`);
			onpick({ id: c.id, member_no: c.member_no, name: c.name, phone: c.phone, level_name: 'Regular', points_balance: 0 });
			open = false;
			f = { name: '', phone: '' };
		} catch (e) {
			errors = fieldErrors(e);
			toast.error(errMsg(e));
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={registering ? 'Daftarkan member baru' : 'Pilih pelanggan'}>
	{#if !registering}
		<input bind:this={inputEl} class="h-9 w-full rounded-md border border-border bg-surface px-3 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary" placeholder="No. HP, no. member, atau nama" bind:value={q} oninput={search} autocomplete="off" aria-label="Cari pelanggan" />
		<ul class="divide-y divide-border rounded-md border border-border">
			{#each results as c (c.id)}
				<li><button class="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-2" onclick={() => pick(c)}>
					<span><span class="font-medium">{c.name}</span><br /><span class="text-[12px] text-muted">{c.member_no} · {c.phone}</span></span>
					<span class="text-right"><span class="text-[12px] text-primary">{c.level_name}</span><br /><span class="num text-[12px] text-muted">{num(c.points_balance)} poin</span></span>
				</button></li>
			{:else}
				<li class="px-3 py-6 text-center text-muted">{q.trim().length < 3 ? 'Ketik minimal 3 karakter' : 'Tidak ditemukan'}</li>
			{/each}
		</ul>
	{:else}
		<Field label="Nama" for="cu-name" error={errors.name}><Input id="cu-name" bind:value={f.name} /></Field>
		<Field label="No. HP" for="cu-phone" error={errors.phone} hint="Dipakai untuk mencari member di kasir"><Input id="cu-phone" inputmode="tel" bind:value={f.phone} /></Field>
	{/if}
	{#snippet footer()}
		{#if registering}
			<Button variant="secondary" onclick={() => (registering = false)}>Kembali</Button>
			<Button loading={busy} disabled={!f.name.trim() || f.phone.replace(/\D/g, '').length < 8} onclick={register}>Daftar & pilih</Button>
		{:else}
			{#if canRegister}<Button variant="secondary" onclick={() => { registering = true; f.phone = /^[\d+\s-]{8,}$/.test(q) ? q : ''; }}><UserPlus class="size-4" />Member baru</Button>{/if}
			<Button variant="secondary" onclick={() => (open = false)}>Tutup</Button>
		{/if}
	{/snippet}
</Dialog>
