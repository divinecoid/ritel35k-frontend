<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Printer } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import { ApiError, get, post } from '#lib/api/client';
	import { can } from '#lib/permissions';
	import { errMsg } from '#lib/utils/errors';
	import { dateTime, idr, num } from '#lib/utils/format';
	import type { Me, SaleDetail } from '#lib/types/api';

	let { saleId = $bindable(), me, storePath }: { saleId: string | null; me: Me; storePath?: string } = $props();
	const qc = useQueryClient();
	let open = $state(false);
	let mode = $state<'view' | 'void' | 'return'>('view');
	let reason = $state('');
	let method = $state('CASH');
	let qty = $state<Record<string, string>>({});
	let restock = $state<Record<string, boolean>>({});
	let approval = $state({ approver_email: '', pin: '' });
	let needsApproval = $state(false);
	let receipt = $state('');

	$effect(() => {
		if (saleId) {
			open = true;
			mode = 'view';
			reason = '';
			qty = {};
			restock = {};
			needsApproval = false;
			approval = { approver_email: '', pin: '' };
			receipt = '';
		}
	});

	const sale = createQuery(() => ({ queryKey: ['sale', saleId], enabled: !!saleId, queryFn: async () => (await get<SaleDetail>(`/pos/sales/${saleId}`)).data }));
	const canVoid = $derived(can(me.grants, 'pos.transaction.create', storePath));
	const canReturn = $derived(can(me.grants, 'pos.refund.create', storePath));

	const refresh = async () => {
		await qc.invalidateQueries({ queryKey: ['sale', saleId] });
		await qc.invalidateQueries({ queryKey: ['sales'] });
		await qc.invalidateQueries({ queryKey: ['balances'] });
	};
	const onErr = (e: unknown) => {
		if (e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') {
			needsApproval = true;
			toast.error('Butuh persetujuan: isi email dan PIN supervisor/manajer');
		} else toast.error(errMsg(e));
	};
	const appr = () => (approval.pin ? approval : undefined);

	const voidM = createMutation(() => ({
		mutationFn: () => post(`/pos/sales/${saleId}/void`, { reason, approval: appr() }),
		onSuccess: async () => { toast.ok('Transaksi di-void, stok dikembalikan'); mode = 'view'; await refresh(); },
		onError: onErr
	}));
	const retM = createMutation(() => ({
		mutationFn: () =>
			post<{ document_number: string; refund_amount: string }>(`/pos/sales/${saleId}/returns`, {
				reason,
				refund_method: method,
				approval: appr(),
				items: Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ sale_item_id: id, qty: Number(v), restock: restock[id] ?? true }))
			}),
		onSuccess: async (r) => { toast.ok(`Retur ${r.data.document_number}: refund ${idr(r.data.refund_amount)}`); mode = 'view'; await refresh(); },
		onError: onErr
	}));

	async function showReceipt() {
		const r = await fetch(`/api/pos/sales/${saleId}/receipt?format=text`);
		receipt = r.ok ? await r.text() : 'Gagal memuat struk';
		await new Promise((r) => setTimeout(r, 50));
		window.print();
	}
	const retTotal = $derived(
		(sale.data?.items ?? []).reduce((s, it) => s + (Number(qty[it.id]) > 0 ? (Number(it.line_total) * Number(qty[it.id])) / Number(it.qty) : 0), 0)
	);
</script>

