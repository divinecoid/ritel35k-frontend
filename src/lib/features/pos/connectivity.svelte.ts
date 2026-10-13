/**
 * Is the cloud reachable? The browser's own online flag only knows about the LAN, so we ask the app server
 * (/ping → API /ready). Checked every few seconds, faster while down, and immediately on network events or
 * when a request fails (markDown).
 */
class Net {
	online = $state(true);
	checkedAt = $state(0);
	#timer: ReturnType<typeof setTimeout> | undefined;
	#started = false;
	#listeners = new Set<(online: boolean) => void>();

	start() {
		if (this.#started || typeof window === 'undefined') return;
		this.#started = true;
		window.addEventListener('online', () => void this.check());
		window.addEventListener('offline', () => this.set(false));
		void this.check();
	}

	/** Called when the state flips; returns an unsubscribe. */
	onChange(fn: (online: boolean) => void) {
		this.#listeners.add(fn);
		return () => this.#listeners.delete(fn);
	}

	private set(v: boolean) {
		if (v !== this.online) {
			this.online = v;
			for (const fn of this.#listeners) fn(v);
		}
	}

	markDown() {
		this.set(false);
		this.schedule(1500);
	}

	private schedule(ms: number) {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.check(), ms);
	}

	async check() {
		let ok = false;
		try {
			const r = await fetch('/ping', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
			ok = r.ok && !!(await r.json()).ok;
		} catch {
			ok = false;
		}
		this.checkedAt = Date.now();
		this.set(ok);
		this.schedule(ok ? 6000 : 2500);
	}
}

export const net = new Net();
