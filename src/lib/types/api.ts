// Hand-maintained mirror of the Go API (backend/internal/*/handler.go). Replace with generated
// types once api/openapi.yaml exists.
export interface Envelope<T> {
	success: boolean;
	data: T;
	meta?: Meta;
}
export interface Meta {
	page: number;
	per_page: number;
	total: number;
	total_pages: number;
}

export type UnitType = 'company' | 'business_unit' | 'region' | 'store';

export interface OrgUnit {
	id: string;
	parent_id: string | null;
	type: UnitType;
	code: string;
	name: string;
	path: string;
	status: string;
	accessible: boolean;
	store_id?: string;
	store_status?: string;
}

export interface GrantScope {
	all: boolean;
	paths: string[];
}
export interface Me {
	user: { id: string; company_id: string; email: string; name: string };
	grants: Record<string, GrantScope>;
	roles: { role_code: string; role_name: string; org_unit_id: string | null; org_unit_name: string | null }[];
}

export interface Store {
	id: string;
	org_unit_id: string;
	parent_org_unit_id: string | null;
	code: string;
	name: string;
	path: string;
	address: Record<string, string>;
	timezone: string;
	status: string;
	created_at: string;
}
export interface Provisioned {
	store: Store;
	default_warehouse: { id: string; code: string; name: string };
}

export interface SettingDef {
	key: string;
	type: 'string' | 'int' | 'number' | 'bool' | 'string_array';
	default: unknown;
	group: string;
	description: string;
}
export interface EffectiveSetting extends SettingDef {
	value: unknown;
	source: 'default' | UnitType;
	source_org_unit_id?: string;
	source_name?: string;
	inherited: boolean;
}

export interface Role {
	id: string;
	code: string;
	name: string;
	is_system: boolean;
	permissions: string[];
}
export interface Assignment {
	role_id: string;
	role_code: string;
	role_name: string;
	org_unit_id: string | null;
	org_unit_name: string | null;
	org_unit_type: string | null;
}
export interface User {
	id: string;
	email: string;
	name: string;
	status: string;
	has_pin: boolean;
	last_login_at: string | null;
	created_at: string;
	assignments: Assignment[];
}

export interface Barcode {
	id: string;
	barcode: string;
	kind: string;
	is_primary: boolean;
}
export interface Variant {
	id: string;
	sku: string;
	name: string;
	purchase_price: string;
	cost: string;
	status: string;
	barcodes: Barcode[];
}
export interface Product {
	id: string;
	code: string;
	name: string;
	short_name: string;
	category_id: string | null;
	brand_id: string | null;
	uom_id: string;
	status: string;
	version: number;
	is_rfid_tracked: boolean;
	variants: Variant[];
}
export interface Named {
	id: string;
	code: string;
	name: string;
}
export interface Supplier {
	id: string;
	code: string;
	name: string;
	pic: string;
	phone: string;
	email: string;
	payment_term_days: number;
	lead_time_days: number;
	status: string;
}
export interface AuditLog {
	id: string;
	user_id: string | null;
	store_id: string | null;
	action: string;
	entity: string;
	entity_id: string;
	new_value: unknown;
	ip_address: string;
	created_at: string;
}

// ---- Phase 2: POS, inventory, pricing ----
export interface Terminal {
	id: string;
	store_id: string;
	store_name?: string;
	code: string;
	name: string;
	status: string;
}

export interface ShiftTotals {
	cash_sales: string;
	noncash_sales: string;
	gross_sales: string;
	sale_count: number;
	void_count: number;
	cash_in: string;
	cash_out: string;
	cash_refunds: string;
	opening_cash: string;
	expected_cash: string;
}
export interface Shift {
	id: string;
	store_id: string;
	terminal_id: string;
	cashier_id: string;
	status: 'open' | 'closed';
	opening_cash: string;
	opened_at: string;
	closed_at: string | null;
	expected_cash: string | null;
	counted_cash: string | null;
	variance: string | null;
	note: string;
	totals: ShiftTotals;
	movements?: { id: string; type: string; amount: string; reason: string; created_at: string }[];
}
export interface ShiftRow {
	id: string;
	store_id: string;
	store_name: string;
	terminal_code: string;
	cashier_name: string;
	status: string;
	opening_cash: string;
	opened_at: string;
	closed_at: string | null;
	expected_cash: string | null;
	counted_cash: string | null;
	variance: string | null;
}