<Dialog bind:open title={sale.data ? sale.data.document_number : 'Transaksi'} wide onclose={() => (saleId = null)}>
	{#if !sale.data}<p class="text-muted">Memuat…</p>
	{:else}
		{@const s = sale.data}
		<div class="flex flex-wrap items-center gap-2 text-muted">
			<Badge tone={s.status === 'completed' ? 'ok' : 'danger'}>{s.status === 'completed' ? 'Selesai' : 'VOID'}</Badge>
			<span>{dateTime(s.created_at)}</span><span>·</span><span>{s.store_name} / {s.terminal_code}</span><span>·</span><span>Kasir {s.cashier_name}</span>
			{#if s.void_reason}<span class="text-danger">· {s.void_reason}</span>{/if}
		</div>

		{#if s.customer_name}<p class="text-muted">Member: <a class="text-primary hover:underline" href="/customers/{s.customer_id}">{s.customer_name}</a> · {s.customer_member_no} · poin +{s.points_earned}{#if s.points_redeemed} / −{s.points_redeemed}{/if}</p>{/if}
		<table class="w-full text-left">
			<thead class="border-b border-border text-[12px] text-muted uppercase"><tr><th class="py-2">Barang</th><th class="text-right">Qty</th><th class="text-right">Harga</th><th class="text-right">Total</th>{#if mode === 'return'}<th class="text-right">Retur</th><th class="text-center">Kembali ke rak</th>{/if}</tr></thead>
			<tbody>
				{#each s.items as it (it.id)}
					<tr class="border-b border-border last:border-0">
						<td class="py-2">{it.product_name}<br /><span class="font-mono text-[12px] text-muted">{it.sku}</span></td>
						<td class="num text-right">{num(it.qty)}</td><td class="num text-right">{idr(it.unit_price)}</td><td class="num text-right">{idr(it.line_total)}</td>
						{#if mode === 'return'}
							<td class="text-right"><Input class="num ml-auto h-8 w-16 text-right" inputmode="decimal" placeholder="0" bind:value={qty[it.id]} aria-label="Qty retur" /></td>
							<td class="text-center"><input type="checkbox" checked={restock[it.id] ?? true} onchange={(e) => (restock[it.id] = e.currentTarget.checked)} aria-label="Kembali ke rak" /></td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>

		<dl class="ml-auto grid w-72 grid-cols-2 gap-y-1">
			<dt class="text-muted">Subtotal</dt><dd class="num text-right">{idr(s.subtotal)}</dd>
			{#if Number(s.promo_discount) > 0}<dt class="text-ok">Promo</dt><dd class="num text-right text-ok">-{idr(s.promo_discount)}</dd>{/if}
			{#if Number(s.voucher_discount) > 0}<dt class="text-ok">Voucher</dt><dd class="num text-right text-ok">-{idr(s.voucher_discount)}</dd>{/if}
			{#if Number(s.discount_total) > 0}<dt class="text-muted">Total diskon</dt><dd class="num text-right">-{idr(s.discount_total)}</dd>{/if}
			<dt class="text-muted">PPN</dt><dd class="num text-right">{idr(s.tax_total)}</dd>
			<dt class="font-semibold">Total</dt><dd class="num text-right font-semibold">{idr(s.grand_total)}</dd>
			{#each s.payments as p}<dt class="text-muted">{p.method}</dt><dd class="num text-right">{idr(p.tendered)}</dd>{/each}
			{#if Number(s.change_amount) > 0}<dt class="text-muted">Kembali</dt><dd class="num text-right">{idr(s.change_amount)}</dd>{/if}
			{#if Number(s.refunded_total) > 0}<dt class="text-warn">Sudah diretur</dt><dd class="num text-right text-warn">{idr(s.refunded_total)}</dd>{/if}
		</dl>

		{#if s.returns.length}
			<div class="rounded-md bg-surface-2 p-3 text-[13px]">
				{#each s.returns as r}<p>{r.document_number} · {idr(r.refund_amount)} via {r.refund_method} · {r.reason}</p>{/each}
			</div>
		{/if}

		{#if mode !== 'view'}
			<div class="space-y-3 rounded-md border border-border p-3">
				<Field label={mode === 'void' ? 'Alasan void' : 'Alasan retur'} for="s-why"><Input id="s-why" bind:value={reason} /></Field>
				{#if mode === 'return'}
					<Field label="Refund via" for="s-method"><Select id="s-method" bind:value={method}><option value="CASH">Tunai (dari laci shift Anda)</option><option value="QRIS">QRIS</option><option value="DEBIT">Debit</option><option value="CREDIT">Kartu kredit</option><option value="EWALLET">E-wallet</option></Select></Field>
					<p class="num font-medium">Total refund: {idr(retTotal)}</p>
				{/if}
				{#if needsApproval}
					<div class="grid grid-cols-2 gap-2 rounded-md border border-warn/40 bg-warn/10 p-2">
						<Field label="Email supervisor/manajer" for="s-ae"><Input id="s-ae" type="email" bind:value={approval.approver_email} autocomplete="off" /></Field>
						<Field label="PIN" for="s-ap"><Input id="s-ap" type="password" inputmode="numeric" bind:value={approval.pin} autocomplete="off" /></Field>
					</div>
				{/if}
			</div>
		{/if}
		<pre class="print-area hidden whitespace-pre print:block">{receipt}</pre>
	{/if}
	{#snippet footer()}
		{#if sale.data && mode === 'view'}
			<Button variant="secondary" onclick={showReceipt}><Printer class="size-4" />Cetak struk</Button>
			{#if sale.data.status === 'completed' && canReturn}<Button variant="secondary" onclick={() => (mode = 'return')}>Retur</Button>{/if}
			{#if sale.data.status === 'completed' && canVoid}<Button variant="danger" onclick={() => (mode = 'void')}>Void</Button>{/if}
		{:else if mode === 'void'}
			<Button variant="secondary" onclick={() => (mode = 'view')}>Batal</Button>
			<Button variant="danger" loading={voidM.isPending} disabled={!reason.trim()} onclick={() => voidM.mutate()}>Void transaksi</Button>
		{:else if mode === 'return'}
			<Button variant="secondary" onclick={() => (mode = 'view')}>Batal</Button>
			<Button loading={retM.isPending} disabled={!reason.trim() || retTotal <= 0} onclick={() => retM.mutate()}>Proses retur</Button>
		{/if}
	{/snippet}
</Dialog>
