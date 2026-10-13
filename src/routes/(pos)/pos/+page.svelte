<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { Banknote, BadgePercent, Clock, Ticket, UserRound, LogOut, Minus, PauseCircle, Plus, Printer, ScanBarcode, Search, Trash2, Wallet, X } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { toast } from '#lib/components/ui/toast.svelte';
	import PayDialog from '#lib/features/pos/PayDialog.svelte';
	import ReceiptDialog from '#lib/features/pos/ReceiptDialog.svelte';
	import ShiftDialogs from '#lib/features/pos/ShiftDialogs.svelte';
	import DevicesDialog from '#lib/features/pos/DevicesDialog.svelte';
	import CustomerDialog from '#lib/features/pos/CustomerDialog.svelte';
	import { can } from '#lib/permissions';
	import ShiftGate from '#lib/features/pos/ShiftGate.svelte';
	import { PosState } from '#lib/features/pos/pos.svelte';
	import { get } from '#lib/api/client';
	import { errMsg } from '#lib/utils/errors';
	import { dateTime, idr, num } from '#lib/utils/format';
	import type { Product, SaleDetail } from '#lib/types/api';

	let { data } = $props();
	const pos = new PosState(untrack(() => data.terminals));

	let scan = $state('');
	let scanEl: HTMLInputElement | undefined = $state();
	let results = $state<Product[]>([]);
	let searching = $state(false);
	let payOpen = $state(false);
	let cashOpen = $state(false);
	let closeOpen = $state(false);
	let heldOpen = $state(false);
	let devicesOpen = $state(false);
	let customerOpen = $state(false);
	let voucherInput = $state('');
	let showVoucher = $state(false);
	let receiptId = $state<string | null>(null);
	let lastSale = $state<SaleDetail | null>(null);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		void pos.loadShift();
		const key = (e: KeyboardEvent) => {
			if (e.key === 'F2') (e.preventDefault(), scanEl?.focus());
			else if (e.key === 'F8') (e.preventDefault(), pos.hold());
			else if (e.key === 'F9') (e.preventDefault(), (heldOpen = true));
			else if (e.key === 'F12' && pos.items.length && !payOpen) (e.preventDefault(), (payOpen = true));
		};
		window.addEventListener('keydown', key);
		return () => window.removeEventListener('keydown', key);
	});

	$effect(() => {
		scanEl?.focus(); // (re)focus whenever the scan field appears, e.g. right after opening a shift
	});

	const focusScan = () => tick().then(() => scanEl?.focus());

	async function submitScan() {
		const code = scan.trim();
		if (!code) return;
		// A pick from the suggestions wins; otherwise the text is a barcode (scanners type fast and press Enter).
		scan = '';
		results = [];
		try {
			// 16+ hex digits is a tag (EPC), which no barcode is: the same scan field accepts both
			await pos.add(/^[0-9a-fA-F]{16,64}$/.test(code) ? { epc: code } : { barcode: code });
		} catch (e) {
			toast.error(errMsg(e));
		}
		void focusScan();
	}

	function onInput() {
		clearTimeout(searchTimer);
		const q = scan.trim();
		if (q.length < 2 || /^\d{8,}$/.test(q)) {
			results = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			searching = true;
			try {
				results = (await get<Product[]>('/products', { q, per_page: 8, status: 'active' })).data;
			} catch {
				results = [];
			} finally {
				searching = false;
			}
		}, 180);
	}

	async function pick(variantId: string) {
		scan = '';
		results = [];
		try {
			await pos.add({ variant_id: variantId });
		} catch (e) {
			toast.error(errMsg(e));
		}
		void focusScan();
	}

	function completed(s: SaleDetail) {
		voucherInput = '';
		showVoucher = false;
		lastSale = s;
		receiptId = s.id;
	}

	async function applyVoucher() {
		try {
			await pos.applyVoucher(voucherInput);
			if (!voucherInput) showVoucher = false;
			toast.ok(voucherInput ? `Voucher ${voucherInput.toUpperCase()} dipakai` : 'Voucher dilepas');
		} catch (e) {
			toast.error(errMsg(e));
		}
	}

	const hasCash = $derived(!!lastSale?.payments.some((p) => p.method === 'CASH'));
	const lineOf = (i: number) => pos.quote?.lines[i];