export interface CartLine {
	promo_discount: string;
	promotions: AppliedPromo[];
	voucher_discount: string;
	line_no: number;
	variant_id: string;
	sku: string;
	name: string;
	barcode: string;
	qty: string;
	unit_price: string;
	price_source: string;
	discount_percent: string;
	gross: string;
	discount_amount: string;
	tax_rate: string;
	tax_amount: string;
	line_total: string;
}
export interface Quote {
	lines: CartLine[];
	subtotal: string;
	discount_total: string;
	promo_discount: string;
	voucher_discount: string;
	tax_total: string;
	grand_total: string;
	price_includes_tax: boolean;
	max_discount_percent: string;
	approval_required: boolean;
	payment_methods: string[];
	promotions: AppliedPromo[];
	voucher?: { code: string; discount: string };
	customer?: { id: string; member_no: string; name: string; phone: string; level_name: string; points_balance: number; earn_multiplier: string };
	points_earn: number;
	max_redeem_points: number;
	redeem_value: string;
	min_redeem_points: number;
}

export interface SaleItem {
	id: string;
	line_no: number;
	variant_id: string;
	sku: string;
	product_name: string;
	qty: string;
	unit_price: string;
	discount_amount: string;
	line_total: string;
}
export interface Payment {
	id: string;
	method: string;
	amount: string;
	tendered: string;
	reference: string;
}
export interface SaleRow {
	id: string;
	document_number: string;
	store_id: string;
	store_name: string;
	terminal_code: string;
	cashier_name: string;
	status: 'completed' | 'voided';
	business_date: string;
	grand_total: string;
	discount_total: string;
	refunded_total: string;
	created_at: string;
	methods: string;
}
export interface SaleDetail extends SaleRow {
	customer_id: string | null;
	customer_name: string | null;
	customer_member_no: string | null;
	promo_discount: string;
	voucher_discount: string;
	points_earned: number;
	points_redeemed: number;
	promotions: { sale_item_id: string; promotion_id: string; name: string; amount: string }[];
	subtotal: string;
	tax_total: string;
	paid_total: string;
	change_amount: string;
	void_reason: string;
	items: SaleItem[];
	payments: Payment[];
	returns: { id: string; document_number: string; refund_amount: string; refund_method: string; reason: string; created_at: string }[];
}

export interface Balance {
	store_id: string | null;
	store_name: string | null;
	store_code: string | null;
	warehouse_id: string;
	warehouse_code: string;
	variant_id: string;
	sku: string;
	product_name: string;
	variant_name: string;
	on_hand: string;
	avg_cost: string;
	reorder_point: string;
}
export interface Movement {
	id: string;
	movement_type: string;
	qty_delta: string;
	unit_cost: string;
	balance_after: string;
	document_number: string;
	note: string;
	created_at: string;
	sku: string;
	product_name: string;
	warehouse_code: string;
}
export interface PriceRow {
	price_list_id: string;
	price_list_name: string;
	min_qty: string;
	id: string;
	org_unit_id: string;
	org_unit_name: string;
	org_unit_type: string;
	price: string;
	effective_from: string;
	effective_to: string | null;
}

// ---- Phase 3: supply chain ----
export interface Warehouse {
	id: string;
	store_id: string | null;
	code: string;
	name: string;
	type: string;
	is_default: boolean;
	status: string;
}
export interface WarehouseDir {
	id: string;
	code: string;
	name: string;
	type: string;
	store_id: string | null;
	store_name: string | null;
}

export type POStatus = 'draft' | 'submitted' | 'approved' | 'partially_received' | 'received' | 'cancelled';
export interface PORow {
	id: string;
	document_number: string;
	status: POStatus;
	total: string;
	expected_date: string | null;
	created_at: string;
	store_id: string | null;
	warehouse_id: string;
	supplier_name: string;
	warehouse_code: string;
	store_name: string | null;
}
export interface POLine {
	id: string;
	variant_id: string;
	sku: string;
	product_name: string;
	qty_ordered: string;
	unit_price: string;
	qty_received: string;
	line_total: string;
}
export interface PODetail extends PORow {
	supplier_id: string;
	warehouse_name: string;
	note: string;
	path: string;
	created_by: string;
	cancel_reason: string;
	lines: POLine[];
}
export interface GRNRow {
	id: string;
	document_number: string;
	supplier_ref: string;
	received_date: string;
	total_cost: string;
	created_at: string;
	store_id: string | null;
	po_id: string | null;
	supplier_name: string;
	warehouse_code: string;
	store_name: string | null;
	po_number: string | null;
}
export interface GRNDetail extends GRNRow {
	supplier_id: string;
	warehouse_id: string;
	note: string;
	lines: { id: string; variant_id: string; sku: string; product_name: string; qty: string; unit_cost: string; line_total: string }[];
}
export interface PurchaseReturnRow {
	id: string;
	document_number: string;
	reason: string;
	total_cost: string;
	created_at: string;
	supplier_name: string;
	warehouse_code: string;
	store_name: string | null;
}

