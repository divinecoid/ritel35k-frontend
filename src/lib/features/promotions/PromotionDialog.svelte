<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import ProductPicker from '#lib/features/products/ProductPicker.svelte';
	import { get, post, put } from '#lib/api/client';
	import { useScope } from '#lib/scope/scope.svelte';
	import { errMsg, fieldErrors } from '#lib/utils/errors';
	import type { MembershipLevel, Named, PromoType, Promotion } from '#lib/types/api';

	let { promoId = $bindable(), creating = $bindable() }: { promoId: string | null; creating: boolean } = $props();
	const scope = useScope();
	const qc = useQueryClient();
	let open = $state(false);
	const editing = $derived(!!promoId);

	const existing = createQuery(() => ({ queryKey: ['promotion', promoId], enabled: !!promoId, queryFn: async () => (await get<Promotion>(`/promotions/${promoId}`)).data }));
	const levels = createQuery(() => ({ queryKey: ['levels'], enabled: open, queryFn: async () => (await get<MembershipLevel[]>('/membership-levels')).data }));
	const cats = createQuery(() => ({ queryKey: ['categories'], enabled: open, queryFn: async () => (await get<Named[]>('/categories')).data }));

	const blank = () => ({ code: '', name: '', description: '', type: 'percent' as PromoType, priority: 100, stackable: true, exclusive: false, status: 'active',
		percent: '10', amount: '', per: 'unit', buy_qty: '2', get_qty: '1', get_pct: '100', qty: '3', price: '', min_spend: '', th_mode: 'amount', starts: '', ends: '', days: [] as number[], tfrom: '', tto: '' });
	let f = $state(blank());
	let orgs = $state<string[]>([]);
	let lvls = $state<string[]>([]);
	let catIds = $state<string[]>([]);
	let prods = $state<{ variant_id: string; label: string }[]>([]);
	let errors = $state<Record<string, string>>({});

	const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

	$effect(() => {
		if (creating) { f = blank(); orgs = []; lvls = []; catIds = []; prods = []; errors = {}; open = true; }
	});
	$effect(() => {
		const p = existing.data;
		if (promoId && p) {
			const c = p.config as Record<string, number | string>;
			f = { code: p.code, name: p.name, description: p.description, type: p.type, priority: p.priority, stackable: p.stackable, exclusive: p.exclusive, status: p.status,
				percent: String(c.percent ?? '10'), amount: String(c.amount ?? ''), per: String(c.per ?? 'unit'), buy_qty: String(c.buy_qty ?? '2'), get_qty: String(c.get_qty ?? '1'),
				get_pct: String(c.get_discount_percent ?? '100'), qty: String(c.qty ?? '3'), price: String(c.price ?? ''), min_spend: String(c.min_spend ?? ''),
				th_mode: Number(c.percent) > 0 ? 'percent' : 'amount', starts: toLocal(p.starts_at), ends: toLocal(p.ends_at), days: p.days_of_week ?? [], tfrom: p.time_from ?? '', tto: p.time_to ?? '' };
			orgs = p.scopes?.org_unit_ids ?? []; lvls = p.scopes?.level_ids ?? []; catIds = p.scopes?.category_ids ?? [];
			prods = (p.scopes?.variant_ids ?? []).map((v) => ({ variant_id: v, label: v.slice(0, 8) }));
			errors = {};
			open = true;
		}
	});

	function config() {
		const n = (s: string) => Number(s) || 0;
		switch (f.type) {
			case 'percent': return { percent: n(f.percent) };
			case 'fixed': return { amount: n(f.amount), per: f.per };
			case 'bxgy': return { buy_qty: n(f.buy_qty), get_qty: n(f.get_qty), get_discount_percent: n(f.get_pct) };
			case 'bundle': return { qty: n(f.qty), price: n(f.price) };
			default: return { min_spend: n(f.min_spend), ...(f.th_mode === 'percent' ? { percent: n(f.percent) } : { amount: n(f.amount) }) };
		}
	}
	const iso = (s: string) => (s ? new Date(s).toISOString() : undefined);

	const m = createMutation(() => ({
		mutationFn: () => {
			const body = { code: f.code.trim(), name: f.name.trim(), description: f.description, type: f.type, config: config(), priority: Number(f.priority) || 100, stackable: f.stackable, exclusive: f.exclusive, status: f.status,
				starts_at: iso(f.starts), ends_at: iso(f.ends), days_of_week: f.days.length ? f.days : undefined, time_from: f.tfrom || undefined, time_to: f.tto || undefined,
				scopes: { org_unit_ids: orgs, level_ids: lvls, category_ids: catIds, variant_ids: prods.map((p) => p.variant_id) } };
			return editing ? put(`/promotions/${promoId}`, body) : post('/promotions', body);
		},
		onSuccess: async () => { toast.ok(editing ? 'Promosi diperbarui' : 'Promosi dibuat'); close(); await qc.invalidateQueries({ queryKey: ['promotions'] }); await qc.invalidateQueries({ queryKey: ['promotion'] }); },
		onError: (e) => { errors = fieldErrors(e); toast.error(errMsg(e)); }
	}));
	function close() { open = false; creating = false; promoId = null; }

	const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
	const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
	const units = $derived(scope.units.filter((u) => u.type !== 'company'));
	const types: [PromoType, string][] = [['percent', 'Diskon persen'], ['fixed', 'Potongan nominal'], ['bxgy', 'Beli X gratis/diskon Y'], ['bundle', 'Paket (N barang harga tetap)'], ['threshold', 'Belanja minimum dapat potongan']];
