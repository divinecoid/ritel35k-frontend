import { ApiError, get, isNetworkFailure, post } from '#lib/api/client';
import type { Quote, SaleDetail, Shift, Terminal } from '#lib/types/api';
import { net } from './connectivity.svelte';
import { edgeConfigured, offCloseShift, offOpenShift, offQuote, offReceiptText, offSale, offShift, offStatus, offSyncNow, type OfflineShift, type OfflineTerminalStatus } from './offline';

export interface CartItem {
	key: string;
	barcode?: string;
	variant_id?: string;
	epc?: string; // an RFID tag scanned at the POS: one specific item, qty is always 1
	qty: number;
	discount_percent: number;
}

export interface Held {
	id: string;
	at: string;
	items: CartItem[];
	cartDiscount: number;
	total: string;
	customer?: PosCustomer | null;
	voucherCode?: string;
}

export interface PayLine {
	method: string;
	amount: string;
	reference: string;
}

export interface PosCustomer {
	id: string;
	member_no: string;
	name: string;
	phone: string;
	level_name: string;
	points_balance: number;
}

export interface Approval {
	approver_email: string;
	pin: string;
}

const HELD_KEY = 'r35k_held_v1';
const TERMINAL_KEY = 'r35k_terminal_v1';

const uid = () => crypto.randomUUID();

/** A sale taken by the store agent while the cloud was unreachable; carries its own receipt text. */
export type OfflineSaleDetail = SaleDetail & { offline?: boolean; offline_text?: string };

function shiftFromEdge(v: OfflineShift, terminalId: string): Shift & { offline?: boolean } {
	return {
		id: v.client_shift_id ?? v.shift_id ?? '',
		store_id: '',
		terminal_id: terminalId,
		cashier_id: v.cashier_id,
		status: 'open',
		opening_cash: v.opening_cash,
		opened_at: v.opened_at,
		closed_at: null,
		expected_cash: v.expected_cash,
		counted_cash: null,
		variance: null,
		note: '',
		offline: true,
		totals: { cash_sales: v.cash_sales, noncash_sales: v.noncash_sales, gross_sales: String(Number(v.cash_sales) + Number(v.noncash_sales)), sale_count: v.sale_count, void_count: 0, cash_in: '0', cash_out: '0', cash_refunds: '0', opening_cash: v.opening_cash, expected_cash: v.expected_cash }
	} as Shift & { offline?: boolean };
}

/**
 * Cart + checkout state for one POS screen. Pricing is never computed here: every change is sent to
 * /pos/quote and the server's numbers are shown. A client_txn_id is minted per cart and kept across
 * retries, so a retry after a network failure cannot create a second sale.
 */
export class PosState {
	me: { id: string; name: string };
	/** The store agent's view of this terminal (null: no agent configured / unreachable). */
	edge = $state<OfflineTerminalStatus | null>(null);
	edgeOn = $state(false);
	syncing = $state(false);
	terminals = $state<Terminal[]>([]);
	terminalId = $state('');
	shift = $state<Shift | null>(null);
	loadingShift = $state(true);

	items = $state<CartItem[]>([]);
	cartDiscount = $state(0);
	quote = $state<Quote | null>(null);
	quoting = $state(false);
	quoteError = $state('');
	held = $state<Held[]>([]);
	customer = $state<PosCustomer | null>(null);
	voucherCode = $state('');

	#clientTxnId = uid();
	#seq = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;

	terminal = $derived(this.terminals.find((t) => t.id === this.terminalId));
	/**
	 * Which side takes the sale. While the cloud is unreachable — and while the agent still holds sales it has not
	 * delivered yet, so order and shift linkage stay intact — everything goes through the store agent.
	 */
	useEdge = $derived(this.edgeOn && (!net.online || (this.edge?.pending ?? 0) > 0));
	/** Without the cloud and without a ready agent there is nothing to sell with. */
	canSell = $derived(net.online || !!this.edge?.ready);
	offlineShift = $derived(!!(this.shift as (Shift & { offline?: boolean }) | null)?.offline);
	itemCount = $derived(this.items.reduce((n, i) => n + i.qty, 0));
	grandTotal = $derived(this.quote ? Number(this.quote.grand_total) : 0);