export type TransferStatus = 'draft' | 'submitted' | 'approved' | 'shipped' | 'received' | 'cancelled';
export interface TransferRow {
	id: string;
	document_number: string;
	status: TransferStatus;
	created_at: string;
	from_store_id: string | null;
	to_store_id: string | null;
	from_code: string;
	to_code: string;
	from_store_name: string | null;
	to_store_name: string | null;
	line_count: number;
}
export interface TransferDetail extends TransferRow {
	from_name: string;
	to_name: string;
	from_path: string;
	to_path: string;
	from_warehouse_id: string;
	to_warehouse_id: string;
	note: string;
	cancel_reason: string;
	lines: { id: string; variant_id: string; sku: string; product_name: string; qty_requested: string; qty_shipped: string; qty_received: string; unit_cost: string }[];
}

export interface CountRow {
	id: string;
	document_number: string;
	kind: string;
	status: 'counting' | 'submitted' | 'approved' | 'cancelled';
	snapshot_at: string;
	created_at: string;
	store_id: string | null;
	warehouse_code: string;
	store_name: string | null;
	item_count: number;
	counted_count: number;
}
export interface CountDetail extends CountRow {
	warehouse_name: string;
	path: string;
	lines: {
		id: string;
		variant_id: string;
		sku: string;
		product_name: string;
		barcode: string | null;
		system_qty: string;
		counted_qty: string | null;
		expected_qty: string | null;
		variance: string | null;
		unit_cost: string;
		variance_value: string;
	}[];
	summary: { items: number; counted: number; surplus_qty: string; shortage_qty: string; variance_value: string; abs_variance_value: string };
}

// ---- Phase 4: commercial ----
export interface MembershipLevel {
	id: string;
	code: string;
	name: string;
	rank: number;
	min_spend: string;
	earn_multiplier: string;
	is_default: boolean;
}
export interface Customer {
	id: string;
	member_no: string;
	name: string;
	phone: string;
	email: string;
	birthday: string | null;
	gender: string;
	address: string;
	notes: string;
	level_id: string;
	level_name: string;
	points_balance: number;
	lifetime_spend: string;
	last_purchase_at: string | null;
	status: string;
	created_at: string;
	earn_multiplier?: string;
}
export interface LoyaltyTx {
	id: string;
	kind: string;
	points: number;
	balance_after: number;
	sale_id: string | null;
	note: string;
	created_at: string;
}
export interface CustomerDetail extends Customer {
	ledger: LoyaltyTx[];
	sales: { id: string; document_number: string; status: string; grand_total: string; points_earned: number; points_redeemed: number; created_at: string; store_name: string }[];
	next_level: { name: string; min_spend: string; remaining: string } | null;
}
export interface PriceList {
	id: string;
	code: string;
	name: string;
	membership_level_id: string | null;
	level_name: string | null;
	is_default: boolean;
	status: string;
}
export type PromoType = 'percent' | 'fixed' | 'bxgy' | 'bundle' | 'threshold';
export interface Promotion {
	id: string;
	code: string;
	name: string;
	description: string;
	type: PromoType;
	config: Record<string, number | string>;
	priority: number;
	stackable: boolean;
	exclusive: boolean;
	starts_at: string | null;
	ends_at: string | null;
	days_of_week: number[] | null;
	time_from: string | null;
	time_to: string | null;
	status: string;
	scopes?: { org_unit_ids?: string[]; variant_ids?: string[]; category_ids?: string[]; brand_ids?: string[]; level_ids?: string[] };
}
export interface Voucher {
	id: string;
	code: string;
	kind: 'fixed' | 'percent';
	value: string;
	min_spend: string;
	max_discount: string | null;
	max_uses: number | null;
	used_count: number;
	customer_id: string | null;
	customer_name?: string | null;
	valid_from: string | null;
	valid_to: string | null;
	status: string;
	batch: string;
	note: string;
	created_at: string;
}
export interface AppliedPromo {
	promotion_id: string;
	name: string;
	amount: string;
}

// ---- Phase 5: dashboard, reports, notifications, approvals
export interface DashTotals {
	transactions: number;
	voided: number;
	items_sold: string;
	gross_sales: string;
	discount: string;
	refund: string;
	net_sales: string;
	avg_basket: string;
	gross_profit: string;
	margin_pct: string;
}
export interface DashOverview {
	from: string;
	to: string;
	prev_from: string;
	prev_to: string;
	current: DashTotals;
	previous: DashTotals;
	show_profit: boolean;
	trend: { date: string; transactions: number; net_sales: string; gross_profit: string }[];
	hourly: { hour: number; transactions: number; net_sales: string }[];
	top_products: { variant_id: string; sku: string; name: string; category: string; qty: string; net_sales: string; gross_profit: string }[];
	categories: { name: string; qty: string; net_sales: string; share_pct: string }[];
	payments: { method: string; payments: number; amount: string; share_pct: string }[];
	breakdown: { unit_id: string; code: string; name: string; type: UnitType; path: string; stores: number; transactions: number; net_sales: string; gross_profit: string; share_pct: string }[];
	breakdown_level: string;
	stock?: { stock_value: string; low_stock: number; out_of_stock: number };
	open_shifts?: number;
	updated_at: string;
}

