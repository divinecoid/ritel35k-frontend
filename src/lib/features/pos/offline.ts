// The store agent's offline POS API (ritel35k-edge /offline/…): same cart/quote shapes as the cloud, so the screen
// does not care which side answers.
import { edgeCall, edgeText, loadEdge } from './edge';
import type { Quote } from '#lib/types/api';

export interface OfflineTerminalStatus {
	name: string;
	terminal_id: string;
	terminal_code: string;
	store_name: string;
	ready: boolean;
	online: boolean;
	snapshot_version: string;
	snapshot_age_s: number;
	pending: number;
	dead_letters: number;
	last_sync: string;
	last_error: string;
	items: number;
	members: number;
}

export interface OfflineShift {
	cashier_id: string;
	client_shift_id?: string;
	shift_id?: string;
	opened_at: string;
	opening_cash: string;
	sale_count: number;
	cash_sales: string;
	noncash_sales: string;
	expected_cash: string;
	offline: boolean;
}

export interface OfflineSaleResult {
	id: string;
	local_number: string;
	grand_total: string;
	change_amount: string;
	points_earn: number;
	replay: boolean;
	occurred_at: string;
}

export interface OfflineMember {
	id: string;
	member_no: string;
	name: string;
	phone: string;
	level_name: string;
	points_balance: number;
}

export interface OfflineProduct {
	variant_id: string;
	sku: string;
	name: string;
	barcode: string;
	price: string;
}

const qs = (o: Record<string, string | number | undefined>) => {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
	return p.size ? `?${p}` : '';
};

export const edgeConfigured = () => !!loadEdge();

export async function offStatus(terminalId: string): Promise<OfflineTerminalStatus | null> {
	if (!loadEdge()) return null;
	const r = (await edgeCall('/offline/status', undefined, 2500)) as { terminals: OfflineTerminalStatus[] };
	return r.terminals.find((t) => t.terminal_id === terminalId) ?? null;
}

export const offSyncNow = (terminalId: string) => edgeCall('/offline/sync?terminal_id=' + terminalId, {}, 20000);
export const offQuote = (body: unknown) => edgeCall('/offline/pos/quote', body, 8000) as Promise<Quote>;
export const offProducts = (terminalId: string, q: string) => edgeCall('/offline/pos/products' + qs({ terminal_id: terminalId, q, limit: 8 })) as Promise<OfflineProduct[]>;
export const offMembers = (terminalId: string, q: string) => edgeCall('/offline/pos/members' + qs({ terminal_id: terminalId, q })) as Promise<OfflineMember[]>;
export const offShift = (terminalId: string, cashierId: string) => edgeCall('/offline/pos/shift' + qs({ terminal_id: terminalId, cashier_id: cashierId })) as Promise<{ shift: OfflineShift | null; pending: number }>;
export const offOpenShift = (body: { terminal_id: string; cashier_id: string; opening_cash: number }) => edgeCall('/offline/pos/shifts/open', body) as Promise<OfflineShift>;
export const offCloseShift = (body: { terminal_id: string; cashier_id: string; shift_id?: string; counted_cash: number; note: string }) =>
	edgeCall('/offline/pos/shifts/close', body) as Promise<{ expected_cash?: string; counted_cash: string; variance?: string }>;
export const offSale = (body: unknown) => edgeCall('/offline/pos/sales', body, 10000) as Promise<OfflineSaleResult>;
export const offReceiptText = (terminalId: string, id: string, width = 32) => edgeText('/offline/pos/receipts/' + id + qs({ terminal_id: terminalId, format: 'text', width }));