</script>

<svelte:head><title>Kasir — RITEL35K</title></svelte:head>

<header class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
	<div class="flex items-center gap-4">
		<span class="font-bold tracking-tight">RITEL<span class="text-primary">35K</span></span>
		<span class="text-muted">{pos.terminal?.store_name ?? ''} · {pos.terminal?.code ?? ''}</span>
		{#if pos.shift}<span class="flex items-center gap-1 text-ok"><Clock class="size-3.5" />Shift sejak {dateTime(pos.shift.opened_at)}</span>{/if}
	</div>
	<div class="flex items-center gap-1">
		{#if pos.shift}
			<Button size="sm" variant="ghost" onclick={() => (cashOpen = true)}><Banknote class="size-4" />Kas</Button>
			<Button size="sm" variant="ghost" onclick={() => (closeOpen = true)}><Wallet class="size-4" />Tutup shift</Button>
		{/if}
		<Button size="sm" variant="ghost" onclick={() => (devicesOpen = true)}><Printer class="size-4" />Perangkat</Button>
		<a href="/dashboard" class="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[13px] hover:bg-surface-2"><LogOut class="size-4" />Back office</a>
	</div>
</header>

{#if pos.loadingShift}
	<div class="grid flex-1 place-items-center text-muted">Memuat…</div>
{:else if !pos.shift}
	<ShiftGate {pos} />
{:else}
	<div class="grid min-h-0 flex-1 grid-cols-[1fr_440px]">
		<!-- scan / search -->
		<section class="flex min-h-0 flex-col gap-3 p-4">
			<form class="relative" onsubmit={(e) => { e.preventDefault(); submitScan(); }}>
				<ScanBarcode class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
				<input
					bind:this={scanEl}
					bind:value={scan}
					oninput={onInput}
					autocomplete="off"
					inputmode="search"
					placeholder="Scan barcode / tag RFID atau ketik nama produk…  (F2)"
					aria-label="Scan atau cari produk"
					class="h-12 w-full rounded-lg border-2 border-border bg-surface pr-4 pl-11 text-base focus:border-primary focus:outline-none"
				/>
			</form>
			{#if results.length}
				<ul class="divide-y divide-border overflow-auto rounded-lg border border-border bg-surface">
					{#each results as p (p.id)}
						{#each p.variants as v (v.id)}
							<li>
								<button class="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-surface-2" onclick={() => pick(v.id)}>
									<span><span class="font-medium">{p.name}</span> <span class="text-muted">{v.name}</span><br /><span class="font-mono text-[12px] text-muted">{v.sku} · {v.barcodes[0]?.barcode ?? '—'}</span></span>
									<Plus class="size-4 text-primary" />
								</button>
							</li>
						{/each}
					{/each}
				</ul>
			{:else if searching}
				<p class="text-muted"><Search class="mr-1 inline size-4" />Mencari…</p>
			{:else}
				<div class="grid flex-1 place-items-center rounded-lg border border-dashed border-border text-center text-muted">
					<div>
						<ScanBarcode class="mx-auto mb-2 size-10 opacity-40" />
						<p>Scan barang untuk menambah ke keranjang</p>
						<p class="mt-3 text-[12px]">F2 fokus scan · F8 tahan · F9 ambil tahanan · F12 bayar</p>
					</div>
				</div>
			{/if}
		</section>

		<!-- cart -->
		<aside class="flex min-h-0 flex-col border-l border-border bg-surface">
			<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
				<h2 class="font-semibold">Keranjang <span class="font-normal text-muted">({num(pos.itemCount)} item)</span></h2>
				<div class="flex gap-1">
					<Button size="sm" variant="ghost" disabled={!pos.items.length} onclick={() => pos.hold()}><PauseCircle class="size-4" />Tahan</Button>
					<Button size="sm" variant="ghost" onclick={() => (heldOpen = true)}>Tahanan{pos.held.length ? ` (${pos.held.length})` : ''}</Button>
				</div>
			</div>

			<div class="flex items-center justify-between gap-2 border-b border-border bg-surface-2/40 px-4 py-2">
				{#if pos.customer}
					<div class="min-w-0 leading-tight"><p class="truncate font-medium">{pos.customer.name}</p><p class="text-[12px] text-muted">{pos.customer.level_name} · <span class="num">{num(pos.customer.points_balance)}</span> poin{#if pos.quote && pos.quote.points_earn > 0} · <span class="text-ok">+{pos.quote.points_earn}</span>{/if}</p></div>
					<Button size="sm" variant="ghost" onclick={() => pos.setCustomer(null).catch((e) => toast.error(errMsg(e)))}><X class="size-4" /></Button>
				{:else}
					<Button size="sm" variant="secondary" onclick={() => (customerOpen = true)}><UserRound class="size-4" />Pelanggan / member</Button>
				{/if}
				{#if pos.voucherCode}
					<span class="inline-flex items-center gap-1 rounded bg-ok/15 px-2 py-1 text-[12px] font-medium text-ok"><Ticket class="size-3.5" />{pos.voucherCode}<button class="ml-1" aria-label="Lepas voucher" onclick={() => { voucherInput = ''; applyVoucher(); }}><X class="size-3" /></button></span>
				{:else}
					<Button size="sm" variant="ghost" onclick={() => (showVoucher = !showVoucher)}><Ticket class="size-4" />Voucher</Button>
				{/if}
			</div>
			{#if showVoucher && !pos.voucherCode}
				<form class="flex gap-2 border-b border-border px-4 py-2" onsubmit={(e) => { e.preventDefault(); applyVoucher(); }}>
					<input class="h-8 flex-1 rounded border border-border bg-surface px-2 uppercase" placeholder="Kode voucher" bind:value={voucherInput} aria-label="Kode voucher" />
					<Button size="sm" type="submit" disabled={!voucherInput.trim() || !pos.items.length}>Pakai</Button>
				</form>
			{/if}

			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if !pos.items.length}
					<p class="px-4 py-10 text-center text-muted">Keranjang kosong</p>
				{/if}
				{#each pos.items as it, i (it.key)}
					{@const l = lineOf(i)}
					<div class="border-b border-border px-4 py-2.5">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="truncate font-medium">{l?.name ?? it.barcode ?? it.epc ?? '…'}</p>
								{#if it.epc}<p class="font-mono text-[11px] text-muted">RFID {it.epc.slice(-8)}</p>{/if}
								<p class="text-[12px] text-muted">{l ? idr(l.unit_price) : ''}{#if l && Number(l.discount_amount) > 0} · diskon {idr(l.discount_amount)}{/if}</p>
								{#if l}{#each l.promotions as pr}<p class="flex items-center gap-1 text-[12px] text-ok"><BadgePercent class="size-3" />{pr.name} −{idr(pr.amount)}</p>{/each}{/if}
							</div>
							<span class="num font-medium">{l ? idr(l.line_total) : '…'}</span>
						</div>
						<div class="mt-1.5 flex items-center justify-between">
							<div class="flex items-center gap-1">
								<button class="grid size-7 place-items-center rounded border border-border hover:bg-surface-2" aria-label="Kurangi" onclick={() => pos.setQty(it.key, it.qty - 1)}><Minus class="size-3.5" /></button>
								<input class="num h-7 w-12 rounded border border-border bg-surface text-center disabled:opacity-60" inputmode="decimal" value={it.qty} disabled={!!it.epc} aria-label="Jumlah" onchange={(e) => pos.setQty(it.key, Number(e.currentTarget.value))} />
								<button class="grid size-7 place-items-center rounded border border-border hover:bg-surface-2 disabled:opacity-40" disabled={!!it.epc} aria-label="Tambah" onclick={() => pos.setQty(it.key, it.qty + 1)}><Plus class="size-3.5" /></button>
							</div>
							<div class="flex items-center gap-2 text-[12px] text-muted">
								<label class="flex items-center gap-1">Disc
									<input class="num h-7 w-12 rounded border border-border bg-surface text-center text-text" inputmode="decimal" value={it.discount_percent || ''} placeholder="0" aria-label="Diskon persen" onchange={(e) => pos.setDiscount(it.key, Number(e.currentTarget.value))} />%
								</label>
								<button class="rounded p-1 hover:text-danger" aria-label="Hapus" onclick={() => pos.remove(it.key)}><Trash2 class="size-4" /></button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="space-y-1.5 border-t border-border bg-surface-2/50 px-4 py-3">
				{#if pos.quoteError}<p class="text-danger" role="alert">{pos.quoteError}</p>{/if}
				{#if pos.quote}
					<div class="flex justify-between text-muted"><span>Subtotal</span><span class="num">{idr(pos.quote.subtotal)}</span></div>
					{#if Number(pos.quote.promo_discount) > 0}<div class="flex justify-between text-ok"><span>Promo</span><span class="num">-{idr(pos.quote.promo_discount)}</span></div>{/if}
					{#if pos.quote.voucher}<div class="flex justify-between text-ok"><span>Voucher {pos.quote.voucher.code}</span><span class="num">-{idr(pos.quote.voucher.discount)}</span></div>{/if}
					{#if Number(pos.quote.discount_total) - Number(pos.quote.promo_discount) - Number(pos.quote.voucher_discount) > 0}<div class="flex justify-between text-muted"><span>Diskon manual</span><span class="num">-{idr(Number(pos.quote.discount_total) - Number(pos.quote.promo_discount) - Number(pos.quote.voucher_discount))}</span></div>{/if}
					<div class="flex justify-between text-muted"><span>PPN {pos.quote.price_includes_tax ? '(termasuk)' : ''}</span><span class="num">{idr(pos.quote.tax_total)}</span></div>
				{/if}
				<label class="flex items-center justify-between text-muted">Diskon transaksi
					<span><input class="num h-7 w-14 rounded border border-border bg-surface text-center text-text" inputmode="decimal" value={pos.cartDiscount || ''} placeholder="0" aria-label="Diskon transaksi persen" onchange={(e) => pos.setCartDiscount(Number(e.currentTarget.value))} /> %</span>
				</label>
				<div class="flex items-baseline justify-between pt-1">
					<span class="text-base font-semibold">TOTAL</span>
					<span class="num text-3xl font-bold">{idr(pos.quote?.grand_total ?? 0)}</span>
				</div>
				<Button class="h-12 w-full text-base" disabled={!pos.items.length || !pos.quote || pos.quoting || !!pos.quoteError} onclick={() => (payOpen = true)}>Bayar (F12)</Button>
			</div>
		</aside>
	</div>
{/if}

<PayDialog {pos} bind:open={payOpen} oncomplete={completed} />
<ReceiptDialog bind:saleId={receiptId} {hasCash} change={lastSale?.change_amount ?? '0'} autoPrint onclose={focusScan} />
{#if pos.shift}<ShiftDialogs {pos} bind:cashOpen bind:closeOpen />{/if}
<DevicesDialog bind:open={devicesOpen} />
<CustomerDialog bind:open={customerOpen} canRegister={can(data.me.grants, 'customer.create')} onpick={(c) => pos.setCustomer(c).catch((e) => toast.error(errMsg(e)))} />

<Dialog bind:open={heldOpen} title="Transaksi ditahan">
	{#if !pos.held.length}<p class="text-muted">Tidak ada transaksi yang ditahan.</p>{/if}
	<ul class="divide-y divide-border">
		{#each pos.held as h (h.id)}
			<li class="flex items-center justify-between py-2.5">
				<span>{h.items.length} baris · <span class="num">{idr(h.total)}</span><br /><span class="text-[12px] text-muted">{dateTime(h.at)}</span></span>
				<span class="flex gap-1">
					<Button size="sm" onclick={() => { pos.resume(h.id); heldOpen = false; }}>Ambil</Button>
					<button class="rounded p-2 text-muted hover:text-danger" aria-label="Hapus" onclick={() => pos.dropHeld(h.id)}><X class="size-4" /></button>
				</span>
			</li>
		{/each}
	</ul>
</Dialog>
