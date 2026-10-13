import { ApiError, get, post } from '#lib/api/client';
import type { Quote, SaleDetail, Shift, Terminal } from '#lib/types/api';

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

/**
 * Cart + checkout state for one POS screen. Pricing is never computed here: every change is sent to
 * /pos/quote and the server's numbers are shown. A client_txn_id is minted per cart and kept across
 * retries, so a retry after a network failure cannot create a second sale.
 */
export class PosState {
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
	itemCount = $derived(this.items.reduce((n, i) => n + i.qty, 0));
	grandTotal = $derived(this.quote ? Number(this.quote.grand_total) : 0);

	constructor(terminals: Terminal[]) {
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

	async loadShift() {
		this.loadingShift = true;
		try {
			this.shift = (await get<Shift | null>('/pos/shifts/current')).data;
			if (this.shift) this.setTerminal(this.shift.terminal_id);
		} finally {
			this.loadingShift = false;
		}
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
			const r = await post<Quote>('/pos/quote', this.cartBody());
			if (seq === this.#seq) {
				this.quote = r.data;
				this.quoteError = '';
			}
		} catch (e) {
			if (seq === this.#seq) this.quoteError = e instanceof ApiError ? e.message : 'Gagal menghitung';
			throw e;
		} finally {
			if (seq === this.#seq) this.quoting = false;
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

	async checkout(payments: PayLine[], approval?: Approval, points = 0): Promise<SaleDetail> {
		const r = await post<SaleDetail>('/pos/sales', {
			...this.cartBody(),
			client_txn_id: this.#clientTxnId,
			payments: [
				...(points > 0 ? [{ method: 'POINTS', points }] : []),
				...payments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference || undefined }))
			],
			approval: approval?.pin ? approval : undefined
		});
		this.clear();
		await this.loadShift(); // refresh live totals
		return r.data;
	}
}
