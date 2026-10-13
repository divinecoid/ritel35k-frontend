export interface ToastItem {
	id: number;
	kind: 'ok' | 'error';
	text: string;
}

let nextId = 1;

class Toasts {
	items = $state<ToastItem[]>([]);
	push(kind: ToastItem['kind'], text: string) {
		const id = nextId++;
		this.items.push({ id, kind, text });
		setTimeout(() => (this.items = this.items.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500);
	}
	ok = (t: string) => this.push('ok', t);
	error = (t: string) => this.push('error', t);
}

export const toast = new Toasts();
