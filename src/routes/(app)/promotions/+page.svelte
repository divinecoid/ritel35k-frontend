<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Plus } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Empty from '#lib/components/ui/Empty.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import PromotionDialog from '#lib/features/promotions/PromotionDialog.svelte';
	import { get } from '#lib/api/client';
	import { canAll } from '#lib/permissions';
	import { dateTime, idr } from '#lib/utils/format';
	import type { Promotion } from '#lib/types/api';

	let { data } = $props();
	let creating = $state(false);
	let editId = $state<string | null>(null);
	const list = createQuery(() => ({ queryKey: ['promotions'], queryFn: async () => (await get<Promotion[]>('/promotions')).data }));
	const canManage = $derived(canAll(data.me.grants, 'promotion.manage'));

	const describe = (p: Promotion) => {
		const c = p.config as Record<string, number | string>;
		switch (p.type) {
			case 'percent': return `Diskon ${c.percent}%`;
			case 'fixed': return `Potongan ${idr(Number(c.amount))} ${c.per === 'order' ? 'per pesanan' : 'per unit'}`;
			case 'bxgy': return `Beli ${c.buy_qty} dapat ${c.get_qty}${Number(c.get_discount_percent) && Number(c.get_discount_percent) < 100 ? ` (diskon ${c.get_discount_percent}%)` : ' gratis'}`;
			case 'bundle': return `${c.qty} barang ${idr(Number(c.price))}`;
			default: return `Belanja ≥ ${idr(Number(c.min_spend))} potongan ${Number(c.percent) > 0 ? c.percent + '%' : idr(Number(c.amount))}`;
		}
	};
	const window = (p: Promotion) => (p.starts_at || p.ends_at ? `${p.starts_at ? dateTime(p.starts_at) : '…'} → ${p.ends_at ? dateTime(p.ends_at) : '…'}` : 'Tanpa batas');
</script>

<PageHeader title="Promosi" description="Diterapkan otomatis di kasir oleh mesin promosi — urutan, gabung/eksklusif, dan cakupan dikelola di sini">
	{#snippet actions()}{#if canManage}<Button onclick={() => (creating = true)}><Plus class="size-4" />Promosi baru</Button>{/if}{/snippet}
</PageHeader>

<Card>
	{#if list.isPending}<Empty title="Memuat…" />
	{:else if list.isError}<Empty title="Gagal memuat" hint={list.error.message} />
	{:else if !list.data.length}<Empty title="Belum ada promosi" hint="Contoh: Beli 2 Gratis 1 untuk kategori sepatu, atau diskon 15% khusus member Gold." />
	{:else}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="px-4 py-2.5">Promosi</th><th>Aturan</th><th>Periode</th><th>Gabung</th><th>Prio</th><th class="pr-4">Status</th></tr></thead>
			<tbody>
				{#each list.data as p (p.id)}
					<tr class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60" onclick={() => canManage && (editId = p.id)}>
						<td class="px-4 py-2.5"><p class="font-medium">{p.name}</p><p class="font-mono text-[12px] text-muted">{p.code}</p></td>
						<td>{describe(p)}</td><td class="text-[13px] text-muted">{window(p)}</td>
						<td>{#if p.exclusive}<Badge tone="warn">eksklusif</Badge>{:else if p.stackable}<Badge>bisa digabung</Badge>{:else}<Badge tone="info">tidak digabung</Badge>{/if}</td>
						<td class="num text-muted">{p.priority}</td><td class="pr-4"><Badge tone={p.status === 'active' ? 'ok' : 'warn'}>{p.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<PromotionDialog bind:promoId={editId} bind:creating />