	constructor(terminals: Terminal[], me: { id: string; name: string }) {
		this.me = me;
		this.terminals = terminals;
		try {
			const saved = localStorage.getItem(TERMINAL_KEY);
			this.terminalId = terminals.find((t) => t.id === saved)?.id ?? terminals[0]?.id ?? '';
			this.held = JSON.parse(localStorage.getItem(HELD_KEY) ?? '[]');
		} catch {
			this.terminalId = terminals[0]?.id ?? '';
		}
	}

	setTerminal(id: string) {
		this.terminalId = id;
		try {
			localStorage.setItem(TERMINAL_KEY, id);
		} catch {
			/* ignore */
		}
	}

	#poll: ReturnType<typeof setInterval> | undefined;
	#unsub: (() => void) | undefined;

	/** Starts connectivity watching and the agent status poll; returns the cleanup. */
	start() {
		net.start();
		void this.refreshEdge();
		this.#poll = setInterval(() => void this.refreshEdge(), 6000);
		this.#unsub = net.onChange((online) => {
			void this.refreshEdge();
			if (online) void this.syncEdge();
			else void this.requote().catch(() => {}); // re-price the cart on the agent's catalogue
		});
		return () => {
			clearInterval(this.#poll);
			this.#unsub?.();
		};
	}

	async refreshEdge() {
		this.edgeOn = edgeConfigured();
		if (!this.edgeOn || !this.terminalId) {
			this.edge = null;
			return;
		}
		try {
			const prev = this.edge?.pending ?? 0;
			const s = await offStatus(this.terminalId);
			this.edge = s;
			if (s && prev > 0 && s.pending === 0 && net.online) void this.loadShift(); // the agent has delivered everything: back to the cloud's own shift
		} catch {
			this.edge = null;
		}
	}

	/** Asks the agent to deliver its queue now (the cloud just came back). */
	async syncEdge() {
		if (!this.edgeOn || !this.terminalId) return;
		this.syncing = true;
		try {
			await offSyncNow(this.terminalId);
		} catch {
			/* the agent keeps retrying on its own */
		} finally {
			this.syncing = false;
			await this.refreshEdge();
		}
	}

	async loadShift() {
		this.loadingShift = true;
		try {
			if (!this.useEdge) {
				try {
					const cloud = (await get<Shift | null>('/pos/shifts/current')).data;
					this.shift = cloud;
					if (cloud) this.setTerminal(cloud.terminal_id);
					return;
				} catch (e) {
					if (!isNetworkFailure(e)) throw e;
					net.markDown();
					await this.refreshEdge();
				}
			}
			// cloud unreachable (or the agent is still delivering): the agent knows the cashier's offline shift
			if (this.shift && !this.offlineShift) return; // a shift the cloud opened earlier stays valid; sales carry its id
			if (!this.edgeOn || !this.terminalId) return;
			const r = await offShift(this.terminalId, this.me.id).catch(() => null);
			this.shift = r?.shift ? shiftFromEdge(r.shift, this.terminalId) : null;
		} finally {
			this.loadingShift = false;
		}
	}

	async openShiftOffline(cash: number) {
		await offOpenShift({ terminal_id: this.terminalId, cashier_id: this.me.id, opening_cash: cash });
		await this.refreshEdge();
		await this.loadShift();
	}

	/** Queues the shift close on the agent (delivered to the cloud when possible). */
	async closeShiftOffline(counted: number, note: string) {
		const sh = this.shift as (Shift & { offline?: boolean }) | null;
		const r = await offCloseShift({ terminal_id: this.terminalId, cashier_id: this.me.id, shift_id: sh && !sh.offline ? sh.id : undefined, counted_cash: counted, note });
		void this.refreshEdge();
		return r;
	}

	// ---- cart -----------------------------------------------------------------------------

	private touch() {
		this.#clientTxnId = uid(); // cart changed: a retry of the old request must not be replayed for this one
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.requote(), 120);
	}

	async requote() {
		const seq = ++this.#seq;
		if (!this.items.length) {
			this.quote = null;
			this.quoteError = '';
			this.quoting = false;
			return;
		}
		this.quoting = true;
		try {
			const q = await this.priceCart();
			if (seq === this.#seq) {
				this.quote = q;
				this.quoteError = '';
			}
		} catch (e) {
			if (seq === this.#seq) this.quoteError = e instanceof ApiError ? e.message : 'Gagal menghitung';
			throw e;
		} finally {
			if (seq === this.#seq) this.quoting = false;
		}
	}

	/** Prices the cart on whichever side is reachable; a failed cloud call falls back to the agent's catalogue. */
	private async priceCart(): Promise<Quote> {
		if (this.useEdge) return offQuote(this.cartBody());
		try {
			return (await post<Quote>('/pos/quote', this.cartBody(), { timeoutMs: 8000 })).data;
		} catch (e) {
			if (isNetworkFailure(e) && this.edgeOn && this.edge?.ready) {
				net.markDown();
				return offQuote(this.cartBody());
			}
			throw e;
		}
	}

	cartBody() {
		return {
			terminal_id: this.terminalId,
			cart_discount_percent: this.cartDiscount || undefined,
			customer_id: this.customer?.id,
			voucher_code: this.voucherCode || undefined,
			items: this.items.map((i) => ({
				...(i.epc ? { epc: i.epc } : i.barcode ? { barcode: i.barcode } : { variant_id: i.variant_id }),
				qty: i.qty,
				discount_percent: i.discount_percent || undefined
			}))
		};
	}

	/** Adds one unit by scanned barcode (or picked variant). Rolls back if the server rejects it. */
	async add(input: { barcode?: string; variant_id?: string; epc?: string }) {
		if (input.epc) {
			const e = input.epc.toUpperCase();
			if (this.items.some((i) => i.epc === e)) throw new Error('Tag ini sudah ada di keranjang');
			input = { epc: e };
		}
		const existing = input.epc ? undefined : this.items.find((i) => (input.barcode && i.barcode === input.barcode) || (input.variant_id && i.variant_id === input.variant_id));
		const snapshot = $state.snapshot(this.items) as CartItem[];
		if (existing && existing.discount_percent === 0) existing.qty += 1;
		else this.items.push({ key: uid(), qty: 1, discount_percent: 0, ...input });
		this.#clientTxnId = uid();
		clearTimeout(this.#timer);
		try {
			await this.requote();
		} catch (e) {
			this.items = snapshot;
			void this.requote().catch(() => {});
			throw e;
		}
	}

	setQty(key: string, qty: number) {
		const it = this.items.find((i) => i.key === key);
		if (!it) return;
		if (qty <= 0) return this.remove(key);
		it.qty = qty;
		this.touch();
	}

	setDiscount(key: string, p: number) {
		const it = this.items.find((i) => i.key === key);
		if (!it) return;
		it.discount_percent = Math.min(100, Math.max(0, p || 0));
		this.touch();
	}

	setCartDiscount(p: number) {
		this.cartDiscount = Math.min(100, Math.max(0, p || 0));
		this.touch();
	}

	/** Attaches a member (re-prices with member prices/promos). Rolls back if the server rejects the cart. */
	async setCustomer(c: PosCustomer | null) {
		const prev = this.customer;
		this.customer = c;
		this.#clientTxnId = uid();
		if (!this.items.length) return;
		try {
			await this.requote();
		} catch (e) {
			this.customer = prev;
			void this.requote().catch(() => {});
			throw e;
		}
	}

	/** Applies (or clears, with '') a voucher code; an invalid code is rejected and the previous state kept. */
	async applyVoucher(code: string) {
		if (code.trim() && this.useEdge) throw new Error('Voucher hanya bisa dipakai saat terhubung ke server');
		const prev = this.voucherCode;
		this.voucherCode = code.trim();
		this.#clientTxnId = uid();
		try {
			await this.requote();
		} catch (e) {
			this.voucherCode = prev;
			void this.requote().catch(() => {});
			throw e;
		}
	}

	remove(key: string) {
		this.items = this.items.filter((i) => i.key !== key);
		this.touch();
	}

	clear() {
		this.items = [];
		this.cartDiscount = 0;
		this.customer = null;
		this.voucherCode = '';
		this.quote = null;
		this.quoteError = '';
		this.#clientTxnId = uid();
	}

	// ---- hold / resume --------------------------------------------------------------------

	private saveHeld() {
		try {
			localStorage.setItem(HELD_KEY, JSON.stringify(this.held));
		} catch {
			/* ignore */
		}
	}

	hold() {
		if (!this.items.length) return;
		this.held.unshift({ id: uid(), at: new Date().toISOString(), items: $state.snapshot(this.items) as CartItem[], cartDiscount: this.cartDiscount, total: this.quote?.grand_total ?? '0', customer: $state.snapshot(this.customer) as PosCustomer | null, voucherCode: this.voucherCode });
		this.held = this.held.slice(0, 20);
		this.saveHeld();
		this.clear();
	}

	resume(id: string) {
		const h = this.held.find((x) => x.id === id);
		if (!h) return;
		if (this.items.length) this.hold();
		this.items = h.items;
		this.cartDiscount = h.cartDiscount;
		this.customer = h.customer ?? null;
		this.voucherCode = h.voucherCode ?? '';
		this.held = this.held.filter((x) => x.id !== id);
		this.saveHeld();
		this.touch();
	}

	dropHeld(id: string) {
		this.held = this.held.filter((x) => x.id !== id);
		this.saveHeld();
	}

	// ---- checkout -------------------------------------------------------------------------

	async checkout(payments: PayLine[], approval?: Approval, points = 0): Promise<OfflineSaleDetail> {
		if (this.useEdge) return this.checkoutEdge(payments, points);
		try {
			const r = await post<SaleDetail>(
				'/pos/sales',
				{
					...this.cartBody(),
					client_txn_id: this.#clientTxnId,
					payments: [
						...(points > 0 ? [{ method: 'POINTS', points }] : []),
						...payments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference || undefined }))
					],
					approval: approval?.pin ? approval : undefined
				},
				{ timeoutMs: 10000 }
			);
			this.clear();
			await this.loadShift(); // refresh live totals
			return r.data;
		} catch (e) {
			// The answer never arrived: the sale may or may not be recorded. Retry on the store agent with the SAME
			// client_txn_id — whichever side saw it first wins and the other is acknowledged as a duplicate at sync.
			if (isNetworkFailure(e) && this.edgeOn && this.edge?.ready) {
				net.markDown();
				return this.checkoutEdge(payments, points);
			}
			throw e;
		}
	}

	private async checkoutEdge(payments: PayLine[], points: number): Promise<OfflineSaleDetail> {
		if (points > 0) throw new Error('Poin tidak bisa ditukar saat offline');
		const body = this.cartBody();
		const q = await offQuote(body);
		if (q.approval_required) throw new Error('Diskon melebihi batas butuh PIN supervisor — tidak tersedia saat offline. Kurangi diskon.');
		if (Number(q.grand_total) !== this.grandTotal) {
			this.quote = q; // show the agent's numbers; the cashier confirms them before taking money
			throw new Error(`Harga offline berbeda: total sekarang ${new Intl.NumberFormat('id-ID').format(Number(q.grand_total))}. Periksa lalu bayar lagi.`);
		}
		const sh = this.shift as (Shift & { offline?: boolean }) | null;
		const pay = payments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference || undefined }));
		const r = await offSale({
			terminal_id: this.terminalId,
			client_txn_id: this.#clientTxnId,
			cashier_id: this.me.id,
			cashier_name: this.me.name,
			shift_id: sh && !sh.offline ? sh.id : undefined,
			items: body.items,
			cart_discount_percent: body.cart_discount_percent,
			customer_id: body.customer_id,
			payments: pay
		});
		const text = await offReceiptText(this.terminalId, r.id).catch(() => '');
		this.clear();
		void this.refreshEdge();
		void this.loadShift();
		return { id: r.id, document_number: r.local_number, grand_total: r.grand_total, change_amount: r.change_amount, payments: pay.map((p) => ({ method: p.method, amount: String(p.amount) })), offline: true, offline_text: text } as unknown as OfflineSaleDetail;
	}
}
