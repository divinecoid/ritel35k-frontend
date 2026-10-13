import type { SecurityType, TagStatus } from '#lib/types/api';

export const tagLabel: Record<TagStatus, string> = {
	REGISTERED: 'Terdaftar',
	IN_STOCK: 'Di gudang',
	ON_SHELF: 'Di rak',
	RESERVED: 'Dipesan',
	SOLD: 'Terjual',
	RETURNED: 'Diretur',
	DAMAGED: 'Rusak',
	LOST: 'Hilang'
};

export const tagTone: Record<TagStatus, 'neutral' | 'ok' | 'warn' | 'danger' | 'info'> = {
	REGISTERED: 'neutral',
	IN_STOCK: 'neutral',
	ON_SHELF: 'info',
	RESERVED: 'warn',
	SOLD: 'ok',
	RETURNED: 'info',
	DAMAGED: 'danger',
	LOST: 'danger'
};

/** Statuses a person may set by hand (SOLD only happens at checkout). */
export const manualStatuses: TagStatus[] = ['IN_STOCK', 'ON_SHELF', 'RESERVED', 'DAMAGED', 'LOST'];

export const securityLabel: Record<SecurityType, string> = {
	UNAUTHORIZED_EXIT: 'Keluar tanpa bayar',
	UNKNOWN_TAG: 'Tag tidak dikenal',
	RFID_MISMATCH: 'Anomali tag',
	EXCESSIVE_VOIDS: 'Void berlebihan',
	LARGE_REFUND: 'Retur besar',
	HIGH_DISCOUNT: 'Diskon tinggi',
	CASH_VARIANCE: 'Selisih kas',
	READER_OFFLINE: 'Reader offline'
};

export const severityTone = { info: 'info', warning: 'warn', critical: 'danger' } as const;
export const severityLabel = { info: 'Info', warning: 'Perhatian', critical: 'Kritis' } as const;
export const eventStatusLabel = { open: 'Baru', acknowledged: 'Ditangani', resolved: 'Selesai', false_alarm: 'Alarm palsu' } as const;
export const eventStatusTone = { open: 'danger', acknowledged: 'warn', resolved: 'ok', false_alarm: 'neutral' } as const;
export const readerKindLabel = { gate: 'Gerbang', pos: 'Pad kasir', shelf: 'Rak', handheld: 'Handheld' } as const;