</script>

<Dialog bind:open title={editing ? `Ubah promosi — ${f.code}` : 'Promosi baru'} wide onclose={close}>
	<div class="grid grid-cols-2 gap-3">
		<Field label="Kode" for="pr-code" error={errors.code}><Input id="pr-code" bind:value={f.code} disabled={editing} placeholder="DISKON-GAJIAN" /></Field>
		<Field label="Nama (tampil di struk)" for="pr-name" error={errors.name}><Input id="pr-name" bind:value={f.name} /></Field>
		<Field label="Jenis" for="pr-type"><Select id="pr-type" bind:value={f.type} disabled={editing}>{#each types as [v, l]}<option value={v}>{l}</option>{/each}</Select></Field>
		<Field label="Prioritas" for="pr-prio" hint="Angka kecil dijalankan lebih dulu"><Input id="pr-prio" type="number" bind:value={f.priority} /></Field>
	</div>

	<div class="rounded-md border border-border p-3">
		<p class="mb-2 text-[13px] font-medium">Aturan</p>
		{#if f.type === 'percent'}<Field label="Diskon (%)" for="c-pct" error={errors.config}><Input id="c-pct" inputmode="decimal" bind:value={f.percent} /></Field>
		{:else if f.type === 'fixed'}<div class="grid grid-cols-2 gap-3"><Field label="Potongan (Rp)" for="c-amt" error={errors.config}><Input id="c-amt" inputmode="numeric" bind:value={f.amount} /></Field><Field label="Berlaku per" for="c-per"><Select id="c-per" bind:value={f.per}><option value="unit">tiap unit barang</option><option value="order">seluruh pesanan</option></Select></Field></div>
		{:else if f.type === 'bxgy'}<div class="grid grid-cols-3 gap-3"><Field label="Beli (qty)" for="c-b" error={errors.config}><Input id="c-b" inputmode="numeric" bind:value={f.buy_qty} /></Field><Field label="Dapat (qty)" for="c-g"><Input id="c-g" inputmode="numeric" bind:value={f.get_qty} /></Field><Field label="Diskon barang 'dapat' (%)" for="c-gp" hint="100 = gratis"><Input id="c-gp" inputmode="decimal" bind:value={f.get_pct} /></Field></div><p class="mt-1 text-[12px] text-muted">Barang termurah dalam kelompok yang jadi gratis.</p>
		{:else if f.type === 'bundle'}<div class="grid grid-cols-2 gap-3"><Field label="Jumlah barang per paket" for="c-q" error={errors.config}><Input id="c-q" inputmode="numeric" bind:value={f.qty} /></Field><Field label="Harga paket (Rp)" for="c-p"><Input id="c-p" inputmode="numeric" bind:value={f.price} /></Field></div>
		{:else}<div class="grid grid-cols-3 gap-3"><Field label="Minimal belanja (Rp)" for="c-ms" error={errors.config}><Input id="c-ms" inputmode="numeric" bind:value={f.min_spend} /></Field><Field label="Potongan berupa" for="c-tm"><Select id="c-tm" bind:value={f.th_mode}><option value="amount">nominal</option><option value="percent">persen</option></Select></Field>
			{#if f.th_mode === 'amount'}<Field label="Nominal (Rp)" for="c-ta"><Input id="c-ta" inputmode="numeric" bind:value={f.amount} /></Field>{:else}<Field label="Persen" for="c-tp"><Input id="c-tp" inputmode="decimal" bind:value={f.percent} /></Field>{/if}</div>{/if}
	</div>

	<div class="grid grid-cols-2 gap-3">
		<Field label="Mulai" for="pr-s"><Input id="pr-s" type="datetime-local" bind:value={f.starts} /></Field>
		<Field label="Berakhir" for="pr-e" error={errors.ends_at}><Input id="pr-e" type="datetime-local" bind:value={f.ends} /></Field>
	</div>
	<div>
		<p class="mb-1 text-[13px] font-medium">Hari berlaku <span class="font-normal text-muted">(kosong = setiap hari)</span></p>
		<div class="flex flex-wrap gap-1.5">{#each days as d, i}<button type="button" class="rounded border px-2.5 py-1 {f.days.includes(i) ? 'border-primary bg-primary text-primary-fg' : 'border-border'}" onclick={() => (f.days = toggle(f.days, i))}>{d}</button>{/each}</div>
		<div class="mt-2 grid grid-cols-2 gap-3"><Field label="Jam mulai (waktu toko)" for="pr-tf"><Input id="pr-tf" type="time" bind:value={f.tfrom} /></Field><Field label="Jam selesai" for="pr-tt" error={errors.time_from}><Input id="pr-tt" type="time" bind:value={f.tto} /></Field></div>
	</div>

	<details class="rounded-md border border-border p-3" open={orgs.length + lvls.length + catIds.length + prods.length > 0}>
		<summary class="cursor-pointer font-medium">Cakupan <span class="font-normal text-muted">(kosong = semua toko, semua barang, semua pelanggan)</span></summary>
		<div class="mt-3 space-y-3">
			<div><p class="mb-1 text-[13px] font-medium">Toko / region</p><div class="flex max-h-32 flex-wrap gap-1.5 overflow-auto">{#each units as u (u.id)}<button type="button" class="rounded border px-2 py-0.5 text-[13px] {orgs.includes(u.id) ? 'border-primary bg-primary text-primary-fg' : 'border-border'}" onclick={() => (orgs = toggle(orgs, u.id))}>{u.name}</button>{/each}</div></div>
			<div><p class="mb-1 text-[13px] font-medium">Level member</p><div class="flex flex-wrap gap-1.5">{#each levels.data ?? [] as l (l.id)}<button type="button" class="rounded border px-2 py-0.5 text-[13px] {lvls.includes(l.id) ? 'border-primary bg-primary text-primary-fg' : 'border-border'}" onclick={() => (lvls = toggle(lvls, l.id))}>{l.name}</button>{/each}</div></div>
			<div><p class="mb-1 text-[13px] font-medium">Kategori</p><div class="flex flex-wrap gap-1.5">{#each cats.data ?? [] as c (c.id)}<button type="button" class="rounded border px-2 py-0.5 text-[13px] {catIds.includes(c.id) ? 'border-primary bg-primary text-primary-fg' : 'border-border'}" onclick={() => (catIds = toggle(catIds, c.id))}>{c.name}</button>{/each}</div></div>
			<div><p class="mb-1 text-[13px] font-medium">Barang tertentu</p><ProductPicker onpick={(p) => !prods.some((x) => x.variant_id === p.variant_id) && prods.push({ variant_id: p.variant_id, label: `${p.name} (${p.sku})` })} />
				<ul class="mt-1 space-y-1">{#each prods as p, i (p.variant_id)}<li class="flex items-center justify-between rounded border border-border px-2 py-1 text-[13px]">{p.label}<button class="p-1 text-muted hover:text-danger" aria-label="Hapus" onclick={() => prods.splice(i, 1)}><Trash2 class="size-3.5" /></button></li>{/each}</ul></div>
		</div>
	</details>

	<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
		<label class="flex items-center gap-2"><input type="checkbox" bind:checked={f.stackable} />Bisa digabung dengan promo lain</label>
		<label class="flex items-center gap-2"><input type="checkbox" bind:checked={f.exclusive} />Eksklusif (pelanggan dapat yang lebih besar: ini sendiri vs semua promo digabung)</label>
		<label class="flex items-center gap-2">Status <Select class="h-8 w-32" bind:value={f.status}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></Select></label>
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={close}>Batal</Button>
		<Button loading={m.isPending} disabled={!f.code.trim() || !f.name.trim()} onclick={() => m.mutate()}>Simpan</Button>
	{/snippet}
</Dialog>
