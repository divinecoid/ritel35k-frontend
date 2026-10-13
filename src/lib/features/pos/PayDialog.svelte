<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { ApiError } from '#lib/api/client';
	import { idr } from '#lib/utils/format';
	import type { OfflineSaleDetail, PayLine, PosState } from './pos.svelte';

	let { pos, open = $bindable(), oncomplete }: { pos: PosState; open: boolean; oncomplete: (s: OfflineSaleDetail) => void } = $props();

	let points = $state(0);
	const maxPts = $derived(pos.quote?.max_redeem_points ?? 0);
	const redeemValue = $derived(Number(pos.quote?.redeem_value ?? 0));
	const pointsValue = $derived(points * redeemValue);
	const total = $derived(Math.max(0, pos.grandTotal - pointsValue)); // what is left to pay in money
	const methods = $derived(pos.quote?.payment_methods ?? ['CASH']);
	let lines = $state<PayLine[]>([{ method: 'CASH', amount: '', reference: '' }]);
	let approver = $state({ approver_email: '', pin: '' });
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if (open) {
			points = 0;
			lines = [{ method: 'CASH', amount: String(pos.grandTotal), reference: '' }];
			approver = { approver_email: '', pin: '' };
			error = '';
		}
	});

	const tendered = $derived(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
	const nonCash = $derived(lines.filter((l) => l.method !== 'CASH').reduce((s, l) => s + (Number(l.amount) || 0), 0));
	const cashTendered = $derived(tendered - nonCash);
	const remaining = $derived(Math.max(0, total - nonCash));
	const change = $derived(Math.max(0, cashTendered - remaining));
	const short = $derived(Math.max(0, remaining - cashTendered));
	// keep the single default cash line equal to what is left when points are applied
	$effect(() => {
		if (open && lines.length === 1 && lines[0].method === 'CASH' && Number(lines[0].amount) <= pos.grandTotal) lines[0].amount = String(total);
	});
	const valid = $derived(pos.grandTotal > 0 && (total === 0 ? true : short === 0 && nonCash <= total && lines.every((l) => Number(l.amount) > 0)));
	const quick = $derived([...new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])].filter((v) => v >= total));

	async function pay() {
		busy = true;
		error = '';
		try {
			const sale = await pos.checkout(total > 0 ? lines : [], pos.quote?.approval_required && !pos.useEdge ? approver : undefined, points);
			open = false;
			oncomplete(sale);
		} catch (e) {
			if (e instanceof ApiError) {
				const d = e.details as Record<string, string> | undefined;
				error =
					e.code === 'INSUFFICIENT_STOCK'
						? `Stok tidak cukup (tersedia ${d?.available ?? '?'}). Kurangi jumlah atau hubungi manajer.`
						: e.code === 'APPROVAL_DENIED'
							? 'PIN atau email supervisor salah / tidak berwenang.'
							: e.code === 'SHIFT_REQUIRED'
								? 'Shift Anda sudah tertutup. Buka shift lagi.'
								: e.message;
				if (e.code === 'SHIFT_REQUIRED') void pos.loadShift();
			} else error = e instanceof Error && e.message && !(e instanceof TypeError) ? e.message : 'Gagal menyimpan transaksi. Coba lagi — transaksi yang sama tidak akan tercatat dua kali.';
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title="Pembayaran" wide>
	<div class="flex items-baseline justify-between rounded-md bg-surface-2 px-4 py-3">
		<span class="text-muted">{points > 0 ? `Sisa dibayar (poin −${idr(pointsValue)})` : 'Total tagihan'}</span>
		<span class="num text-3xl font-semibold">{idr(total)}</span>
	</div>

	{#if pos.useEdge}
		<p class="rounded-md bg-warn/10 px-3 py-2 text-warn">Mode offline — struk memakai nomor sementara; nomor resmi menyusul saat sinkron.</p>
	{:else if pos.quote?.customer && maxPts > 0}
		<div class="flex items-center justify-between gap-3 rounded-md border border-border p-3">
			<div><p class="font-medium">Pakai poin {pos.quote.customer.name}</p><p class="text-[12px] text-muted">Saldo {pos.quote.customer.points_balance} poin · maks {maxPts} poin ({idr(maxPts * redeemValue)}) · 1 poin = {idr(redeemValue)}</p></div>
			<div class="flex items-center gap-2"><Input class="num h-8 w-24 text-right" inputmode="numeric" value={points || ''} placeholder="0" aria-label="Poin dipakai" onchange={(e) => (points = Math.max(0, Math.min(maxPts, Number(e.currentTarget.value) || 0)))} />
				<Button size="sm" variant="secondary" onclick={() => (points = maxPts)}>Maks</Button></div>
		</div>
		{#if points > 0 && points < (pos.quote.min_redeem_points ?? 0)}<p class="text-[12px] text-danger">Minimal penukaran {pos.quote.min_redeem_points} poin</p>{/if}
	{/if}

	<div class="space-y-2">
		{#each lines as l, i}
			<div class="grid grid-cols-[130px_1fr_1fr_auto] items-center gap-2">
				<Select bind:value={l.method} aria-label="Metode">{#each methods as m}<option value={m}>{m}</option>{/each}</Select>
				<Input inputmode="numeric" bind:value={l.amount} aria-label="Jumlah" placeholder="Jumlah" class="num text-right" />
				{#if l.method !== 'CASH'}<Input bind:value={l.reference} placeholder="Ref / no. kartu" aria-label="Referensi" />{:else}<span></span>{/if}
				<button class="rounded p-2 text-muted hover:text-danger disabled:opacity-30" disabled={lines.length === 1} aria-label="Hapus" onclick={() => lines.splice(i, 1)}><Trash2 class="size-4" /></button>
			</div>
		{/each}
		<div class="flex flex-wrap items-center gap-2">
			<Button size="sm" variant="secondary" onclick={() => lines.push({ method: methods.find((m) => m !== 'CASH') ?? 'CASH', amount: String(Math.max(0, remaining - cashTendered)), reference: '' })}><Plus class="size-3.5" />Pisah pembayaran</Button>
			<span class="text-muted">Tunai cepat:</span>
			{#each quick as q}<Button size="sm" variant="ghost" onclick={() => { lines = [{ method: 'CASH', amount: String(q), reference: '' }]; }}>{q === total ? 'Uang pas' : idr(q)}</Button>{/each}
		</div>
	</div>

	<div class="grid grid-cols-3 gap-3 text-center">
		<div class="rounded-md border border-border p-2"><p class="text-muted">Diterima</p><p class="num text-lg font-semibold">{idr(tendered)}</p></div>
		<div class="rounded-md border border-border p-2 {short > 0 ? 'border-danger/50' : ''}"><p class="text-muted">Kurang</p><p class="num text-lg font-semibold {short > 0 ? 'text-danger' : ''}">{idr(short)}</p></div>
		<div class="rounded-md border border-border p-2 {change > 0 ? 'border-ok/50' : ''}"><p class="text-muted">Kembalian</p><p class="num text-lg font-semibold {change > 0 ? 'text-ok' : ''}">{idr(change)}</p></div>
	</div>

	{#if pos.quote?.approval_required && !pos.useEdge}
		<div class="space-y-2 rounded-md border border-warn/40 bg-warn/10 p-3">
			<p class="font-medium text-warn">Diskon melebihi batas {pos.quote.max_discount_percent}% — butuh persetujuan supervisor</p>
			<div class="grid grid-cols-2 gap-2">
				<Field label="Email supervisor" for="ap-e"><Input id="ap-e" type="email" bind:value={approver.approver_email} autocomplete="off" /></Field>
				<Field label="PIN" for="ap-p"><Input id="ap-p" type="password" inputmode="numeric" bind:value={approver.pin} autocomplete="off" /></Field>
			</div>
		</div>
	{/if}
	{#if error}<p class="text-danger" role="alert">{error}</p>{/if}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)}>Batal</Button>
		<Button loading={busy} disabled={!valid || (points > 0 && points < (pos.quote?.min_redeem_points ?? 0)) || (pos.quote?.approval_required && (pos.useEdge || !approver.pin || !approver.approver_email))} onclick={pay}>Bayar {idr(total)}</Button>
	{/snippet}
</Dialog>