export interface ReportDef {
	key: string;
	title: string;
	description: string;
	group: string;
	perm: string;
	uses_dates: boolean;
}
export type ColumnType = 'text' | 'date' | 'datetime' | 'money' | 'int' | 'qty' | 'percent';
export interface ReportTable {
	report: string;
	title: string;
	from?: string;
	to?: string;
	columns: { key: string; label: string; type: ColumnType }[];
	rows: (string | number | null)[][];
	totals?: (string | number | null)[];
	truncated: boolean;
	show_profit: boolean;
	generated_at: string;
}

export interface AppNotification {
	id: string;
	store_id: string | null;
	store_name: string;
	type: string;
	severity: 'info' | 'warning' | 'critical';
	title: string;
	body: string;
	entity_type: string;
	entity_id: string;
	created_at: string;
	read_at: string | null;
}

export interface ApprovalItem {
	type: 'purchase_order' | 'stock_transfer' | 'stock_count';
	id: string;
	document_number: string;
	title: string;
	subtitle: string;
	amount?: string;
	requested_by: string;
	requested_by_id: string;
	own: boolean;
	requested_at: string | null;
	href: string;
}
export interface ApprovalInbox {
	items: ApprovalItem[];
	counts: Record<string, number>;
	total: number;
}

// ---- Phase 6: RFID & security
export type TagStatus = 'REGISTERED' | 'IN_STOCK' | 'ON_SHELF' | 'RESERVED' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'LOST';
export interface RfidTag {
	id: string;
	epc: string;
	variant_id: string;
	status: TagStatus;
	store_id: string | null;
	location: string;
	sold_sale_id: string | null;
	sold_at: string | null;
	last_seen_at: string | null;
	created_at: string;
	updated_at: string;
	sku: string;
	product_name: string;
	variant_name: string;
	store_name: string;
}
export interface RfidTagDetail extends RfidTag {
	history: { id: string; read_at: string; direction: string; decision: string; reason: string; local_decision: string; reader_code: string; reader_kind: string; store_name: string }[];
}
export interface RfidReader {
	id: string;
	store_id: string;
	store_name: string;
	store_code: string;
	code: string;
	name: string;
	kind: 'gate' | 'pos' | 'shelf' | 'handheld';
	status: 'active' | 'inactive';
	token_hint: string;
	last_seen_at: string | null;
	last_ip: string;
	agent_version: string;
	stats: { buffered?: number; local_alarms?: number; snapshot_tags?: number; snapshot_age_seconds?: number };
	created_at: string;
}
export interface RfidVarianceRow {
	variant_id: string;
	sku: string;
	product_name: string;
	variant_name: string;
	store_id: string;
	store_name: string;
	tag_qty: number;
	system_qty: string;
}
export type SecurityType = 'UNAUTHORIZED_EXIT' | 'UNKNOWN_TAG' | 'RFID_MISMATCH' | 'EXCESSIVE_VOIDS' | 'LARGE_REFUND' | 'HIGH_DISCOUNT' | 'CASH_VARIANCE' | 'READER_OFFLINE';
export interface SecurityEventRow {
	id: string;
	store_id: string;
	type: SecurityType;
	severity: 'info' | 'warning' | 'critical';
	title: string;
	epc: string;
	sale_id: string | null;
	status: 'open' | 'acknowledged' | 'resolved' | 'false_alarm';
	occurred_at: string;
	resolved_at: string | null;
	store_name: string;
	reader_code: string;
	user_name: string;
}
export interface SecurityEventDetail extends SecurityEventRow {
	detail: Record<string, unknown>;
	sku: string;
	product_name: string;
	acknowledged_by_name: string;
	acknowledged_at: string | null;
	resolved_by_name: string;
	resolution_note: string;
}
export interface SecurityOverview {
	from: string;
	to: string;
	active: number;
	active_critical: number;
	total: number;
	by_type: { type: SecurityType; total: number; active: number; critical: number }[];
	by_day: { day: string; total: number; critical: number }[];
	by_store: { store_id: string; store_name: string; total: number; active: number; critical: number }[];
	readers?: { total: number; online: number; offline: number; never_seen: number };
	tags?: Record<string, number>;
	stock_mismatch?: number;
}
export interface RfidScanResult {
	added: number;
	already_counted: number;
	unknown: string[];
	foreign: string[];
	sold: string[];
	flagged: string[];
	not_in_count: string[];
	totals: Record<string, string>;
}
export interface EnrolledReader {
	reader: { id: string; code: string; name: string; kind: string; token_hint: string };
	token: string;
}
